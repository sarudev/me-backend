import { Injectable } from '@nestjs/common'
import { SteamService } from './steam.service.js'
import { DiscordService } from '../../app/services/discord.service.js'
import { filter, forkJoin, from, map, mergeMap, of, switchMap, tap, timer, toArray } from 'rxjs'
import { UtilsService } from '../../app/services/utils.service.js'
import { GameAccount, GameMergeData, SteamGameAssets, Game, SteamOwnedGame, CacheSaveEvent } from '../../app/types/app.types.js'
import { epicGames, riotGames, xboxGames } from '../../../assets/games.js'
import { BLACKLIST } from '../../../assets/blacklist.js'
import { RanksService } from './ranks.service.js'
import { StateService } from './state.service.js'
import { TrackingService } from '../../app/services/tracking.service.js'
import { AppLogger } from '../../app/services/logger.service.js'
import { CacheService } from '../../app/services/cache.service.js'

@Injectable()
export class GamesService {
  constructor(
    private readonly steamService: SteamService,
    private readonly discordService: DiscordService,
    private readonly utils: UtilsService,
    private readonly ranksService: RanksService,
    private readonly stateService: StateService,
    private readonly trackingService: TrackingService,
    private readonly cacheService: CacheService,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit() {
    this.cronGamesCoversCache()
    this.cacheService.onCacheSaved$.pipe(filter((d) => d.key === 'steamGames')).subscribe(({ value }: CacheSaveEvent<SteamOwnedGame[]>) => {
      this.gamesCoversCache(value.new.filter((n) => !value.old?.some((o) => o.id === n.id)).map((g) => g.id))
    })
  }

  private cronGamesCoversCache() {
    timer(24 * 60 * 60 * 1000, this.utils.expireTime)
      .pipe(
        switchMap(() => this.getGamesData()),
        map((games) => games.filter((g) => g.id > 0).map((game) => game.id)),
      )
      .subscribe((g) => this.gamesCoversCache(g))
  }

  private gamesCoversCache(ids: number[]) {
    if (ids.length === 0) {
      this.logger.log(`No new games to cache covers for`, GamesService.name)
      return
    }

    const chunks = Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) => ids.slice(i * 100, (i + 1) * 100))

    this.logger.log(`Fetching covers for ${ids.length} games in ${chunks.length} batches...`, GamesService.name)

    from(chunks)
      .pipe(
        mergeMap((chunk) => this.steamService.getGameCovers(chunk), 3),
        toArray(),
        switchMap((covers) => {
          const allCovers = covers.flat()

          this.logger.log(`Caching ${allCovers.length} game covers...`, GamesService.name)

          return from(allCovers).pipe(
            mergeMap(
              (cover) =>
                forkJoin([
                  this.utils.downloadAndSaveImage(cover.assets.header, `game_images/${cover.id}/header.png`),
                  this.utils.downloadAndSaveImage(cover.assets.library, `game_images/${cover.id}/library.png`),
                ]),
              50,
            ),
            toArray(),
          )
        }),
        this.trackingService.trackError('SteamService:gamesCoversCache'),
      )
      .subscribe(() => this.logger.log(`Steam games covers cached successfully`, GamesService.name))
  }

  private getEpicGames() {
    return of(
      epicGames.map<GameMergeData>((g) => {
        return {
          account: {
            type: 'epic',
            data: '@topsaru',
          },
          id: g.id,
          name: g.name,
          playtime: g.playtime,
        }
      }),
    )
  }

  private getXboxGames() {
    return of(
      xboxGames.map<GameMergeData>((g) => {
        return {
          account: {
            type: 'xbox',
            data: '@sarudev',
          },
          id: g.id,
          name: g.name,
          playtime: g.playtime,
        }
      }),
    )
  }

  private getRiotGames() {
    return of(
      riotGames.map<GameMergeData>((g) => {
        return {
          account: {
            type: 'riot',
            data: g.id === -70 ? 'Sarudev#7278' : 'Saru#7278',
          },
          id: g.id,
          name: g.name,
          playtime: g.playtime,
        }
      }),
    )
  }

  private getGamesData() {
    return forkJoin([this.getRiotGames(), this.getEpicGames(), this.getXboxGames(), this.steamService.fetchGames()]).pipe(
      map((games) =>
        games
          .flat()
          .filter((g) => !BLACKLIST.includes(g.id))
          .reduce((map, game) => {
            const existing = map.get(game.id)
            const account = {
              type: [252950, -20].includes(game.id) ? 'epic' : game.account.type,
              data: [252950, -20].includes(game.id) ? '@topsaru' : game.account.data,
            } as GameAccount

            if (!existing) {
              map.set(game.id, {
                id: game.id,
                name: game.name,
                playtime: game.playtime,
                account: account,
              })

              return map
            }

            existing.playtime += game.playtime
            existing.account = account

            return map
          }, new Map<number, GameMergeData>())
          .values(),
      ),
      map((games) => [...games]),
      this.trackingService.trackError('GamesService:getGamesData'),
    )
  }

  public getGames() {
    return forkJoin({
      games: this.getGamesData(),
      states: this.stateService.getGameStates(),
    }).pipe(
      switchMap(({ games, states }) =>
        forkJoin(
          games.map((game) =>
            this.steamService.getGameImages(game.id).pipe(
              map<SteamGameAssets, Game>((cover) => {
                const state = states.find((s) => s.id === game.id)
                const gameState = {
                  isFavorite: state?.isFavorite ?? false,
                  isLoved: state?.isLoved ?? false,
                  platinumPercentage: state?.platinumPercentage ?? null,
                }

                const rank = this.ranksService.getGameRanksFor(game.id)
                const gameRank =
                  rank == null
                    ? null
                    : {
                        best: rank.best ?? null,
                        current: rank.current ?? null,
                      }

                return {
                  id: game.id,
                  name: game.name,
                  playtime: game.playtime,
                  state: gameState,
                  rank: gameRank,
                  assets: cover.assets,
                  account: game.account,
                }
              }),
            ),
          ),
        ),
      ),
      this.trackingService.trackError('GamesService:getGames'),
    )
  }

  public getDiscordProfilePicture() {
    return this.discordService.getProfilePicture().pipe(switchMap(this.utils.downloadAsBase64))
  }
}

/*
cs stats: https://csstats.gg/player/76561198896706454 (scraping)
valorant stats: https://tracker.gg/valorant/profile/riot/Saru%237278/overview (scraping)
lol stats: https://tracker.gg/lol/profile/riot/Sarudev%237278/overview (scraping)
fortnite stats: https://fortnitetracker.com/profile/all/topsaru (scraping)
rocket league stats: https://rocketleague.tracker.network/rocket-league/profile/epic/topsaru/overview (scraping)
brawlhalla: https://tracker.gg/brawlhalla/profile/29732203-/overview (scraping)
steam games: steam web api
*/
