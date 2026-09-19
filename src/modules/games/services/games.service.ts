import { Injectable } from '@nestjs/common'
import { SteamService } from './steam.service.js'
import { DiscordService } from '../../app/services/discord.service.js'
import { catchError, concatMap, filter, forkJoin, from, interval, map, mergeMap, of, switchMap, tap, timer, toArray, zipWith } from 'rxjs'
import { UtilsService } from '../../app/services/utils.service.js'
import { Game, GameAccount, GameMergeData, GameStateWithId, SteamAppDetailsResolved as SteamAppDetailsResolved } from '../types/games.types.js'
import { EPIC_GAMES, RIOT_GAMES, XBOX_GAMES } from '../../../assets/games.js'
import { BLACKLIST } from '../../../assets/blacklist.js'
import { RanksService } from './ranks.service.js'
import { TrackingService } from '../../app/services/tracking.service.js'
import { AppLogger } from '../../app/services/logger.service.js'
import { CacheService } from '../../app/services/cache.service.js'
import { StateService } from './state.service.js'

@Injectable()
export class GamesService {
  public steamCovers = new Set<number>()
  public steamDetails = new Map<number, SteamAppDetailsResolved>()

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
      .onCacheSet$<number[]>()
      .pipe(filter((event) => event.key === 'steamCovers'))
      .subscribe((event) => {
        this.steamCovers = new Set(event.value)
        this.logger.log(`Local steam covers updated (${event.value.length})`, GamesService.name)
      })

    this.cacheService
      .onCacheSet$<SteamAppDetailsResolved[]>()
      .pipe(filter((event) => event.key === 'steamDetails'))
      .subscribe((event) => {
        this.steamDetails = event.value.reduce((map, details) => {
          map.set(details.id, details)
          return map
        }, new Map<number, SteamAppDetailsResolved>())
        this.logger.log(`Local steam details updated (${event.value.length})`, GamesService.name)
      })

    this.cacheService
      .onCacheVerified$()
      .pipe(
        filter((d) => d.key === 'steamGames'),
        tap(() => this.logger.log('Steam games cache verified, syncing covers and details...', GamesService.name)),
        switchMap(() => forkJoin([this.syncGamesCovers(this.gamesMergeData), this.syncGameDetails(this.gamesMergeData)])),
      )
      .subscribe()

    timer(this.cacheService.cacheExpireTimes.steamCovers, this.cacheService.cacheExpireTimes.steamCovers)
      .pipe(switchMap(() => this.syncGamesCovers(this.gamesMergeData)))
      .subscribe()

    timer(this.cacheService.cacheExpireTimes.steamDetails, this.cacheService.cacheExpireTimes.steamDetails)
      .pipe(switchMap(() => this.syncGameDetails(this.gamesMergeData)))
      .subscribe()
  }

  //#region covers
  private syncGamesCovers(games: GameMergeData[]) {
    const games$ = of(games)

    return games$.pipe(
      filter((games) => games.length > 0),
      switchMap((games) => {
        const validGames = games.filter((game) => game.id > 0)

        return this.cacheService.get<number[]>('steamCovers').pipe(
          switchMap((cache) => {
            if (cache == null || this.cacheService.hasExpired('steamCovers', cache.timestamp)) {
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
  //#endregion covers

  //#region details
  private syncGameDetails(games: GameMergeData[]) {
    return of(games).pipe(
      filter((games) => games.length > 0),
      switchMap((games) => {
        const validGames = games.filter((game) => game.id > 0)

        return this.cacheService.get<SteamAppDetailsResolved[]>('steamDetails').pipe(
          switchMap((cache) => {
            if (cache == null || this.cacheService.hasExpired('steamDetails', cache.timestamp)) {
              this.logger.log(`Steam details cache is ${cache == null ? 'missing' : 'expired'}, starting full cache...`, GamesService.name)

              return this.appDetailsCache(validGames, true)
            }

            const cachedIds = new Set(cache.data.map((detail) => detail.id))
            const newGames = validGames.filter((game) => !cachedIds.has(game.id))

            if (newGames.length === 0) {
              this.logger.log(`Steam details cache is up to date`, GamesService.name)

              return of(null)
            }

            this.logger.log(`Found ${newGames.length} new games to cache details`, GamesService.name)

            return this.appDetailsCache(newGames)
          }),
        )
      }),
    )
  }

  private appDetailsCache(games: GameMergeData[], force = false) {
    const ids = games.map((game) => game.id)
    const startedAt = Date.now()

    if (ids.length === 0) {
      return of(null)
    }

    return from(ids).pipe(
      mergeMap(
        (id, index) =>
          timer(index * 1_550).pipe(
            switchMap(() => this.steamService.fetchAppDetails(id)),
            tap(() => {
              const processed = index + 1
              const progress = Math.floor((processed / ids.length) * 100)
              const elapsed = Date.now() - startedAt
              const average = elapsed / processed
              const remaining = average * (ids.length - processed)

              this.logger.log(
                `Steam details download progress: ${progress}% (${processed}/${ids.length} games) - elapsed: ${this.formatElapsed(elapsed)} - avg: ${this.formatElapsed(average)}/game - remaining: ${this.formatElapsed(remaining)}/game`,
                GamesService.name,
              )
            }),
          ),
        Infinity,
      ),
      toArray(),
      switchMap((details) => this.updateSteamDetailsCache(details, force)),
      tap(() =>
        this.logger.log(`Steam details cached successfully (${ids.length} games) - elapsed: ${this.formatElapsed(Date.now() - startedAt)}`, GamesService.name),
      ),
      this.trackingService.trackError('SteamService:appDetailsCache'),
    )
  }

  private formatElapsed(milliseconds: number) {
    const seconds = milliseconds / 1_000

    return seconds > 60 ? `${(seconds / 60).toFixed(2)}m` : `${seconds.toFixed(2)}s`
  }

  private updateSteamDetailsCache(details: SteamAppDetailsResolved[], force = false) {
    if (details.length === 0) {
      return of(null)
    }

    if (force) {
      return this.cacheService.set('steamDetails', details, false)
    }

    return this.cacheService.get<SteamAppDetailsResolved[]>('steamDetails').pipe(
      switchMap((cache) => {
        const currentDetails = cache?.data ?? []

        const detailsById = new Map(currentDetails.map((detail) => [detail.id, detail]))

        details.forEach((detail) => {
          detailsById.set(detail.id, detail)
        })

        return this.cacheService.set('steamDetails', [...detailsById.values()], true)
      }),
    )
  }
  //#endregion details

  //#region games
  private get gamesMergeData() {
    const games = [RIOT_GAMES, EPIC_GAMES, XBOX_GAMES, this.steamService.ownedGames]
      .flat()
      .filter((g) => !BLACKLIST.has(g.id))
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
      .values()

    return [...games]
  }

  public getGames() {
    return this.gamesMergeData.map<Game>(
      (game) =>
        ({
          id: game.id,
          name: game.name,
          playtime: game.playtime,
          state: this.stateService.states.get(game.id)!,
          rank: this.ranksService.getGameRanksFor(game.id),
          assets: this.steamService.getGameCover(game.id, this.steamCovers.has(game.id)),
          account: game.account,
          details: this.steamDetails.get(game.id) ?? null,
        }) satisfies Game,
    )
  }
  //#endregion games

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
