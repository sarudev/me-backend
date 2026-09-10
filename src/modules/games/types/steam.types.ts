export interface IPlayerServiceResponse {
  response: {
    game_count: number
    games: IGetOwnedGames[]
  }
}

export interface IGetOwnedGames {
  appid: number
  name: string
  playtime_forever: number
}

export interface IStoreBrowseService {
  response: {
    store_items: IGetItems[]
  }
}

export interface IGetItems {
  id: number
  name: string
  appid: number
  assets: IGetItemsAssets
}

export interface IGetItemsAssets {
  asset_url_format: string
  main_capsule: string
  small_capsule: string
  header: string
  page_background: string
  hero_capsule: string
  library_capsule: string
  library_hero: string
}

export interface ISteamUser {
  response: {
    players: IGetPlayerSummaries[]
  }
}

export interface IGetPlayerSummaries {
  steamid: string
  personaname: string
  profileurl: string
  avatar: string
  avatarfull: string
}

export interface ISteamUserStatsv2 {
  game: {
    gameName: string
    gameVersion: string
    availableGameStats: IGetPlayerAchievements
  }
}

export interface IGetPlayerAchievements {
  achievements: {
    name: string
    defaultvalue: number
    displayName: string
    hidden: number
    description: string
    icon: string
    icongray: string
  }[]
  stats: {
    name: string
    defaultvalue: number
    displayName: string
  }[]
}

export interface ISteamUserStatsv1 {
  playerstats: {
    steamID: string
    gameName: string
    achievements: GetPlayerAchievements[]
    success: boolean
  }
}

export interface GetPlayerAchievements {
  apiname: string
  achieved: number
  unlocktime: number
}
