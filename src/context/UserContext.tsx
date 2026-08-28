import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, LeagueTier, MatchHistory, Badge } from '../types/user';
import { BADGES_LIST, LEAGUE_TIERS_INFO } from '../data/storeData';
import { sounds } from '../utils/audio';

interface UserContextType {
  user: UserProfile;
  updateUser: (updates: Partial<UserProfile>) => void;
  updateUsername: (name: string) => void;
  depositFunds: (amount: number, method: string) => boolean;
  withdrawFunds: (amount: number) => boolean;
  buyCoinPack: (coins: number, priceUsd: number) => boolean;
  deductBuyIn: (amount: number) => boolean;
  buyStoreItem: (itemId: string, category: string, price: number) => boolean;
  equipItem: (category: 'appearance' | 'maps' | 'diceSkins' | 'profile_pictures', itemId: string) => void;
  recordMatchResult: (result: {
    roomName: string;
    placement: number;
    totalPlayers: number;
    betAmount: number;
    payout: number;
    netWorth: number;
    durationMinutes: number;
    stats: {
      rentCollected: number;
      propertiesBought: number;
      housesBuilt: number;
      doublesRolled: number;
    };
  }) => { lpChange: number; coinsEarned: number; newBadges: Badge[] };
  claimDailyReward: () => number | null;
  lastDailyClaim: string | null;
  loginUser: (email: string, username: string) => void;
  logoutUser: () => void;
  isLoggedIn: boolean;
}

const DEFAULT_USER: UserProfile = {
  id: 'usr_' + Math.random().toString(36).substring(2, 9),
  username: 'sahi',
  email: 'sahi@richup.io',
  avatar: 'orange',
  avatarFrame: 'pfp_neon',
  title: 'Novice Landlord',
  coins: 240, // starter coins to try store
  walletBalance: 50.00, // $50 starter wager wallet balance
  leaguePoints: 750, // Gold Tier
  leagueTier: 'Gold',
  level: 4,
  xp: 320,
  maxXp: 600,
  inventory: {
    appearances: ['orange', 'bu', 'navy', 'apple'],
    maps: ['classic', 'worldwide'],
    profilePictures: ['pfp_neon', 'pfp_crown', 'pfp_fire'],
    diceSkins: ['dice_neon']
  },
  stats: {
    gamesPlayed: 14,
    gamesWon: 8,
    winStreak: 2,
    bestWinStreak: 4,
    totalEarningsUsd: 152.00,
    totalCoinsEarned: 680,
    monopoliesBuilt: 11,
    bankruptciesCaused: 9,
    rentCollectedTotal: 18450
  },
  badges: [
    { ...BADGES_LIST[0], unlockedAt: '2026-08-20' },
    { ...BADGES_LIST[4], unlockedAt: '2026-08-22' }
  ],
  matchHistory: [
    {
      id: 'mh_1',
      roomName: 'High Stakes NYC',
      date: 'Yesterday',
      placement: 1,
      totalPlayers: 4,
      betAmount: 10,
      payout: 38,
      netWorth: 4250,
      lpChange: 45,
      durationMinutes: 12
    },
    {
      id: 'mh_2',
      roomName: 'Casual Quick #402',
      date: '2 days ago',
      placement: 2,
      totalPlayers: 4,
      betAmount: 0,
      payout: 0,
      netWorth: 2100,
      lpChange: 15,
      durationMinutes: 18
    }
  ]
};

function calculateLeagueTier(lp: number): LeagueTier {
  if (lp >= 2200) return 'Tycoon';
  if (lp >= 1800) return 'Master';
  if (lp >= 1400) return 'Diamond';
  if (lp >= 1000) return 'Platinum';
  if (lp >= 600) return 'Gold';
  if (lp >= 300) return 'Silver';
  return 'Bronze';
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('richup_user_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading saved profile', e);
      }
    }
    return DEFAULT_USER;
  });

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('richup_auth') === 'true' || true;
  });

  const [lastDailyClaim, setLastDailyClaim] = useState<string | null>(() => {
    return localStorage.getItem('richup_daily_claim');
  });

  useEffect(() => {
    localStorage.setItem('richup_user_profile', JSON.stringify(user));
  }, [user]);

  const updateUser = (updates: Partial<UserProfile>) => {
    setUser(prev => ({ ...prev, ...updates }));
  };

  const updateUsername = (name: string) => {
    const trimmed = name.trim() || 'Player';
    setUser(prev => ({ ...prev, username: trimmed }));
  };

  const depositFunds = (amount: number, method: string) => {
    if (amount <= 0) return false;
    sounds.playCashRegister();
    setUser(prev => ({
      ...prev,
      walletBalance: Math.round((prev.walletBalance + amount) * 100) / 100
    }));
    return true;
  };

  const withdrawFunds = (amount: number) => {
    if (amount <= 0 || user.walletBalance < amount) return false;
    sounds.playClick();
    setUser(prev => ({
      ...prev,
      walletBalance: Math.round((prev.walletBalance - amount) * 100) / 100
    }));
    return true;
  };

  const buyCoinPack = (coins: number, priceUsd: number): boolean => {
    if (priceUsd <= 0 || user.walletBalance < priceUsd) {
      return false;
    }
    sounds.playCashRegister();
    setUser(prev => ({
      ...prev,
      walletBalance: Math.round((prev.walletBalance - priceUsd) * 100) / 100,
      coins: prev.coins + coins,
      stats: {
        ...prev.stats,
        totalCoinsEarned: prev.stats.totalCoinsEarned + coins
      }
    }));
    return true;
  };

  const deductBuyIn = (amount: number): boolean => {
    if (amount <= 0) return true;
    if (user.walletBalance < amount) return false;
    sounds.playCashRegister();
    setUser(prev => ({
      ...prev,
      walletBalance: Math.round((prev.walletBalance - amount) * 100) / 100
    }));
    return true;
  };

  const buyStoreItem = (itemId: string, category: string, priceCoins: number) => {
    if (user.coins < priceCoins) return false;

    sounds.playCashRegister();
    setUser(prev => {
      const updatedInv = { ...prev.inventory };
      let newAvatar = prev.avatar;
      let newFrame = prev.avatarFrame;

      if (category === 'appearance') {
        if (!updatedInv.appearances.includes(itemId)) {
          updatedInv.appearances = [...updatedInv.appearances, itemId];
        }
        newAvatar = itemId;
      } else if (category === 'maps') {
        if (!updatedInv.maps.includes(itemId)) {
          updatedInv.maps = [...updatedInv.maps, itemId];
        }
      } else if (category === 'upgrades') {
        if (!updatedInv.diceSkins.includes(itemId)) {
          updatedInv.diceSkins = [...updatedInv.diceSkins, itemId];
        }
      } else if (category === 'profile_pictures') {
        if (!updatedInv.profilePictures.includes(itemId)) {
          updatedInv.profilePictures = [...updatedInv.profilePictures, itemId];
        }
        newFrame = itemId;
      }

      return {
        ...prev,
        coins: prev.coins - priceCoins,
        avatar: newAvatar,
        avatarFrame: newFrame,
        inventory: updatedInv
      };
    });
    return true;
  };

  const equipItem = (category: 'appearance' | 'maps' | 'diceSkins' | 'profile_pictures', itemId: string) => {
    sounds.playClick();
    if (category === 'appearance') {
      setUser(prev => ({ ...prev, avatar: itemId }));
    } else if (category === 'profile_pictures') {
      setUser(prev => ({
        ...prev,
        avatarFrame: prev.avatarFrame === itemId ? 'none' : itemId
      }));
    }
  };

  const claimDailyReward = (): number | null => {
    const today = new Date().toDateString();
    if (lastDailyClaim === today) return null;

    const rewardCoins = 50;
    sounds.playVictory();
    setLastDailyClaim(today);
    localStorage.setItem('richup_daily_claim', today);

    setUser(prev => ({
      ...prev,
      coins: prev.coins + rewardCoins,
      stats: {
        ...prev.stats,
        totalCoinsEarned: prev.stats.totalCoinsEarned + rewardCoins
      }
    }));
    return rewardCoins;
  };

  const recordMatchResult = (result: {
    roomName: string;
    placement: number;
    totalPlayers: number;
    betAmount: number;
    payout: number;
    netWorth: number;
    durationMinutes: number;
    stats: {
      rentCollected: number;
      propertiesBought: number;
      housesBuilt: number;
      doublesRolled: number;
    };
  }) => {
    const isWin = result.placement === 1;
    let lpChange = 0;
    if (isWin) {
      lpChange = 35 + Math.floor(Math.random() * 15);
    } else if (result.placement === 2) {
      lpChange = 10;
    } else if (result.placement === 3) {
      lpChange = -8;
    } else {
      lpChange = -18;
    }

    const coinsEarned = isWin ? 30 + Math.floor(result.betAmount * 2) : 10;
    const xpGained = isWin ? 120 : 50;

    const newBadgesUnlocked: Badge[] = [];

    setUser(prev => {
      const newLp = Math.max(0, prev.leaguePoints + lpChange);
      const newTier = calculateLeagueTier(newLp);
      const newXp = prev.xp + xpGained;
      let newLevel = prev.level;
      let leftoverXp = newXp;
      let newMaxXp = prev.maxXp;

      if (newXp >= prev.maxXp) {
        newLevel += 1;
        leftoverXp = newXp - prev.maxXp;
        newMaxXp = Math.floor(prev.maxXp * 1.3);
      }

      // Check badges
      const existingBadgeIds = prev.badges.map(b => b.id);
      if (isWin && !existingBadgeIds.includes('first_win')) {
        const badge = BADGES_LIST.find(b => b.id === 'first_win');
        if (badge) newBadgesUnlocked.push({ ...badge, unlockedAt: new Date().toISOString() });
      }
      if (isWin && result.betAmount >= 10 && !existingBadgeIds.includes('high_roller')) {
        const badge = BADGES_LIST.find(b => b.id === 'high_roller');
        if (badge) newBadgesUnlocked.push({ ...badge, unlockedAt: new Date().toISOString() });
      }
      if (result.stats.doublesRolled >= 3 && !existingBadgeIds.includes('double_trouble')) {
        const badge = BADGES_LIST.find(b => b.id === 'double_trouble');
        if (badge) newBadgesUnlocked.push({ ...badge, unlockedAt: new Date().toISOString() });
      }

      const newMatch: MatchHistory = {
        id: 'mh_' + Date.now(),
        roomName: result.roomName,
        date: 'Just now',
        placement: result.placement,
        totalPlayers: result.totalPlayers,
        betAmount: result.betAmount,
        payout: result.payout,
        netWorth: result.netWorth,
        lpChange,
        durationMinutes: Math.max(1, result.durationMinutes)
      };

      const updatedWallet = result.payout > 0 
        ? Math.round((prev.walletBalance + result.payout) * 100) / 100 
        : prev.walletBalance;

      return {
        ...prev,
        walletBalance: updatedWallet,
        coins: prev.coins + coinsEarned,
        leaguePoints: newLp,
        leagueTier: newTier,
        level: newLevel,
        xp: leftoverXp,
        maxXp: newMaxXp,
        stats: {
          gamesPlayed: prev.stats.gamesPlayed + 1,
          gamesWon: prev.stats.gamesWon + (isWin ? 1 : 0),
          winStreak: isWin ? prev.stats.winStreak + 1 : 0,
          bestWinStreak: isWin ? Math.max(prev.stats.bestWinStreak, prev.stats.winStreak + 1) : prev.stats.bestWinStreak,
          totalEarningsUsd: prev.stats.totalEarningsUsd + (result.payout > result.betAmount ? (result.payout - result.betAmount) : 0),
          totalCoinsEarned: prev.stats.totalCoinsEarned + coinsEarned,
          monopoliesBuilt: prev.stats.monopoliesBuilt,
          bankruptciesCaused: prev.stats.bankruptciesCaused + (isWin ? (result.totalPlayers - 1) : 0),
          rentCollectedTotal: prev.stats.rentCollectedTotal + result.stats.rentCollected
        },
        badges: [...prev.badges, ...newBadgesUnlocked],
        matchHistory: [newMatch, ...prev.matchHistory.slice(0, 19)]
      };
    });

    return { lpChange, coinsEarned, newBadges: newBadgesUnlocked };
  };

  const loginUser = (email: string, username: string) => {
    setIsLoggedIn(true);
    localStorage.setItem('richup_auth', 'true');
    setUser(prev => ({
      ...prev,
      email: email || prev.email,
      username: username || prev.username
    }));
  };

  const logoutUser = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('richup_auth');
  };

  return (
    <UserContext.Provider
      value={{
        user,
        updateUser,
        updateUsername,
        depositFunds,
        withdrawFunds,
        buyCoinPack,
        deductBuyIn,
        buyStoreItem,
        equipItem,
        recordMatchResult,
        claimDailyReward,
        lastDailyClaim,
        loginUser,
        logoutUser,
        isLoggedIn
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
