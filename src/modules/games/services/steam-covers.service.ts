import { Injectable, OnModuleInit } from '@nestjs/common'
import { catchError, filter, forkJoin, from, map, mergeMap, of, switchMap, tap, timer, toArray } from 'rxjs'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { GameLibraryService } from './game-library.service.js'
import { SteamService } from './steam.service.js'
import { GameMergeData } from '../types/games.types.js'
import { CacheService } from '../../app/services/cache.service.js'
import { TrackingService } from '../../app/services/tracking.service.js'
import { AppLogger } from '../../app/services/logger.service.js'
import { UtilsService } from '../../app/services/utils.service.js'
import { EnvService } from '../../app/services/env.service.js'

@Injectable()
export class SteamCoversService implements OnModuleInit {
  public steamCovers = new Set<number>()

  constructor(
    private readonly gameLibraryService: GameLibraryService,
    private readonly steamService: SteamService,
    private readonly cacheService: CacheService,
    private readonly trackingService: TrackingService,
    private readonly utils: UtilsService,
    private readonly env: EnvService,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit() {
    this.cacheService
      .onCacheSet$<number[]>()
      .pipe(filter((event) => event.key === 'steamCovers'))
      .subscribe((event) => {
        this.steamCovers = new Set(event.value)
        this.logger.log(`Local steam covers updated (${event.value.length})`, SteamCoversService.name)
      })

    this.cacheService
      .onCacheVerified$()
      .pipe(
        filter((d) => d.key === 'steamGames'),
        tap(() => this.logger.log('Steam games cache verified, syncing covers...', SteamCoversService.name)),
        switchMap(() => this.syncGamesCovers(this.gameLibraryService.games)),
      )
      .subscribe()

    timer(this.cacheService.cacheExpireTimes.steamCovers, this.cacheService.cacheExpireTimes.steamCovers)
      .pipe(switchMap(() => this.syncGamesCovers(this.gameLibraryService.games)))
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
            if (cache == null || this.cacheService.hasExpired('steamCovers', cache.timestamp)) {
              this.logger.log(`Steam covers cache is ${cache == null ? 'missing' : 'expired'}, starting full cache...`, SteamCoversService.name)

              return this.gamesCoversCache(validGames, true)
            }

            const cachedIds = new Set(cache.data)
            const newGames = validGames.filter((game) => !cachedIds.has(game.id))

            if (newGames.length === 0) {
              this.logger.log(`Steam covers cache is up to date`, SteamCoversService.name)

              return of(null)
            }

            this.logger.log(`Found ${newGames.length} new games to cache covers`, SteamCoversService.name)

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
          this.logger.log(`No new games to cache covers for`, SteamCoversService.name)

          return of(null)
        }

        this.logger.log(`Caching ${total} game covers...`, SteamCoversService.name)

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
                SteamCoversService.name,
              )

              if (consecutiveFailures >= 3) {
                throw new Error('Three consecutive game cover downloads failed')
              }
            }

            if (processed >= nextProgress || processed === total) {
              const progress = Math.floor((processed / total) * 100)

              this.logger.log(
                `Cover caching progress: ${progress}% ` + `(${processed}/${total} games, ${processed * 2}/${total * 2} images)`,
                SteamCoversService.name,
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
      this.trackingService.trackError('SteamCoversService:gamesCoversCache'),
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

    this.logger.log(`Fetching covers for ${ids.length} games in ${chunks.length} batches...`, SteamCoversService.name)

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

  public hasCoverCached(id: number) {
    return existsSync(join('src/assets/images/game_images', `${id}/header.png`)) && existsSync(join('src/assets/images/game_images', `${id}/library.png`))
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
