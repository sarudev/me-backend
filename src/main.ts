import { NestFactory } from '@nestjs/core'
import { AppLogger } from './modules/app/services/logger.service.js'
import { AppModule, ObserveInstrument } from './modules/app/app.module.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
    logger: new AppLogger(),
  })
  await app.listen(process.env.PORT ?? 3000)
}
await bootstrap()
