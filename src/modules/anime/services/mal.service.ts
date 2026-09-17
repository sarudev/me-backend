import { Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { EMPTY, expand, map, of, reduce, switchMap, tap, timer } from 'rxjs'
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
  Anime,
  IMalAnimeMyStatus,
} from '../types/mal.types.js'
import { createHash, randomBytes } from 'node:crypto'
import { AppLogger } from '../../app/services/logger.service.js'
import { UtilsService } from '../../app/services/utils.service.js'

@Injectable()
export class MyAnimeListService {
  private readonly apiUrl = 'https://api.myanimelist.net/v2'
  private readonly oauthUrl = 'https://myanimelist.net/v1/oauth2'
  private readonly codeVerifier = randomBytes(64).toString('base64url')
  private accessToken: string | null = null

  constructor(
    private readonly httpService: HttpService,
    private readonly env: EnvService,
    private readonly trackingService: TrackingService,
    private readonly logger: AppLogger,
    private readonly utilsService: UtilsService,
  ) {}

  onModuleInit() {
    this.refreshAccessToken().subscribe((data) => {
      this.logger.log('MyAnimeList access token refreshed', MyAnimeListService.name)
      this.accessToken = data.access_token
    })
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
      `${this.apiUrl}/users/@me/animelist?` +
      new URLSearchParams({
        limit: '1000',
        fields: ['id', 'title', 'main_picture', 'mean', 'synopsis', 'num_episodes', 'status', 'my_list_status', 'start_season'].join(','),
      })

    return request(initialUrl).pipe(
      expand((response) => (response.paging?.next ? request(response.paging.next) : EMPTY)),
      map((response) => response.data.map((entry) => entry.node)),
      reduce((all, current) => [...all, ...current], [] as IMalAnimeListNode[]),
      map((animes) =>
        animes.map(
          (a) =>
            ({
              id: a.id,
              title: a.title,
              image: a.main_picture?.medium!,
              episodes: a.num_episodes,
              status: a.status,
              score: a.mean,
              url: `https://myanimelist.net/anime/${a.id}`,
              season: a.season,
              synopsis: a.synopsis.replace('[Written by MAL Rewrite]', '').trim(),
              myStatus: {
                status: a.my_list_status.status,
                score: a.my_list_status.score,
                episodesWatched: a.my_list_status.num_episodes_watched,
                finishedAt: a.my_list_status.finish_date,
                startedAt: a.my_list_status.start_date,
                updatedAt: a.my_list_status.updated_at,
              },
            }) satisfies Anime,
        ),
      ),
      map((animes) =>
        animes.toSorted((a, b) => {
          const statusOrder: Record<IMalAnimeMyStatus, number> = {
            watching: 0,
            on_hold: 1,
            completed: 2,
            plan_to_watch: 3,
            dropped: 4,
          }

          const statusDiff = statusOrder[a.myStatus.status] - statusOrder[b.myStatus.status]

          if (statusDiff !== 0) {
            return statusDiff
          }

          return new Date(b.myStatus.updatedAt).getTime() - new Date(a.myStatus.updatedAt).getTime()
        }),
      ),
    )
  }

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
        tap((data) => {
          this.accessToken = data.access_token
        }),
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

    return timer(0, this.utilsService.cacheExpireTimes.malAccessToken).pipe(
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
