import { Injectable } from '@nestjs/common'
import { MyAnimeListService } from './mal.service.js'
import { of } from 'rxjs'

@Injectable()
export class AnimeService {
  constructor(private readonly malService: MyAnimeListService) {}

  public getAnimeList() {
    return this.malService.getAnimeList()
  }

  public get authorizeUrl() {
    return this.malService.authorizeUrl
  }

  public getAccessToken(code: string) {
    return this.malService.getAccessToken(code)
  }
}
