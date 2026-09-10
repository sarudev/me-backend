import { Injectable } from '@nestjs/common'
import { Client, Events, GatewayIntentBits } from 'discord.js'
import { from, map } from 'rxjs'
import { EnvService } from './env.service.js'
import { AppLogger } from './logger.service.js'

@Injectable()
export class DiscordService {
  private client: Client

  constructor(
    private readonly env: EnvService,
    private readonly logger: AppLogger,
  ) {
    this.client = new Client({ intents: [GatewayIntentBits.Guilds] })
    this.registerEventHandlers()
    this.login()
  }

  private login() {
    this.client.login(this.env.DISCORD_TOKEN)
  }

  private async registerEventHandlers() {
    this.client.once(Events.ClientReady, (readyClient) => {
      this.logger.log(`Logged in as ${readyClient.user.tag}!`, DiscordService.name)
    })
  }

  public getProfilePicture() {
    return from(this.client.users.fetch(this.env.DISCORD_SARU_ID)).pipe(map((user) => `${user.displayAvatarURL()}?size=512`))
  }
}
