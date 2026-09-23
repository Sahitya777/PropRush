import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, LeagueTier, MatchHistory, Badge } from '../types/user';
import { BADGES_LIST, LEAGUE_TIERS_INFO } from '../data/storeData';
import { sounds } from '../utils/audio';
import { syncUserProfileToServer } from '../utils/serverUsersSync';
import { isUserBanned } from '../utils/banManager';
import { isUserAdmin } from '../utils/adminRegistry';
import { useSafeDynamic } from './DynamicIntegration';
import {
  trackReferralCodeFromUrl,
  getPendingReferrer,
  processReferralOnServer,
  isReferralAlreadyClaimedLocally,
  clearPendingReferrer
} from '../utils/referralService';
import { getMockUsdcBalance } from '../contracts/client';

interface UserContextType {
  user: UserProfile;
  isBanned: boolean;
  updateUser: (updates: Partial<UserProfile>) => void;
  updateUsername: (name: string) => void;
  depositFunds: (amount: number, method: string) => boolean;
  withdrawFunds: (amount: number) => boolean;
  buyCoinPack: (coins: number, priceUsd: number) => boolean;
  exchangeUsdcForCoins: (usdcAmount: number, coinsGranted: number) => boolean;
  refreshOnChainUsdcBalance: (addressOverride?: string) => Promise<void>;
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
  syncDynamicUser: (dynamicData: {
    id: string;
    email?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    walletAddress?: string;
    chain?: string;
    imageUrl?: string;
  }) => void;
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
  claimReferralCode: (code: string) => Promise<{ success: boolean; message: string }>;
  referralNotification: { message: string; points: number } | null;
  clearReferralNotification: () => void;
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
  id: 'usr_guest',
  username: 'Guest Player',
  email: '',
  avatar: 'orange',
  avatarFrame: undefined,
  diceSkin: 'dice_classic',
  mapSkin: 'classic',
  title: 'Guest Tycoon',
  coins: 0,
  walletBalance: 0.00,
  leaguePoints: 0,
  leagueTier: 'Bronze',
  level: 1,
  xp: 0,
  maxXp: 500,
  inventory: {
    appearances: ['orange'],
    maps: ['classic'],
    profilePictures: [],
    diceSkins: ['dice_classic']
  },
  stats: {
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
  badges: [],
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
  const { setShowAuthFlow, handleLogOut, setSimulatedUser } = useSafeDynamic();
  const [user, setUser] = useState<UserProfile>(() => {
    // Check clean version flag to reset legacy mock profiles
    const cleanFlag = localStorage.getItem('proprush_real_dynamic_v3');
    if (!cleanFlag) {
      localStorage.removeItem('proprush_user_profile');
      localStorage.removeItem('richup_user_profile');
      localStorage.removeItem('proprush_clean_account_v1');
      localStorage.removeItem('proprush_dynamic_auth');
      localStorage.removeItem('proprush_clerk_auth');
      localStorage.setItem('proprush_real_dynamic_v3', 'true');
      return { ...DEFAULT_USER, id: getTabSessionId() };
    }

    const isDynamicAuth = localStorage.getItem('proprush_dynamic_auth') === 'true';
    if (!isDynamicAuth) {
      return { ...DEFAULT_USER, id: getTabSessionId() };
    }

    const saved = localStorage.getItem('proprush_user_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.dynamicUserId || parsed.walletAddress) {
          return {
            ...DEFAULT_USER,
            ...parsed,
            walletBalance: typeof parsed.walletBalance === 'number' && !isNaN(parsed.walletBalance) ? parsed.walletBalance : 0.00,
            coins: typeof parsed.coins === 'number' && !isNaN(parsed.coins) ? parsed.coins : 0,
            inventory: {
              appearances: parsed.inventory?.appearances || ['orange'],
              maps: parsed.inventory?.maps || ['classic'],
              profilePictures: parsed.inventory?.profilePictures || [],
              diceSkins: parsed.inventory?.diceSkins || ['dice_classic']
            }
          };
        }
      } catch (e) {
        console.error('Error loading saved profile', e);
      }
    }
    return { ...DEFAULT_USER, id: getTabSessionId() };
  });

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('proprush_dynamic_auth') === 'true';
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
    try {
      setShowAuthFlow(true);
    } catch {
      // ignore
    }
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthModalReason(null);
    try {
      setShowAuthFlow(false);
    } catch {
      // ignore
    }
  };

  const requireAuth = (reason: string, onAuthenticated: () => void) => {
    if (isLoggedIn) {
      onAuthenticated();
    } else {
      setPendingAction(() => onAuthenticated);
      openAuthModal(reason);
    }
  };

  // Referral tracking & rewards state
  const [referralNotification, setReferralNotification] = useState<{ message: string; points: number } | null>(null);

  const clearReferralNotification = useCallback(() => {
    setReferralNotification(null);
  }, []);

  // Check URL query parameters for referral on initial mount
  useEffect(() => {
    const code = trackReferralCodeFromUrl();
    if (code) {
      console.log('Detected referral invite link from @' + code);
    }
  }, []);

  // Function to process pending referral for authenticated users
  const checkAndApplyPendingReferral = useCallback(async (targetUser: UserProfile) => {
    const pendingReferrer = getPendingReferrer();
    if (!pendingReferrer) return;
    if (targetUser.referrals?.referredBy) {
      clearPendingReferrer();
      return;
    }
    if (isReferralAlreadyClaimedLocally(targetUser.id, targetUser.walletAddress)) {
      clearPendingReferrer();
      return;
    }

    try {
      const res = await processReferralOnServer(pendingReferrer, targetUser);
      if (res.success && res.refereeBonusCoins) {
        sounds.playCashRegister();
        setUser(prev => {
          const updatedCoins = prev.coins + (res.refereeBonusCoins || 100);
          const updatedLp = prev.leaguePoints + (res.refereeBonusLp || 50);
          const updatedUser: UserProfile = {
            ...prev,
            coins: updatedCoins,
            leaguePoints: updatedLp,
            referrals: {
              code: prev.referrals?.code || prev.username,
              friendsJoined: prev.referrals?.friendsJoined || 0,
              totalPointsEarned: prev.referrals?.totalPointsEarned || 0,
              earningsUsd: prev.referrals?.earningsUsd || 0,
              referredBy: res.referrerUsername || pendingReferrer,
              history: prev.referrals?.history || [],
            }
          };
          localStorage.setItem('proprush_user_profile', JSON.stringify(updatedUser));
          if (updatedUser.dynamicUserId) {
            localStorage.setItem(`proprush_dynamic_${updatedUser.dynamicUserId}`, JSON.stringify(updatedUser));
          }
          syncUserProfileToServer(updatedUser);
          return updatedUser;
        });

        setReferralNotification({
          message: res.message,
          points: res.refereeBonusCoins || 100
        });
      }
    } catch (err) {
      console.warn('Could not auto-process referral', err);
    }
  }, []);

  // Manual claim of referral code (from Settings modal)
  const claimReferralCode = useCallback(async (code: string): Promise<{ success: boolean; message: string }> => {
    const cleanCode = (code || '').trim();
    if (!cleanCode) {
      return { success: false, message: 'Please enter a valid referral code or username.' };
    }
    if (user.referrals?.referredBy) {
      return { success: false, message: `You have already claimed a referral bonus from @${user.referrals.referredBy}.` };
    }
    if (isReferralAlreadyClaimedLocally(user.id, user.walletAddress)) {
      return { success: false, message: 'Referral reward has already been claimed for this account.' };
    }

    try {
      const res = await processReferralOnServer(cleanCode, user);
      if (res.success) {
        sounds.playWin();
        setUser(prev => {
          const updatedCoins = prev.coins + (res.refereeBonusCoins || 100);
          const updatedLp = prev.leaguePoints + (res.refereeBonusLp || 50);
          const updatedUser: UserProfile = {
            ...prev,
            coins: updatedCoins,
            leaguePoints: updatedLp,
            referrals: {
              code: prev.referrals?.code || prev.username,
              friendsJoined: prev.referrals?.friendsJoined || 0,
              totalPointsEarned: prev.referrals?.totalPointsEarned || 0,
              earningsUsd: prev.referrals?.earningsUsd || 0,
              referredBy: res.referrerUsername || cleanCode,
              history: prev.referrals?.history || [],
            }
          };
          localStorage.setItem('proprush_user_profile', JSON.stringify(updatedUser));
          if (updatedUser.dynamicUserId) {
            localStorage.setItem(`proprush_dynamic_${updatedUser.dynamicUserId}`, JSON.stringify(updatedUser));
          }
          syncUserProfileToServer(updatedUser);
          return updatedUser;
        });

        setReferralNotification({
          message: res.message,
          points: res.refereeBonusCoins || 100
        });

        return { success: true, message: res.message };
      } else {
        return { success: false, message: res.message };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to claim referral code.' };
    }
  }, [user]);

  const loginWithGoogle = (email?: string, name?: string, avatar?: string) => {
    const userEmail = email || 'sahityanijhawan@gmail.com';
    const userName = name || userEmail.split('@')[0];
    setIsLoggedIn(true);
    localStorage.setItem('proprush_dynamic_auth', 'true');
    localStorage.setItem('proprush_clerk_auth', 'true');
    
    if (setSimulatedUser) {
      try {
        setSimulatedUser({
          userId: 'usr_sahi_' + Math.random().toString(36).substring(2, 9),
          email: userEmail,
          username: userName,
        });
      } catch {
        // ignore
      }
    }
    
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

    const isAdmin = isUserAdmin(userEmail) || userEmail.toLowerCase() === 'sahityanijhawan@gmail.com';

    const freshUser: UserProfile = {
      ...DEFAULT_USER,
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      email: userEmail,
      username: userName,
      avatar: avatar || 'orange',
      walletBalance: user.walletBalance > 0 ? user.walletBalance : 0.00,
      coins: user.coins > 0 ? user.coins : 0,
      leaguePoints: user.leaguePoints || 0,
      leagueTier: 'Bronze',
      level: 1,
      title: isAdmin ? 'Platform Administrator' : 'Player',
      inventory: {
        appearances: ['orange'],
        maps: ['classic'],
        profilePictures: [],
        diceSkins: ['dice_classic']
      },
      stats: {
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
      badges: isAdmin ? [{ id: 'b_admin', name: 'Platform Admin', description: 'Platform Administrator', icon: '👑', rarity: 'legendary', unlockedAt: new Date().toISOString().split('T')[0] }] : [],
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

  const syncDynamicUser = (dynamicData: {
    id: string;
    email?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    walletAddress?: string;
    chain?: string;
    imageUrl?: string;
  }) => {
    setIsLoggedIn(true);
    localStorage.setItem('proprush_dynamic_auth', 'true');
    localStorage.setItem('proprush_clerk_auth', 'true');

    if (setSimulatedUser) {
      try {
        setSimulatedUser({
          userId: dynamicData.id,
          email: dynamicData.email,
          username: dynamicData.username,
          walletAddress: dynamicData.walletAddress,
        });
      } catch {
        // ignore
      }
    }
    setUser(prev => {
      const email = dynamicData.email || prev.email || '';
      const walletAddress = dynamicData.walletAddress || prev.walletAddress || '';
      const firstName = dynamicData.firstName || prev.firstName;
      const lastName = dynamicData.lastName || prev.lastName;

      const storageKey = `proprush_dynamic_${dynamicData.id}`;
      let savedUser: Partial<UserProfile> = {};
      const savedUserStr = localStorage.getItem(storageKey);
      if (savedUserStr) {
        try {
          savedUser = JSON.parse(savedUserStr);
        } catch (e) {
          console.error('Error parsing stored user data for dynamic user', e);
        }
      }

      // If dynamicData.username is provided and is a real non-wallet username, prioritize it over a cached 0x address!
      const isSavedUsernameWallet = Boolean(savedUser.username && /^0x[a-fA-F0-9]{4,}/i.test(savedUser.username));
      let resolvedUsername = '';
      if (dynamicData.username && !/^0x[a-fA-F0-9]{10,}/i.test(dynamicData.username)) {
        resolvedUsername = dynamicData.username;
      } else if (savedUser.username && !isSavedUsernameWallet) {
        resolvedUsername = savedUser.username;
      } else if (firstName) {
        resolvedUsername = `${firstName}${lastName ? ` ${lastName}` : ''}`.trim();
      } else if (dynamicData.username) {
        resolvedUsername = dynamicData.username;
      } else if (walletAddress) {
        resolvedUsername = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
      } else {
        resolvedUsername = email ? email.split('@')[0] : 'Player';
      }

      const isAdmin = (email && email.toLowerCase() === 'sahityanijhawan@gmail.com') || isUserAdmin(email || walletAddress);

      // Real user state - starting from 0 unless real matches were recorded
      const realUser: UserProfile = {
        ...DEFAULT_USER,
        ...savedUser,
        id: dynamicData.id,
        dynamicUserId: dynamicData.id,
        walletAddress,
        chain: dynamicData.chain || 'ETH',
        email,
        username: resolvedUsername,
        firstName,
        lastName,
        profilePictureUrl: dynamicData.imageUrl || savedUser.profilePictureUrl || prev.profilePictureUrl,
        title: isAdmin ? 'Platform Administrator' : (savedUser.title || 'Dynamic Player'),
        walletBalance: typeof savedUser.walletBalance === 'number' ? savedUser.walletBalance : 0.00,
        coins: typeof savedUser.coins === 'number' ? savedUser.coins : 0,
        leaguePoints: typeof savedUser.leaguePoints === 'number' ? savedUser.leaguePoints : 0,
        leagueTier: savedUser.leagueTier || 'Bronze',
        level: savedUser.level || 1,
        xp: savedUser.xp || 0,
        inventory: savedUser.inventory || {
          appearances: ['orange'],
          maps: ['classic'],
          profilePictures: [],
          diceSkins: ['dice_classic']
        },
        stats: savedUser.stats || {
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
        badges: savedUser.badges || (isAdmin ? [{ id: 'b_admin', name: 'Platform Admin', description: 'Verified administrator', icon: '👑', rarity: 'legendary', unlockedAt: new Date().toISOString().split('T')[0] }] : []),
        matchHistory: savedUser.matchHistory || []
      };

      localStorage.setItem(storageKey, JSON.stringify(realUser));
      localStorage.setItem('proprush_user_profile', JSON.stringify(realUser));

      // Synchronize real profile to server
      syncUserProfileToServer(realUser);

      // Auto check and claim pending referral bonus if visiting via ?ref= link
      setTimeout(() => {
        checkAndApplyPendingReferral(realUser);
      }, 300);

      return realUser;
    });
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

      const isAdmin = (email && email.toLowerCase() === 'sahityanijhawan@gmail.com') || isUserAdmin(email || '');

      // Fresh user state for new accounts
      const freshUser: UserProfile = {
        ...DEFAULT_USER,
        ...prev,
        id: clerkData.id,
        clerkUserId: clerkData.id,
        email,
        username,
        profilePictureUrl: clerkData.imageUrl || prev.profilePictureUrl,
        title: isAdmin ? 'Platform Administrator' : 'Player',
        walletBalance: prev.walletBalance > 0 ? prev.walletBalance : 0.00,
        coins: prev.coins > 0 ? prev.coins : 0,
        leaguePoints: prev.leaguePoints || 0,
        leagueTier: 'Bronze',
        level: 1,
        inventory: {
          appearances: ['orange'],
          maps: ['classic'],
          profilePictures: [],
          diceSkins: ['dice_classic']
        },
        stats: {
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
        badges: isAdmin ? [{ id: 'b_admin', name: 'Platform Admin', description: 'Platform Administrator', icon: '👑', rarity: 'legendary', unlockedAt: new Date().toISOString().split('T')[0] }] : [],
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
    localStorage.removeItem('proprush_dynamic_auth');
    localStorage.removeItem('proprush_user_profile');
    sounds.playClick();
    try {
      handleLogOut();
    } catch {
      // ignore
    }
    setUser({ ...DEFAULT_USER, id: getTabSessionId() });
  };

  const [lastDailyClaim, setLastDailyClaim] = useState<string | null>(() => {
    return localStorage.getItem('proprush_daily_claim') || localStorage.getItem('richup_daily_claim');
  });

  useEffect(() => {
    // Only sync to server if user is authenticated via Dynamic
    if (isLoggedIn && (user.dynamicUserId || user.walletAddress)) {
      syncUserProfileToServer(user);
    }
    const handleFocus = () => {
      if (isLoggedIn && (user.dynamicUserId || user.walletAddress)) {
        syncUserProfileToServer(user);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isLoggedIn, user.dynamicUserId, user.walletAddress]);

  useEffect(() => {
    if (isLoggedIn && (user.dynamicUserId || user.walletAddress)) {
      localStorage.setItem('proprush_user_profile', JSON.stringify(user));
      if (user.dynamicUserId) {
        localStorage.setItem(`proprush_dynamic_${user.dynamicUserId}`, JSON.stringify(user));
      } else if (user.walletAddress) {
        localStorage.setItem(`proprush_dynamic_${user.walletAddress.toLowerCase()}`, JSON.stringify(user));
      }

      const timer = setTimeout(() => {
        syncUserProfileToServer(user);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user, isLoggedIn]);

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
    setUser(prev => {
      const updatedUser = {
        ...prev,
        walletBalance: Math.max(0, Math.round((prev.walletBalance - priceUsd) * 100) / 100),
        coins: prev.coins + coins,
        stats: {
          ...prev.stats,
          totalCoinsEarned: prev.stats.totalCoinsEarned + coins
        }
      };
      localStorage.setItem('proprush_user_profile', JSON.stringify(updatedUser));
      if (updatedUser.dynamicUserId) {
        localStorage.setItem(`proprush_dynamic_${updatedUser.dynamicUserId}`, JSON.stringify(updatedUser));
      }
      return updatedUser;
    });
    return true;
  };

  const exchangeUsdcForCoins = (usdcAmount: number, coinsGranted: number): boolean => {
    if (isBanned || usdcAmount <= 0 || user.walletBalance < usdcAmount) {
      sounds.playBankrupt();
      return false;
    }
    sounds.playVictory();
    setUser(prev => {
      const updatedUser = {
        ...prev,
        walletBalance: Math.max(0, Math.round((prev.walletBalance - usdcAmount) * 100) / 100),
        coins: prev.coins + coinsGranted,
        stats: {
          ...prev.stats,
          totalCoinsEarned: prev.stats.totalCoinsEarned + coinsGranted
        }
      };
      localStorage.setItem('proprush_user_profile', JSON.stringify(updatedUser));
      if (updatedUser.dynamicUserId) {
        localStorage.setItem(`proprush_dynamic_${updatedUser.dynamicUserId}`, JSON.stringify(updatedUser));
      }
      return updatedUser;
    });
    return true;
  };

  const refreshOnChainUsdcBalance = useCallback(async (addressOverride?: string) => {
    try {
      const targetAddr = (addressOverride || user.walletAddress || (window as any).ethereum?.selectedAddress);
      if (!targetAddr || !targetAddr.startsWith('0x') || targetAddr.length < 10) return;
      const res = await getMockUsdcBalance(targetAddr as `0x${string}`);
      const val = parseFloat(res.formatted);
      if (!isNaN(val)) {
        setUser(prev => {
          if (val !== prev.walletBalance) {
            const updated = {
              ...prev,
              walletBalance: val,
              walletAddress: prev.walletAddress || targetAddr
            };
            localStorage.setItem('proprush_user_profile', JSON.stringify(updated));
            if (updated.dynamicUserId) {
              localStorage.setItem(`proprush_dynamic_${updated.dynamicUserId}`, JSON.stringify(updated));
            }
            return updated;
          }
          return prev;
        });
      }
    } catch (e) {
      console.warn('Failed to sync on-chain USDC balance:', e);
    }
  }, [user.walletAddress]);

  useEffect(() => {
    refreshOnChainUsdcBalance();

    const handleUsdcUpdated = (e: any) => {
      const addr = e.detail?.address;
      refreshOnChainUsdcBalance(addr);
    };

    window.addEventListener('proprush_usdc_updated', handleUsdcUpdated);
    const onFocus = () => refreshOnChainUsdcBalance();
    window.addEventListener('focus', onFocus);

    const interval = setInterval(() => {
      refreshOnChainUsdcBalance();
    }, 15000);

    return () => {
      window.removeEventListener('proprush_usdc_updated', handleUsdcUpdated);
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [refreshOnChainUsdcBalance]);

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
        exchangeUsdcForCoins,
        refreshOnChainUsdcBalance,
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
        syncDynamicUser,
        syncClerkUser,
        logoutUser,
        isLoggedIn,
        isAuthModalOpen,
        authModalReason,
        openAuthModal,
        closeAuthModal,
        requireAuth,
        claimReferralCode,
        referralNotification,
        clearReferralNotification
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
