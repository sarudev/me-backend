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

export interface RedisWrapper<T> {
  timestamp: number
  data: T
}
