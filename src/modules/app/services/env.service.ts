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

  public get STEAM_API_KEY() {
    if (this.cache.STEAM_API_KEY == null) {
      this.cache.STEAM_API_KEY = this.config.getOrThrow<string>('STEAM_API_KEY')
    }
    return this.cache.STEAM_API_KEY
  }

  public get STEAM_API_TOKEN() {
    if (this.cache.STEAM_API_TOKEN == null) {
      this.cache.STEAM_API_TOKEN = this.config.getOrThrow<string>('STEAM_API_TOKEN')
    }
    return this.cache.STEAM_API_TOKEN
  }

  public get RIOT_API_KEY() {
    if (this.cache.RIOT_API_KEY == null) {
      this.cache.RIOT_API_KEY = this.config.getOrThrow<string>('RIOT_API_KEY')
    }
    return this.cache.RIOT_API_KEY
  }

  public get TRACKER_GG_API_KEY() {
    if (this.cache.TRACKER_GG_API_KEY == null) {
      this.cache.TRACKER_GG_API_KEY = this.config.getOrThrow<string>('TRACKER_GG_API_KEY')
    }
    return this.cache.TRACKER_GG_API_KEY
  }

  public get MAL_CLIENT_ID() {
    if (this.cache.MAL_CLIENT_ID == null) {
      this.cache.MAL_CLIENT_ID = this.config.getOrThrow<string>('MAL_CLIENT_ID')
    }
    return this.cache.MAL_CLIENT_ID
  }

  public get MAL_REFRESH_TOKEN() {
    if (this.cache.MAL_REFRESH_TOKEN == null) {
      this.cache.MAL_REFRESH_TOKEN = this.config.getOrThrow<string>('MAL_REFRESH_TOKEN')
    }
    return this.cache.MAL_REFRESH_TOKEN
  }

  public get MAL_CLIENT_SECRET() {
    if (this.cache.MAL_CLIENT_SECRET == null) {
      this.cache.MAL_CLIENT_SECRET = this.config.getOrThrow<string>('MAL_CLIENT_SECRET')
    }
    return this.cache.MAL_CLIENT_SECRET
  }

  public get MAL_CODE_VERIFIER() {
    if (this.cache.MAL_CODE_VERIFIER == null) {
      this.cache.MAL_CODE_VERIFIER = this.config.getOrThrow<string>('MAL_CODE_VERIFIER')
    }
    return this.cache.MAL_CODE_VERIFIER
  }

  public get DISCORD_APP_ID() {
    if (this.cache.DISCORD_APP_ID == null) {
      this.cache.DISCORD_APP_ID = this.config.getOrThrow<string>('DISCORD_APP_ID')
    }
    return this.cache.DISCORD_APP_ID
  }

  public get DISCORD_PUBLIC_KEY() {
    if (this.cache.DISCORD_PUBLIC_KEY == null) {
      this.cache.DISCORD_PUBLIC_KEY = this.config.getOrThrow<string>('DISCORD_PUBLIC_KEY')
    }
    return this.cache.DISCORD_PUBLIC_KEY
  }

  public get DISCORD_SECRET() {
    if (this.cache.DISCORD_SECRET == null) {
      this.cache.DISCORD_SECRET = this.config.getOrThrow<string>('DISCORD_SECRET')
    }
    return this.cache.DISCORD_SECRET
  }

  public get DISCORD_TOKEN() {
    if (this.cache.DISCORD_TOKEN == null) {
      this.cache.DISCORD_TOKEN = this.config.getOrThrow<string>('DISCORD_TOKEN')
    }
    return this.cache.DISCORD_TOKEN
  }

  public get DISCORD_SARU_ID() {
    if (this.cache.DISCORD_SARU_ID == null) {
      this.cache.DISCORD_SARU_ID = this.config.getOrThrow<string>('DISCORD_SARU_ID')
    }
    return this.cache.DISCORD_SARU_ID
  }

  public get REDIS_PASSWORD() {
    if (this.cache.REDIS_PASSWORD == null) {
      this.cache.REDIS_PASSWORD = this.config.getOrThrow<string>('REDIS_PASSWORD')
    }
    return this.cache.REDIS_PASSWORD
  }

  public get REDIS_HOST() {
    if (this.cache.REDIS_HOST == null) {
      this.cache.REDIS_HOST = this.config.getOrThrow<string>('REDIS_HOST')
    }
    return this.cache.REDIS_HOST
  }

  public get REDIS_PORT() {
    if (this.cache.REDIS_PORT == null) {
      this.cache.REDIS_PORT = this.config.getOrThrow<number>('REDIS_PORT')
    }
    return this.cache.REDIS_PORT
  }

  public get BACKEND_URL() {
    if (this.cache.BACKEND_URL == null) {
      this.cache.BACKEND_URL = this.config.getOrThrow<string>('BACKEND_URL')
    }
    return this.cache.BACKEND_URL
  }
}
