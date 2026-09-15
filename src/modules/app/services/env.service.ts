import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class EnvService {
  constructor(private readonly config: ConfigService) {}

  public get STEAM_API_KEY() {
    return this.config.getOrThrow<string>('STEAM_API_KEY')
  }

  public get STEAM_API_TOKEN() {
    return this.config.getOrThrow<string>('STEAM_API_TOKEN')
  }

  public get RIOT_API_KEY() {
    return this.config.getOrThrow<string>('RIOT_API_KEY')
  }

  public get TRACKER_GG_API_KEY() {
    return this.config.getOrThrow<string>('TRACKER_GG_API_KEY')
  }

  public get MAL_CLIENT_ID() {
    return this.config.getOrThrow<string>('MAL_CLIENT_ID')
  }

  public get MAL_CLIENT_SECRET() {
    return this.config.getOrThrow<string>('MAL_CLIENT_SECRET')
  }

  public get MAL_CODE_VERIFIER() {
    return this.config.getOrThrow<string>('MAL_CODE_VERIFIER')
  }

  public get DISCORD_APP_ID() {
    return this.config.getOrThrow<string>('DISCORD_APP_ID')
  }

  public get DISCORD_PUBLIC_KEY() {
    return this.config.getOrThrow<string>('DISCORD_PUBLIC_KEY')
  }

  public get DISCORD_SECRET() {
    return this.config.getOrThrow<string>('DISCORD_SECRET')
  }

  public get DISCORD_TOKEN() {
    return this.config.getOrThrow<string>('DISCORD_TOKEN')
  }

  public get DISCORD_SARU_ID() {
    return this.config.getOrThrow<string>('DISCORD_SARU_ID')
  }

  public get REDIS_PASSWORD() {
    return this.config.getOrThrow<string>('REDIS_PASSWORD')
  }

  public get REDIS_HOST() {
    return this.config.getOrThrow<string>('REDIS_HOST')
  }

  public get REDIS_PORT() {
    return this.config.getOrThrow<number>('REDIS_PORT')
  }

  public get BACKEND_URL() {
    return this.config.getOrThrow<string>('BACKEND_URL')
  }
}
