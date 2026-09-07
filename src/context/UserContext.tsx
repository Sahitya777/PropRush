import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, LeagueTier, MatchHistory, Badge } from '../types/user';
import { BADGES_LIST, LEAGUE_TIERS_INFO } from '../data/storeData';
import { sounds } from '../utils/audio';
import { syncUserProfileToServer } from '../utils/serverUsersSync';
import { isUserBanned } from '../utils/banManager';

interface UserContextType {
  user: UserProfile;
  isBanned: boolean;
  updateUser: (updates: Partial<UserProfile>) => void;
  updateUsername: (name: string) => void;
  depositFunds: (amount: number, method: string) => boolean;
  withdrawFunds: (amount: number) => boolean;
  buyCoinPack: (coins: number, priceUsd: number) => boolean;
  deductBuyIn: (amount: number) => boolean;
  buyStoreItem: (itemId: string, category: string, price: number) => boolean;
  equipItem: (
    category: 'appearance' | 'maps' | 'upgrades' | 'diceSkins' | 'dice_skins' | 'profile_pictures',
    itemId: string
  ) => void;
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
  loginWithGoogle: (email?: string, name?: string, avatar?: string) => void;
  loginWithSocial: (provider: 'github' | 'discord' | 'apple') => void;
  loginWithEmail: (email: string) => void;
  syncClerkUser: (clerkData: {
    id: string;
    email?: string;
    username?: string;
    fullName?: string;
    imageUrl?: string;
  }) => void;
  logoutUser: () => void;
  isLoggedIn: boolean;
  isAuthModalOpen: boolean;
  authModalReason: string | null;
  openAuthModal: (reason?: string) => void;
  closeAuthModal: () => void;
  requireAuth: (reason: string, onAuthenticated: () => void) => void;
}

const getTabSessionId = (): string => {
  try {
    let tabId = sessionStorage.getItem('proprush_tab_pid');
    if (!tabId) {
      tabId = 'usr_' + Math.random().toString(36).substring(2, 8) + '_' + Date.now().toString(36);
      sessionStorage.setItem('proprush_tab_pid', tabId);
    }
    return tabId;
  } catch {
    return 'usr_' + Math.random().toString(36).substring(2, 8);
  }
};

const DEFAULT_USER: UserProfile = {
  id: 'usr_sahi_super',
  username: 'Sahitya Nijhawan',
  email: 'sahityanijhawan@gmail.com',
  avatar: 'vip',
  avatarFrame: 'pfp_gold_sparkle',
  diceSkin: 'dice_classic',
  mapSkin: 'classic',
  title: 'Platform Administrator',
  coins: 3200,
  walletBalance: 270.00,
  leaguePoints: 2490,
  leagueTier: 'Tycoon',
  level: 14,
  xp: 450,
  maxXp: 1000,
  inventory: {
    appearances: ['orange', 'vip', 'gold', 'cyber'],
    maps: ['classic', 'neon_tokyo', 'worldwide'],
    profilePictures: ['pfp_gold_sparkle'],
    diceSkins: ['dice_classic', 'dice_gold']
  },
  stats: {
    gamesPlayed: 184,
    gamesWon: 135,
    winStreak: 6,
    bestWinStreak: 9,
    totalEarningsUsd: 8450.00,
    totalCoinsEarned: 3200,
    monopoliesBuilt: 58,
    bankruptciesCaused: 82,
    rentCollectedTotal: 49200
  },
  badges: [
    { id: 'b_super_admin', name: 'Platform Admin', description: 'Platform creator & administrator', icon: '👑', rarity: 'legendary', unlockedAt: '2026-08-10' },
    { id: 'b_tycoon_league', name: 'Tycoon League', description: 'Reached Tycoon Tier (2,300+ LP)', icon: '🏆', rarity: 'legendary', unlockedAt: '2026-08-15' },
    { id: 'b_high_roller', name: 'High Roller', description: 'Won $5,000+ in competitive matches', icon: '💎', rarity: 'epic', unlockedAt: '2026-08-18' }
  ],
  matchHistory: []
};

const GROOVY_BADGES: Badge[] = [
  { id: 'b_high_roller', name: 'High Roller', description: 'Placed $50+ in cash matches', icon: '💎', rarity: 'epic', unlockedAt: '2026-08-20' },
  { id: 'b_diamond_league', name: 'Diamond League', description: 'Reached Diamond Tier', icon: '🏆', rarity: 'legendary', unlockedAt: '2026-08-25' }
];

function calculateLeagueTier(lp: number): LeagueTier {
  if (lp >= 2300) return 'Tycoon';
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
    // Check clean version flag to reset legacy mock profiles (which had $50 balance and 450 coins)
    const cleanFlag = localStorage.getItem('proprush_clean_account_v1');
    if (!cleanFlag) {
      localStorage.removeItem('proprush_user_profile');
      localStorage.removeItem('richup_user_profile');
      localStorage.setItem('proprush_clean_account_v1', 'true');
      return DEFAULT_USER;
    }

    const saved = localStorage.getItem('proprush_user_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_USER,
          ...parsed,
          id: getTabSessionId(),
          inventory: {
            appearances: parsed.inventory?.appearances || ['orange'],
            maps: parsed.inventory?.maps || ['classic'],
            profilePictures: parsed.inventory?.profilePictures || [],
            diceSkins: parsed.inventory?.diceSkins || ['dice_classic']
          }
        };
      } catch (e) {
        console.error('Error loading saved profile', e);
      }
    }
    return DEFAULT_USER;
  });

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('proprush_clerk_auth') === 'true';
  });

  // Track real-time ban status
  const [isBanned, setIsBanned] = useState<boolean>(() => {
    return Boolean(user.isBanned || isUserBanned(user.email, user.id));
  });

  useEffect(() => {
    const checkBan = () => {
      const banned = Boolean(user.isBanned || isUserBanned(user.email, user.id));
      setIsBanned(banned);
    };

    checkBan();
    window.addEventListener('proprush_ban_updated', checkBan);
    return () => window.removeEventListener('proprush_ban_updated', checkBan);
  }, [user.email, user.id, user.isBanned]);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const openAuthModal = (reason?: string) => {
    setAuthModalReason(reason || null);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthModalReason(null);
  };

  const requireAuth = (reason: string, onAuthenticated: () => void) => {
    if (isLoggedIn) {
      onAuthenticated();
    } else {
      setPendingAction(() => onAuthenticated);
      openAuthModal(reason);
    }
  };

  const loginWithGoogle = (email?: string, name?: string, avatar?: string) => {
    const userEmail = email || 'sahi@gmail.com';
    const userName = name || userEmail.split('@')[0];
    setIsLoggedIn(true);
    localStorage.setItem('proprush_clerk_auth', 'true');
    
    const storageKey = `proprush_user_${userEmail.toLowerCase()}`;
    const savedUserStr = localStorage.getItem(storageKey);
    if (savedUserStr) {
      try {
        const parsed = JSON.parse(savedUserStr);
        setUser({
          ...DEFAULT_USER,
          ...parsed,
          email: userEmail,
          username: userName,
          avatar: avatar || parsed.avatar || 'orange'
        });
        if (pendingAction) {
          setTimeout(() => {
            pendingAction();
            setPendingAction(null);
          }, 100);
        }
        return;
      } catch (e) {
        console.error('Error loading saved user', e);
      }
    }

    const isGroovy = userEmail.toLowerCase() === 'sahityagroovy@gmail.com';
    const isSuperAdmin = userEmail.toLowerCase() === 'sahityanijhawan@gmail.com';

    const freshUser: UserProfile = {
      ...DEFAULT_USER,
      id: isGroovy ? 'usr_player_sahitya' : (isSuperAdmin ? 'usr_sahi_super' : ('usr_' + Math.random().toString(36).substring(2, 9))),
      email: userEmail,
      username: userName,
      avatar: avatar || (isGroovy ? 'purple' : 'orange'),
      walletBalance: isGroovy ? 1906.02 : (isSuperAdmin ? 270.00 : (user.walletBalance > 0 ? user.walletBalance : 0.00)),
      coins: isGroovy ? 1598 : (user.coins > 0 ? user.coins : 0),
      leaguePoints: isGroovy ? 1850 : (isSuperAdmin ? 2490 : 0),
      leagueTier: isGroovy ? 'Diamond' : (isSuperAdmin ? 'Tycoon' : 'Bronze'),
      level: isGroovy ? 9 : (isSuperAdmin ? 14 : 1),
      inventory: isSuperAdmin ? DEFAULT_USER.inventory : isGroovy ? {
        appearances: ['orange', 'purple', 'cyber', 'gold', 'neon'],
        maps: ['classic', 'neon_tokyo', 'cyberpunk'],
        profilePictures: ['pfp_neon_frame'],
        diceSkins: ['dice_classic', 'dice_neon']
      } : {
        appearances: ['orange'],
        maps: ['classic'],
        profilePictures: [],
        diceSkins: ['dice_classic']
      },
      stats: isSuperAdmin ? DEFAULT_USER.stats : isGroovy ? {
        gamesPlayed: 45,
        gamesWon: 31,
        winStreak: 4,
        bestWinStreak: 7,
        totalEarningsUsd: 2950.00,
        totalCoinsEarned: 1598,
        monopoliesBuilt: 12,
        bankruptciesCaused: 19,
        rentCollectedTotal: 18450
      } : {
        gamesPlayed: 0,
        gamesWon: 0,
        winStreak: 0,
        bestWinStreak: 0,
        totalEarningsUsd: 0.00,
        totalCoinsEarned: 0,
        monopoliesBuilt: 0,
        bankruptciesCaused: 0,
        rentCollectedTotal: 0
      },
      badges: isSuperAdmin ? DEFAULT_USER.badges : (isGroovy ? GROOVY_BADGES : []),
      matchHistory: []
    };

    localStorage.setItem(storageKey, JSON.stringify(freshUser));
    setUser(freshUser);

    if (pendingAction) {
      setTimeout(() => {
        pendingAction();
        setPendingAction(null);
      }, 100);
    }
  };

  const loginWithSocial = (provider: 'github' | 'discord' | 'apple') => {
    const defaultEmail = `${user.username.toLowerCase()}@${provider}.auth`;
    loginWithGoogle(defaultEmail, user.username);
  };

  const loginWithEmail = (email: string) => {
    const name = email.split('@')[0] || 'Player';
    loginWithGoogle(email, name);
  };

  const syncClerkUser = (clerkData: {
    id: string;
    email?: string;
    username?: string;
    fullName?: string;
    imageUrl?: string;
  }) => {
    setIsLoggedIn(true);
    localStorage.setItem('proprush_clerk_auth', 'true');
    setUser(prev => {
      const email = clerkData.email || prev.email;
      const username = clerkData.fullName || clerkData.username || (clerkData.email ? clerkData.email.split('@')[0] : prev.username || 'Player');
      
      const storageKey = `proprush_user_${clerkData.id}`;
      const savedUserStr = localStorage.getItem(storageKey);
      if (savedUserStr) {
        try {
          const parsed = JSON.parse(savedUserStr);
          return {
            ...DEFAULT_USER,
            ...parsed,
            id: clerkData.id,
            clerkUserId: clerkData.id,
            email,
            username,
            profilePictureUrl: clerkData.imageUrl || parsed.profilePictureUrl
          };
        } catch (e) {
          console.error('Error parsing stored user data for clerk user', e);
        }
      }

      // Check if user has data stored under their email address
      const emailStorageKey = email ? `proprush_user_${email.toLowerCase()}` : null;
      const savedByEmailStr = emailStorageKey ? localStorage.getItem(emailStorageKey) : null;
      if (savedByEmailStr) {
        try {
          const parsed = JSON.parse(savedByEmailStr);
          return {
            ...DEFAULT_USER,
            ...parsed,
            id: clerkData.id,
            clerkUserId: clerkData.id,
            email,
            username: username || parsed.username,
            profilePictureUrl: clerkData.imageUrl || parsed.profilePictureUrl
          };
        } catch (e) {
          console.error('Error parsing stored user data by email for clerk user', e);
        }
      }

      const isGroovy = email && email.toLowerCase() === 'sahityagroovy@gmail.com';
      const isSuperAdmin = email && email.toLowerCase() === 'sahityanijhawan@gmail.com';

      // Fresh user state for new Clerk accounts
      const freshUser: UserProfile = {
        ...DEFAULT_USER,
        ...prev,
        id: clerkData.id,
        clerkUserId: clerkData.id,
        email,
        username,
        profilePictureUrl: clerkData.imageUrl || prev.profilePictureUrl,
        walletBalance: isGroovy ? 1906.02 : (isSuperAdmin ? 270.00 : (prev.walletBalance > 0 ? prev.walletBalance : 0.00)),
        coins: isGroovy ? 1598 : (prev.coins > 0 ? prev.coins : 0),
        leaguePoints: isGroovy ? 1850 : (isSuperAdmin ? 2490 : (prev.leaguePoints || 0)),
        leagueTier: isGroovy ? 'Diamond' : (isSuperAdmin ? 'Tycoon' : (prev.leagueTier || 'Bronze')),
        level: isGroovy ? 9 : (isSuperAdmin ? 14 : (prev.level || 1)),
        inventory: isSuperAdmin ? DEFAULT_USER.inventory : (isGroovy ? {
          appearances: ['orange', 'purple', 'cyber', 'gold', 'neon'],
          maps: ['classic', 'neon_tokyo', 'cyberpunk'],
          profilePictures: ['pfp_neon_frame'],
          diceSkins: ['dice_classic', 'dice_neon']
        } : (prev.inventory || DEFAULT_USER.inventory)),
        stats: isSuperAdmin ? DEFAULT_USER.stats : (isGroovy ? {
          gamesPlayed: 45,
          gamesWon: 31,
          winStreak: 4,
          bestWinStreak: 7,
          totalEarningsUsd: 2950.00,
          totalCoinsEarned: 1598,
          monopoliesBuilt: 12,
          bankruptciesCaused: 19,
          rentCollectedTotal: 18450
        } : (prev.stats || DEFAULT_USER.stats)),
        badges: isSuperAdmin ? DEFAULT_USER.badges : (isGroovy ? GROOVY_BADGES : (prev.badges || [])),
        matchHistory: prev.matchHistory || []
      };

      localStorage.setItem(storageKey, JSON.stringify(freshUser));
      return freshUser;
    });

    if (pendingAction) {
      setTimeout(() => {
        pendingAction();
        setPendingAction(null);
      }, 100);
    }
  };

  const loginUser = (email: string, username: string) => {
    loginWithGoogle(email, username);
  };

  const logoutUser = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('proprush_clerk_auth');
    sounds.playClick();
  };

  const [lastDailyClaim, setLastDailyClaim] = useState<string | null>(() => {
    return localStorage.getItem('proprush_daily_claim') || localStorage.getItem('richup_daily_claim');
  });

  useEffect(() => {
    // Immediate sync on mount and on window focus
    syncUserProfileToServer(user);
    const handleFocus = () => {
      syncUserProfileToServer(user);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    localStorage.setItem('proprush_user_profile', JSON.stringify(user));
    if (user.clerkUserId) {
      localStorage.setItem(`proprush_user_${user.clerkUserId}`, JSON.stringify(user));
    } else if (user.email) {
      localStorage.setItem(`proprush_user_${user.email.toLowerCase()}`, JSON.stringify(user));
    }

    const timer = setTimeout(() => {
      syncUserProfileToServer(user);
    }, 500);
    return () => clearTimeout(timer);
  }, [user]);

  const updateUser = (updates: Partial<UserProfile>) => {
    setUser(prev => ({ ...prev, ...updates }));
  };

  const updateUsername = (name: string) => {
    const trimmed = name.trim() || 'Player';
    setUser(prev => ({ ...prev, username: trimmed }));
  };

  const depositFunds = (amount: number, method: string) => {
    if (isBanned) {
      sounds.playBankrupt();
      return false;
    }
    if (amount <= 0) return false;
    sounds.playCashRegister();
    setUser(prev => ({
      ...prev,
      walletBalance: Math.round((prev.walletBalance + amount) * 100) / 100
    }));
    return true;
  };

  const withdrawFunds = (amount: number) => {
    if (isBanned) {
      sounds.playBankrupt();
      return false;
    }
    if (amount <= 0 || user.walletBalance < amount) return false;
    sounds.playClick();
    setUser(prev => ({
      ...prev,
      walletBalance: Math.round((prev.walletBalance - amount) * 100) / 100
    }));
    return true;
  };

  const buyCoinPack = (coins: number, priceUsd: number): boolean => {
    if (isBanned || priceUsd <= 0 || user.walletBalance < priceUsd) {
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
    if (isBanned) {
      sounds.playBankrupt();
      return false;
    }
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
      let newDice = prev.diceSkin;
      let newMap = prev.mapSkin;

      if (category === 'appearance') {
        if (!updatedInv.appearances.includes(itemId)) {
          updatedInv.appearances = [...updatedInv.appearances, itemId];
        }
        newAvatar = itemId;
      } else if (category === 'maps') {
        if (!updatedInv.maps.includes(itemId)) {
          updatedInv.maps = [...updatedInv.maps, itemId];
        }
        newMap = itemId;
      } else if (category === 'upgrades' || category === 'diceSkins' || category === 'dice_skins') {
        if (!updatedInv.diceSkins.includes(itemId)) {
          updatedInv.diceSkins = [...updatedInv.diceSkins, itemId];
        }
        newDice = itemId;
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
        diceSkin: newDice,
        mapSkin: newMap,
        inventory: updatedInv
      };
    });
    return true;
  };

  const equipItem = (
    category: 'appearance' | 'maps' | 'upgrades' | 'diceSkins' | 'dice_skins' | 'profile_pictures',
    itemId: string
  ) => {
    sounds.playClick();
    if (category === 'appearance') {
      setUser(prev => ({ ...prev, avatar: itemId }));
    } else if (category === 'profile_pictures') {
      setUser(prev => ({
        ...prev,
        avatarFrame: prev.avatarFrame === itemId ? 'none' : itemId
      }));
    } else if (category === 'upgrades' || category === 'diceSkins' || category === 'dice_skins') {
      setUser(prev => ({
        ...prev,
        diceSkin: itemId
      }));
    } else if (category === 'maps') {
      setUser(prev => ({
        ...prev,
        mapSkin: itemId
      }));
    }
  };

  const claimDailyReward = (): number | null => {
    const today = new Date().toDateString();
    if (lastDailyClaim === today) return null;

    const rewardCoins = 15;
    sounds.playVictory();
    setLastDailyClaim(today);
    localStorage.setItem('proprush_daily_claim', today);

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

    const coinsEarned = isWin ? 35 + Math.floor(result.betAmount * 2.5) : 12;
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

  return (
    <UserContext.Provider
      value={{
        user,
        isBanned,
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
        loginWithGoogle,
        loginWithSocial,
        loginWithEmail,
        syncClerkUser,
        logoutUser,
        isLoggedIn,
        isAuthModalOpen,
        authModalReason,
        openAuthModal,
        closeAuthModal,
        requireAuth
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
