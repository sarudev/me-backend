import { Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { BehaviorSubject, catchError, filter, forkJoin, interval, map, of, switchMap, take, timer } from 'rxjs'
import {
  IGetItems,
  IGetOwnedGames,
  IGetPlayerSummaries,
  ISteamUser,
  ISteamUserStatsv1,
  ISteamUserStatsv2,
  IStoreBrowseService,
  type IPlayerServiceResponse,
} from '../types/steam.types.js'
import { SteamProfile, SteamGameAssets, SteamOwnedGame, GameMergeData, SteamAccountData } from '../../app/types/app.types.js'
import { UtilsService } from '../../app/services/utils.service.js'
import { cacheCovers } from '../../../assets/images/game_images/cache.js'
import { steamAccounts } from '../../../assets/accounts.js'
import { CacheService } from '../../app/services/cache.service.js'
import { TrackingService } from '../../app/services/tracking.service.js'
import { EnvService } from '../../app/services/env.service.js'
import { AppLogger } from '../../app/services/logger.service.js'
import { BLACKLIST } from '../../../assets/blacklist.js'

@Injectable()
export class SteamService {
  private readonly steamApiUrl = 'https://api.steampowered.com'
  private readonly steamAccountsCached = new BehaviorSubject<boolean>(false)

  constructor(
    private readonly httpService: HttpService,
    private readonly env: EnvService,
    private readonly utils: UtilsService,
    private readonly cacheService: CacheService,
    private readonly trackingService: TrackingService,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit() {
    interval(1000)
      .pipe(switchMap(() => this.cacheService.get<SteamProfile[]>('steamAccounts')))
      .subscribe((res) => {
        this.steamAccountsCached.next(!this.utils.isExpired(res?.timestamp ?? 0))
      })
    timer(0, this.utils.expireTime)
      .pipe(
        switchMap(() =>
          this.cacheService.cache('steamAccounts', this.getPlayersInfo(steamAccounts), {
            onGet: () => this.logger.log('Looking if steam accounts are expired...', SteamService.name),
            onAlreadyCached: (data) => this.logger.log(`Steam accounts cached: ${data.length} accounts`, SteamService.name),
            onFetching: () => this.logger.log('Steam accounts expired, fetching from Steam API...', SteamService.name),
            onCaching: (res) => this.logger.log(`Fetched ${res.length} steam accounts, caching...`, SteamService.name),
            onCached: (data) => this.logger.log(`Steam accounts cached successfully: ${data.length} accounts`, SteamService.name),
          }),
        ),
      )
      .subscribe({
        next: () => this.steamAccountsCached.next(true),
        error: () => this.steamAccountsCached.next(false),
      })

    timer(0, this.utils.expireTime)
      .pipe(
        switchMap(() => this.whenReady$),
        switchMap(() =>
          this.cacheService.cache<GameMergeData[]>(
            'steamGames',
            this.fetchSteamGames().pipe(this.trackingService.trackError('SteamService:fetchSteamGames')),
            {
              onGet: () => this.logger.log('Looking if steam games are expired...', SteamService.name),
              onAlreadyCached: (res) => this.logger.log(`Steam games cached: ${res!.length} games`, SteamService.name),
              onFetching: () => this.logger.log('Steam games expired, fetching from Steam API...', SteamService.name),
              onCaching: (res) => this.logger.log(`Fetched ${res.length} steam games, caching...`, SteamService.name),
              onCached: (res) => this.logger.log(`Steam games cached successfully: ${res.length} games.`, SteamService.name),
            },
          ),
        ),
      )
      .subscribe()
  }

  public get whenReady$() {
    return this.areSteamAccountsValid$.pipe(this.utils.whenReady())
  }

  private fetchSteamGames() {
    return forkJoin({
      accounts: this.accounts,
      games: forkJoin(steamAccounts.map((account) => this.getPlayerGames(account))),
    }).pipe(
      map(({ accounts, games }) => {
        return games
          .flat()
          .filter((g) => !BLACKLIST.includes(g.id))
          .reduce((map, game) => {
            const existing = map.get(game.id)
            const steamAcc = accounts.find((a) => a.steamid === (game.id === 730 ? '76561198896706454' : game.steamAccount))!
            const account = {
              type: 'steam',
              data: steamAcc,
            } satisfies SteamAccountData

            if (!existing) {
              map.set(game.id, {
                id: game.id,
                name: game.name,
                playtime: game.playtime_forever,
                account: account,
              })

              return map
            }

            existing.playtime += game.playtime_forever
            existing.account = account

            return map
          }, new Map<number, GameMergeData>())
          .values()
      }),
      map((games) => [...games]),
      this.trackingService.trackError('MainService:fetchSteamGames'),
    )
  }

  public getGames() {
    return this.cacheService.get<GameMergeData[]>('steamGames').pipe(map((res) => res?.data ?? []))
  }

  public get areSteamAccountsValid$() {
    return this.steamAccountsCached.asObservable()
  }

  public get accounts() {
    return this.cacheService.get<SteamProfile[]>('steamAccounts').pipe(map((res) => res?.data ?? []))
  }

  public get mainAccountSteamId() {
    return '76561198963704471'
  }

  public getPlayersInfo(steamIds: string[]) {
    return this.getPlayerSummaries(steamIds).pipe(
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

  public getPlayerSummaries(steamIds: string[]) {
    const url = `${this.steamApiUrl}/ISteamUser/GetPlayerSummaries/v0002/`
    return this.httpService
      .get<ISteamUser>(url, {
        params: {
          key: this.env.STEAM_API_KEY,
          steamids: steamIds.join(','),
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

  public getPlayerGames(steamId: string) {
    const url = `${this.steamApiUrl}/IPlayerService/GetOwnedGames/v1/`
    return this.httpService
      .get<IPlayerServiceResponse>(url, {
        params: {
          key: this.env.STEAM_API_KEY,
          steamid: steamId,
          include_appinfo: true,
          include_played_free_games: true,
        },
      })
      .pipe(
        this.trackingService.trackError('SteamService:getPlayerGames'),
        map((response) => response.data.response.games),
        map<IGetOwnedGames[], SteamOwnedGame[]>((games) =>
          games.map((g) => ({
            id: g.appid,
            name: g.name,
            playtime_forever: g.playtime_forever,
            steamAccount: steamId,
          })),
        ),
      )
  }

  private getLocalCover(appid: number) {
    return of<SteamGameAssets>({
      id: appid,
      assets: this.utils.images[appid],
    })
  }

  public getGameImages(appid: number) {
    if (appid < 0) {
      return this.getLocalCover(appid)
    }

    const cache = cacheCovers.find((cover) => cover.id === appid)
    if (cache != null) {
      return of<SteamGameAssets>(cache)
    }

    const input = {
      ids: [{ appid }],
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
        this.trackingService.trackError('SteamService:getGameImages'),
        map((response) => response.data.response.store_items[0]),
        map<IGetItems, SteamGameAssets>((g) => {
          const baseUrl = 'https://shared.akamai.steamstatic.com/store_item_assets'
          const assetUrl = `${baseUrl}/${g.assets.asset_url_format}`
          const replace = (filename: string) => (filename == null ? null : assetUrl.replace('${FILENAME}', filename))

          return {
            id: g.appid,
            assets: {
              header: replace(g?.assets?.header) ?? this.utils.images.placeholder.header,
              library: replace(g?.assets?.library_capsule) ?? this.utils.images.placeholder.library,
            },
          }
        }),
        catchError(() => this.getLocalCover(appid)),
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
    const url = `${this.steamApiUrl}/ISteamUserStats/GetSchemaForGame/v2/`
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
    const url = `${this.steamApiUrl}/ISteamUserStats/GetPlayerAchievements/v1/`

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
}
