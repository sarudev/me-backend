import { Injectable } from '@nestjs/common'
import { catchError, OperatorFunction } from 'rxjs'

@Injectable()
export class TrackingService {
  public notifyError(error: Error, context?: string) {
    console.error(`Error${context ? ` in ${context}` : ''}:`, error)
  }

  public trackError<T>(key?: string): OperatorFunction<T, T> {
    return catchError((err) => {
      this.notifyError(err, key)

      throw err
    })
  }
}
