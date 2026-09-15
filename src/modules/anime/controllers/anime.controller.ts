import { Controller, Get, Param, ParseIntPipe, Query, Res } from '@nestjs/common'
import { type Response } from 'express'
import { AnimeService } from '../services/anime.service.js'
import { UtilsService } from '../../app/services/utils.service.js'

@Controller('anime')
export class AnimeController {
  constructor(
    private readonly animeService: AnimeService,
    private readonly utils: UtilsService,
  ) {}

  @Get('search')
  searchAnime(@Query('q') query: string, @Res() res: Response) {
    this.animeService.searchAnime(query).subscribe({
      next: (data) => {
        res.json(data)
      },
      error: (err) => {
        this.utils.handleError(res, err)
      },
    })
  }

  @Get('list/:username')
  getUserAnimeList(@Param('username') username: string, @Res() res: Response) {
    this.animeService.getUserAnimeList(username).subscribe({
      next: (data) => {
        res.json(data)
      },
      error: (err) => {
        this.utils.handleError(res, err)
      },
    })
  }

  @Get('oauth/login')
  oauthLogin(@Res() res: Response) {
    res.redirect(this.animeService.authorizeUrl)
  }

  @Get('oauth/callback')
  oauthCallback(@Query('code') code: string, @Res() res: Response) {
    this.animeService.getAccessToken(code).subscribe({
      next: (data) => {
        res.json(data)
      },
      error: (err) => {
        this.utils.handleError(res, err)
      },
    })
  }

  @Get(':id')
  getAnime(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    this.animeService.getAnime(id).subscribe({
      next: (data) => {
        res.json(data)
      },
      error: (err) => {
        this.utils.handleError(res, err)
      },
    })
  }
}
