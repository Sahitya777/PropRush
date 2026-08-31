export type TileType = 
  | 'go' 
  | 'property' 
  | 'chest' 
  | 'tax' 
  | 'railroad' 
  | 'chance' 
  | 'jail' 
  | 'utility' 
  | 'vacation' 
  | 'gotojail'
  | 'go_to_jail';

export type PropertyGroup = 
  | 'brazil'
  | 'israel'
  | 'italy'
  | 'germany'
  | 'china'
  | 'france'
  | 'uk'
  | 'usa'
  | 'brown' 
  | 'light_blue' 
  | 'pink' 
  | 'orange' 
  | 'red' 
  | 'yellow' 
  | 'green' 
  | 'dark_blue' 
  | 'railroad' 
  | 'utility' 
  | 'special';

export interface BoardTile {
  id: number;
  name: string;
  type: TileType;
  group?: PropertyGroup;
  flag?: string;
  price?: number;
  rent?: number[]; // [base, 1 house, 2 houses, 3 houses, 4 houses, hotel]
  houseCost?: number;
  mortgageValue?: number;
  icon?: string;
  description?: string;
  taxAmount?: number;
}

export interface PlayerDetailedStats {
  turns: number;
  movesCount: number;
  doublesRolled: number;
  rentPaid: number;
  rentCollected: number;
  propertiesBought: number;
  housesBuilt: number;
  hotelsBuilt: number;
  taxesPaid: number;
  jailVisits: number;
  passGoCount: number;
  peakCash: number;
  peakNetWorth: number;
  luckScore?: number;
  mortgagesCount?: number;
  tradesCompleted?: number;
}

export interface MatchRoundSnapshot {
  round: number;
  label: string;
  [key: string]: number | string;
}

export interface MatchDiceStat {
  sum: number;
  count: number;
  expectedPercent: number;
  actualPercent: number;
}

export interface MatchAward {
  id: string;
  title: string;
  badge: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar: string;
  description: string;
  value: string;
}

export interface MatchKeyEvent {
  id: string;
  round: number;
  time: string;
  title: string;
  description: string;
  type: 'monopoly' | 'bankruptcy' | 'huge_rent' | 'jail_sentence' | 'jackpot' | 'trade' | 'auction';
  impact: string;
  playerId?: string;
}

export interface MatchAnalytics {
  matchId: string;
  roomName: string;
  totalRounds: number;
  durationSeconds: number;
  totalEconomyVolume: number;
  totalRentTransacted: number;
  totalTaxesCollected: number;
  totalHousesBuilt: number;
  totalHotelsBuilt: number;
  totalPropertiesSold: number;
  timeline: MatchRoundSnapshot[];
  diceDistribution: MatchDiceStat[];
  playerStats: Record<string, PlayerDetailedStats>;
  awards: MatchAward[];
  keyEvents: MatchKeyEvent[];
}

export interface Player {
  id: string;
  name: string;
  avatar: string; // skin id: 'navy' | 'lilac' | 'apple' | 'fire' | etc.
  avatarFrame?: string; // frame id: 'pfp_crown' | 'pfp_neon' | 'pfp_fire' | 'pfp_diamond'
  diceSkin?: string; // dice skin id: 'dice_golden' | 'dice_neon' | 'dice_magma' etc.
  color: string; // hex or tailwind class
  isBot: boolean;
  isHost?: boolean;
  cash: number;
  netWorth: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  getOutOfJailCards: number;
  isBankrupt: boolean;
  properties: number[]; // tile ids owned
  mortgaged: number[]; // tile ids mortgaged
  houses: Record<number, number>; // tileId -> number of houses (1-4) or 5 for hotel
  stats?: PlayerDetailedStats;
}

export type TurnPhase = 
  | 'roll' 
  | 'action' 
  | 'buy_decision' 
  | 'auction' 
  | 'jail_decision' 
  | 'trade' 
  | 'end_turn';

export interface AuctionState {
  tileId: number;
  highestBid: number;
  highestBidderId: string | null;
  activePlayerIds: string[];
  currentBidderIndex: number;
  timer: number;
  bidHistory: { playerId: string; amount: number; time: string }[];
}

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offeredCash: number;
  offeredProperties: number[];
  requestedCash: number;
  requestedProperties: number[];
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
}

export interface GameLogEntry {
  id: string;
  timestamp: string;
  type: 'roll' | 'buy' | 'rent' | 'jail' | 'chance' | 'chest' | 'build' | 'mortgage' | 'bankrupt' | 'win' | 'trade' | 'auction' | 'tax';
  message: string;
  playerId?: string;
  amount?: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  time: string;
  isSystem?: boolean;
}

export type BoardMapTheme = 
  | 'classic' 
  | 'worldwide' 
  | 'death_valley' 
  | 'lucky' 
  | 'cyber' 
  | 'candy' 
  | 'space' 
  | 'medieval' 
  | 'pirate' 
  | 'egypt';

export interface GameRoom {
  id: string;
  name: string;
  hostId: string;
  isPrivate: boolean;
  maxPlayers: number;
  betAmount: number; // $0 to $100 wager per player
  totalPrizePool: number;
  platformFeeRate: number; // 0.05 (5%)
  status: 'lobby' | 'playing' | 'gameover' | 'finished';
  players: Player[];
  currentTurnPlayerId: string;
  turnTimer: number; // remaining seconds
  turnTimeLimit: number; // 15, 25, 40 seconds
  turnPhase: TurnPhase;
  lastDice: [number, number];
  isDouble: boolean;
  consecutiveDoubles: number;
  freeParkingPool: number;
  boardTheme: BoardMapTheme;
  auction: AuctionState | null;
  activeTrade: TradeOffer | null;
  logs: GameLogEntry[];
  messages: ChatMessage[];
  winner: Player | null;
  fastSpeed: boolean; // 2x animation speeds
  startedAt?: number;
  endedAt?: number;
  currentRound?: number;
  roundHistory?: MatchRoundSnapshot[];
  analytics?: MatchAnalytics;
  pendingCard?: {
    type: 'chance' | 'chest';
    title: string;
    description: string;
    actionType: string;
    value?: number;
  } | null;
}
