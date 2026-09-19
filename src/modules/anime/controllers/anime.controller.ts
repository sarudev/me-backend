import { Controller, Get, Res } from '@nestjs/common'
import { type Response } from 'express'
import { AnimeService } from '../services/anime.service.js'

@Controller('animes')
export class AnimeController {
  constructor(private readonly animeService: AnimeService) {}

  @Get()
  getAnimeList(@Res() res: Response) {
    const animes = this.animeService.getAnimeList()
    res.json(animes)
  }

  // @Get('oauth/login')
  // oauthLogin(@Res() res: Response) {
  //   res.redirect(this.animeService.authorizeUrl)
  // }

  // @Get('oauth/callback')
  // oauthCallback(@Query('code') code: string, @Res() res: Response) {
  //   this.animeService.getAccessToken(code).subscribe({
  //     next: (data) => {
  //       res.json(data)
  //     },
  //     error: (err) => {
  //       this.utils.handleError(res, err)
  //     },
  //   })
  // }
}
