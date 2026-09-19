import { Injectable, OnModuleInit } from '@nestjs/common'
import { filter, forkJoin, map, switchMap, timer } from 'rxjs'
import { CachedPlatinum, GameState, GameStateWithId, Platinum } from '../types/games.types.js'
import { SteamService } from './steam.service.js'
import { STATES } from '../../../assets/states.js'
import { TrackingService } from '../../app/services/tracking.service.js'
import { CacheService } from '../../app/services/cache.service.js'
import { AppLogger } from '../../app/services/logger.service.js'
import { UtilsService } from '../../app/services/utils.service.js'

@Injectable()
export class StateService implements OnModuleInit {
  public states = new Map<number, GameState>()

  constructor(
    private readonly steamService: SteamService,
    private readonly trackingService: TrackingService,
    private readonly cacheService: CacheService,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit() {
    this.cacheService
      .onCacheSet$<CachedPlatinum[]>()
      .pipe(filter((event) => event.key === 'platinums'))
      .subscribe((event) => {
        const platinums = event.value.reduce((map, platinum) => {
          map.set(platinum.id, platinum)
          return map
        }, new Map<number, CachedPlatinum>())

        this.states = STATES.reduce((map, state) => {
          map.set(state.id, {
            isFavorite: state.isFavorite,
            isLoved: state.isLoved,
            platinumPercentage: platinums.get(state.id) ?? null,
          } satisfies GameState)
          return map
        }, new Map<number, GameState>())

        this.logger.log(`Local platinums updated (${event.value.length})`, StateService.name)
      })

    const ids = STATES.filter((s) => s.trackingPlatinum).map((s) => s.id)

    timer(0, this.cacheService.cacheExpireTimes.platinums)
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
              onGet: () => this.logger.log('Looking for platinums...', StateService.name),
              onFetching: () => this.logger.log('Fetching platinums from Steam API...', StateService.name),
              onAlreadyCached: (cache) => this.logger.log(`Platinums already cached (${cache?.length ?? 0})`, StateService.name),
              onCached: (data) => this.logger.log(`Cached ${data.length} platinums successfully`, StateService.name),
            },
          ),
        ),
      )
      .subscribe()
  }
}
