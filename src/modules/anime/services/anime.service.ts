import { Injectable } from '@nestjs/common'
import { MyAnimeListService } from './mal.service.js'

@Injectable()
export class AnimeService {
  constructor(private readonly malService: MyAnimeListService) {}

  public searchAnime(query: string, limit?: number) {
    return this.malService.searchAnime(query, limit)
  }

  public getAnime(id: number) {
    return this.malService.getAnime(id)
  }

  public getUserAnimeList(username: string) {
    return this.malService.getUserAnimeList(username)
  }

  public get authorizeUrl() {
    return this.malService.authorizeUrl
  }

  public getAccessToken(code: string) {
    return this.malService.getAccessToken(code)
  }
}
