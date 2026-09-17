import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Redis } from 'ioredis'
import { BehaviorSubject, from, map, Observable, of, Subject, switchMap, tap, timeout } from 'rxjs'
import { CacheSaveEvent, RedisWrapper } from '../types/app.types.js'
import { TrackingService } from './tracking.service.js'
import { EnvService } from './env.service.js'
import { UtilsService } from './utils.service.js'

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis
  private readonly ready$ = new BehaviorSubject(false)
  private readonly onCacheSave$ = new Subject<CacheSaveEvent<any>>()

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
    return this.onCacheSave$.asObservable()
  }

  public cache<T>(
    key: string,
    fetch: Observable<T>,
    events?: {
      onGet?: () => void
      onFetching?: (cache: T | null) => void
      onAlreadyCached?: (cache: T) => void
      onCaching?: (current: T, old: T | null) => void
      onCached?: (data: T) => void
    },
    forceRecache = false,
  ) {
    events?.onGet?.()

    return this.get<T>(key).pipe(
      switchMap((cache) => {
        if (!forceRecache && cache != null && !this.utils.hasExpired(key as keyof typeof this.utils.cacheExpireTimes, cache.timestamp)) {
          events?.onAlreadyCached?.(cache.data)
          this.onCacheSave$.next({ key, value: { new: null, old: cache?.data ?? null } })
          return of(cache.data)
        }

        events?.onFetching?.(cache?.data ?? null)

        return fetch.pipe(
          switchMap((data) => {
            events?.onCaching?.(data, cache?.data ?? null)

            return this.set(key, data).pipe(
              tap(() => {
                events?.onCached?.(data)
                this.onCacheSave$.next({ key, value: { new: data, old: cache?.data ?? null } })
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
      this.trackingService.trackError(`CacheService:set:${key}`),
    )
  }
}
