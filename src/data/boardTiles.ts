import { BoardTile, BoardMapTheme } from '../types/game';

export const BASE_BOARD_TILES: BoardTile[] = [
  // 0: TOP-LEFT CORNER: START
  {
    id: 0,
    name: 'START',
    type: 'go',
    description: 'Collect $200 salary as you pass',
    icon: '🚀'
  },
  // 1 to 9: TOP ROW (Left to Right)
  {
    id: 1,
    name: 'Salvador',
    type: 'property',
    group: 'brazil',
    flag: '🇧🇷',
    price: 60,
    rent: [2, 10, 30, 90, 160, 250],
    houseCost: 50,
    mortgageValue: 30
  },
  {
    id: 2,
    name: 'Treasure',
    type: 'chest',
    description: 'Draw a lucky bonus treasure card',
    icon: '🎁'
  },
  {
    id: 3,
    name: 'Rio',
    type: 'property',
    group: 'brazil',
    flag: '🇧🇷',
    price: 60,
    rent: [4, 20, 60, 180, 320, 450],
    houseCost: 50,
    mortgageValue: 30
  },
  {
    id: 4,
    name: 'Earnings Tax',
    type: 'tax',
    taxAmount: 200,
    description: 'Pay %10 earnings tax to central pool',
    icon: '💸'
  },
  {
    id: 5,
    name: 'TLV Airport',
    type: 'railroad',
    group: 'railroad',
    flag: '✈️',
    price: 200,
    rent: [25, 50, 100, 200],
    mortgageValue: 100,
    icon: '✈️'
  },
  {
    id: 6,
    name: 'Tel Aviv',
    type: 'property',
    group: 'israel',
    flag: '🇮🇱',
    price: 100,
    rent: [6, 30, 90, 270, 400, 550],
    houseCost: 50,
    mortgageValue: 50
  },
  {
    id: 7,
    name: 'Haifa',
    type: 'property',
    group: 'israel',
    flag: '🇮🇱',
    price: 110,
    rent: [6, 30, 90, 270, 400, 550],
    houseCost: 50,
    mortgageValue: 55
  },
  {
    id: 8,
    name: 'Surprise',
    type: 'chance',
    description: 'Draw a mystery surprise card',
    icon: '❓'
  },
  {
    id: 9,
    name: 'Jerusalem',
    type: 'property',
    group: 'israel',
    flag: '🇮🇱',
    price: 120,
    rent: [8, 40, 100, 300, 450, 600],
    houseCost: 50,
    mortgageValue: 60
  },
  // 10: TOP-RIGHT CORNER: PRISON
  {
    id: 10,
    name: 'In Prison',
    type: 'jail',
    description: 'Passing by / In Prison (3 turns)',
    icon: '🔒'
  },

  // 11 to 19: RIGHT COLUMN (Top to Bottom)
  {
    id: 11,
    name: 'Venice',
    type: 'property',
    group: 'italy',
    flag: '🇮🇹',
    price: 130,
    rent: [10, 50, 150, 450, 625, 750],
    houseCost: 100,
    mortgageValue: 65
  },
  {
    id: 12,
    name: 'Power Company',
    type: 'utility',
    group: 'utility',
    price: 150,
    rent: [4, 10],
    mortgageValue: 75,
    icon: '⚡'
  },
  {
    id: 13,
    name: 'Milan',
    type: 'property',
    group: 'italy',
    flag: '🇮🇹',
    price: 140,
    rent: [10, 50, 150, 450, 625, 750],
    houseCost: 100,
    mortgageValue: 70
  },
  {
    id: 14,
    name: 'Rome',
    type: 'property',
    group: 'italy',
    flag: '🇮🇹',
    price: 160,
    rent: [12, 60, 180, 500, 700, 900],
    houseCost: 100,
    mortgageValue: 80
  },
  {
    id: 15,
    name: 'MUC Airport',
    type: 'railroad',
    group: 'railroad',
    flag: '✈️',
    price: 200,
    rent: [25, 50, 100, 200],
    mortgageValue: 100,
    icon: '✈️'
  },
  {
    id: 16,
    name: 'Frankfurt',
    type: 'property',
    group: 'germany',
    flag: '🇩🇪',
    price: 180,
    rent: [14, 70, 200, 550, 750, 950],
    houseCost: 100,
    mortgageValue: 90
  },
  {
    id: 17,
    name: 'Treasure',
    type: 'chest',
    description: 'Draw a lucky bonus treasure card',
    icon: '🎁'
  },
  {
    id: 18,
    name: 'Munich',
    type: 'property',
    group: 'germany',
    flag: '🇩🇪',
    price: 190,
    rent: [14, 70, 200, 550, 750, 950],
    houseCost: 100,
    mortgageValue: 95
  },
  {
    id: 19,
    name: 'Berlin',
    type: 'property',
    group: 'germany',
    flag: '🇩🇪',
    price: 200,
    rent: [16, 80, 220, 600, 800, 1000],
    houseCost: 100,
    mortgageValue: 100
  },
  // 20: BOTTOM-RIGHT CORNER: VACATION
  {
    id: 20,
    name: 'Vacation',
    type: 'vacation',
    description: 'Collect all collected tax and penalty cash!',
    icon: '🏖️'
  },

  // 21 to 29: BOTTOM ROW (Right to Left)
  {
    id: 21,
    name: 'Shenzhen',
    type: 'property',
    group: 'china',
    flag: '🇨🇳',
    price: 210,
    rent: [18, 90, 250, 700, 875, 1050],
    houseCost: 150,
    mortgageValue: 105
  },
  {
    id: 22,
    name: 'Surprise',
    type: 'chance',
    description: 'Draw a mystery surprise card',
    icon: '❓'
  },
  {
    id: 23,
    name: 'Beijing',
    type: 'property',
    group: 'china',
    flag: '🇨🇳',
    price: 220,
    rent: [18, 90, 250, 700, 875, 1050],
    houseCost: 150,
    mortgageValue: 110
  },
  {
    id: 24,
    name: 'Shanghai',
    type: 'property',
    group: 'china',
    flag: '🇨🇳',
    price: 240,
    rent: [20, 100, 300, 750, 925, 1100],
    houseCost: 150,
    mortgageValue: 120
  },
  {
    id: 25,
    name: 'CDG Airport',
    type: 'railroad',
    group: 'railroad',
    flag: '✈️',
    price: 200,
    rent: [25, 50, 100, 200],
    mortgageValue: 100,
    icon: '✈️'
  },
  {
    id: 26,
    name: 'Lyon',
    type: 'property',
    group: 'france',
    flag: '🇫🇷',
    price: 260,
    rent: [22, 110, 330, 800, 975, 1150],
    houseCost: 150,
    mortgageValue: 130
  },
  {
    id: 27,
    name: 'Water Company',
    type: 'utility',
    group: 'utility',
    price: 150,
    rent: [4, 10],
    mortgageValue: 75,
    icon: '💧'
  },
  {
    id: 28,
    name: 'Toulouse',
    type: 'property',
    group: 'france',
    flag: '🇫🇷',
    price: 270,
    rent: [22, 110, 330, 800, 975, 1150],
    houseCost: 150,
    mortgageValue: 135
  },
  {
    id: 29,
    name: 'Paris',
    type: 'property',
    group: 'france',
    flag: '🇫🇷',
    price: 280,
    rent: [24, 120, 360, 850, 1025, 1200],
    houseCost: 150,
    mortgageValue: 140
  },
  // 30: BOTTOM-LEFT CORNER: GO TO PRISON
  {
    id: 30,
    name: 'Go to prison',
    type: 'gotojail',
    description: 'Go directly to prison. Do not pass GO!',
    icon: '☠️'
  },

  // 31 to 39: LEFT COLUMN (Bottom to Top)
  {
    id: 31,
    name: 'Liverpool',
    type: 'property',
    group: 'uk',
    flag: '🇬🇧',
    price: 290,
    rent: [26, 130, 390, 900, 1100, 1275],
    houseCost: 200,
    mortgageValue: 145
  },
  {
    id: 32,
    name: 'Manchester',
    type: 'property',
    group: 'uk',
    flag: '🇬🇧',
    price: 300,
    rent: [26, 130, 390, 900, 1100, 1275],
    houseCost: 200,
    mortgageValue: 150
  },
  {
    id: 33,
    name: 'Treasure',
    type: 'chest',
    description: 'Draw a lucky bonus treasure card',
    icon: '🎁'
  },
  {
    id: 34,
    name: 'London',
    type: 'property',
    group: 'uk',
    flag: '🇬🇧',
    price: 320,
    rent: [28, 150, 450, 1000, 1200, 1400],
    houseCost: 200,
    mortgageValue: 160
  },
  {
    id: 35,
    name: 'JFK Airport',
    type: 'railroad',
    group: 'railroad',
    flag: '✈️',
    price: 200,
    rent: [25, 50, 100, 200],
    mortgageValue: 100,
    icon: '✈️'
  },
  {
    id: 36,
    name: 'Surprise',
    type: 'chance',
    description: 'Draw a mystery surprise card',
    icon: '❓'
  },
  {
    id: 37,
    name: 'San Francisco',
    type: 'property',
    group: 'usa',
    flag: '🇺🇸',
    price: 360,
    rent: [35, 175, 500, 1100, 1300, 1500],
    houseCost: 200,
    mortgageValue: 180
  },
  {
    id: 38,
    name: 'Premium Tax',
    type: 'tax',
    taxAmount: 75,
    description: 'Pay $75 luxury premium tax',
    icon: '💍'
  },
  {
    id: 39,
    name: 'New York',
    type: 'property',
    group: 'usa',
    flag: '🇺🇸',
    price: 400,
    rent: [50, 200, 600, 1400, 1700, 2000],
    houseCost: 200,
    mortgageValue: 200
  }
];

export const GROUP_COLORS: Record<string, { bg: string; border: string; text: string; badge: string; name?: string }> = {
  brazil: { bg: 'bg-[#15803d]', border: 'border-[#15803d]', text: 'text-[#4ade80]', badge: '#15803d', name: 'Brazil' },
  israel: { bg: 'bg-[#1d4ed8]', border: 'border-[#1d4ed8]', text: 'text-[#60a5fa]', badge: '#1d4ed8', name: 'Israel' },
  italy: { bg: 'bg-[#047857]', border: 'border-[#047857]', text: 'text-[#34d399]', badge: '#047857', name: 'Italy' },
  germany: { bg: 'bg-[#b45309]', border: 'border-[#b45309]', text: 'text-[#fbbf24]', badge: '#b45309', name: 'Germany' },
  china: { bg: 'bg-[#b91c1c]', border: 'border-[#b91c1c]', text: 'text-[#f87171]', badge: '#b91c1c', name: 'China' },
  france: { bg: 'bg-[#1e40af]', border: 'border-[#1e40af]', text: 'text-[#93c5fd]', badge: '#1e40af', name: 'France' },
  uk: { bg: 'bg-[#9f1239]', border: 'border-[#9f1239]', text: 'text-[#fb7185]', badge: '#9f1239', name: 'United Kingdom' },
  usa: { bg: 'bg-[#312e81]', border: 'border-[#312e81]', text: 'text-[#a5b4fc]', badge: '#312e81', name: 'United States' },
  brown: { bg: 'bg-[#8B4513]', border: 'border-[#8B4513]', text: 'text-[#d7a177]', badge: '#8B4513' },
  light_blue: { bg: 'bg-[#38bdf8]', border: 'border-[#38bdf8]', text: 'text-[#38bdf8]', badge: '#38bdf8' },
  pink: { bg: 'bg-[#ec4899]', border: 'border-[#ec4899]', text: 'text-[#ec4899]', badge: '#ec4899' },
  orange: { bg: 'bg-[#f97316]', border: 'border-[#f97316]', text: 'text-[#f97316]', badge: '#f97316' },
  red: { bg: 'bg-[#ef4444]', border: 'border-[#ef4444]', text: 'text-[#ef4444]', badge: '#ef4444' },
  yellow: { bg: 'bg-[#eab308]', border: 'border-[#eab308]', text: 'text-[#eab308]', badge: '#eab308' },
  green: { bg: 'bg-[#22c55e]', border: 'border-[#22c55e]', text: 'text-[#22c55e]', badge: '#22c55e' },
  dark_blue: { bg: 'bg-[#3b82f6]', border: 'border-[#3b82f6]', text: 'text-[#3b82f6]', badge: '#3b82f6' },
  railroad: { bg: 'bg-[#334155]', border: 'border-[#475569]', text: 'text-[#94a3b8]', badge: '#334155', name: 'Airports' },
  utility: { bg: 'bg-[#0369a1]', border: 'border-[#0284c7]', text: 'text-[#38bdf8]', badge: '#0369a1', name: 'Companies' },
  special: { bg: 'bg-[#475569]', border: 'border-[#475569]', text: 'text-slate-300', badge: '#475569' }
};

export const GROUP_PROPERTY_COUNTS: Record<string, number> = {
  brazil: 2,
  israel: 3,
  italy: 3,
  germany: 3,
  china: 3,
  france: 3,
  uk: 3,
  usa: 2,
  brown: 2,
  light_blue: 3,
  pink: 3,
  orange: 3,
  red: 3,
  yellow: 3,
  green: 3,
  dark_blue: 2,
  railroad: 4,
  utility: 2
};

export interface CardDefinition {
  title: string;
  description: string;
  action: 'cash' | 'goto' | 'jail' | 'out_of_jail' | 'repair' | 'collect_players';
  value?: number;
  tileId?: number;
}

export const CHANCE_CARDS: CardDefinition[] = [
  { title: 'Advance to START', description: 'Collect $200 salary immediately!', action: 'goto', tileId: 0 },
  { title: 'Flight to TLV Airport', description: 'Take a flight to TLV Airport. If you pass START, collect $200.', action: 'goto', tileId: 5 },
  { title: 'Airport Dividend', description: 'Aviation revenue payout! Collect $50.', action: 'cash', value: 50 },
  { title: 'Speeding Fine', description: 'Pay $50 fine to central pool.', action: 'cash', value: -50 },
  { title: 'Go to Prison', description: 'Go directly to prison. Do not pass START, do not collect $200.', action: 'jail' },
  { title: 'Building Repairs', description: 'Pay maintenance on all properties: $25 per house, $100 per hotel.', action: 'repair', value: 25 },
  { title: 'Get Out of Jail Free', description: 'Keep this card until needed or trade it.', action: 'out_of_jail' },
  { title: 'Advance to New York', description: 'Advance token to New York penthouse.', action: 'goto', tileId: 39 },
  { title: 'Advance to Shanghai', description: 'Advance token to Shanghai skyline.', action: 'goto', tileId: 24 },
  { title: 'Crypto Airdrop', description: 'You won a jackpot prize! Collect $150.', action: 'cash', value: 150 }
];

export const CHEST_CARDS: CardDefinition[] = [
  { title: 'Bank Error in Your Favor', description: 'Collect $200 from the bank.', action: 'cash', value: 200 },
  { title: 'Doctor Fee', description: 'Pay $50 hospital consultation.', action: 'cash', value: -50 },
  { title: 'Stock Investment Sale', description: 'From sale of stock you get $50.', action: 'cash', value: 50 },
  { title: 'Holiday Fund Matures', description: 'Receive $100 vacation payout.', action: 'cash', value: 100 },
  { title: 'Income Tax Refund', description: 'Collect $100 tax refund.', action: 'cash', value: 100 },
  { title: 'Birthday Celebration', description: 'It is your birthday! Collect $20 from every player.', action: 'collect_players', value: 20 },
  { title: 'Life Insurance Matures', description: 'Collect $100 payout.', action: 'cash', value: 100 },
  { title: 'Go to Prison', description: 'Go directly to prison.', action: 'jail' },
  { title: 'Get Out of Jail Free', description: 'This card may be kept until needed.', action: 'out_of_jail' }
];

export function getThemedBoardTiles(theme: BoardMapTheme): BoardTile[] {
  return BASE_BOARD_TILES;
}
