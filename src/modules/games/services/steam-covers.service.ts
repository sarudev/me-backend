import { Injectable, OnModuleInit } from '@nestjs/common'
import { catchError, EMPTY, filter, forkJoin, from, map, mergeMap, of, switchMap, tap, timer, toArray } from 'rxjs'
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
      .onCacheVerified$<number[]>()
      .pipe(
        filter((event) => event.key === 'steamCovers'),
        map((event) => event.value.new!),
      )
      .subscribe((steamCovers) => {
        this.steamCovers = new Set(steamCovers.concat([-10, -20, -30, -40, -50, -60]))
        this.logger.log(`Local steam covers updated (${steamCovers.length})`, SteamCoversService.name)
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
    if (games.length < 1) return EMPTY

    const validGames = games.filter((game) => game.id > 0)
    const gameNames = new Map(validGames.map((game) => [game.id, game.name]))
    const failedCovers: number[] = []

    return this.cacheService.reconcile<number, GameMergeData>('steamCovers', validGames, {
      sourceId: (game) => game.id,
      cachedId: (id) => id,
      onAlreadyCached: () => this.logger.log(`Steam covers cache is up to date`, SteamCoversService.name),
      fetch: (games, mode) =>
        this.fetchAllGameCovers(games.map((game) => game.id)).pipe(
          switchMap((covers) => {
            const total = covers.length

            if (total === 0) {
              this.logger.log(`No new games to cache covers for`, SteamCoversService.name)

              return of([])
            }

            this.logger.log(`Caching ${total} game covers (${mode})...`, SteamCoversService.name)

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
                    map(() => ({ success: true, cover })),
                    catchError(() => of({ success: false, cover })),
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
        ),
      merge: (current, fetched) => [...new Set([...current, ...fetched])],
    })
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
