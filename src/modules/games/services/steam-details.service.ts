import { Injectable, OnModuleInit } from '@nestjs/common'
import { filter, from, mergeMap, of, switchMap, tap, timer, toArray } from 'rxjs'
import { GameLibraryService } from './game-library.service.js'
import { SteamService } from './steam.service.js'
import { GameMergeData, SteamAppDetailsResolved } from '../types/games.types.js'
import { CacheService } from '../../app/services/cache.service.js'
import { TrackingService } from '../../app/services/tracking.service.js'
import { AppLogger } from '../../app/services/logger.service.js'

@Injectable()
export class SteamDetailsService implements OnModuleInit {
  public steamDetails = new Map<number, SteamAppDetailsResolved>()

  constructor(
    private readonly gameLibraryService: GameLibraryService,
    private readonly steamService: SteamService,
    private readonly cacheService: CacheService,
    private readonly trackingService: TrackingService,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit() {
    this.cacheService
      .onCacheSet$<SteamAppDetailsResolved[]>()
      .pipe(filter((event) => event.key === 'steamDetails'))
      .subscribe((event) => {
        this.steamDetails = event.value.reduce((map, details) => {
          map.set(details.id, details)
          return map
        }, new Map<number, SteamAppDetailsResolved>())
        this.logger.log(`Local steam details updated (${event.value.length})`, SteamDetailsService.name)
      })

    this.cacheService
      .onCacheVerified$()
      .pipe(
        filter((d) => d.key === 'steamGames'),
        tap(() => this.logger.log('Steam games cache verified, syncing details...', SteamDetailsService.name)),
        switchMap(() => this.syncGameDetails(this.gameLibraryService.games)),
      )
      .subscribe()

    timer(this.cacheService.cacheExpireTimes.steamDetails, this.cacheService.cacheExpireTimes.steamDetails)
      .pipe(switchMap(() => this.syncGameDetails(this.gameLibraryService.games)))
      .subscribe()
  }

  private syncGameDetails(games: GameMergeData[]) {
    return of(games).pipe(
      filter((games) => games.length > 0),
      switchMap((games) => {
        const validGames = games.filter((game) => game.id > 0)

        return this.cacheService.get<SteamAppDetailsResolved[]>('steamDetails').pipe(
          switchMap((cache) => {
            if (cache == null || this.cacheService.hasExpired('steamDetails', cache.timestamp)) {
              this.logger.log(`Steam details cache is ${cache == null ? 'missing' : 'expired'}, starting full cache...`, SteamDetailsService.name)

              return this.appDetailsCache(validGames, true)
            }

            const cachedIds = new Set(cache.data.map((detail) => detail.id))
            const newGames = validGames.filter((game) => !cachedIds.has(game.id))

            if (newGames.length === 0) {
              this.logger.log(`Steam details cache is up to date`, SteamDetailsService.name)

              return of(null)
            }

            this.logger.log(`Found ${newGames.length} new games to cache details`, SteamDetailsService.name)

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
                SteamDetailsService.name,
              )
            }),
          ),
        Infinity,
      ),
      toArray(),
      switchMap((details) => this.updateSteamDetailsCache(details, force)),
      tap(() =>
        this.logger.log(
          `Steam details cached successfully (${ids.length} games) - elapsed: ${this.formatElapsed(Date.now() - startedAt)}`,
          SteamDetailsService.name,
        ),
      ),
      this.trackingService.trackError('SteamDetailsService:appDetailsCache'),
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
}
