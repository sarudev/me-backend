import { Injectable, OnModuleInit } from '@nestjs/common'
import { EMPTY, filter, from, map, mergeMap, of, switchMap, tap, timer, toArray } from 'rxjs'
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
    private readonly logger: AppLogger,
  ) {}

  onModuleInit() {
    this.cacheService
      .onCacheVerified$<SteamAppDetailsResolved[]>()
      .pipe(
        filter((event) => event.key === 'steamDetails'),
        map((event) => event.value.new!),
      )
      .subscribe((value) => {
        this.steamDetails = value.reduce((map, details) => {
          map.set(details.id, details)
          return map
        }, new Map<number, SteamAppDetailsResolved>())
        this.logger.log(`Local steam details updated (${value.length})`, SteamDetailsService.name)
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
    if (games.length === 0) return EMPTY

    const validGames = games.filter((game) => game.id > 0)
    const startedAt = Date.now()

    return this.cacheService.reconcile<SteamAppDetailsResolved, GameMergeData>('steamDetails', validGames, {
      sourceId: (game) => game.id,
      cachedId: (details) => details.id,
      onAlreadyCached: () => this.logger.log(`Steam details cache is up to date`, SteamDetailsService.name),
      fetch: (games, mode) => {
        const ids = games.map((game) => game.id)

        this.logger.log(`Caching ${ids.length} steam game details (${mode})...`, SteamDetailsService.name)

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
          tap(() =>
            this.logger.log(
              `Steam details cached successfully (${ids.length} games) - elapsed: ${this.formatElapsed(Date.now() - startedAt)}`,
              SteamDetailsService.name,
            ),
          ),
        )
      },
      merge: (current, fetched, mode) => {
        if (mode === 'full') {
          return fetched
        }

        const detailsById = new Map(current.map((details) => [details.id, details]))

        fetched.forEach((details) => detailsById.set(details.id, details))

        return [...detailsById.values()]
      },
    })
  }

  private formatElapsed(milliseconds: number) {
    const seconds = milliseconds / 1_000

    return seconds > 60 ? `${(seconds / 60).toFixed(2)}m` : `${seconds.toFixed(2)}s`
  }
}
