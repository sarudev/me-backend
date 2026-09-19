import { Injectable } from '@nestjs/common'
import { SteamService } from './steam.service.js'
import { GameAccount, GameMergeData } from '../types/games.types.js'
import { EPIC_GAMES, RIOT_GAMES, XBOX_GAMES } from '../../../assets/games.js'
import { BLACKLIST } from '../../../assets/blacklist.js'

@Injectable()
export class GameLibraryService {
  constructor(private readonly steamService: SteamService) {}

  public get games(): GameMergeData[] {
    const games = [RIOT_GAMES, EPIC_GAMES, XBOX_GAMES, this.steamService.ownedGames]
      .flat()
      .filter((g) => !BLACKLIST.has(g.id))
      .reduce((map, game) => {
        const existing = map.get(game.id)
        const account = {
          type: [252950, -20].includes(game.id) ? 'epic' : game.account.type,
          data: [252950, -20].includes(game.id) ? '@topsaru' : game.account.data,
        } as GameAccount

        if (!existing) {
          map.set(game.id, {
            id: game.id,
            name: game.name,
            playtime: game.playtime,
            account: account,
          })

          return map
        }

        existing.playtime += game.playtime
        existing.account = account

        return map
      }, new Map<number, GameMergeData>())
      .values()

    return [...games]
  }
}
