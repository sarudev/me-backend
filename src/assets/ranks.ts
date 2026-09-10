import { GameId, GameRankings, RankDefinition } from '../modules/app/types/app.types.js'

// appid: 252950
const RocketLeagueRank: RankDefinition[] = [
  {
    id: 'unranked',
    icons: ['unranked.png'],
    divisions: 1,
    name: 'Sin rango',
  },
  {
    id: 'bronze',
    icons: ['bronze_1.png', 'bronze_2.png', 'bronze_3.png'],
    divisions: 3,
    name: 'Bronce',
  },
  {
    id: 'silver',
    icons: ['silver_1.png', 'silver_2.png', 'silver_3.png'],
    divisions: 3,
    name: 'Plata',
  },
  {
    id: 'gold',
    icons: ['gold_1.png', 'gold_2.png', 'gold_3.png'],
    divisions: 3,
    name: 'Oro',
  },
  {
    id: 'platinum',
    icons: ['platinum_1.png', 'platinum_2.png', 'platinum_3.png'],
    divisions: 3,
    name: 'Platino',
  },
  {
    id: 'diamond',
    icons: ['diamond_1.png', 'diamond_2.png', 'diamond_3.png'],
    divisions: 3,
    name: 'Diamante',
  },
  {
    id: 'champion',
    icons: ['champion_1.png', 'champion_2.png', 'champion_3.png'],
    divisions: 3,
    name: 'Campeón',
  },
  {
    id: 'grand_champion',
    icons: ['grand_champion_1.png', 'grand_champion_2.png', 'grand_champion_3.png'],
    divisions: 3,
    name: 'Gran campeón',
  },
  {
    id: 'supersonic_legend',
    icons: ['supersonic_legend.png'],
    divisions: 1,
    name: 'Leyenda supersónica',
  },
]

// appid: -10
const ValorantRank: RankDefinition[] = [
  {
    id: 'unranked',
    icons: ['unranked.png'],
    divisions: 1,
    name: 'Sin rango',
  },
  {
    id: 'iron',
    icons: ['iron_1.png', 'iron_2.png', 'iron_3.png'],
    divisions: 3,
    name: 'Hierro',
  },
  {
    id: 'bronze',
    icons: ['bronze_1.png', 'bronze_2.png', 'bronze_3.png'],
    divisions: 3,
    name: 'Bronce',
  },
  {
    id: 'silver',
    icons: ['silver_1.png', 'silver_2.png', 'silver_3.png'],
    divisions: 3,
    name: 'Plata',
  },
  {
    id: 'gold',
    icons: ['gold_1.png', 'gold_2.png', 'gold_3.png'],
    divisions: 3,
    name: 'Oro',
  },
  {
    id: 'platinum',
    icons: ['platinum_1.png', 'platinum_2.png', 'platinum_3.png'],
    divisions: 3,
    name: 'Platino',
  },
  {
    id: 'diamond',
    icons: ['diamond_1.png', 'diamond_2.png', 'diamond_3.png'],
    divisions: 3,
    name: 'Diamante',
  },
  {
    id: 'ascendant',
    icons: ['ascendant_1.png', 'ascendant_2.png', 'ascendant_3.png'],
    divisions: 3,
    name: 'Ascendente',
  },
  {
    id: 'immortal',
    icons: ['immortal_1.png', 'immortal_2.png', 'immortal_3.png'],
    divisions: 3,
    name: 'Inmortal',
  },
  {
    id: 'radiant',
    icons: ['radiant.png'],
    divisions: 1,
    name: 'Radiante',
  },
]

// appid: 730
const CSRank: RankDefinition[] = [
  {
    id: 'unranked',
    icons: ['common.png'], // b1c3d9
    divisions: 1,
    name: 'Sin rango',
  },
  {
    id: 'common',
    icons: ['common.png'], // b1c3d9
    divisions: 1,
    name: 'Común',
  },
  {
    id: 'uncommon',
    icons: ['uncommon.png'], // 5e98d7
    divisions: 1,
    name: 'Poco común',
  },
  {
    id: 'rare',
    icons: ['rare.png'], // 4b69ff
    divisions: 1,
    name: 'Raro',
  },
  {
    id: 'mythical',
    icons: ['mythical.png'], // 8846ff
    divisions: 1,
    name: 'Mítico',
  },
  {
    id: 'legendary',
    icons: ['legendary.png'], // d22ce6
    divisions: 1,
    name: 'Legendario',
  },
  {
    id: 'ancient',
    icons: ['ancient.png'], // eb4b4b
    divisions: 1,
    name: 'Antiguo',
  },
  {
    id: 'unusual',
    icons: ['unusual.png'], // fed700
    divisions: 1,
    name: 'Inusual',
  },
]

// appid: -20
const FortniteRank: RankDefinition[] = [
  {
    id: 'unranked',
    icons: ['unranked.png'],
    divisions: 1,
    name: 'Sin rango',
  },
  {
    id: 'bronze',
    icons: ['bronze_1.png', 'bronze_2.png', 'bronze_3.png'],
    divisions: 3,
    name: 'Bronce',
  },
  {
    id: 'silver',
    icons: ['silver_1.png', 'silver_2.png', 'silver_3.png'],
    divisions: 3,
    name: 'Plata',
  },
  {
    id: 'gold',
    icons: ['gold_1.png', 'gold_2.png', 'gold_3.png'],
    divisions: 3,
    name: 'Oro',
  },
  {
    id: 'platinum',
    icons: ['platinum_1.png', 'platinum_2.png', 'platinum_3.png'],
    divisions: 3,
    name: 'Platino',
  },
  {
    id: 'diamond',
    icons: ['diamond_1.png', 'diamond_2.png', 'diamond_3.png'],
    divisions: 3,
    name: 'Diamante',
  },
  {
    id: 'elite',
    icons: ['elite_1.png', 'elite_2.png', 'elite_3.png'],
    divisions: 3,
    name: 'Élite',
  },
  {
    id: 'champion',
    icons: ['champion_1.png', 'champion_2.png', 'champion_3.png'],
    divisions: 3,
    name: 'Campeón',
  },
  {
    id: 'unreal',
    icons: ['unreal_1.png', 'unreal_2.png'],
    divisions: 2,
    name: 'Unreal',
  },
]

// appid: 291550
const BrawlhallaRank: RankDefinition[] = [
  {
    id: 'unranked',
    icons: ['unranked.png'],
    divisions: 1,
    name: 'Sin rango',
  },
  {
    id: 'tin',
    icons: ['tin_0.png', 'tin_1.png', 'tin_2.png', 'tin_3.png', 'tin_4.png', 'tin_5.png'],
    divisions: 6,
    name: 'Estaño',
  },
  {
    id: 'bronze',
    icons: ['bronze_0.png', 'bronze_1.png', 'bronze_2.png', 'bronze_3.png', 'bronze_4.png', 'bronze_5.png'],
    divisions: 6,
    name: 'Bronce',
  },
  {
    id: 'silver',
    icons: ['silver_0.png', 'silver_1.png', 'silver_2.png', 'silver_3.png', 'silver_4.png', 'silver_5.png'],
    divisions: 6,
    name: 'Plata',
  },
  {
    id: 'gold',
    icons: ['gold_0.png', 'gold_1.png', 'gold_2.png', 'gold_3.png', 'gold_4.png', 'gold_5.png'],
    divisions: 6,
    name: 'Oro',
  },
  {
    id: 'platinum',
    icons: ['platinum_0.png', 'platinum_1.png', 'platinum_2.png', 'platinum_3.png', 'platinum_4.png', 'platinum_5.png'],
    divisions: 6,
    name: 'Platino',
  },
  {
    id: 'diamond',
    icons: ['diamond.png'],
    divisions: 1,
    name: 'Diamante',
  },
  {
    id: 'valhallan',
    icons: ['valhallan.png'],
    divisions: 1,
    name: 'Valhallan',
  },
]

export const RANKS: Record<GameId, { folder: string; ranks: RankDefinition[] }> = {
  '291550': {
    folder: 'brawlhalla_ranks',
    ranks: BrawlhallaRank,
  },
  '-10': {
    folder: 'valorant_ranks',
    ranks: ValorantRank,
  },
  '252950': {
    folder: 'rocket_league_ranks',
    ranks: RocketLeagueRank,
  },
  '-20': {
    folder: 'fortnite_ranks',
    ranks: FortniteRank,
  },
  '730': {
    folder: 'cs_ranks',
    ranks: CSRank,
  },
}

export const ranksMock: GameRankings[] = [
  {
    id: 291550,
    best: {
      division: 1,
      rankName: 'diamond',
    },
    current: {
      division: 3,
      rankName: 'platinum',
    },
  },
  {
    id: -10,
    best: {
      division: 1,
      rankName: 'radiant',
    },
    current: {
      division: 2,
      rankName: 'platinum',
    },
  },
  {
    id: 252950,
    best: {
      division: 3,
      rankName: 'diamond',
    },
    current: {
      division: 1,
      rankName: 'diamond',
    },
  },
  {
    id: -20,
    best: {
      division: 1,
      rankName: 'unreal',
    },
    current: {
      division: 3,
      rankName: 'silver',
    },
  },
  {
    id: 730,
    best: {
      rankName: 'mythical',
      division: 1,
      elo: 19130,
    },
    current: {
      rankName: 'unranked',
      division: 1,
      elo: null,
    },
  },
]
