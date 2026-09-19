import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class EnvService {
  private readonly cache: Record<string, any | null> = {
    STEAM_API_KEY: null,
    STEAM_API_TOKEN: null,
    RIOT_API_KEY: null,
    TRACKER_GG_API_KEY: null,
    MAL_CLIENT_ID: null,
    MAL_REFRESH_TOKEN: null,
    MAL_CLIENT_SECRET: null,
    MAL_CODE_VERIFIER: null,
    DISCORD_APP_ID: null,
    DISCORD_PUBLIC_KEY: null,
    DISCORD_SECRET: null,
    DISCORD_TOKEN: null,
    DISCORD_SARU_ID: null,
    REDIS_PASSWORD: null,
    REDIS_HOST: null,
    REDIS_PORT: null,
    BACKEND_URL: null,
  }

  constructor(private readonly config: ConfigService) {}

  private get<T = string>(key: string): T {
    return (this.cache[key] ??= this.config.getOrThrow<T>(key))
  }

  public get STEAM_API_KEY() {
    return this.get('STEAM_API_KEY')
  }

  public get STEAM_API_TOKEN() {
    return this.get('STEAM_API_TOKEN')
  }

  public get RIOT_API_KEY() {
    return this.get('RIOT_API_KEY')
  }

  public get TRACKER_GG_API_KEY() {
    return this.get('TRACKER_GG_API_KEY')
  }

  public get MAL_CLIENT_ID() {
    return this.get('MAL_CLIENT_ID')
  }

  public get MAL_REFRESH_TOKEN() {
    return this.get('MAL_REFRESH_TOKEN')
  }

  public get MAL_CLIENT_SECRET() {
    return this.get('MAL_CLIENT_SECRET')
  }

  public get MAL_CODE_VERIFIER() {
    return this.get('MAL_CODE_VERIFIER')
  }

  public get DISCORD_APP_ID() {
    return this.get('DISCORD_APP_ID')
  }

  public get DISCORD_PUBLIC_KEY() {
    return this.get('DISCORD_PUBLIC_KEY')
  }

  public get DISCORD_SECRET() {
    return this.get('DISCORD_SECRET')
  }

  public get DISCORD_TOKEN() {
    return this.get('DISCORD_TOKEN')
  }

  public get DISCORD_SARU_ID() {
    return this.get('DISCORD_SARU_ID')
  }

  public get REDIS_PASSWORD() {
    return this.get('REDIS_PASSWORD')
  }

  public get REDIS_HOST() {
    return this.get('REDIS_HOST')
  }

  public get REDIS_PORT() {
    return this.get<number>('REDIS_PORT')
  }

  public get BACKEND_URL() {
    return this.get('BACKEND_URL')
  }
}
