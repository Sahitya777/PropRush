import { StoreItem, LeagueTier, Badge } from '../types/user';

export const STORE_ITEMS: StoreItem[] = [
  // ==========================================
  // PLAYER APPEARANCES / CHARACTERS
  // ==========================================
  {
    id: 'orange',
    name: 'Classic Orange',
    category: 'appearance',
    priceCoins: 30,
    previewColor: '#ff7844',
    emoji: '🟠',
    description: 'The iconic vibrant orange PropRush blob with friendly eyes.',
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
    description: 'Charming purple jelly blob with rosy cheeks and sweet smile.',
    rarity: 'common'
  },
  {
    id: 'navy',
    name: 'Navy Squid',
    category: 'appearance',
    priceCoins: 40,
    previewColor: '#2563eb',
    emoji: '🐙',
    description: 'Classic navy squid avatar with curious eyes and deep sea tenacity.',
    rarity: 'common'
  },
  {
    id: 'lilac',
    name: 'Lilac Sprite',
    category: 'appearance',
    priceCoins: 80,
    previewColor: '#a855f7',
    emoji: '👾',
    description: 'Playful lilac marshmallow creature with energetic bounce.',
    rarity: 'rare'
  },
  {
    id: 'apple',
    name: 'Green Apple',
    category: 'appearance',
    priceCoins: 90,
    previewColor: '#22c55e',
    emoji: '🍏',
    description: 'Crisp green apple character with a witty cartoon stare.',
    rarity: 'rare'
  },
  {
    id: 'fire',
    name: 'Blaze Elemental',
    category: 'appearance',
    priceCoins: 130,
    previewColor: '#f97316',
    emoji: '🔥',
    description: 'Blazing fireball entity eager for high-stakes bidding wars.',
    rarity: 'epic',
    isPopular: true
  },
  {
    id: 'ghost',
    name: 'Phantom Ghost',
    category: 'appearance',
    priceCoins: 160,
    previewColor: '#94a3b8',
    emoji: '👻',
    description: 'Ghostly apparition that haunts rivals with relentless rent fees.',
    rarity: 'epic'
  },
  {
    id: 'cyber',
    name: 'Cyber Bot 2099',
    category: 'appearance',
    priceCoins: 220,
    previewColor: '#06b6d4',
    emoji: '🤖',
    description: 'High-frequency algorithmic trading bot engineered for monopoly dominance.',
    rarity: 'epic'
  },
  {
    id: 'king',
    name: 'King Gold',
    category: 'appearance',
    priceCoins: 350,
    previewColor: '#eab308',
    emoji: '👑',
    description: 'Golden royal monarch wearing a jewel-encrusted diamond crown.',
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
    description: 'Silent midnight assassin extracting rent from the darkest shadows.',
    rarity: 'rare'
  },
  {
    id: 'cat',
    name: 'Neon Cyber Kitty',
    category: 'appearance',
    priceCoins: 240,
    previewColor: '#f43f5e',
    emoji: '🐱',
    description: 'Futuristic glowing feline with laser-focused intuition and synth whiskers.',
    rarity: 'rare'
  },
  {
    id: 'duck',
    name: 'Quack Tycoon',
    category: 'appearance',
    priceCoins: 260,
    previewColor: '#facc15',
    emoji: '🦆',
    description: 'Executive robo-duck equipped with golden aviators and a micro-tuxedo.',
    rarity: 'epic'
  },
  {
    id: 'boss',
    name: 'Billionaire Boss',
    category: 'appearance',
    priceCoins: 380,
    previewColor: '#1e293b',
    emoji: '🕶️',
    description: 'Ruthless Wall Street venture capitalist who never settles for second place.',
    rarity: 'legendary'
  },
  {
    id: 'alien',
    name: 'Cosmic Alien',
    category: 'appearance',
    priceCoins: 310,
    previewColor: '#8b5cf6',
    emoji: '👽',
    description: 'Extraterrestrial mogul acquiring planetary assets across solar systems.',
    rarity: 'epic'
  },
  {
    id: 'knight',
    name: 'Pixel Paladin',
    category: 'appearance',
    priceCoins: 290,
    previewColor: '#64748b',
    emoji: '🛡️',
    description: 'Retro 8-bit armored knight defending properties against rival sieges.',
    rarity: 'rare'
  },
  {
    id: 'dragon',
    name: 'Infernal Dragon',
    category: 'appearance',
    priceCoins: 450,
    previewColor: '#dc2626',
    emoji: '🐲',
    description: 'Ancient mythical dragon resting atop hoards of golden monopoly riches.',
    rarity: 'legendary',
    isPopular: true
  },

  // ==========================================
  // DISCORD NITRO-STYLE ANIMATED AVATAR FRAMES
  // ==========================================
  {
    id: 'pfp_crown',
    name: 'Gilded Tycoon Frame',
    category: 'profile_pictures',
    priceCoins: 85,
    previewColor: '#eab308',
    emoji: '👑',
    description: 'Golden laurel wreath with glowing crown aura, moving radiance, and glinting sparkles.',
    rarity: 'rare',
    isPopular: true
  },
  {
    id: 'pfp_neon',
    name: 'Cyberpunk Holo Frame',
    category: 'profile_pictures',
    priceCoins: 110,
    previewColor: '#06b6d4',
    emoji: '💠',
    description: 'Nitro-style rotating cyber neon ring with pulsing cyan nodes and holographic energy sweep.',
    rarity: 'rare'
  },
  {
    id: 'pfp_fire',
    name: 'Inferno Blaze Vortex',
    category: 'profile_pictures',
    priceCoins: 160,
    previewColor: '#f97316',
    emoji: '🔥',
    description: 'Animated blazing flame ring with crackling embers, flickering heat waves, and fiery ascension.',
    rarity: 'epic',
    isPopular: true
  },
  {
    id: 'pfp_diamond',
    name: 'Diamond Prism Frame',
    category: 'profile_pictures',
    priceCoins: 190,
    previewColor: '#38bdf8',
    emoji: '💎',
    description: 'Prismatic crystal diamond ring with glittering starlight flare animation and refractive gleams.',
    rarity: 'epic'
  },
  {
    id: 'pfp_cosmic',
    name: 'Cosmic Nebula Vortex',
    category: 'profile_pictures',
    priceCoins: 280,
    previewColor: '#8b5cf6',
    emoji: '🌌',
    description: 'Premium Discord Nitro-style swirling galaxy vortex with rotating stellar dust and pulsar rays.',
    rarity: 'legendary',
    isPopular: true
  },
  {
    id: 'pfp_electric',
    name: 'Electric Storm Arc',
    category: 'profile_pictures',
    priceCoins: 290,
    previewColor: '#38bdf8',
    emoji: '⚡',
    description: 'Crackling lightning thunder arcs flashing and rotating around the avatar with high-voltage surges.',
    rarity: 'legendary'
  },
  {
    id: 'pfp_rgb',
    name: 'RGB Chromatic Flow',
    category: 'profile_pictures',
    priceCoins: 320,
    previewColor: '#ec4899',
    emoji: '🌈',
    description: 'Hypnotic 360-degree rotating rainbow RGB laser ring with continuous chromatic spectrum shift.',
    rarity: 'legendary',
    isPopular: true
  },
  {
    id: 'pfp_void',
    name: 'Dark Matter Void',
    category: 'profile_pictures',
    priceCoins: 340,
    previewColor: '#6b21a8',
    emoji: '🔮',
    description: 'Interdimensional black hole event horizon with violet gravitational distortion waves.',
    rarity: 'legendary'
  },
  {
    id: 'pfp_sakura',
    name: 'Sakura Petal Drift',
    category: 'profile_pictures',
    priceCoins: 220,
    previewColor: '#f472b6',
    emoji: '🌸',
    description: 'Ethereal cherry blossom aura with fluttering pink glowing petals and soft romantic bloom.',
    rarity: 'epic'
  },
  {
    id: 'pfp_dragon',
    name: 'Golden Dragon Aura',
    category: 'profile_pictures',
    priceCoins: 420,
    previewColor: '#f59e0b',
    emoji: '🐉',
    description: 'Ultimate mythical gold dragon coiled around your portrait with soaring fireballs and divine majesty.',
    rarity: 'legendary',
    isPopular: true
  },

  // ==========================================
  // BOARD MAPS
  // ==========================================
  {
    id: 'worldwide',
    name: 'Mr. Worldwide',
    category: 'maps',
    priceCoins: 180,
    previewColor: '#3b82f6',
    emoji: '🌐',
    description: 'Travel from Tokyo Shibuya to Paris, London, and New York penthouses.',
    rarity: 'rare',
    isPopular: true
  },
  {
    id: 'death_valley',
    name: 'Death Valley',
    category: 'maps',
    priceCoins: 210,
    previewColor: '#dc2626',
    emoji: '☠️',
    description: 'Dangerous volcanic wasteland with sizzling magma cracks and punishing rents.',
    rarity: 'rare'
  },
  {
    id: 'lucky',
    name: 'Lucky Clover Haven',
    category: 'maps',
    priceCoins: 210,
    previewColor: '#10b981',
    emoji: '🍀',
    description: 'Emerald clover paradise with frequent jackpot airdrops and fortune payouts.',
    rarity: 'rare'
  },
  {
    id: 'cyber_neon',
    name: 'Cyber Metropolis 2099',
    category: 'maps',
    priceCoins: 280,
    previewColor: '#8b5cf6',
    emoji: '⚡',
    description: 'High-tech cyberpunk grid bathed in neon luminescence and synthwave skylines.',
    rarity: 'epic',
    isPopular: true
  },
  {
    id: 'candy',
    name: 'Candy Kingdom',
    category: 'maps',
    priceCoins: 260,
    previewColor: '#ec4899',
    emoji: '🍭',
    description: 'Pastel sugar wonderland with lollipop hotels, chocolate avenues, and caramel cash flow.',
    rarity: 'epic'
  },
  {
    id: 'space',
    name: 'Space Odyssey',
    category: 'maps',
    priceCoins: 340,
    previewColor: '#4338ca',
    emoji: '🚀',
    description: 'Orbital space stations, lunar real estate, and interstellar warp gates.',
    rarity: 'legendary'
  },
  {
    id: 'medieval',
    name: 'Medieval Castle Keep',
    category: 'maps',
    priceCoins: 290,
    previewColor: '#b45309',
    emoji: '🏰',
    description: 'Cobblestone kingdom streets, royal keeps, drawbridges, and knightly fiefdoms.',
    rarity: 'rare'
  },
  {
    id: 'pirate',
    name: 'Pirate Treasure Cove',
    category: 'maps',
    priceCoins: 310,
    previewColor: '#0d9488',
    emoji: '🏴‍☠️',
    description: 'Tropical skull coves, sunken galleons, doubloon vaults, and rum trade ports.',
    rarity: 'epic'
  },
  {
    id: 'egypt',
    name: 'Ancient Egypt Pyramids',
    category: 'maps',
    priceCoins: 350,
    previewColor: '#d97706',
    emoji: '🏛️',
    description: 'Golden pharaoh tombs, Nile river oases, and sun god monuments.',
    rarity: 'legendary'
  },

  // ==========================================
  // UPGRADES & DICE SKINS
  // ==========================================
  {
    id: 'dice_golden',
    name: 'Gold Ingot Dice',
    category: 'upgrades',
    priceCoins: 140,
    previewColor: '#f59e0b',
    emoji: '🎲',
    description: 'Solid 24-karat gold die that hits the felt with heavy metallic resonance.',
    rarity: 'rare',
    isPopular: true
  },
  {
    id: 'dice_neon',
    name: 'Neon Glow Dice',
    category: 'upgrades',
    priceCoins: 95,
    previewColor: '#ec4899',
    emoji: '✨',
    description: 'Glowing ultraviolet dice leaving glowing light trails during every roll.',
    rarity: 'common'
  },
  {
    id: 'dice_ruby',
    name: 'Crimson Ruby Dice',
    category: 'upgrades',
    priceCoins: 175,
    previewColor: '#ef4444',
    emoji: '💎',
    description: 'Polished royal ruby gemstone with laser-cut golden numbered pips.',
    rarity: 'epic'
  },
  {
    id: 'dice_magma',
    name: 'Molten Magma Dice',
    category: 'upgrades',
    priceCoins: 220,
    previewColor: '#f97316',
    emoji: '🌋',
    description: 'Infernal volcanic dice that smoke and crackle with molten lava pips.',
    rarity: 'epic'
  },
  {
    id: 'dice_cyber',
    name: 'Cyber Matrix Dice',
    category: 'upgrades',
    priceCoins: 240,
    previewColor: '#10b981',
    emoji: '🟩',
    description: 'Holographic matrix data cubes flashing green terminal code lines.',
    rarity: 'epic'
  },
  {
    id: 'dice_cosmic',
    name: 'Cosmic Stardust Dice',
    category: 'upgrades',
    priceCoins: 310,
    previewColor: '#8b5cf6',
    emoji: '🌌',
    description: 'Forged from deep space meteorites, sparkling with miniature galaxies inside.',
    rarity: 'legendary',
    isPopular: true
  },
  {
    id: 'dice_rainbow',
    name: 'Prismatic Rainbow Dice',
    category: 'upgrades',
    priceCoins: 330,
    previewColor: '#38bdf8',
    emoji: '🌈',
    description: 'Iridescent chromatic dice reflecting the full visual color spectrum as they spin.',
    rarity: 'legendary'
  },
  {
    id: 'dice_dragon',
    name: 'Emerald Dragon Dice',
    category: 'upgrades',
    priceCoins: 360,
    previewColor: '#059669',
    emoji: '🐲',
    description: 'Carved from mythical dragon scales with gilded dragon eye pips.',
    rarity: 'legendary'
  }
];

export const BADGES_LIST: Badge[] = [
  {
    id: 'first_win',
    name: 'First Victory',
    description: 'Win your first PropRush real estate match.',
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
  Master: { minLp: 1800, maxLp: 2299, color: '#a855f7', badge: 'bg-purple-900/40 text-purple-300 border-purple-400', icon: '🔮' },
  Tycoon: { minLp: 2300, maxLp: 9999, color: '#f43f5e', badge: 'bg-rose-900/40 text-rose-300 border-rose-400', icon: '👑' }
};
