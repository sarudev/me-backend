import { HttpService } from '@nestjs/axios'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { map } from 'rxjs/operators'
import { GameImageAssets } from '../types/app.types.js'
import { covers } from '../../../assets/covers.js'
import { Request } from 'express'
import { EnvService } from './env.service.js'

@Injectable()
export class UtilsService implements OnModuleInit {
  images: { placeholder: GameImageAssets; [key: number]: GameImageAssets } = {
    placeholder: {
      header: '',
      library: '',
    },
  }

  constructor(
    private readonly httpService: HttpService,
    private readonly env: EnvService,
  ) {}

  onModuleInit() {
    const placeholders = {
      header: `${this.env.BACKEND_URL}/${covers.basePath}/placeholder/header.png`,
      library: `${this.env.BACKEND_URL}/${covers.basePath}/placeholder/library.png`,
    }

    const coversResolved = Object.entries(covers.ids).map(([id, assets]) => ({
      id: Number(id),
      assets: {
        header: `${this.env.BACKEND_URL}/${covers.basePath}/${assets.header}/header.png`,
        library: `${this.env.BACKEND_URL}/${covers.basePath}/${assets.library}/library.png`,
      },
    }))

    this.images.placeholder = placeholders
    coversResolved.forEach((cover) => {
      this.images[cover.id] = cover.assets
    })
  }

  downloadAsBase64(url: string) {
    return this.httpService
      .get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
      })
      .pipe(
        map(({ data, headers }) => {
          const base64 = Buffer.from(data).toString('base64')
          const mimeType = headers['content-type'] ?? 'image/webp'

          return `data:${mimeType};base64,${base64}`
        }),
      )
  }

  isExpired(timestamp: number) {
    return Date.now() - timestamp > this.expireTime - 2000
  }

  public get expireTime() {
    return 15 * 60 * 1000
  }

  public getBackendUrl(req: Request) {
    const url = `${req.protocol}://${req.get('host')}`
    return url.replace(/localhost|127\.0\.0\.1/, '192.168.1.34')
  }
}
