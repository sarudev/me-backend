import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { AnimeController } from './controllers/anime.controller.js'
import { AnimeService } from './services/anime.service.js'
import { MyAnimeListService } from './services/mal.service.js'

@Module({
  imports: [HttpModule],
  controllers: [AnimeController],
  providers: [AnimeService, MyAnimeListService],
})
export class AnimeModule {}
