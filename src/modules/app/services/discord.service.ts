import { Injectable } from '@nestjs/common'
import { Client, Events, GatewayIntentBits, User } from 'discord.js'
import { BehaviorSubject, from, map, Observable, switchMap, timeout } from 'rxjs'
import { EnvService } from './env.service.js'
import { AppLogger } from './logger.service.js'
import { UtilsService } from './utils.service.js'
import axios, { AxiosError } from 'axios'

interface ClientReady {
  isReady: true
  client: Client
}

interface ClientNotReady {
  isReady: false
  client: null
}

@Injectable()
export class DiscordService {
  private client: Client
  private ready = new BehaviorSubject<ClientReady | ClientNotReady>({ isReady: false, client: null })
  private saru: User

  constructor(
    private readonly env: EnvService,
    private readonly logger: AppLogger,
    private readonly utils: UtilsService,
  ) {}

  onModuleInit() {
    this.client = new Client({ intents: [GatewayIntentBits.Guilds] })
    this.registerEventHandlers()
    this.login()

    this.whenReady$.subscribe(({ client }) => {
      this.logger.log(`Logged in as ${client.user?.tag}!`, DiscordService.name)
    })
  }

  private get whenReady$() {
    return this.ready.pipe(
      timeout(30_000),
      this.utils.whenReady((v) => v as ClientReady),
    )
  }

  private login() {
    this.client.login(this.env.DISCORD_TOKEN)
  }

  private async registerEventHandlers() {
    this.client.once(Events.ClientReady, (client) => {
      this.client.users.fetch(this.env.DISCORD_SARU_ID).then((user) => {
        this.saru = user
        this.ready.next({ isReady: true, client })
      })
    })
  }

  public getProfilePicture() {
    return this.whenReady$.pipe(
      switchMap(() => from(this.client.users.fetch(this.env.DISCORD_SARU_ID)).pipe(map((user) => `${user.displayAvatarURL()}?size=512`))),
    )
  }

  public notifyError(error: Error, context?: string) {
    this.whenReady$
      .pipe(
        switchMap(() => {
          const stack = error.stack
            ?.split('\n')
            .filter((line) => !line.includes('node_modules'))
            .join('\n')
          const uri = error instanceof AxiosError && error.config?.url != null ? axios.getUri(error.config) : undefined
          const msg = `Error${context ? ` in \`${context}\`` : ''}${uri != null ? ` (${uri.slice(0, 200)})` : ''}: \n\`\`\`${stack}`

          return from(this.saru.send(msg.slice(0, 2000 - 3) + '```'))
        }),
      )
      .subscribe({
        next: () => this.logger.warn(`Error notification sent to Discord user ${this.saru.tag}`, DiscordService.name),
        error: (err) => this.logger.error('Failed to send error notification to Discord:', err, undefined, true),
      })
  }

  public notify(message: string) {
    this.whenReady$.pipe(switchMap(() => from(this.saru.send(message.slice(0, 2000))))).subscribe({
      next: () => this.logger.log(`Message sent to Discord user ${this.saru.tag}`, DiscordService.name),
      error: (err) => this.logger.error('Failed to send message to Discord:', err, undefined, true),
    })
  }
}
