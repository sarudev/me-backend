import { HttpService } from '@nestjs/axios'
import { Injectable } from '@nestjs/common'
import { filter, map, switchMap, take, tap } from 'rxjs/operators'
import { EnvService } from './env.service.js'
import { from, OperatorFunction } from 'rxjs'
import { dirname, join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'

@Injectable()
export class UtilsService {
  constructor(private readonly httpService: HttpService) {}

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

  public get expireTime() {
    return 15 * 60 * 1000
  }

  public whenReady<T>(): OperatorFunction<T, T>
  public whenReady<T, B>(map: (value: T) => B): OperatorFunction<T, B>
  public whenReady<T, B>(cb?: (value: T) => B): OperatorFunction<T, T | B> {
    return (source) =>
      source.pipe(
        filter((v) => (typeof v === 'boolean' && v) || (Array.isArray(v) && v[0] === true) || (v && typeof v === 'object' && 'isReady' in v && v.isReady === true)),
        take(1),
        map((v) => (cb ? cb(v) : v)),
      )
  }

  public downloadAndSaveImage(url: string, path: string) {
    const filePath = join(process.cwd(), 'src/assets/images', path)
    const dir = dirname(filePath)

    return this.httpService
      .get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
      })
      .pipe(switchMap(({ data }) => from(mkdir(dir, { recursive: true })).pipe(switchMap(() => from(writeFile(filePath, Buffer.from(data)))))))
  }
}
