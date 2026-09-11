import { Injectable, LoggerService } from '@nestjs/common'

@Injectable()
export class AppLogger implements LoggerService {
  private readonly magentaContexts = ['NestFactory', 'InstanceLoader', 'RoutesResolver', 'RouterExplorer', 'NestApplication']

  private colors = {
    reset: '\x1b[0m',
    lime: '\x1b[92m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    gray: '\x1b[90m',
    brightRed: '\x1b[91m',
  }

  private format(type: string, context: string | undefined, message: any) {
    const now = new Date()

    const date = now.toLocaleDateString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
    })

    const time = now.toLocaleTimeString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour12: false,
    })

    const typeColor =
      {
        LOG: this.colors.cyan,
        ERROR: this.colors.red,
        WARN: this.colors.yellow,
        DEBUG: this.colors.blue,
        VERBOSE: this.colors.gray,
        FATAL: this.colors.brightRed,
      }[type] ?? this.colors.reset

    const formattedType = `${typeColor}[${type}]${this.colors.reset}`

    const formattedContext = this.magentaContexts.includes(context ?? '')
      ? `${this.colors.magenta}[${context}]${this.colors.reset}`
      : `${this.colors.yellow}[${context ?? 'Application'}]${this.colors.reset}`

    const formattedDate = `${this.colors.lime}${date} ${time}${this.colors.reset}`

    return `${formattedDate} - ${formattedType} ${formattedContext} ${message}`
  }

  log(message: any, context?: string) {
    console.log(this.format('LOG', context, message))
  }

  error(message: any, trace?: string, context?: string, ignoreTrace?: boolean) {
    console.error(this.format('ERROR', context, message))

    if (trace && !ignoreTrace) {
      console.error(trace)
    }
  }

  warn(message: any, context?: string) {
    console.warn(this.format('WARN', context, message))
  }

  debug(message: any, context?: string) {
    console.debug(this.format('DEBUG', context, message))
  }

  verbose(message: any, context?: string) {
    console.info(this.format('VERBOSE', context, message))
  }

  fatal(message: any, context?: string) {
    console.error(this.format('FATAL', context, message))
  }
}
