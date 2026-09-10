import { Injectable } from '@nestjs/common'
import { GameRankData, GameRankings, ResolvedGameRanksWithId } from '../../app/types/app.types.js'
import { RANKS, ranksMock } from '../../../assets/ranks.js'
import { EnvService } from '../../app/services/env.service.js'
import { TrackingService } from '../../app/services/tracking.service.js'

@Injectable()
export class RanksService {
  constructor(
    private readonly env: EnvService,
    private readonly trackingService: TrackingService,
  ) {}

  private getGameRanks<T extends GameRankData>(ranks: GameRankings & { id: T['id'] }): ResolvedGameRanksWithId {
    const { id } = ranks

    return {
      id: ranks.id,
      best: {
        ...this.getRankInfo({ ...ranks.best, id } as T),
        elo: ranks.best.elo ?? null,
      },
      current: {
        ...this.getRankInfo({ ...ranks.current, id } as T),
        elo: ranks.current.elo ?? null,
      },
    }
  }

  public getGameRanksFor(gameId: number) {
    const gameRanks = ranksMock.find((r) => r.id === gameId)

    if (!gameRanks) {
      return null
    }

    return this.getGameRanks(gameRanks)
  }

  private getRankInfo(game: GameRankData) {
    const division = game.division == null ? 0 : game.division - 1

    let baseUrl = RANKS[game.id].folder
    let ranks = RANKS[game.id].ranks

    if (ranks == null) {
      const err = new Error(`Unsupported game: ${game.id}`)
      this.trackingService.notifyError(err, `RankService:getRankInfo`)
      throw err
    }

    const rank = ranks.find((r) => r.id === game.rankName)

    if (!rank) {
      const err = new Error(`Unsupported rank: ${game.rankName}`)
      this.trackingService.notifyError(err, `RankService:getRankInfo`)
      throw err
    }

    if (rank.icons.length !== rank.divisions) {
      const err = new Error(
        `Rank icons length (${rank.icons.length}) does not match divisions (${rank.divisions}) for rank ${rank.id} in game ${game.id}`,
      )
      this.trackingService.notifyError(err, `RankService:getRankInfo`)
      throw err
    }

    return {
      division: game.division,
      name: rank.name,
      rankId: rank.id,
      icon: `${this.env.BACKEND_URL}/images/ranks/${baseUrl}/${rank.icons[division]}`,
    }
  }
}
