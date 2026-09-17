import { Injectable } from '@nestjs/common'
import { catchError, OperatorFunction } from 'rxjs'
import { DiscordService } from './discord.service.js'

@Injectable()
export class TrackingService {
  constructor(private readonly discord: DiscordService) {}

  public notifyError(error: Error, context?: string) {
    this.discord.notifyError(error, context)
  }

  public notify(message: string) {
    this.discord.notify(message)
  }

  public trackError<T>(key?: string): OperatorFunction<T, T> {
    return catchError((err) => {
      this.notifyError(err, key)

      throw err
    })
  }
}
