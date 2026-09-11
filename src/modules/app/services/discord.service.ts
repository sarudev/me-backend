import { Injectable } from '@nestjs/common'
import { Client, Events, GatewayIntentBits } from 'discord.js'
import { BehaviorSubject, from, map, Observable, switchMap } from 'rxjs'
import { EnvService } from './env.service.js'
import { AppLogger } from './logger.service.js'
import { UtilsService } from './utils.service.js'

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
    return this.ready.pipe(this.utils.whenReady((v) => v as ClientReady))
  }

  private login() {
    this.client.login(this.env.DISCORD_TOKEN)
  }

  private async registerEventHandlers() {
    this.client.once(Events.ClientReady, (client) => this.ready.next({ isReady: true, client }))
  }

  public getProfilePicture() {
    return this.whenReady$.pipe(
      switchMap(() => from(this.client.users.fetch(this.env.DISCORD_SARU_ID)).pipe(map((user) => `${user.displayAvatarURL()}?size=512`))),
    )
  }

  public notifyError(error: Error, context?: string) {
    this.whenReady$.pipe(switchMap(() => from(this.client.users.fetch(this.env.DISCORD_SARU_ID)))).subscribe((user) => {
      const stack = error.stack
        ?.split('\n')
        .filter((line) => !line.includes('node_modules'))
        .join('\n')
      const msg = `Error${context ? ` in \`${context}\`` : ''}: \n\`\`\`${stack}`

      from(user.send(msg.slice(0, 2000 - 3) + '```')).subscribe({
        next: () => this.logger.error(`Error notification sent to Discord user ${user.tag}`, DiscordService.name, undefined, true),
        error: (err) => console.error('Failed to send error notification to Discord:', err),
      })
    })
  }
}
