import { Controller, Get, Res } from '@nestjs/common'
import { type Response } from 'express'
import { GamesService } from '../services/games.service.js'
import { TrackingService } from '../../app/services/tracking.service.js'
import { UtilsService } from '../../app/services/utils.service.js'

@Controller('games')
export class GamesController {
  constructor(
    private readonly gamesService: GamesService,
    private readonly utils: UtilsService,
  ) {}

  @Get()
  getPlayerGames(@Res() res: Response) {
    this.gamesService.getGames().subscribe({
      next: (data) => {
        res.json(data.toSorted((a, b) => b.playtime - a.playtime))
      },
      error: (err) => {
        this.utils.handleError(res, err)
      },
    })
  }

  @Get('dspfp')
  getDiscordProfilePicture(@Res() res: Response) {
    this.gamesService.getDiscordProfilePicture().subscribe({
      next: (url) => {
        res.send(url)
      },
      error: (err) => {
        this.utils.handleError(res, err)
      },
    })
  }

  @Get('details')
  getGameDetails(@Res() res: Response) {
    this.gamesService.fetchGameDetails().subscribe({
      next: (data) => {
        res.json(data)
      },
      error: (err) => {
        this.utils.handleError(res, err)
      },
    })
  }
}
