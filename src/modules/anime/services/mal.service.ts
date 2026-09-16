import { Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { EMPTY, expand, map, reduce, switchMap, tap, timer } from 'rxjs'
import { EnvService } from '../../app/services/env.service.js'
import { TrackingService } from '../../app/services/tracking.service.js'
import {
  IMalAnimeDetails,
  IMalAnimeListNode as IMalAnimeListNode,
  IMalAnimeListEntry,
  IMalAnimeListResponse,
  IMalSearchResponse,
  IMalTokenResponse,
  IMalUserAnimeListResponse,
} from '../types/mal.types.js'
import { createHash, randomBytes } from 'node:crypto'
import { AppLogger } from '../../app/services/logger.service.js'

@Injectable()
export class MyAnimeListService {
  private readonly apiUrl = 'https://api.myanimelist.net/v2'
  private readonly oauthUrl = 'https://myanimelist.net/v1/oauth2'
  private accessToken: string | null = null

  constructor(
    private readonly httpService: HttpService,
    private readonly env: EnvService,
    private readonly trackingService: TrackingService,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit() {
    this.refreshAccessToken().subscribe((data) => {
      this.logger.log('MyAnimeList access token refreshed', MyAnimeListService.name)
      this.accessToken = data.access_token
    })
  }

  private get headers() {
    return {
      'X-MAL-CLIENT-ID': this.env.MAL_CLIENT_ID,
    }
  }

  private get redirectUri() {
    return `${this.env.BACKEND_URL}/anime/oauth/callback`
  }

  public getAnimeList() {
    const request = (url: string) =>
      this.httpService
        .get<IMalAnimeListResponse>(url, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        })
        .pipe(map(({ data }) => data))

    const initialUrl =
      'https://api.myanimelist.net/v2/users/@me/animelist?' +
      new URLSearchParams({
        limit: '100',
        fields: ['id', 'title', 'main_picture', 'num_episodes', 'status', 'my_list_status'].join(','),
      })

    return request(initialUrl).pipe(
      expand((response) => (response.paging?.next ? request(response.paging.next) : EMPTY)),
      map((response) => response.data.map((entry) => entry.node)),
      reduce((all, current) => [...all, ...current], [] as IMalAnimeListNode[]),
      map((animes) =>
        animes.map((a) => ({
          ...a,
          url: `https://myanimelist.net/anime/${a.id}`,
        })),
      ),
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

  public refreshAccessToken() {
    const body = new URLSearchParams({
      client_id: this.env.MAL_CLIENT_ID,
      client_secret: this.env.MAL_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: this.env.MAL_REFRESH_TOKEN,
    })

    return timer(0, 24 * 60 * 60 * 1000).pipe(
      tap(() => this.logger.log('Refreshing MyAnimeList access token...', MyAnimeListService.name)),
      switchMap(() =>
        this.httpService
          .post<IMalTokenResponse>(`${this.oauthUrl}/token`, body.toString(), {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          })
          .pipe(
            map(({ data }) => data),
            this.trackingService.trackError('MyAnimeListService:refreshAccessToken'),
          ),
      ),
    )
  }
}
