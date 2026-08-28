import { StoreItem, LeagueTier, Badge } from '../types/user';

export const STORE_ITEMS: StoreItem[] = [
  // Player appearances (matching RichUp style)
  {
    id: 'orange',
    name: 'Classic Orange',
    category: 'appearance',
    priceCoins: 30,
    previewColor: '#ff7844',
    emoji: '🟠',
    description: 'The iconic vibrant orange RichUp blob with friendly eyes.',
    rarity: 'common',
    isPopular: true
  },
  {
    id: 'bu',
    name: 'Bu Purple',
    category: 'appearance',
    priceCoins: 50,
    previewColor: '#b066fe',
    emoji: '🟣',
    description: 'Charming purple jelly blob with rosy cheeks.',
    rarity: 'common'
  },
  {
    id: 'navy',
    name: 'Navy',
    category: 'appearance',
    priceCoins: 40,
    previewColor: '#2563eb',
    emoji: '🐙',
    description: 'Classic richup navy squid avatar with curious eyes.',
    rarity: 'common'
  },
  {
    id: 'lilac',
    name: 'Lilac',
    category: 'appearance',
    priceCoins: 80,
    previewColor: '#a855f7',
    emoji: '👾',
    description: 'Playful lilac marshmallow creature.',
    rarity: 'rare'
  },
  {
    id: 'apple',
    name: 'Apple',
    category: 'appearance',
    priceCoins: 90,
    previewColor: '#22c55e',
    emoji: '🍏',
    description: 'Crisp green apple with cartoon stare.',
    rarity: 'rare'
  },
  {
    id: 'fire',
    name: 'Fire',
    category: 'appearance',
    priceCoins: 130,
    previewColor: '#f97316',
    emoji: '🔥',
    description: 'Blazing fireball eager for intense bidding wars.',
    rarity: 'epic',
    isPopular: true
  },
  {
    id: 'ghost',
    name: 'Phantom',
    category: 'appearance',
    priceCoins: 160,
    previewColor: '#94a3b8',
    emoji: '👻',
    description: 'Ghostly apparition that haunts rivals with heavy rents.',
    rarity: 'epic'
  },
  {
    id: 'cyber',
    name: 'Cyber Bot',
    category: 'appearance',
    priceCoins: 220,
    previewColor: '#06b6d4',
    emoji: '🤖',
    description: 'Algorithmic trading bot programmed to dominate real estate.',
    rarity: 'epic'
  },
  {
    id: 'king',
    name: 'King Gold',
    category: 'appearance',
    priceCoins: 350,
    previewColor: '#eab308',
    emoji: '👑',
    description: 'Golden royal monarch with diamond studs.',
    rarity: 'legendary',
    isPopular: true
  },
  {
    id: 'ninja',
    name: 'Shadow Ninja',
    category: 'appearance',
    priceCoins: 280,
    previewColor: '#334155',
    emoji: '🥷',
    description: 'Silent assassin collecting taxes from the shadows.',
    rarity: 'rare'
  },

  // Board maps
  {
    id: 'worldwide',
    name: 'Mr. Worldwide',
    category: 'maps',
    priceCoins: 180,
    previewColor: '#3b82f6',
    emoji: '🌐',
    description: 'Travel from Tokyo Shibuya to Paris and New York.',
    rarity: 'rare',
    isPopular: true
  },
  {
    id: 'death_valley',
    name: 'Death Valley',
    category: 'maps',
    priceCoins: 180,
    previewColor: '#dc2626',
    emoji: '☠️',
    description: 'Dangerous volcanic wasteland with sizzling rents.',
    rarity: 'rare'
  },
  {
    id: 'lucky',
    name: 'Lucky Wheel',
    category: 'maps',
    priceCoins: 180,
    previewColor: '#10b981',
    emoji: '🍀',
    description: 'Emerald clover haven with frequent jackpot payouts.',
    rarity: 'rare'
  },
  {
    id: 'cyber_neon',
    name: 'Cyber Neon',
    category: 'maps',
    priceCoins: 240,
    previewColor: '#8b5cf6',
    emoji: '⚡',
    description: 'High-tech cyberpunk grid bathed in neon luminescence.',
    rarity: 'epic'
  },

  // Upgrades / Dice Skins
  {
    id: 'dice_golden',
    name: 'Gold Ingot Dice',
    category: 'upgrades',
    priceCoins: 120,
    previewColor: '#f59e0b',
    emoji: '🎲',
    description: 'Heavy gold-plated dice with resonant clatter.',
    rarity: 'rare'
  },
  {
    id: 'dice_neon',
    name: 'Neon Glow Dice',
    category: 'upgrades',
    priceCoins: 90,
    previewColor: '#ec4899',
    emoji: '✨',
    description: 'Glowing ultraviolet dice leaving light trails.',
    rarity: 'common'
  },
  {
    id: 'dice_ruby',
    name: 'Crimson Ruby Dice',
    category: 'upgrades',
    priceCoins: 150,
    previewColor: '#ef4444',
    emoji: '💎',
    description: 'Polished gemstone dice carved from raw ruby.',
    rarity: 'epic'
  },

  // Profile pictures & Frames
  {
    id: 'pfp_crown',
    name: 'Gilded Tycoon Frame',
    category: 'profile_pictures',
    priceCoins: 75,
    previewColor: '#eab308',
    emoji: '👑',
    description: 'Golden laurel wreath with glowing crown aura and radiant sparkles.',
    rarity: 'rare',
    isPopular: true
  },
  {
    id: 'pfp_neon',
    name: 'Cyberpunk Holo Frame',
    category: 'profile_pictures',
    priceCoins: 75,
    previewColor: '#06b6d4',
    emoji: '💠',
    description: 'High-tech cyan neon animated cyber ring with pulsing light.',
    rarity: 'rare'
  },
  {
    id: 'pfp_fire',
    name: 'Inferno Blaze Frame',
    category: 'profile_pictures',
    priceCoins: 90,
    previewColor: '#f97316',
    emoji: '🔥',
    description: 'Blazing flame ring with crackling embers and fiery glow.',
    rarity: 'epic'
  },
  {
    id: 'pfp_diamond',
    name: 'Diamond Tycoon Frame',
    category: 'profile_pictures',
    priceCoins: 120,
    previewColor: '#38bdf8',
    emoji: '💎',
    description: 'Prismatic crystal diamond ring with glittering starlight reflections.',
    rarity: 'legendary'
  }
];

export const BADGES_LIST: Badge[] = [
  {
    id: 'first_win',
    name: 'First Blood',
    description: 'Win your first RichUp economy match.',
    icon: '🏆',
    rarity: 'common',
    maxProgress: 1
  },
  {
    id: 'high_roller',
    name: 'High Roller',
    description: 'Win a wager match with $20+ prize pool.',
    icon: '💰',
    rarity: 'rare',
    maxProgress: 1
  },
  {
    id: 'monopoly_king',
    name: 'Monopoly King',
    description: 'Own 3 complete color sets simultaneously in a match.',
    icon: '🏰',
    rarity: 'epic',
    maxProgress: 3
  },
  {
    id: 'hotel_tycoon',
    name: 'Skyline Developer',
    description: 'Build 10 hotels across all matches.',
    icon: '🏢',
    rarity: 'rare',
    maxProgress: 10
  },
  {
    id: 'double_trouble',
    name: 'Double Trouble',
    description: 'Roll doubles 3 times in a single match.',
    icon: '🎲',
    rarity: 'common',
    maxProgress: 3
  },
  {
    id: 'prison_veteran',
    name: 'Houdini Escape',
    description: 'Escape prison by rolling doubles on your first attempt.',
    icon: '🔓',
    rarity: 'rare',
    maxProgress: 1
  },
  {
    id: 'rent_crusher',
    name: 'Rent Crusher',
    description: 'Collect over $1,000 in a single rent landing.',
    icon: '💸',
    rarity: 'legendary',
    maxProgress: 1000
  },
  {
    id: 'streak_master',
    name: 'Unstoppable',
    description: 'Achieve a 3-game win streak in competitive rooms.',
    icon: '🔥',
    rarity: 'legendary',
    maxProgress: 3
  }
];

export const LEAGUE_TIERS_INFO: Record<LeagueTier, { minLp: number; maxLp: number; color: string; badge: string; icon: string }> = {
  Bronze: { minLp: 0, maxLp: 299, color: '#b45309', badge: 'bg-amber-800/40 text-amber-300 border-amber-600', icon: '🥉' },
  Silver: { minLp: 300, maxLp: 599, color: '#94a3b8', badge: 'bg-slate-700/50 text-slate-200 border-slate-400', icon: '🥈' },
  Gold: { minLp: 600, maxLp: 999, color: '#eab308', badge: 'bg-yellow-900/40 text-yellow-300 border-yellow-500', icon: '🥇' },
  Platinum: { minLp: 1000, maxLp: 1399, color: '#2dd4bf', badge: 'bg-teal-900/40 text-teal-300 border-teal-500', icon: '💠' },
  Diamond: { minLp: 1400, maxLp: 1799, color: '#38bdf8', badge: 'bg-sky-900/40 text-sky-300 border-sky-400', icon: '💎' },
  Master: { minLp: 1800, maxLp: 2199, color: '#a855f7', badge: 'bg-purple-900/40 text-purple-300 border-purple-400', icon: '🔮' },
  Tycoon: { minLp: 2200, maxLp: 9999, color: '#f59e0b', badge: 'bg-amber-950/60 text-amber-200 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)]', icon: '👑' }
};
