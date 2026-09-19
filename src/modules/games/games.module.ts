import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { GamesController } from './controllers/games.controller.js'
import { GamesService } from './services/games.service.js'
import { SteamService } from './services/steam.service.js'
import { RanksService } from './services/ranks.service.js'
import { StateService } from './services/state.service.js'

@Module({
  imports: [HttpModule],
  controllers: [GamesController],
  providers: [GamesService, SteamService, RanksService, StateService],
})
export class GamesModule {}
