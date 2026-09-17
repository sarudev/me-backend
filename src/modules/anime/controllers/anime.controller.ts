import { Controller, Get, Param, ParseIntPipe, Query, Res } from '@nestjs/common'
import { type Response } from 'express'
import { AnimeService } from '../services/anime.service.js'
import { UtilsService } from '../../app/services/utils.service.js'

@Controller('animes')
export class AnimeController {
  constructor(
    private readonly animeService: AnimeService,
    private readonly utils: UtilsService,
  ) {}

  @Get()
  getAnimeList(@Res() res: Response) {
    this.animeService.getAnimeList().subscribe({
      next: (data) => {
        res.json(data)
      },
      error: (err) => {
        this.utils.handleError(res, err)
      },
    })
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
