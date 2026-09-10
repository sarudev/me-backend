import { Controller, Get, Res } from '@nestjs/common'
import { type Response } from 'express'
import { GamesService } from '../services/games.service.js'

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get()
  getPlayerGames(@Res() res: Response) {
    this.gamesService.getGames().subscribe({
      next: (data) => {
        res.json(data.toSorted((a, b) => b.playtime - a.playtime))
      },
      error: (err) => {
        res.status(500).json({ error: err.message })
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
        res.status(500).json({ error: err.message })
      },
    })
  }
}
