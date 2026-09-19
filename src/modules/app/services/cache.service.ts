import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Redis } from 'ioredis'
import { BehaviorSubject, filter, from, map, Observable, of, OperatorFunction, Subject, switchMap, take, tap, timeout } from 'rxjs'
import { CacheSaveEvent, RedisWrapper } from '../types/app.types.js'
import { TrackingService } from './tracking.service.js'
import { EnvService } from './env.service.js'
import { UtilsService } from './utils.service.js'

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis
  private readonly ready$ = new BehaviorSubject(false)
  private readonly cacheVerified$ = new Subject<CacheSaveEvent<any>>()
  private readonly cacheSet$ = new Subject<{ key: string; value: any; preserveTimestamp: boolean }>()

  public cacheExpireTimes = {
    steamGames: 8 * 60 * 60 * 1000, // 8 hours
    steamAccounts: 15 * 60 * 1000, // 15 minutes
    platinums: 15 * 60 * 1000, // 15 minutes
    steamCovers: 24 * 60 * 60 * 1000, // 24 hours
    steamDetails: 24 * 60 * 60 * 1000, // 24 hours
    malAccessToken: 24 * 60 * 60 * 1000, // 24 hours
    malAnimeList: 24 * 60 * 60 * 1000, // 24 hours
  } as const

  constructor(
    private readonly env: EnvService,
    private readonly trackingService: TrackingService,
    private readonly utils: UtilsService,
  ) {
    this.redis = new Redis(this.redisConfig)
  }

  onModuleInit() {
    this.redis.on('ready', () => {
      this.ready$.next(true)
    })

    this.redis.on('close', () => {
      this.ready$.next(false)
    })
  }

  private get redisConfig() {
    return {
      host: this.env.REDIS_HOST,
      port: this.env.REDIS_PORT,
      password: this.env.REDIS_PASSWORD,
    }
  }

  private get whenReady$() {
    return this.ready$.pipe(this.utils.whenReady())
  }

  public onCacheVerified$<T>(): Observable<CacheSaveEvent<T>> {
    return this.cacheVerified$.asObservable()
  }

  public onCacheSet$<T>(): Observable<{ key: string; value: T }> {
    return this.cacheSet$.asObservable()
  }

  public hasExpired(key: keyof typeof this.cacheExpireTimes, lastUpdated: number): boolean {
    return Date.now() - lastUpdated > (this.cacheExpireTimes[key] ?? 0) - 5000
  }

  public cache<T>(
    key: string,
    fetch: Observable<T>,
    events?: {
      onGet?: () => void
      onFetching?: (cache: T | null) => void
      onAlreadyCached?: (cache: T) => void
      onCached?: (data: T) => void
    },
    forceRecache = false,
  ) {
    events?.onGet?.()

    return this.get<T>(key).pipe(
      switchMap((cache) => {
        if (!forceRecache && cache != null && !this.hasExpired(key as keyof typeof this.cacheExpireTimes, cache.timestamp)) {
          events?.onAlreadyCached?.(cache.data)
          this.cacheVerified$.next({ key, value: { subKey: 'alreadyCached', new: cache!.data!, old: cache!.data! } })
          return of(cache.data)
        }

        events?.onFetching?.(cache?.data ?? null)

        return fetch.pipe(
          switchMap((data) => {
            return this.set(key, data).pipe(
              tap(() => {
                events?.onCached?.(data)
                this.cacheVerified$.next({ key, value: { subKey: 'cached', new: data, old: cache?.data ?? null } })
              }),
              map(() => data),
            )
          }),
        )
      }),
    )
  }

  async onModuleDestroy() {
    await this.redis.quit()
  }

  public get ready(): Observable<boolean> {
    return this.ready$.asObservable()
  }

  public get<T>(key: string): Observable<RedisWrapper<T> | null> {
    return this.whenReady$.pipe(
      timeout(30_000),
      switchMap(() => from(this.redis.get(key))),
      map((value) => (value ? JSON.parse(value) : null)),
      this.trackingService.trackError(`CacheService:get:${key}`),
    )
  }

  public set<T>(key: string, value: T, preserveTimestamp = false) {
    return this.whenReady$.pipe(
      timeout(30_000),
      switchMap(() =>
        preserveTimestamp
          ? this.get<T>(key).pipe(
              switchMap((cache) =>
                from(
                  this.redis.set(
                    key,
                    JSON.stringify({
                      data: value,
                      timestamp: cache?.timestamp ?? Date.now(),
                    } satisfies RedisWrapper<T>),
                  ),
                ),
              ),
            )
          : from(
              this.redis.set(
                key,
                JSON.stringify({
                  data: value,
                  timestamp: Date.now(),
                } satisfies RedisWrapper<T>),
              ),
            ),
      ),
      tap(() => this.cacheSet$.next({ key, value, preserveTimestamp })),
      this.trackingService.trackError(`CacheService:set:${key}`),
    )
  }
}
