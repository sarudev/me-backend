import { Injectable } from '@nestjs/common'
import { SteamService } from './steam.service.js'
import { DiscordService } from '../../app/services/discord.service.js'
import { catchError, filter, forkJoin, from, map, mergeMap, of, switchMap, tap, timer, toArray } from 'rxjs'
import { UtilsService } from '../../app/services/utils.service.js'
import {
  GameAccount,
  GameMergeData,
  SteamAppDetails,
  SteamAppDetailsData,
  SteamAppDetailsResolved as SteamAppDetailsResolved,
  SteamOwnedGame,
  SteamProfile,
} from '../types/games.types.js'
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
    this.cacheService
      .onCacheVerified$()
      .pipe(
        filter((d) => d.key === 'steamGames'),
        switchMap(() => this.getGamesData()),
        switchMap((games) => this.syncGamesCovers(games)),
      )
      .subscribe()

    timer(this.utils.cacheExpireTimes.steamCovers, this.utils.cacheExpireTimes.steamCovers)
      .pipe(
        switchMap(() => this.getGamesData()),
        switchMap((games) => this.syncGamesCovers(games)),
      )
      .subscribe()
  }

  private syncGamesCovers(games: GameMergeData[]) {
    const games$ = of(games)

    return games$.pipe(
      filter((games) => games.length > 0),
      switchMap((games) => {
        const validGames = games.filter((game) => game.id > 0)

        return this.cacheService.get<number[]>('steamCovers').pipe(
          switchMap((cache) => {
            if (cache == null || this.utils.hasExpired('steamCovers', cache.timestamp)) {
              this.logger.log(`Steam covers cache is ${cache == null ? 'missing' : 'expired'}, starting full cache...`, GamesService.name)

              return this.gamesCoversCache(validGames, true)
            }

            const cachedIds = new Set(cache.data)
            const newGames = validGames.filter((game) => !cachedIds.has(game.id))

            if (newGames.length === 0) {
              this.logger.log(`Steam covers cache is up to date`, GamesService.name)

              return of(null)
            }

            this.logger.log(`Found ${newGames.length} new games to cache covers`, GamesService.name)

            return this.gamesCoversCache(newGames, false)
          }),
        )
      }),
    )
  }

  private gamesCoversCache(games: GameMergeData[], force = false) {
    const ids = games.map((game) => game.id)

    if (ids.length === 0) {
      return of(null)
    }

    const gameNames = new Map(games.map((game) => [game.id, game.name]))

    const failedCovers: number[] = []

    return this.getGameCoversToCache(ids, force).pipe(
      switchMap((covers) => {
        const total = covers.length

        if (total === 0) {
          this.logger.log(`No new games to cache covers for`, GamesService.name)

          return of(null)
        }

        this.logger.log(`Caching ${total} game covers...`, GamesService.name)

        let processed = 0
        let nextProgress = 50
        let consecutiveFailures = 0

        return from(covers).pipe(
          mergeMap(
            (cover) =>
              forkJoin({
                header: this.utils.downloadAndSaveImage(cover.assets.header, `game_images/${cover.id}/header.png`),
                library: this.utils.downloadAndSaveImage(cover.assets.library, `game_images/${cover.id}/library.png`),
              }).pipe(
                map(() => ({
                  success: true,
                  cover,
                })),
                catchError(() =>
                  of({
                    success: false,
                    cover,
                  }),
                ),
              ),
            10,
          ),
          tap(({ success, cover }) => {
            processed++

            if (success) {
              consecutiveFailures = 0
            } else {
              consecutiveFailures++

              failedCovers.push(cover.id)

              this.logger.warn(
                `Failed to cache covers for game ${cover.id}` +
                  `${gameNames.get(cover.id) ? ` (${gameNames.get(cover.id)})` : ''} ` +
                  `(consecutive failures: ${consecutiveFailures})`,
                GamesService.name,
              )

              if (consecutiveFailures >= 3) {
                throw new Error('Three consecutive game cover downloads failed')
              }
            }

            if (processed >= nextProgress || processed === total) {
              const progress = Math.floor((processed / total) * 100)

              this.logger.log(
                `Cover caching progress: ${progress}% ` + `(${processed}/${total} games, ${processed * 2}/${total * 2} images)`,
                GamesService.name,
              )

              nextProgress += 50
            }
          }),
          filter(({ success }) => success),
          map(({ cover }) => cover.id),
          toArray(),
          switchMap((cachedIds) => this.updateSteamCoversCache(cachedIds, force)),
        )
      }),
      catchError((error) => {
        if (failedCovers.length > 0) {
          this.notifyCoverFailures(failedCovers, error)
        }

        throw error
      }),
      tap(() => {
        if (failedCovers.length > 0) {
          this.notifyCoverFailures(failedCovers)
        }
      }),
      this.trackingService.trackError('SteamService:gamesCoversCache'),
    )
  }

  private getGameCoversToCache(ids: number[], force: boolean) {
    if (force) {
      return this.fetchAllGameCovers(ids)
    }

    return this.cacheService.get<number[]>('steamCovers').pipe(
      map((cache) => {
        const cachedIds = new Set(cache?.data ?? [])

        return ids.filter((id) => !cachedIds.has(id))
      }),
      switchMap((newIds) => this.fetchAllGameCovers(newIds)),
    )
  }

  private updateSteamCoversCache(cachedIds: number[], force = false) {
    if (cachedIds.length === 0) {
      return of(null)
    }

    return this.cacheService.get<number[]>('steamCovers').pipe(
      switchMap((cache) => {
        const currentIds = cache?.data ?? []

        const ids = [...new Set([...currentIds, ...cachedIds])]

        return this.cacheService.set('steamCovers', ids, !force)
      }),
    )
  }

  private fetchAllGameCovers(ids: number[]) {
    if (ids.length === 0) {
      return of([])
    }

    const chunks = Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) => ids.slice(i * 100, (i + 1) * 100))

    this.logger.log(`Fetching covers for ${ids.length} games in ${chunks.length} batches...`, GamesService.name)

    return from(chunks).pipe(
      mergeMap((chunk) => this.steamService.fetchGameCovers(chunk), 3),
      toArray(),
      map((covers) => covers.flat()),
    )
  }

  private notifyCoverFailures(failedCovers: number[], error?: Error) {
    if (failedCovers.length === 0 && !error) {
      return
    }

    const lines = failedCovers.map((id) => `- ${id}`)

    const message = [
      `Steam cover caching ${error ? 'failed' : 'completed with errors'}.`,
      `Failed games: ${failedCovers.length}`,
      '',
      ...lines,
      ...(error ? ['', `Error: ${error.message}`] : []),
    ].join('\n')

    this.trackingService.notify(message)
  }

  private appDetailsCache(ids: number[]) {
    return from(ids).pipe(
      mergeMap((id) => this.steamService.fetchAppDetails(id), 3),
      toArray(),
      this.trackingService.trackError('SteamService:appDetailsCache'),
    )
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
      map(({ games, states }) =>
        games.map((game) => {
          const cover = this.steamService.getGameCover(game.id)
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
            assets: {
              header: cover.header,
              library: cover.library,
            },
            account: game.account,
          }
        }),
      ),
      this.trackingService.trackError('GamesService:getGames'),
    )
  }

  public fetchGameDetails() {
    return this.getGamesData().pipe(switchMap((games) => this.appDetailsCache(games.filter((g) => g.id > 0).map((g) => g.id))))
  }

  public getDiscordProfilePicture() {
    return this.discordService.getProfilePicture()
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
