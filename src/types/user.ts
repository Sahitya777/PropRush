export type LeagueTier = 
  | 'Bronze' 
  | 'Silver' 
  | 'Gold' 
  | 'Platinum' 
  | 'Diamond' 
  | 'Master' 
  | 'Tycoon';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt?: string;
  progress?: number;
  maxProgress?: number;
}

export interface StoreItem {
  id: string;
  name: string;
  category: 'appearance' | 'maps' | 'upgrades' | 'profile_pictures' | 'dice_skins' | 'coins';
  priceCoins: number;
  previewColor?: string;
  emoji?: string;
  image?: string;
  description: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  isPopular?: boolean;
}

export interface MatchHistory {
  id: string;
  roomName: string;
  date: string;
  placement: number;
  totalPlayers: number;
  betAmount: number;
  payout: number;
  netWorth: number;
  lpChange: number;
  durationMinutes: number;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar: string; // skin id: 'navy' | 'lilac' | 'apple' | 'fire' etc.
  avatarFrame?: string; // frame id: 'pfp_crown' | 'pfp_neon' | 'pfp_fire' | 'pfp_diamond' | 'pfp_cosmic' | etc.
  profilePictureUrl?: string;
  clerkUserId?: string;
  diceSkin?: string; // 'dice_golden' | 'dice_neon' | 'dice_magma' | etc.
  mapSkin?: string; // 'worldwide' | 'death_valley' | 'cyber' | 'candy' | etc.
  title: string;
  coins: number;
  walletBalance: number; // in USD $ (e.g. 50.00)
  leaguePoints: number; // 0 - 2000+
  leagueTier: LeagueTier;
  level: number;
  xp: number;
  maxXp: number;
  inventory: {
    appearances: string[];
    maps: string[];
    profilePictures: string[];
    diceSkins: string[];
  };
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    winStreak: number;
    bestWinStreak: number;
    totalEarningsUsd: number;
    totalCoinsEarned: number;
    monopoliesBuilt: number;
    bankruptciesCaused: number;
    rentCollectedTotal: number;
  };
  badges: Badge[];
  matchHistory: MatchHistory[];
}
