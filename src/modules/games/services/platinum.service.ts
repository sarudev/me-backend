import { Injectable, OnModuleInit } from '@nestjs/common'
import { filter, forkJoin, map, switchMap, take, timer } from 'rxjs'
import { CachedPlatinum, Platinum } from '../../app/types/app.types.js'
import { SteamService } from './steam.service.js'
import { STATES } from '../../../assets/states.js'
import { TrackingService } from '../../app/services/tracking.service.js'
import { CacheService } from '../../app/services/cache.service.js'
import { AppLogger } from '../../app/services/logger.service.js'
import { UtilsService } from '../../app/services/utils.service.js'

@Injectable()
export class PlatinumService implements OnModuleInit {
  constructor(
    private readonly steamService: SteamService,
    private readonly trackingService: TrackingService,
    private readonly cacheService: CacheService,
    private readonly logger: AppLogger,
    private readonly utils: UtilsService,
  ) {}

  onModuleInit() {
    const ids = STATES.filter((s) => s.trackingPlatinum).map((s) => s.id)

    timer(0, this.utils.expireTime)
      .pipe(
        switchMap(() => this.steamService.areSteamAccountsValid$.pipe(filter(Boolean), take(1))),
        switchMap(() =>
          this.cacheService.cache<CachedPlatinum[]>(
            'platinums',
            forkJoin(
              ids.map((id) =>
                this.steamService
                  .getGamePlatinumPercentage(this.steamService.mainAccountSteamId, id)
                  .pipe(map<Platinum | null, CachedPlatinum | null>((p) => (p != null ? { ...p, id } : null))),
              ),
            ).pipe(
              this.trackingService.trackError('PlatinumService:fetchPlatinumPercentages'),
              map((plat) => plat.filter((p) => p != null)),
            ),
            {
              onGet: () => this.logger.log('Looking if platinums are expired...', PlatinumService.name),
              onAlreadyCached: (res) => this.logger.log(`Platinums cached: ${res!.length}`, PlatinumService.name),
              onFetching: () => this.logger.log('Platinums expired, fetching from Steam API...', PlatinumService.name),
              onCaching: (res) => this.logger.log(`Fetched ${res.length} platinums, caching...`, PlatinumService.name),
              onCached: (res) => this.logger.log(`Platinums cached successfully: ${res.length}.`, PlatinumService.name),
            },
          ),
        ),
      )
      .subscribe()
  }

  public get platinums() {
    return this.cacheService.get<CachedPlatinum[]>('platinums').pipe(map((res) => res?.data ?? []))
  }
}
