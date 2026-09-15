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
