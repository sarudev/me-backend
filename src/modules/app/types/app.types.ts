export interface RedisWrapper<T> {
  timestamp: number
  data: T
}

export interface CacheSaveEvent<T> {
  key: string
  value: CacheSaveEventValue<T>
}

export interface CacheSaveEventValue<T> {
  new: T | null
  old: T | null
}
