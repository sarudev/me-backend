import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Redis } from 'ioredis'
import { BehaviorSubject, from, map, Observable, of, switchMap, tap, timeout } from 'rxjs'
import { RedisWrapper } from '../types/app.types.js'
import { TrackingService } from './tracking.service.js'
import { EnvService } from './env.service.js'
import { UtilsService } from './utils.service.js'

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis
  private readonly ready$ = new BehaviorSubject(false)

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

  public cache<T>(
    key: string,
    fetch: Observable<T>,
    events?: {
      onGet?: () => void
      onAlreadyCached?: (data: T) => void
      onCached?: (data: T) => void
      onCaching?: (data: T) => void
      onFetching?: () => void
    },
  ) {
    events?.onGet?.()

    return this.get<T>(key).pipe(
      switchMap((res) => {
        const shouldFetch = res?.data == null || (Array.isArray(res.data) && res.data.length === 0) || this.utils.isExpired(res.timestamp)

        if (!shouldFetch) {
          events?.onAlreadyCached?.(res?.data)
          return of(res?.data)
        }

        events?.onFetching?.()

        return fetch.pipe(
          switchMap((data) => {
            events?.onCaching?.(data)

            return this.set(key, data).pipe(
              tap(() => {
                events?.onCached?.(data)
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

  /**
   * METODO ASINCRONO
   */
  public set<T>(key: string, value: T) {
    return this.whenReady$.pipe(
      timeout(30_000),
      switchMap(() => from(this.redis.set(key, JSON.stringify({ data: value, timestamp: Date.now() } satisfies RedisWrapper<T>)))),
      this.trackingService.trackError(`CacheService:set:${key}`),
    )
  }
}
