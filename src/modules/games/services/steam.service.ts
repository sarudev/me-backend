import { Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { catchError, filter, forkJoin, map, of, switchMap, timer } from 'rxjs'
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
  SteamAppDetails,
  SteamAppDetailsResolved,
} from '../types/games.types.js'
import { STEAM_ACCOUNTS } from '../../../assets/accounts.js'
import { CacheService } from '../../app/services/cache.service.js'
import { TrackingService } from '../../app/services/tracking.service.js'
import { EnvService } from '../../app/services/env.service.js'
import { AppLogger } from '../../app/services/logger.service.js'
import { BLACKLIST } from '../../../assets/blacklist.js'

@Injectable()
export class SteamService {
  private readonly apiUrl = 'https://api.steampowered.com'
  public ownedGames: GameMergeData[] = []
  public accounts = new Map<string, SteamProfile>()

  constructor(
    private readonly httpService: HttpService,
    private readonly env: EnvService,
    private readonly cacheService: CacheService,
    private readonly trackingService: TrackingService,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit() {
    this.cronAccountsCache()
    this.cronGamesCache()

    this.cacheService
      .onCacheVerified$<SteamProfile[]>()
      .pipe(
        filter((event) => event.key === 'steamAccounts'),
        map((event) => event.value.new!),
      )
      .subscribe((value) => {
        this.accounts = value.reduce((map, account) => {
          const existing = map.get(account.steamid)

          if (!existing) {
            map.set(account.steamid, account)
            return map
          }

          return map
        }, new Map<string, SteamProfile>())
        this.logger.log(`Local accounts updated (${value.length})`, SteamService.name)

        this.syncGamesCache().subscribe()
      })

    this.cacheService
      .onCacheVerified$<SteamOwnedGame[]>()
      .pipe(
        filter((event) => event.key === 'steamGames'),
        map((event) => event.value.new!),
      )
      .subscribe((value) => {
        this.ownedGames = value.map<GameMergeData>((game) => ({
          id: game.id,
          name: game.name,
          playtime: game.playtime,
          account: {
            type: 'steam',
            data: this.accounts.get(game.steamid)!,
          },
        }))
        this.logger.log(`Local owned games updated (${value.length})`, SteamService.name)
      })
  }

  private cronAccountsCache() {
    timer(0, this.cacheService.cacheExpireTimes.steamAccounts)
      .pipe(
        switchMap(() => this.syncAccountsCache()),
        this.trackingService.trackError('SteamService:cronAccountsCache'),
      )
      .subscribe()
  }

  private syncAccountsCache() {
    return this.cacheService.cache('steamAccounts', this.getPlayersInfo(STEAM_ACCOUNTS), {
      onGet: () => this.logger.log('Looking for accounts...', SteamService.name),
      onFetching: () => this.logger.log(`Fetching accounts from Steam API...`, SteamService.name),
      onAlreadyCached: (cache) => this.logger.log(`Accounts already cached (${cache?.length ?? 0})`, SteamService.name),
      onCached: (data) => this.logger.log(`Cached ${data.length} accounts successfully`, SteamService.name),
    })
  }

  private cronGamesCache() {
    timer(this.cacheService.cacheExpireTimes.steamGames, this.cacheService.cacheExpireTimes.steamGames)
      .pipe(
        switchMap(() => this.syncGamesCache()),
        this.trackingService.trackError('SteamService:cronPlayerGamesCache'),
      )
      .subscribe()
  }

  private syncGamesCache() {
    return this.cacheService.cache<SteamOwnedGame[]>('steamGames', this.fetchOwnedGames(), {
      onGet: () => this.logger.log('Looking for games...', SteamService.name),
      onFetching: () => this.logger.log('Fetching games from Steam API...', SteamService.name),
      onAlreadyCached: (cache) => this.logger.log(`Games already cached (${cache?.length ?? 0})`, SteamService.name),
      onCached: (data) => this.logger.log(`Cached ${data.length} games successfully`, SteamService.name),
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
      map((games) => games.filter((game) => !BLACKLIST.has(game.id))),
    )
  }

  public fetchAppDetails(id: number) {
    return this.httpService
      .get<{ [key: number]: SteamAppDetails }>('https://store.steampowered.com/api/appdetails', {
        params: {
          appids: id,
          cc: 'ar',
          l: 'spanish',
        },
      })
      .pipe(
        map((response) => Object.values(response.data)[0]),
        map((d): SteamAppDetailsResolved => ({
          id: d.data.steam_appid,
          description: d.data.short_description,
          is_free: d.data.is_free,
          name: d.data.name,
          price: d.data.is_free ? 'Free' : (d.data.price_overview?.final_formatted ?? 'Free'),
        })),
      )
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

  public getGameCover(id: number, hasCover: boolean) {
    const placeholders = {
      header: `${this.env.BACKEND_URL}/images/game_images/placeholder/header.png`,
      library: `${this.env.BACKEND_URL}/images/game_images/placeholder/library.png`,
    }

    if (!hasCover) return placeholders

    return {
      header: `${this.env.BACKEND_URL}/images/game_images/${id}/header.png`,
      library: `${this.env.BACKEND_URL}/images/game_images/${id}/library.png`,
    }
  }
}
