import { Injectable } from '@nestjs/common'
import { SteamService } from './steam.service.js'
import { DiscordService } from '../../app/services/discord.service.js'
import { forkJoin, map, of, switchMap } from 'rxjs'
import { UtilsService } from '../../app/services/utils.service.js'
import { GameAccount, GameMergeData, SteamGameAssets, Game } from '../../app/types/app.types.js'
import { epicGames, riotGames, xboxGames } from '../../../assets/games.js'
import { BLACKLIST } from '../../../assets/blacklist.js'
import { RanksService } from './ranks.service.js'
import { StateService } from './state.service.js'

@Injectable()
export class GamesService {
  constructor(
    private readonly steamService: SteamService,
    private readonly discordService: DiscordService,
    private readonly utils: UtilsService,
    private readonly ranksService: RanksService,
    private readonly stateService: StateService,
  ) {}

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
    return forkJoin([this.getRiotGames(), this.getEpicGames(), this.getXboxGames(), this.steamService.getGames()]).pipe(
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
