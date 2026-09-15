import { Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { map } from 'rxjs'
import { EnvService } from '../../app/services/env.service.js'
import { TrackingService } from '../../app/services/tracking.service.js'
import { IMalAnimeDetails, IMalSearchResponse, IMalTokenResponse, IMalUserAnimeListResponse } from '../types/mal.types.js'
import { createHash, randomBytes } from 'node:crypto'

@Injectable()
export class MyAnimeListService {
  private readonly apiUrl = 'https://api.myanimelist.net/v2'
  private readonly oauthUrl = 'https://myanimelist.net/v1/oauth2'

  constructor(
    private readonly httpService: HttpService,
    private readonly env: EnvService,
    private readonly trackingService: TrackingService,
  ) {}

  private get headers() {
    return {
      'X-MAL-CLIENT-ID': this.env.MAL_CLIENT_ID,
    }
  }

  private get redirectUri() {
    return `${this.env.BACKEND_URL}/anime/oauth/callback`
  }

  public searchAnime(query: string, limit = 10) {
    return this.httpService
      .get<IMalSearchResponse>(`${this.apiUrl}/anime`, {
        headers: this.headers,
        params: {
          q: query,
          limit,
        },
      })
      .pipe(
        map((res) => res.data.data.map((entry) => entry.node)),
        this.trackingService.trackError('MyAnimeListService:searchAnime'),
      )
  }

  public getAnime(id: number) {
    return this.httpService
      .get<IMalAnimeDetails>(`${this.apiUrl}/anime/${id}`, {
        headers: this.headers,
        params: {
          fields: 'id,title,main_picture,alternative_titles,synopsis,mean,rank,popularity,num_episodes,status,genres',
        },
      })
      .pipe(
        map((res) => res.data),
        this.trackingService.trackError('MyAnimeListService:getAnime'),
      )
  }

  public getUserAnimeList(username: string, limit = 100) {
    return this.httpService
      .get<IMalUserAnimeListResponse>(`${this.apiUrl}/users/${username}/animelist`, {
        headers: this.headers,
        params: {
          fields: 'list_status',
          limit,
        },
      })
      .pipe(
        map((res) => res.data.data),
        this.trackingService.trackError('MyAnimeListService:getUserAnimeList'),
      )
  }

  private readonly codeVerifier = randomBytes(64).toString('base64url')

  public get authorizeUrl() {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.env.MAL_CLIENT_ID,
      code_challenge: this.codeVerifier,
      code_challenge_method: 'plain',
      redirect_uri: this.redirectUri,
    })

    return `${this.oauthUrl}/authorize?${params.toString()}`
  }

  public getAccessToken(code: string) {
    const body = new URLSearchParams({
      client_id: this.env.MAL_CLIENT_ID,
      code,
      code_verifier: this.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
      client_secret: this.env.MAL_CLIENT_SECRET,
    })

    return this.httpService
      .post<IMalTokenResponse>(`${this.oauthUrl}/token`, body.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
      .pipe(
        map((res) => res.data),
        this.trackingService.trackError('MyAnimeListService:getAccessToken'),
      )
  }
}
