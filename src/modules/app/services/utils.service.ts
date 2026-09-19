import { HttpService } from '@nestjs/axios'
import { Injectable } from '@nestjs/common'
import { filter, map, switchMap, take, tap } from 'rxjs/operators'
import { from, OperatorFunction } from 'rxjs'
import { dirname, join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { type Response } from 'express'

@Injectable()
export class UtilsService {
  constructor(private readonly httpService: HttpService) {}

  public handleError(res: Response, err: any) {
    res.status(err.response?.status ?? 500).json({
      status: err.response?.status,
      data: err.response?.data,
    })
  }

  public whenReady<T>(): OperatorFunction<T, T>
  public whenReady<T, B>(map: (value: T) => B): OperatorFunction<T, B>
  public whenReady<T, B>(cb?: (value: T) => B): OperatorFunction<T, T | B> {
    return (source) =>
      source.pipe(
        filter(
          (v) => (typeof v === 'boolean' && v) || (Array.isArray(v) && v[0] === true) || (v && typeof v === 'object' && 'isReady' in v && v.isReady === true),
        ),
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
