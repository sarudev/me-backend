import { Controller, Get, Res } from '@nestjs/common'
import { type Response } from 'express'
import { GamesService } from '../services/games.service.js'
import { UtilsService } from '../../app/services/utils.service.js'

@Controller('games')
export class GamesController {
  constructor(
    private readonly gamesService: GamesService,
    private readonly utils: UtilsService,
  ) {}

  @Get()
  getPlayerGames(@Res() res: Response) {
    const games = this.gamesService.getGames()
    res.json(games)
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
}
