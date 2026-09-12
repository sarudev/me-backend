import { Injectable } from '@nestjs/common'
import { STATES } from '../../../assets/states.js'
import { GameStateWithId } from '../../app/types/app.types.js'
import { PlatinumService } from './platinum.service.js'
import { map } from 'rxjs'
import { TrackingService } from '../../app/services/tracking.service.js'

@Injectable()
export class StateService {
  constructor(
    private readonly platinumService: PlatinumService,
    private readonly trackingService: TrackingService,
  ) {}

  public getGameStates() {
    return this.platinumService.platinums.pipe(
      map((platinums) => {
        return STATES.map((state) => {
          const platinum = platinums?.find((p) => p.id === state.id)

          return {
            id: state.id,
            isFavorite: state.isFavorite,
            isLoved: state.isLoved,
            platinumPercentage:
              platinum == null
                ? null
                : {
                    percentage: platinum.percentage,
                    total: platinum.total,
                    unlocked: platinum.unlocked,
                  },
          } satisfies GameStateWithId
        })
      }),
    )
  }
}
