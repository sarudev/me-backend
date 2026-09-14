import { NestFactory } from '@nestjs/core'
import { AppLogger } from './modules/app/services/logger.service.js'
import { AppModule, ObserveInstrument } from './modules/app/app.module.js'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
    logger: new AppLogger(),
    cors: {
      allowedHeaders: '*',
      origin: '*',
      methods: '*',
      credentials: false,
    },
  })
  await app.listen(process.env.PORT ?? 3000)
}
await bootstrap()
