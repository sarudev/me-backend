import { Global, Module } from '@nestjs/common'
import { createObserveModule } from '@nestjs/observe'
import { HttpModule } from '@nestjs/axios'
import { ConfigModule } from '@nestjs/config'
import { ServeStaticModule } from '@nestjs/serve-static'
import { join } from 'node:path'
import { GamesModule } from '../games/games.module.js'
import { UtilsService } from './services/utils.service.js'
import { CacheService } from './services/cache.service.js'
import { TrackingService } from './services/tracking.service.js'
import { AppLogger } from './services/logger.service.js'
import { EnvService } from './services/env.service.js'
import { DiscordService } from './services/discord.service.js'

export const { ObserveModule, ObserveInstrument } = createObserveModule()

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HttpModule,
    ServeStaticModule.forRoot({
      rootPath: join(import.meta.dirname, 'assets'),
      serveRoot: '/',
    }),
    GamesModule,
  ],
  providers: [UtilsService, CacheService, TrackingService, AppLogger, EnvService, DiscordService],
  exports: [UtilsService, CacheService, TrackingService, AppLogger, EnvService, DiscordService],
})
export class AppModule {}
