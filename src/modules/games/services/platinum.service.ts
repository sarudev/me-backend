import { Injectable, OnModuleInit } from '@nestjs/common'
import { forkJoin, map, switchMap, timer } from 'rxjs'
import { CachedPlatinum, Platinum } from '../types/games.types.js'
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

    timer(0, this.utils.cacheExpireTimes.platinums)
      .pipe(
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
              onGet: () => this.logger.log('Looking for platinums...', PlatinumService.name),
              onFetching: () => this.logger.log('Fetching platinums from Steam API...', PlatinumService.name),
              onAlreadyCached: (cache) => this.logger.log(`Platinums already cached (${cache?.length ?? 0})`, PlatinumService.name),
              onCaching: (cur, old) => this.logger.log(`Fetched ${cur.length} platinums (${old?.length ?? 0} before), caching...`, PlatinumService.name),
              onCached: () => this.logger.log(`Platinums cached successfully`, PlatinumService.name),
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
