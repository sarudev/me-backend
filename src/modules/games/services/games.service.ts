import { Injectable } from '@nestjs/common'
import { DiscordService } from '../../app/services/discord.service.js'
import { Game } from '../types/games.types.js'
import { RanksService } from './ranks.service.js'
import { StateService } from './state.service.js'
import { GameLibraryService } from './game-library.service.js'
import { SteamCoversService } from './steam-covers.service.js'
import { SteamDetailsService } from './steam-details.service.js'

@Injectable()
export class GamesService {
  constructor(
    private readonly gameLibraryService: GameLibraryService,
    private readonly steamCoversService: SteamCoversService,
    private readonly steamDetailsService: SteamDetailsService,
    private readonly ranksService: RanksService,
    private readonly stateService: StateService,
    private readonly discordService: DiscordService,
  ) {}

  public getGames() {
    return this.gameLibraryService.games.map<Game>(
      (game) =>
        ({
          id: game.id,
          name: game.name,
          playtime: game.playtime,
          state: this.stateService.states.get(game.id)!,
          rank: this.ranksService.getGameRanksFor(game.id),
          assets: this.steamCoversService.getGameCover(game.id, this.steamCoversService.steamCovers.has(game.id)),
          account: game.account,
          details: this.steamDetailsService.steamDetails.get(game.id) ?? null,
        }) satisfies Game,
    )
  }

  public getDiscordProfilePicture() {
    return this.discordService.getProfilePicture()
  }
}

/*
cs stats: https://csstats.gg/player/76561198896706454 (scraping)
valorant stats: https://tracker.gg/valorant/profile/riot/Saru%237278/overview (scraping)
lol stats: https://tracker.gg/lol/profile/riot/Sarudev%237278/overview (scraping)
fortnite stats: https://fortnitetracker.com/profile/all/topsaru (scraping)
rocket league stats: https://rocketleague.tracker.network/rocket-league/profile/epic/topsaru/overview (scraping)
brawlhalla: https://tracker.gg/brawlhalla/profile/29732203-/overview (scraping)
steam games: steam web api
*/
