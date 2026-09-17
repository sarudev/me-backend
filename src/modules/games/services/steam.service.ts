import { Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { BehaviorSubject, catchError, filter, forkJoin, interval, map, of, switchMap, take, tap, timer } from 'rxjs'
import {
  IGetItems,
  IGetOwnedGames,
  IGetPlayerSummaries,
  ISteamUser,
  ISteamUserStatsv1,
  ISteamUserStatsv2,
  IStoreBrowseService,
  type IPlayerServiceResponse,
  SteamProfile,
  SteamGameAssets,
  SteamOwnedGame,
  GameMergeData,
  SteamAccountData,
  SteamAppDetails,
  SteamAppDetailsResolved,
} from '../types/games.types.js'
import { UtilsService } from '../../app/services/utils.service.js'
import { STEAM_ACCOUNTS } from '../../../assets/accounts.js'
import { CacheService } from '../../app/services/cache.service.js'
import { TrackingService } from '../../app/services/tracking.service.js'
import { EnvService } from '../../app/services/env.service.js'
import { AppLogger } from '../../app/services/logger.service.js'
import { BLACKLIST } from '../../../assets/blacklist.js'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

@Injectable()
export class SteamService {
  private readonly apiUrl = 'https://api.steampowered.com'
  private readonly gamesCached$ = new BehaviorSubject<boolean>(false)

  constructor(
    private readonly httpService: HttpService,
    private readonly env: EnvService,
    private readonly utils: UtilsService,
    private readonly cacheService: CacheService,
    private readonly trackingService: TrackingService,
    private readonly logger: AppLogger,
  ) {}

  public get ownedGames$() {
    return this.cacheService.get<SteamOwnedGame[]>('steamGames').pipe(map((res) => res?.data ?? []))
  }

  onModuleInit() {
    this.cronPlayerInfoCache()
    this.cronPlayerGamesCache()
  }

  private cronPlayerInfoCache() {
    timer(0, this.utils.cacheExpireTimes.steamAccounts)
      .pipe(
        switchMap(() => this.playerInfoCache()),
        this.trackingService.trackError('SteamService:cronPlayerInfoCache'),
      )
      .subscribe()
  }

  private playerInfoCache() {
    return this.cacheService.cache('steamAccounts', this.getPlayersInfo(STEAM_ACCOUNTS), {
      onGet: () => this.logger.log('Looking for accounts...', SteamService.name),
      onFetching: () => this.logger.log(`Fetching accounts from Steam API...`, SteamService.name),
      onAlreadyCached: (cache) => this.logger.log(`Accounts already cached (${cache?.length ?? 0})`, SteamService.name),
      onCaching: (cur, old) => this.logger.log(`Fetched ${cur.length} accounts (${old?.length ?? 0} before), caching...`, SteamService.name),
      onCached: () => this.logger.log(`Accounts cached successfully`, SteamService.name),
    })
  }

  private cronPlayerGamesCache() {
    timer(0, this.utils.cacheExpireTimes.steamGames)
      .pipe(
        switchMap(() => this.playerGamesCache()),
        this.trackingService.trackError('SteamService:cronPlayerGamesCache'),
      )
      .subscribe({
        next: () => this.gamesCached$.next(true),
        error: () => this.gamesCached$.next(false),
      })
  }

  private playerGamesCache() {
    return this.cacheService.cache<SteamOwnedGame[]>('steamGames', this.fetchOwnedGames(), {
      onGet: () => {
        this.gamesCached$.next(false)
        this.logger.log('Looking for games...', SteamService.name)
      },
      onFetching: () => this.logger.log('Fetching games from Steam API...', SteamService.name),
      onAlreadyCached: (cache) => this.logger.log(`Games already cached (${cache?.length ?? 0})`, SteamService.name),
      onCaching: (cur, old) => this.logger.log(`Fetched ${cur.length} games (${old?.length ?? 0} before), caching...`, SteamService.name),
      onCached: () => this.logger.log(`Games cached successfully`, SteamService.name),
    })
  }

  private fetchOwnedGames() {
    return forkJoin(STEAM_ACCOUNTS.map((account) => this.getPlayerGames(account))).pipe(
      map((games) => [
        ...games
          .flat()
          .reduce((map, game) => {
            const existing = map.get(game.id)

            if (!existing) {
              map.set(game.id, game)
              return map
            }

            existing.playtime += game.playtime

            return map
          }, new Map<number, SteamOwnedGame>())
          .values(),
      ]),
      map((games) => games.filter((game) => !BLACKLIST.includes(game.id))),
    )
  }

  public fetchGames() {
    return forkJoin({
      accounts: this.accounts$,
      games: this.ownedGames$,
    }).pipe(
      map(({ accounts, games }) =>
        games.map((game) => {
          const profile = accounts.find((a) => a.steamid === (game.id === 730 ? '76561198896706454' : game.steamid))!

          return {
            id: game.id,
            name: game.name,
            playtime: game.playtime,
            account: {
              type: 'steam',
              data: profile,
            } satisfies SteamAccountData,
          } satisfies GameMergeData
        }),
      ),
      this.trackingService.trackError('MainService:fetchGames'),
    )
  }

  public fetchAppDetails(id: number) {
    return this.httpService
      .get<{ [key: number]: SteamAppDetails }>(`https://store.steampowered.com/api/appdetails`, {
        params: {
          appids: id,
          cc: 'ar',
          l: 'spanish',
        },
      })
      .pipe(
        map((response) => response.data),
        map((details) => Object.values(details)),
        map((details) =>
          details.map<SteamAppDetailsResolved>((d) => ({
            id: d.data.steam_appid,
            description: d.data.short_description,
            is_free: d.data.is_free,
            name: d.data.name,
            price: d.data.is_free ? 'Free' : (d.data.price_overview?.final_formatted ?? 'Free'),
          })),
        ),
      )
  }

  public get accounts$() {
    return this.cacheService.get<SteamProfile[]>('steamAccounts').pipe(map((res) => res?.data ?? []))
  }

  public get mainAccountSteamId() {
    return '76561198963704471'
  }

  public getPlayersInfo(ids: string[]) {
    return this.getPlayerSummaries(ids).pipe(
      map((accounts) =>
        accounts.map(
          (a) =>
            ({
              icon: a.avatarfull,
              name: a.personaname,
              url: a.profileurl,
              steamid: a.steamid,
            }) satisfies SteamProfile,
        ),
      ),
      this.trackingService.trackError('SteamService:getPlayersInfo'),
    )
  }

  public getPlayerSummaries(ids: string[]) {
    const url = `${this.apiUrl}/ISteamUser/GetPlayerSummaries/v0002/`
    return this.httpService
      .get<ISteamUser>(url, {
        params: {
          key: this.env.STEAM_API_KEY,
          steamids: ids.join(','),
        },
      })
      .pipe(
        this.trackingService.trackError('SteamService:getPlayerSummaries'),
        map((response) => response.data),
        map<ISteamUser, IGetPlayerSummaries[]>((r) => {
          return r.response.players.map((p) => ({
            avatar: p.avatar,
            avatarfull: p.avatarfull,
            personaname: p.personaname,
            profileurl: p.profileurl,
            steamid: p.steamid,
          }))
        }),
      )
  }

  private getPlayerGames(id: string) {
    const url = `${this.apiUrl}/IPlayerService/GetOwnedGames/v1/`
    return this.httpService
      .get<IPlayerServiceResponse>(url, {
        params: {
          key: this.env.STEAM_API_KEY,
          steamid: id,
          include_appinfo: true,
          include_played_free_games: true,
        },
      })
      .pipe(
        // this.trackingService.trackError('SteamService:getPlayerGames'),
        map((response) => response.data.response.games),
        map<IGetOwnedGames[], SteamOwnedGame[]>((games) =>
          games.map((g) => ({
            id: g.appid,
            name: g.name,
            playtime: g.playtime_forever,
            steamid: id,
          })),
        ),
      )
  }

  public fetchGameCovers(ids: number[]) {
    const input = {
      ids: ids.map((appid) => ({ appid })),
      context: {
        language: 'english',
        country_code: 'US',
        steam_realm: 1,
      },
      data_request: {
        include_assets: true,
      },
    }

    return this.httpService
      .get<IStoreBrowseService>('https://api.steampowered.com/IStoreBrowseService/GetItems/v1', {
        params: {
          input_json: JSON.stringify(input),
        },
      })
      .pipe(
        map((response) => response.data.response.store_items),
        map<IGetItems[], SteamGameAssets[]>((games) =>
          games.map((g) => {
            const baseUrl = 'https://shared.akamai.steamstatic.com/store_item_assets'
            const assetUrl = `${baseUrl}/${g.assets.asset_url_format}`
            const replace = (filename: string) => (filename == null ? null : assetUrl.replace('${FILENAME}', filename))

            return {
              id: g.appid,
              assets: {
                header: replace(g?.assets?.header) ?? `${this.env.BACKEND_URL}/images/game_images/placeholder/header.png`,
                library: replace(g?.assets?.library_capsule) ?? `${this.env.BACKEND_URL}/images/game_images/placeholder/library.png`,
              },
            }
          }),
        ),
        this.trackingService.trackError('SteamService:fetchGameCovers'),
      )
  }

  public getGamePlatinumPercentage(steamId: string, appId: number) {
    return forkJoin({
      schema: this.getSchema(appId),
      player: this.getPlayerAchievements(steamId, appId),
    }).pipe(
      this.trackingService.trackError('SteamService:getGamePlatinumPercentage'),
      map(({ schema, player }) => {
        const total = schema?.length ?? 0
        const unlocked = player?.filter(({ achieved }) => achieved === 1).length

        if (total === 0 || unlocked == null) return null

        return {
          unlocked,
          total,
          percentage: total > 0 ? (unlocked / total) * 100 : 0,
        }
      }),
    )
  }

  private getSchema(appid: number) {
    const url = `${this.apiUrl}/ISteamUserStats/GetSchemaForGame/v2/`
    return this.httpService
      .get<ISteamUserStatsv2>(url, {
        params: {
          key: this.env.STEAM_API_KEY,
          appid,
        },
      })
      .pipe(
        this.trackingService.trackError('SteamService:getSchema'),
        map((response) => response.data),
        map((data) => data?.game?.availableGameStats?.achievements ?? null),
      )
  }

  private getPlayerAchievements(steamId: string, appid: number) {
    const url = `${this.apiUrl}/ISteamUserStats/GetPlayerAchievements/v1/`

    return this.httpService
      .get<ISteamUserStatsv1>(url, {
        params: {
          key: this.env.STEAM_API_KEY,
          steamid: steamId,
          appid,
        },
      })
      .pipe(
        catchError((error) => {
          if (!(error.response?.data?.playerstats?.success ?? false)) return of(null)

          throw error
        }),
        this.trackingService.trackError('SteamService:getPlayerAchievements'),
        map((response) => response?.data),
        map((data) => data?.playerstats?.achievements ?? null),
      )
  }

  public getGameCovers(ids: number[]) {
    return ids.map((id) => this.getGameCover(id))
  }

  public hasCoverCached(id: number) {
    return existsSync(join('src/assets/images/game_images', `${id}/header.png`)) && existsSync(join('src/assets/images/game_images', `${id}/library.png`))
  }

  public getGameCover(id: number) {
    const placeholders = {
      header: `${this.env.BACKEND_URL}/images/game_images/placeholder/header.png`,
      library: `${this.env.BACKEND_URL}/images/game_images/placeholder/library.png`,
    }

    return {
      id,
      header: existsSync(join('src/assets/images/game_images', `${id}/header.png`))
        ? `${this.env.BACKEND_URL}/images/game_images/${id}/header.png`
        : placeholders.header,
      library: existsSync(join('src/assets/images/game_images', `${id}/library.png`))
        ? `${this.env.BACKEND_URL}/images/game_images/${id}/library.png`
        : placeholders.library,
    }
  }
}
