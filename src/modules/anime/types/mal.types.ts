export interface IMalAnimeNode {
  id: number
  title: string
  main_picture?: {
    medium: string
    large: string
  }
}

export interface IMalAnimeDetails extends IMalAnimeNode {
  alternative_titles?: {
    synonyms: string[]
    en: string
    ja: string
  }
  synopsis: string
  mean: number
  rank: number
  popularity: number
  num_episodes: number
  status: string
  genres: { id: number; name: string }[]
}

export interface IMalSearchResponse {
  data: { node: IMalAnimeNode }[]
  paging: {
    next?: string
  }
}

export interface IMalUserAnimeListEntry {
  node: IMalAnimeNode
  list_status: {
    status: string
    score: number
    num_episodes_watched: number
    is_rewatching: boolean
    updated_at: string
  }
}

export interface IMalUserAnimeListResponse {
  data: IMalUserAnimeListEntry[]
  paging: {
    next?: string
  }
}

export interface IMalTokenResponse {
  token_type: string
  expires_in: number
  access_token: string
  refresh_token: string
}

export interface IMalAnimeListResponse {
  data: IMalAnimeListEntry[]
  paging?: {
    next?: string
  }
}

export interface IMalAnimeListEntry {
  node: IMalAnimeListNode
  list_status: IMalAnimeListStatus
}

export type IMalAnimeStatus = 'finished_airing' | 'currently_airing' | 'not_yet_aired'
export type IMalAnimeMyStatus = 'completed' | 'watching' | 'on_hold' | 'dropped' | 'plan_to_watch'
export type IMalAnimeSeasonEnum = 'winter' | 'spring' | 'summer' | 'fall'

export interface IMalAnimeListNode {
  id: number
  title: string
  main_picture?: {
    medium: string
    large: string
  }
  num_episodes: number
  mean: number
  status: IMalAnimeStatus
  my_list_status: IMalAnimeListMyListStatus
  season: IMalAnimeSeasonEnum
  synopsis: string
}

export interface IMalAnimeListMyListStatus {
  status: IMalAnimeMyStatus
  score: number
  num_episodes_watched: number
  is_rewatching: boolean
  updated_at: string
  start_date: string
  finish_date: string
}

export interface IMalAnimeListStatus {
  status: IMalAnimeMyStatus
  score: number
  num_episodes_watched: number
}

export interface IMalAnimeSeason {
  year: number
  season: IMalAnimeSeasonEnum
}

export interface Anime {
  id: number
  title: string
  score: number
  image: string
  episodes: number
  status: IMalAnimeStatus
  url: string
  myStatus: AnimeMyStatus
  season: IMalAnimeSeasonEnum
  synopsis: string
}

export interface AnimeMyStatus {
  status: IMalAnimeMyStatus
  score: number // 0-10
  episodesWatched: number
  startedAt: string | null // year-month-day
  finishedAt: string | null // year-month-day
  updatedAt: string // year-month-dayTHH:MM:SS
}
