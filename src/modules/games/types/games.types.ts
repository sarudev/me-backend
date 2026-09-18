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

export type GameId = 252950 | -10 | 730 | -20 | 291550

export type GameRankData = RocketLeagueRank | ValorantRank | CSRank | FortniteRank | BrawlhallaRank
export type GameRankings = RocketLeagueRanking | ValorantRanking | CSRanking | FortniteRanking | BrawlhallaRanking

interface GameRankBase {
  id: GameId
  rankName: string
  division: number
  elo?: number | null
}

interface GameRankingBase<T extends GameRankBase> {
  id: T['id']
  best: Omit<T, 'id'>
  current: Omit<T, 'id'>
}

export interface RocketLeagueRank extends GameRankBase {
  id: 252950
  rankName: 'unranked' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'champion' | 'grand_champion' | 'supersonic_legend'
  division: 1 | 2 | 3
}

export interface ValorantRank extends GameRankBase {
  id: -10
  rankName: 'unranked' | 'iron' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'ascendant' | 'immortal' | 'radiant'
  division: 1 | 2 | 3
}

export interface CSRank extends GameRankBase {
  id: 730
  rankName: 'unranked' | 'common' | 'uncommon' | 'rare' | 'mythical' | 'legendary' | 'ancient' | 'unusual'
  division: 1
  elo: number | null
}

export interface FortniteRank extends GameRankBase {
  id: -20
  rankName: 'unranked' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'elite' | 'champion' | 'unreal'
  division: 1 | 2 | 3
}

export interface BrawlhallaRank extends GameRankBase {
  id: 291550
  rankName: 'unranked' | 'tin' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'valhallan'
  division: 1 | 2 | 3 | 4 | 5 | 6
}

export type RocketLeagueRanking = GameRankingBase<RocketLeagueRank>
export type ValorantRanking = GameRankingBase<ValorantRank>
export type CSRanking = GameRankingBase<CSRank>
export type FortniteRanking = GameRankingBase<FortniteRank>
export type BrawlhallaRanking = GameRankingBase<BrawlhallaRank>

export interface RankDefinition {
  id: string
  divisions: number
  icons: string[]
  name: string
}

export interface ResolvedGameRanks {
  best: ResolvedRank
  current: ResolvedRank
}

export interface ResolvedGameRanksWithId extends ResolvedGameRanks {
  id: GameId
}

export interface ResolvedRank {
  name: string
  icon: string
  rankId: string
  division: number
  elo: number | null
}

export interface Game {
  id: number
  name: string
  playtime: number
  account: GameAccount
  assets: GameImageAssets
  state: GameState
  rank: null | ResolvedGameRanks
  details: SteamAppDetailsResolved | null
}

export interface GameState {
  isFavorite: boolean
  isLoved: boolean
  platinumPercentage: null | Platinum
}

export interface GameStateWithId extends GameState {
  id: number
}

export interface Platinum {
  percentage: number
  total: number
  unlocked: number
}

export interface CachedPlatinum extends Platinum {
  id: number
}

export interface GameMergeData {
  id: number
  name: string
  playtime: number
  account: GameAccount
}

export interface GameMergeDataComplete extends GameMergeData {
  rank: null | ResolvedGameRanks
  assets: GameImageAssets
}

export type GameAccount = ExternalGameAccount | SteamAccountData

interface ExternalGameAccount {
  type: 'epic' | 'xbox' | 'riot'
  data: string
}

export interface SteamAccountData {
  type: 'steam'
  data: SteamProfile
}

export interface GameImageAssets {
  library: string
  header: string
}

export interface SteamGameAssets {
  id: number
  assets: GameImageAssets
}

export interface SteamOwnedGame {
  id: number
  name: string
  playtime: number
  steamid: string
}

export interface GameBase {
  id: number
  name: string
  playtime: number
}

export interface GameStats {
  id: number
  name: string
  isLoved: boolean
  isFavorite: boolean
  trackingPlatinum: boolean
  hasRanking: boolean
}

export interface SteamProfile {
  steamid: string
  name: string
  url: string
  icon: string
}

export interface SteamAppDetails {
  success: boolean
  data: SteamAppDetailsData
}

export interface SteamAppDetailsData {
  type: string
  name: string
  steam_appid: number
  required_age: number
  is_free: boolean
  dlc: number[]
  detailed_description: string
  about_the_game: string
  short_description: string
  supported_languages: string
  header_image: string
  capsule_image: string
  capsule_imagev5: string
  website: string
  pc_requirements: {
    minimum: string
    recommended: string
  }
  mac_requirements: {
    minimum: string
    recommended: string
  }
  linux_requirements: {
    minimum: string
    recommended: string
  }
  legal_notice: string
  developers: string[]
  publishers: string[]
  demos: [
    {
      appid: 452280
      description: string
    },
  ]
  price_overview: {
    currency: string
    initial: 1700
    final: 1700
    discount_percent: 0
    initial_formatted: string
    final_formatted: string
  }
  packages: [88199]
  package_groups: [
    {
      name: string
      title: string
      description: string
      selection_text: string
      save_text: string
      display_type: 0
      is_recurring_subscription: string
      subs: [
        {
          packageid: 88199
          percent_savings_text: string
          percent_savings: 0
          option_text: string
          option_description: string
          can_get_free_license: string
          is_free_license: false
          price_in_cents_with_discount: 1700
        },
      ]
    },
  ]
  platforms: {
    windows: true
    mac: true
    linux: true
  }
  metacritic: {
    score: 90
    url: string
  }
  categories: {
    id: 2
    description: string
  }[]
  genres: {
    id: string
    description: string
  }[]
  screenshots: {
    id: 0
    path_thumbnail: string
    path_full: string
  }[]
  movies: {
    id: 256796273
    name: string
    thumbnail: string
    dash_av1: string
    dash_h264: string
    hls_h264: string
    highlight: true
  }[]
  recommendations: {
    total: 195600
  }
  achievements: {
    total: 88
    highlighted: {
      icon: string
      localized_name: string
      archived: 0
      hidden: 0
      name: string
      path: string
    }[]
  }
  release_date: {
    coming_soon: false
    date: string
  }
  support_info: {
    url: string
    email: string
  }
  background: string
  background_raw: string
  content_descriptors: {
    ids: []
    notes: unknown | null
  }
  ratings: {
    dejus: {
      rating: string
      descriptors: string
    }
    kgrb: {
      rating: string
    }
    steam_germany: {
      rating_generated: string
      rating: string
      required_age: string
      banned: string
      use_age_gate: string
      descriptors: string
    }
    igrs: {
      rating_generated: string
      rating: string
      required_age: string
      banned: string
      use_age_gate: string
      descriptors: string
    }
  }
}

export interface SteamAppDetailsResolved {
  id: number
  name: string
  is_free: boolean
  description: string
  price: string
}
