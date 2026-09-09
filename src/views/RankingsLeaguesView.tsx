import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from '../context/UserContext';
import { useSafeDynamic } from '../context/DynamicIntegration';
import { LeagueTier } from '../types/user';
import { useTheme } from '../context/ThemeContext';
import { AvatarCharacter } from '../components/AvatarCharacter';
import { sounds } from '../utils/audio';
import { fetchServerRankings, PlatformMember } from '../utils/serverUsersSync';

export interface LeaderboardPlayer {
  rank: number;
  id: string;
  name: string;
  email?: string;
  avatar: string;
  frame?: string;
  tier: LeagueTier;
  lp: number;
  earningsUsd: number;
  wins: number;
  gamesPlayed: number;
  winRate: number;
  winStreak: number;
  favoriteMap: string;
  title: string;
  country?: string;
  city?: string;
  joinedDate?: string;
  isCurrentUser?: boolean;
  // Multi-timeframe stats
  weeklyPoints: number;
  weeklyEarningsUsd: number;
  weeklyWins: number;
  weeklyGamesPlayed: number;
  weeklyWinRate: number;
  weeklyStreak: number;
  weeklyProjectedPrize?: string;
  allTimeEarningsUsd: number;
  allTimeWins: number;
  allTimeGamesPlayed: number;
  allTimeWinRate: number;
  allTimeBestStreak: number;
  allTimeCoins: number;
}

const GLOBAL_CHAMPIONS_SEED: Omit<LeaderboardPlayer, 'rank'>[] = [];

const LEAGUES_TIERS_INFO = [
  {
    tier: 'Tycoon' as LeagueTier,
    icon: '👑',
    minLp: 2300,
    maxLp: 9999,
    lpRange: '2,300+ LP',
    color: 'from-amber-500 to-yellow-300',
    borderColor: 'border-yellow-400',
    bgColor: 'bg-yellow-500/10',
    textColor: 'text-yellow-400',
    rewards: '15 Coins / wk + Golden Crown Avatar Frame + 0% Cashout Fee',
    perks: 'VIP High Roller Matchmaking, Exclusive Diamond Dice Rolls, Hall of Fame Banner'
  },
  {
    tier: 'Master' as LeagueTier,
    icon: '🌌',
    minLp: 1800,
    maxLp: 2299,
    lpRange: '1,800 - 2,299 LP',
    color: 'from-purple-500 to-indigo-400',
    borderColor: 'border-purple-400',
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-400',
    rewards: '12 Coins / wk + Cosmic Frame + Custom Table Themes',
    perks: 'Fast-Track Cashout, Top 100 Leaderboard Badge, 1.5x Daily Reward Multiplier'
  },
  {
    tier: 'Diamond' as LeagueTier,
    icon: '💎',
    minLp: 1400,
    maxLp: 1799,
    lpRange: '1,400 - 1,799 LP',
    color: 'from-cyan-500 to-blue-400',
    borderColor: 'border-cyan-400',
    bgColor: 'bg-cyan-500/10',
    textColor: 'text-cyan-400',
    rewards: '10 Coins / wk + Diamond Badge + 10% Store Discount',
    perks: 'Priority Room Hosting, Custom Win Fanfare, Diamond Dice Skin Unlock'
  },
  {
    tier: 'Platinum' as LeagueTier,
    icon: '⚡',
    minLp: 1000,
    maxLp: 1399,
    lpRange: '1,000 - 1,399 LP',
    color: 'from-slate-300 to-slate-100',
    borderColor: 'border-slate-300',
    bgColor: 'bg-slate-500/10',
    textColor: 'text-slate-200',
    rewards: '7 Coins / wk + Platinum Nameplate',
    perks: 'Reduced Table Commission, Custom Chat Emotes'
  },
  {
    tier: 'Gold' as LeagueTier,
    icon: '🥇',
    minLp: 600,
    maxLp: 999,
    lpRange: '600 - 999 LP',
    color: 'from-amber-400 to-yellow-600',
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-400',
    rewards: '5 Coins / wk + Gold Rank Shield',
    perks: 'Access to $50 Buy-in Tournaments'
  },
  {
    tier: 'Silver' as LeagueTier,
    icon: '🥈',
    minLp: 300,
    maxLp: 599,
    lpRange: '300 - 599 LP',
    color: 'from-slate-400 to-zinc-500',
    borderColor: 'border-slate-400',
    bgColor: 'bg-slate-500/10',
    textColor: 'text-slate-300',
    rewards: '3 Coins / wk',
    perks: 'Ranked Matchmaking Enabled'
  },
  {
    tier: 'Bronze' as LeagueTier,
    icon: '🥉',
    minLp: 0,
    maxLp: 299,
    lpRange: '0 - 299 LP',
    color: 'from-amber-700 to-yellow-900',
    borderColor: 'border-amber-700',
    bgColor: 'bg-amber-700/10',
    textColor: 'text-amber-600',
    rewards: '2 Coins / wk',
    perks: 'Beginner Match Protection'
  }
];

export const RankingsLeaguesView: React.FC<{ onNavigateHome: () => void }> = ({ onNavigateHome }) => {
  const { user, isLoggedIn } = useUser();
  const { isLight } = useTheme();
  const { isLoaded: isDynamicLoaded, isAuthenticated: isDynamicSignedIn, user: dynamicUser, primaryWallet } = useSafeDynamic();

  const isRealDynamicPlayer = Boolean(
    (isDynamicLoaded && isDynamicSignedIn) || 
    isLoggedIn || 
    user.dynamicUserId || 
    user.walletAddress
  );

  const currentDisplayName = (isDynamicSignedIn && (dynamicUser?.username || dynamicUser?.firstName)) ||
    (primaryWallet?.address ? `${primaryWallet.address.slice(0, 6)}...${primaryWallet.address.slice(-4)}` : (user.username && user.username !== 'Guest Player' ? user.username : 'Player'));

  const currentDisplayEmail = (isDynamicSignedIn && (dynamicUser?.email || (dynamicUser?.verifiedCredentials as any[])?.find(c => c.format === 'email')?.email)) || user.email || '';

  const [activeTab, setActiveTab] = useState<'leaderboard' | 'leagues' | 'tournament'>('leaderboard');
  const [timeframe, setTimeframe] = useState<'season' | 'weekly' | 'all_time'>('season');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<LeaderboardPlayer | null>(null);
  const [serverRankings, setServerRankings] = useState<PlatformMember[]>([]);

  // Dynamic tournament countdown
  const [countdown, setCountdown] = useState({ days: 3, hours: 14, mins: 22, secs: 45 });

  // Fetch live server rankings
  useEffect(() => {
    let isMounted = true;
    const loadRankings = async () => {
      const list = await fetchServerRankings(timeframe, searchQuery, user.email);
      if (isMounted && list && list.length > 0) {
        setServerRankings(list);
      }
    };

    loadRankings();
    const interval = setInterval(loadRankings, 6000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [timeframe, searchQuery, user.email]);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      // Calculate target to next Sunday midnight UTC
      const nextSunday = new Date(now);
      nextSunday.setUTCDate(now.getUTCDate() + ((7 - now.getUTCDay()) % 7 || 7));
      nextSunday.setUTCHours(23, 59, 59, 999);

      const diff = Math.max(0, nextSunday.getTime() - now.getTime());
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown({ days, hours, mins, secs });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute live user stats for the leaderboard
  const userWinRate = user.stats.gamesPlayed > 0 
    ? Number(((user.stats.gamesWon / user.stats.gamesPlayed) * 100).toFixed(1)) 
    : 0;

  const currentUserPlayerObj: LeaderboardPlayer = useMemo(() => {
    const gamesPlayed = user.stats?.gamesPlayed || 0;
    const gamesWon = user.stats?.gamesWon || 0;
    const winStreak = user.stats?.winStreak || 0;
    const bestWinStreak = user.stats?.bestWinStreak || winStreak;
    const totalEarningsUsd = user.stats?.totalEarningsUsd || 0;
    const leaguePoints = user.leaguePoints || 0;

    const weeklyWins = Math.max(0, Math.min(gamesWon, Math.round(gamesWon * 0.22) || (gamesWon > 0 ? 1 : 0)));
    const weeklyGamesPlayed = Math.max(weeklyWins, Math.min(gamesPlayed, Math.round(gamesPlayed * 0.22) || (gamesPlayed > 0 ? 1 : 0)));
    const weeklyWinRate = weeklyGamesPlayed > 0 
      ? Number(((weeklyWins / weeklyGamesPlayed) * 100).toFixed(1)) 
      : 0;
    const weeklyEarningsUsd = Number((totalEarningsUsd * 0.20).toFixed(2));
    const weeklyStreak = Math.min(winStreak, weeklyWins);
    const weeklyPoints = Math.round(weeklyWins * 45 + weeklyStreak * 15 + (leaguePoints * 0.08));

    const allTimeEarningsUsd = totalEarningsUsd;
    const allTimeWins = gamesWon;
    const allTimeGamesPlayed = gamesPlayed;
    const allTimeWinRate = allTimeGamesPlayed > 0 
      ? Number(((allTimeWins / allTimeGamesPlayed) * 100).toFixed(1)) 
      : userWinRate;
    const allTimeBestStreak = bestWinStreak;
    const allTimeCoins = user.stats?.totalCoinsEarned || user.coins || 0;

    return {
      rank: 0,
      id: user.dynamicUserId || user.id || 'usr_player',
      name: currentDisplayName,
      email: currentDisplayEmail,
      avatar: user.avatar || 'orange',
      frame: user.avatarFrame,
      tier: user.leagueTier || 'Bronze',
      lp: leaguePoints,
      earningsUsd: totalEarningsUsd,
      wins: gamesWon,
      gamesPlayed,
      winRate: userWinRate,
      winStreak,
      favoriteMap: user.mapSkin === 'cyber' ? 'Cyber Neon Metropolis' : user.mapSkin === 'worldwide' ? 'Worldwide Grand Tour' : 'Classic RichUp Grid',
      title: user.title || 'Dynamic Player',
      country: 'United States',
      city: 'San Francisco',
      joinedDate: new Date().toISOString().split('T')[0],
      isCurrentUser: true,
      weeklyPoints,
      weeklyEarningsUsd,
      weeklyWins,
      weeklyGamesPlayed,
      weeklyWinRate,
      weeklyStreak,
      weeklyProjectedPrize: '',
      allTimeEarningsUsd,
      allTimeWins,
      allTimeGamesPlayed,
      allTimeWinRate,
      allTimeBestStreak,
      allTimeCoins
    };
  }, [user, userWinRate, currentDisplayName, currentDisplayEmail]);

  // Merge current user with live platform rankings & sort dynamically by timeframe
  const fullLeaderboard: LeaderboardPlayer[] = useMemo(() => {
    const rawList: Omit<LeaderboardPlayer, 'rank'>[] = serverRankings.length > 0
      ? serverRankings.map(s => {
          const weeklyWins = typeof s.weeklyWins === 'number' 
            ? s.weeklyWins 
            : Math.max(0, Math.min(s.wins || 0, Math.round((s.wins || 0) * 0.22) || ((s.wins || 0) > 0 ? 1 : 0)));
          const weeklyGamesPlayed = typeof s.weeklyGamesPlayed === 'number' 
            ? s.weeklyGamesPlayed 
            : Math.max(weeklyWins, Math.min(s.gamesPlayed || 0, Math.round((s.gamesPlayed || 0) * 0.22) || ((s.gamesPlayed || 0) > 0 ? 1 : 0)));
          const weeklyWinRate = weeklyGamesPlayed > 0 
            ? Number(((weeklyWins / weeklyGamesPlayed) * 100).toFixed(1)) 
            : 0;
          const weeklyEarningsUsd = typeof s.weeklyEarningsUsd === 'number' 
            ? s.weeklyEarningsUsd 
            : Number(((s.earningsUsd || 0) * 0.20).toFixed(2));
          const weeklyStreak = typeof s.weeklyStreak === 'number'
            ? s.weeklyStreak
            : Math.min(s.winStreak || 0, weeklyWins);
          const weeklyPoints = typeof s.weeklyPoints === 'number'
            ? s.weeklyPoints
            : Math.round(weeklyWins * 45 + weeklyStreak * 15 + ((s.lp || 0) * 0.08));

          const allTimeEarningsUsd = typeof s.allTimeEarningsUsd === 'number' 
            ? s.allTimeEarningsUsd 
            : (s.earningsUsd || 0);
          const allTimeWins = typeof s.allTimeWins === 'number' 
            ? s.allTimeWins 
            : (s.wins || 0);
          const allTimeGamesPlayed = typeof s.allTimeGamesPlayed === 'number' 
            ? s.allTimeGamesPlayed 
            : (s.gamesPlayed || 0);
          const allTimeWinRate = allTimeGamesPlayed > 0 
            ? Number(((allTimeWins / allTimeGamesPlayed) * 100).toFixed(1)) 
            : s.winRate;
          const allTimeBestStreak = typeof s.allTimeBestStreak === 'number' 
            ? s.allTimeBestStreak 
            : (s.winStreak || 0);
          const allTimeCoins = typeof s.allTimeCoins === 'number' 
            ? s.allTimeCoins 
            : 0;

          return {
            id: s.id,
            name: s.name,
            email: s.email,
            avatar: s.avatar,
            frame: s.frame,
            tier: (s.tier as LeagueTier) || 'Bronze',
            lp: s.lp,
            earningsUsd: s.earningsUsd,
            wins: s.wins,
            gamesPlayed: s.gamesPlayed,
            winRate: s.winRate,
            winStreak: s.winStreak,
            favoriteMap: s.favoriteMap || 'Classic RichUp Grid',
            title: s.title || 'Verified Player',
            country: s.country,
            city: s.city,
            joinedDate: s.joinedDate,
            isCurrentUser: s.isCurrentUser,
            weeklyPoints,
            weeklyEarningsUsd,
            weeklyWins,
            weeklyGamesPlayed,
            weeklyWinRate,
            weeklyStreak,
            weeklyProjectedPrize: s.weeklyProjectedPrize || '',
            allTimeEarningsUsd,
            allTimeWins,
            allTimeGamesPlayed,
            allTimeWinRate,
            allTimeBestStreak,
            allTimeCoins
          };
        })
      : [...GLOBAL_CHAMPIONS_SEED];

    // Deduplicate by id, normalized email, and unique name
    const seenEmails = new Set<string>();
    const seenNames = new Set<string>();
    const seenIds = new Set<string>();
    const sourceList: Omit<LeaderboardPlayer, 'rank'>[] = [];

    for (const item of rawList) {
      const em = (item.email || '').toLowerCase().trim();
      const nm = item.name.toLowerCase().trim();
      const id = item.id;
      if (id && seenIds.has(id)) continue;
      if (em && seenEmails.has(em)) continue;
      if (seenNames.has(nm)) continue;

      if (id) seenIds.add(id);
      if (em) seenEmails.add(em);
      seenNames.add(nm);
      sourceList.push(item);
    }

    // Match current user strictly only if authenticated via Dynamic
    let existingIndex = -1;
    if (isRealDynamicPlayer) {
      existingIndex = sourceList.findIndex(p => 
        (p.id && user.id && p.id === user.id) ||
        (p.id && user.dynamicUserId && p.id === user.dynamicUserId) ||
        (p.email && currentDisplayEmail && p.email.toLowerCase() === currentDisplayEmail.toLowerCase()) ||
        (p.name.toLowerCase() === currentDisplayName.toLowerCase())
      );

      if (existingIndex >= 0) {
        sourceList[existingIndex] = {
          ...sourceList[existingIndex],
          id: user.dynamicUserId || user.id || sourceList[existingIndex].id,
          name: currentDisplayName || sourceList[existingIndex].name,
          email: currentDisplayEmail || sourceList[existingIndex].email,
          avatar: user.avatar || sourceList[existingIndex].avatar,
          frame: user.avatarFrame ?? sourceList[existingIndex].frame,
          lp: user.leaguePoints || sourceList[existingIndex].lp,
          earningsUsd: user.stats.totalEarningsUsd || sourceList[existingIndex].earningsUsd,
          wins: user.stats.gamesWon || sourceList[existingIndex].wins,
          gamesPlayed: user.stats.gamesPlayed || sourceList[existingIndex].gamesPlayed,
          winStreak: user.stats.winStreak || sourceList[existingIndex].winStreak,
          winRate: user.stats.gamesPlayed > 0 ? userWinRate : sourceList[existingIndex].winRate,
          isCurrentUser: true
        };
      } else {
        sourceList.push(currentUserPlayerObj);
        existingIndex = sourceList.length - 1;
      }

      // Strict guarantee: Exactly ONE element in sourceList has isCurrentUser = true
      for (let i = 0; i < sourceList.length; i++) {
        sourceList[i].isCurrentUser = (i === existingIndex);
      }
    } else {
      for (let i = 0; i < sourceList.length; i++) {
        sourceList[i].isCurrentUser = false;
      }
    }

    // Sort strictly by timeframe
    if (timeframe === 'weekly') {
      // Sort by Weekly Cup Points descending, then weekly earnings
      sourceList.sort((a, b) => {
        if (b.weeklyPoints !== a.weeklyPoints) {
          return b.weeklyPoints - a.weeklyPoints;
        }
        return b.weeklyEarningsUsd - a.weeklyEarningsUsd;
      });
    } else if (timeframe === 'all_time') {
      // Sort by All-Time Cash Won descending, then career wins
      sourceList.sort((a, b) => {
        if (b.allTimeEarningsUsd !== a.allTimeEarningsUsd) {
          return b.allTimeEarningsUsd - a.allTimeEarningsUsd;
        }
        return b.allTimeWins - a.allTimeWins;
      });
    } else {
      // Season 4 standard LP
      sourceList.sort((a, b) => {
        if (b.lp !== a.lp) {
          return b.lp - a.lp;
        }
        return b.earningsUsd - a.earningsUsd;
      });
    }

    return sourceList.map((p, idx) => {
      const rank = idx + 1;
      let prize = '+2 🪙';
      if (rank === 1) prize = '🥇 +15 🪙 & Diamond Badge';
      else if (rank === 2) prize = '🥈 +10 🪙';
      else if (rank === 3) prize = '🥉 +6 🪙';

      return {
        ...p,
        rank,
        weeklyProjectedPrize: prize
      };
    });
  }, [currentUserPlayerObj, serverRankings, timeframe, user, userWinRate]);

  // Current user's live rank in the leaderboard
  const currentUserRank = useMemo(() => {
    const found = fullLeaderboard.find(p => p.isCurrentUser || p.name.toLowerCase() === user.username.toLowerCase());
    return found ? found.rank : fullLeaderboard.length;
  }, [fullLeaderboard, user.username]);

  // Filtered leaderboard by search query
  const filteredLeaderboard = useMemo(() => {
    if (!searchQuery.trim()) return fullLeaderboard;
    const q = searchQuery.toLowerCase();
    return fullLeaderboard.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.tier.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q)
    );
  }, [fullLeaderboard, searchQuery]);

  // Progress to next league tier
  const currentTierInfo = LEAGUES_TIERS_INFO.find(t => t.tier === user.leagueTier) || LEAGUES_TIERS_INFO[LEAGUES_TIERS_INFO.length - 1];
  const nextTierIndex = LEAGUES_TIERS_INFO.findIndex(t => t.tier === user.leagueTier) - 1;
  const nextTierInfo = nextTierIndex >= 0 ? LEAGUES_TIERS_INFO[nextTierIndex] : null;

  const lpProgress = nextTierInfo 
    ? Math.min(100, Math.max(0, Math.round(((user.leaguePoints - currentTierInfo.minLp) / (nextTierInfo.minLp - currentTierInfo.minLp)) * 100)))
    : 100;

  return (
    <div className={`min-h-screen pb-16 transition-colors ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#0e0a1a] text-white'
    }`}>
      {/* Top Banner Header (Clean, spacious, mobile-responsive layout) */}
      <div className={`w-full border-b transition-colors ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#140e26] border-[#281e47]'
      }`}>
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              onClick={() => {
                sounds.playClick();
                onNavigateHome();
              }}
              className={`self-start sm:self-auto px-3.5 py-2 sm:py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800' : 'bg-[#20173d] hover:bg-[#2b2052] border-[#362763] text-white'
              }`}
              title="Return to Lobby"
            >
              <span>←</span>
              <span>Back to Lobby</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl">🏆</span>
                <h1 className="text-lg sm:text-2xl font-heading font-black tracking-tight">
                  Global Rankings & League Championship
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Official competitive ladder, ranked tiers, prize pool leaders and weekly tournaments
              </p>
            </div>
          </div>

          {/* Tab Selection Switcher - Smooth horizontal scrolling on mobile */}
          <div className={`p-1 rounded-2xl border flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 max-w-full ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#1b1333] border-[#312354]'
          }`}>
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('leaderboard');
              }}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'leaderboard'
                  ? 'bg-[#7059e2] text-white shadow-md'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🥇</span>
              <span>Leaderboard</span>
            </button>
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('leagues');
              }}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'leagues'
                  ? 'bg-[#7059e2] text-white shadow-md'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>👑</span>
              <span>Leagues & Tiers</span>
            </button>
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('tournament');
              }}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'tournament'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>⚡</span>
              <span>Weekly Cup</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* User Real Standing Hero Banner (Uncrumpled Bento Card) */}
        <div className={`p-4 sm:p-6 rounded-3xl border shadow-xl space-y-5 ${
          isLight
            ? 'bg-gradient-to-br from-purple-50 via-white to-indigo-50 border-purple-200/80'
            : 'bg-gradient-to-br from-[#1c1338] via-[#140e26] to-[#120c22] border-[#312354]'
        }`}>
          {/* Top Row: Avatar, Identity & High-Level Badges */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-500/10">
            <div className="flex items-center gap-3.5 sm:gap-4">
              <AvatarCharacter
                avatarId={user.avatar || 'orange'}
                frameId={user.avatarFrame}
                size="md"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-heading font-black tracking-tight">
                    {user.username}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#7059e2]/20 text-[#a394f7] border border-[#7059e2]/40">
                    {user.leagueTier} League
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-mono-code font-bold border border-amber-500/30">
                    {timeframe === 'weekly' ? 'Weekly' : timeframe === 'all_time' ? 'All-Time' : 'Season'} Rank #{currentUserRank}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                  <span>
                    {timeframe === 'weekly' ? 'Weekly Cup Contender' : timeframe === 'all_time' ? 'PropRush Career Record' : 'Season 4 Verified Competitor'}
                  </span>
                  <span>•</span>
                  <span className="text-purple-400 font-mono-code font-semibold">{user.email || 'Verified Account'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-mono-code font-bold border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {timeframe === 'weekly' ? 'Weekly Tournament Ladder' : timeframe === 'all_time' ? 'All-Time Hall of Fame' : 'Live Season Ladder'}
              </span>
            </div>
          </div>

          {/* Middle Row: 4 Clean Metrics Grid - Dynamically updates based on active timeframe */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {timeframe === 'weekly' ? (
              <>
                <div className={`p-3 sm:p-4 rounded-2xl border ${
                  isLight ? 'bg-white/80 border-purple-100' : 'bg-[#181130]/70 border-[#2b1f49]'
                }`}>
                  <div className="text-[10px] uppercase font-mono-code tracking-wider text-slate-400 font-bold flex items-center gap-1">
                    <span>⚡</span> Weekly Cup Points
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono-code text-purple-400 mt-1">
                    {currentUserPlayerObj.weeklyPoints.toLocaleString()} <span className="text-xs font-normal text-slate-400">Pts</span>
                  </div>
                </div>

                <div className={`p-3 sm:p-4 rounded-2xl border ${
                  isLight ? 'bg-white/80 border-purple-100' : 'bg-[#181130]/70 border-[#2b1f49]'
                }`}>
                  <div className="text-[10px] uppercase font-mono-code tracking-wider text-slate-400 font-bold flex items-center gap-1">
                    <span>🏆</span> This Week Victories
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono-code text-amber-400 mt-1">
                    {currentUserPlayerObj.weeklyWins} <span className="text-xs font-normal text-slate-400">wins ({currentUserPlayerObj.weeklyStreak}W streak)</span>
                  </div>
                </div>

                <div className={`p-3 sm:p-4 rounded-2xl border ${
                  isLight ? 'bg-white/80 border-purple-100' : 'bg-[#181130]/70 border-[#2b1f49]'
                }`}>
                  <div className="text-[10px] uppercase font-mono-code tracking-wider text-slate-400 font-bold flex items-center gap-1">
                    <span>🎯</span> Week Win Rate
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono-code text-cyan-400 mt-1">
                    {currentUserPlayerObj.weeklyWinRate}% <span className="text-xs font-normal text-slate-400">({currentUserPlayerObj.weeklyGamesPlayed} matches)</span>
                  </div>
                </div>

                <div className={`p-3 sm:p-4 rounded-2xl border ${
                  isLight ? 'bg-white/80 border-purple-100' : 'bg-[#181130]/70 border-[#2b1f49]'
                }`}>
                  <div className="text-[10px] uppercase font-mono-code tracking-wider text-slate-400 font-bold flex items-center gap-1">
                    <span>💵</span> This Week Wager Won
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono-code text-emerald-400 mt-1">
                    ${currentUserPlayerObj.weeklyEarningsUsd.toFixed(2)}
                  </div>
                </div>
              </>
            ) : timeframe === 'all_time' ? (
              <>
                <div className={`p-3 sm:p-4 rounded-2xl border ${
                  isLight ? 'bg-white/80 border-purple-100' : 'bg-[#181130]/70 border-[#2b1f49]'
                }`}>
                  <div className="text-[10px] uppercase font-mono-code tracking-wider text-slate-400 font-bold flex items-center gap-1">
                    <span>💵</span> All-Time Cash Won
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono-code text-emerald-400 mt-1">
                    ${currentUserPlayerObj.allTimeEarningsUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div className={`p-3 sm:p-4 rounded-2xl border ${
                  isLight ? 'bg-white/80 border-purple-100' : 'bg-[#181130]/70 border-[#2b1f49]'
                }`}>
                  <div className="text-[10px] uppercase font-mono-code tracking-wider text-slate-400 font-bold flex items-center gap-1">
                    <span>🏆</span> Career Victories
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono-code text-amber-400 mt-1">
                    {currentUserPlayerObj.allTimeWins} <span className="text-xs font-normal text-slate-400">victories</span>
                  </div>
                </div>

                <div className={`p-3 sm:p-4 rounded-2xl border ${
                  isLight ? 'bg-white/80 border-purple-100' : 'bg-[#181130]/70 border-[#2b1f49]'
                }`}>
                  <div className="text-[10px] uppercase font-mono-code tracking-wider text-slate-400 font-bold flex items-center gap-1">
                    <span>🎯</span> Career Win Rate
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono-code text-cyan-400 mt-1">
                    {currentUserPlayerObj.allTimeWinRate}% <span className="text-xs font-normal text-slate-400">({currentUserPlayerObj.allTimeGamesPlayed} matches)</span>
                  </div>
                </div>

                <div className={`p-3 sm:p-4 rounded-2xl border ${
                  isLight ? 'bg-white/80 border-purple-100' : 'bg-[#181130]/70 border-[#2b1f49]'
                }`}>
                  <div className="text-[10px] uppercase font-mono-code tracking-wider text-slate-400 font-bold flex items-center gap-1">
                    <span>🪙</span> Total Career Coins
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono-code text-amber-300 mt-1">
                    {currentUserPlayerObj.allTimeCoins.toLocaleString()} <span className="text-xs font-normal text-slate-400">🪙</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={`p-3 sm:p-4 rounded-2xl border ${
                  isLight ? 'bg-white/80 border-purple-100' : 'bg-[#181130]/70 border-[#2b1f49]'
                }`}>
                  <div className="text-[10px] uppercase font-mono-code tracking-wider text-slate-400 font-bold flex items-center gap-1">
                    <span>⚡</span> League Points
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono-code text-purple-400 mt-1">
                    {user.leaguePoints.toLocaleString()} <span className="text-xs font-normal text-slate-400">LP</span>
                  </div>
                </div>

                <div className={`p-3 sm:p-4 rounded-2xl border ${
                  isLight ? 'bg-white/80 border-purple-100' : 'bg-[#181130]/70 border-[#2b1f49]'
                }`}>
                  <div className="text-[10px] uppercase font-mono-code tracking-wider text-slate-400 font-bold flex items-center gap-1">
                    <span>🏆</span> Ranked Wins
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono-code text-amber-400 mt-1">
                    {user.stats.gamesWon} <span className="text-xs font-normal text-slate-400">victories</span>
                  </div>
                </div>

                <div className={`p-3 sm:p-4 rounded-2xl border ${
                  isLight ? 'bg-white/80 border-purple-100' : 'bg-[#181130]/70 border-[#2b1f49]'
                }`}>
                  <div className="text-[10px] uppercase font-mono-code tracking-wider text-slate-400 font-bold flex items-center gap-1">
                    <span>🎯</span> Win Rate
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono-code text-cyan-400 mt-1">
                    {userWinRate}% <span className="text-xs font-normal text-slate-400">({user.stats.gamesPlayed} played)</span>
                  </div>
                </div>

                <div className={`p-3 sm:p-4 rounded-2xl border ${
                  isLight ? 'bg-white/80 border-purple-100' : 'bg-[#181130]/70 border-[#2b1f49]'
                }`}>
                  <div className="text-[10px] uppercase font-mono-code tracking-wider text-slate-400 font-bold flex items-center gap-1">
                    <span>💵</span> Total Cash Won
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono-code text-emerald-400 mt-1">
                    ${user.stats.totalEarningsUsd.toFixed(2)}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Bottom Row: Next Tier Progress Bar, Weekly Cup Reset & Tier Payout in balanced cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Next Tier Promotion */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between ${
              isLight ? 'bg-white/60 border-slate-200' : 'bg-[#181130]/50 border-[#281e47]'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  Next Tier: {nextTierInfo ? nextTierInfo.tier : 'Max Tier Reached'}
                </span>
                <span className="font-mono-code text-xs font-bold text-purple-400">
                  {lpProgress}%
                </span>
              </div>
              <div className="w-full bg-slate-700/30 rounded-full h-2.5 my-2.5 overflow-hidden border border-slate-700/40">
                <div 
                  className="bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${lpProgress}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400 font-mono-code">
                {nextTierInfo 
                  ? `${Math.max(0, nextTierInfo.minLp - user.leaguePoints).toLocaleString()} LP needed to advance` 
                  : 'Currently at the highest league echelon'}
              </div>
            </div>

            {/* Weekly Cup Reset */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between ${
              isLight ? 'bg-white/60 border-slate-200' : 'bg-[#181130]/50 border-[#281e47]'
            }`}>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Weekly Cup Reset
              </div>
              <div className="text-lg sm:text-xl font-mono-code font-black text-amber-400 my-1">
                {countdown.days}d {countdown.hours}h {countdown.mins}m {countdown.secs}s
              </div>
              <div className="text-[11px] text-slate-400">
                Tournaments conclude every Sunday at 23:59 UTC
              </div>
            </div>

            {/* Tier Payout */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between ${
              isLight ? 'bg-white/60 border-slate-200' : 'bg-[#181130]/50 border-[#281e47]'
            }`}>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Weekly Tier End Payout
              </div>
              <div className="text-lg sm:text-xl font-mono-code font-black text-emerald-400 my-1 flex items-center gap-1.5">
                <span>+{currentTierInfo.rewards.split(' ')[0]}</span>
                <span className="text-base">🪙</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Credited directly to in-game wallet at season rollover
              </div>
            </div>
          </div>
        </div>

        {/* TAB 1: LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-4">
            {/* Filter Bar - Responsive flex with wrap & mobile clean controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Search player, league or country..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs outline-none transition-all ${
                    isLight
                      ? 'bg-white border-slate-200 focus:border-purple-500 text-slate-900'
                      : 'bg-[#150f29] border-[#2c204d] focus:border-purple-500 text-white'
                  }`}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className={`p-1 rounded-xl border flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 ${
                isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#160f2a] border-[#291e47]'
              }`}>
                <button
                  onClick={() => {
                    sounds.playClick();
                    setTimeframe('season');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    timeframe === 'season'
                      ? 'bg-[#7059e2] text-white shadow-sm'
                      : isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  Season 4 (LP)
                </button>
                <button
                  onClick={() => {
                    sounds.playClick();
                    setTimeframe('weekly');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    timeframe === 'weekly'
                      ? 'bg-[#7059e2] text-white shadow-sm'
                      : isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  This Week
                </button>
                <button
                  onClick={() => {
                    sounds.playClick();
                    setTimeframe('all_time');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    timeframe === 'all_time'
                      ? 'bg-[#7059e2] text-white shadow-sm'
                      : isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  All-Time Winnings
                </button>
              </div>
            </div>

            {/* Contextual Active Timeframe Banner */}
            <div className={`px-4 py-2.5 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
              isLight ? 'bg-purple-50/80 border-purple-200 text-purple-900' : 'bg-[#1b1236] border-[#312257] text-purple-200'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-base">{timeframe === 'weekly' ? '⚡' : timeframe === 'all_time' ? '👑' : '🏆'}</span>
                <span>
                  {timeframe === 'weekly' 
                    ? 'Weekly Tournament Cup: Sorted by weekly match points & prize earnings. Resets every Sunday at 23:59 UTC.' 
                    : timeframe === 'all_time' 
                    ? 'All-Time Hall of Fame: Ranked by cumulative career cash earnings & tournament payouts across all seasons.' 
                    : 'Season 4 Championship: Official ladder sorted by competitive League Points (LP) earned in ranked matches.'}
                </span>
              </div>
              <span className="font-mono-code text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 shrink-0 self-start sm:self-auto">
                {filteredLeaderboard.length} Ranked Players
              </span>
            </div>

            {/* Mobile Card List View (Visible on <sm screens for perfect touch UX) */}
            <div className="sm:hidden space-y-3">
              {filteredLeaderboard.map((p) => {
                const isUserRow = p.isCurrentUser || p.name.toLowerCase() === user.username.toLowerCase();
                return (
                  <div
                    key={p.id}
                    className={`p-4 rounded-2xl border shadow-md space-y-3 transition-colors ${
                      isUserRow
                        ? (isLight ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-400/40' : 'bg-[#211642] border-purple-500 ring-2 ring-purple-500/30')
                        : (isLight ? 'bg-white border-slate-200' : 'bg-[#150f29] border-[#291f47]')
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="font-heading font-black text-sm px-2 py-0.5 rounded-md bg-slate-500/15">
                          {p.rank === 1 ? '🥇 #1' : p.rank === 2 ? '🥈 #2' : p.rank === 3 ? '🥉 #3' : `#${p.rank}`}
                        </span>
                        <AvatarCharacter
                          avatarId={p.avatar}
                          frameId={p.frame}
                          size="xs"
                        />
                        <div>
                          <div className="font-heading font-black text-sm flex items-center gap-1.5">
                            <span>{p.name}</span>
                            {isUserRow && (
                              <span className="px-1.5 py-0.2 rounded bg-purple-600 text-white text-[8px] font-black uppercase">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {p.city ? `📍 ${p.city}, ${p.country}` : p.title}
                          </div>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        p.tier === 'Tycoon' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                        p.tier === 'Master' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                        p.tier === 'Diamond' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                        'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                      }`}>
                        {p.tier}
                      </span>
                    </div>

                    {/* Mobile Card Metrics: Dynamically changes per timeframe */}
                    {timeframe === 'weekly' ? (
                      <div className="space-y-2 pt-1 border-t border-slate-500/10">
                        <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono-code">
                          <div>
                            <div className="text-[9px] text-slate-400 uppercase">Weekly Pts</div>
                            <div className="font-black text-purple-400">⚡ {p.weeklyPoints.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-400 uppercase">Week Won</div>
                            <div className="font-black text-emerald-400">${p.weeklyEarningsUsd.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-400 uppercase">Week W/L</div>
                            <div className="font-bold text-amber-400">{p.weeklyWins}W / {p.weeklyGamesPlayed}P</div>
                          </div>
                        </div>
                        {p.weeklyProjectedPrize && (
                          <div className="text-center text-[10px] font-mono-code font-bold text-amber-300 bg-amber-500/10 py-1 rounded-lg border border-amber-500/20">
                            Cup Reward: {p.weeklyProjectedPrize}
                          </div>
                        )}
                      </div>
                    ) : timeframe === 'all_time' ? (
                      <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono-code pt-1 border-t border-slate-500/10">
                        <div>
                          <div className="text-[9px] text-slate-400 uppercase">All-Time Cash</div>
                          <div className="font-black text-emerald-400">${p.allTimeEarningsUsd.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-400 uppercase">Career Wins</div>
                          <div className="font-black text-amber-400">{p.allTimeWins}W</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-400 uppercase">Win Rate</div>
                          <div className="font-bold text-cyan-400">{p.allTimeWinRate}%</div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono-code pt-1 border-t border-slate-500/10">
                        <div>
                          <div className="text-[9px] text-slate-400 uppercase">Season LP</div>
                          <div className="font-black text-purple-400">⚡ {p.lp.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-400 uppercase">Season Won</div>
                          <div className="font-black text-emerald-400">${p.earningsUsd.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-400 uppercase">Win Rate</div>
                          <div className="font-bold text-amber-400">{p.winRate}%</div>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        sounds.playClick();
                        setSelectedPlayer(p);
                      }}
                      className={`w-full py-2 rounded-xl border font-heading font-black text-xs transition-all cursor-pointer ${
                        isLight
                          ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
                          : 'bg-[#231842] hover:bg-[#2f2059] border-[#382669] text-slate-200'
                      }`}
                    >
                      Inspect Profile
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Desktop / Tablet Table View (hidden on mobile, min-w-[760px] to preserve clean columns) */}
            <div className={`hidden sm:block rounded-3xl border overflow-hidden shadow-xl ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#140e26] border-[#281e47]'
            }`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[760px]">
                  <thead>
                    <tr className={`border-b text-[11px] font-mono-code uppercase tracking-wider ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#181130] border-[#281e47] text-slate-400'
                    }`}>
                      <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                      <th className="py-3.5 px-4">Tycoon Player</th>
                      <th className="py-3.5 px-4 text-center">League Tier</th>
                      {timeframe === 'weekly' ? (
                        <>
                          <th className="py-3.5 px-4 text-right">⚡ Weekly Cup Pts</th>
                          <th className="py-3.5 px-4 text-right">Week Cash Won</th>
                          <th className="py-3.5 px-4 text-center">Week Record</th>
                          <th className="py-3.5 px-4 text-center">Cup Prize</th>
                        </>
                      ) : timeframe === 'all_time' ? (
                        <>
                          <th className="py-3.5 px-4 text-right">💵 All-Time Cash Won</th>
                          <th className="py-3.5 px-4 text-center">Career Wins</th>
                          <th className="py-3.5 px-4 text-center">Career Win Rate</th>
                          <th className="py-3.5 px-4 text-center">Career Coins</th>
                        </>
                      ) : (
                        <>
                          <th className="py-3.5 px-4 text-right">League Points</th>
                          <th className="py-3.5 px-4 text-right">Wager Earnings</th>
                          <th className="py-3.5 px-4 text-center">Win Rate</th>
                          <th className="py-3.5 px-4 text-center">Streak</th>
                        </>
                      )}
                      <th className="py-3.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y text-xs ${
                    isLight ? 'divide-slate-100 text-slate-800' : 'divide-[#20183b] text-slate-200'
                  }`}>
                    {filteredLeaderboard.map((p) => {
                      const isTop3 = p.rank <= 3;
                      const isUserRow = p.isCurrentUser || p.name.toLowerCase() === user.username.toLowerCase();
                      return (
                        <tr
                          key={p.id}
                          className={`transition-colors hover:bg-purple-500/10 ${
                            isUserRow 
                              ? (isLight ? 'bg-purple-100/60 font-semibold' : 'bg-purple-950/40 border-l-4 border-purple-500 font-semibold') 
                              : isTop3 ? (isLight ? 'bg-amber-50/50' : 'bg-amber-950/15') : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-center font-black font-heading">
                            {p.rank === 1 ? '🥇 1' : p.rank === 2 ? '🥈 2' : p.rank === 3 ? '🥉 3' : `#${p.rank}`}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <AvatarCharacter
                                avatarId={p.avatar}
                                frameId={p.frame}
                                size="xs"
                              />
                              <div>
                                <div className="font-heading font-black text-sm flex items-center gap-1.5">
                                  <span>{p.name}</span>
                                  {isUserRow && (
                                    <span className="px-1.5 py-0.2 rounded bg-purple-600 text-white text-[9px] font-black uppercase">
                                      YOU
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                  <span>{p.title}</span>
                                  {p.city && (
                                    <>
                                      <span>•</span>
                                      <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>📍 {p.city}, {p.country}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${
                              p.tier === 'Tycoon' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                              p.tier === 'Master' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                              p.tier === 'Diamond' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                              p.tier === 'Platinum' ? 'bg-slate-400/20 text-slate-300 border border-slate-400/30' :
                              p.tier === 'Gold' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                              p.tier === 'Silver' ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30' :
                              'bg-amber-800/20 text-amber-500 border border-amber-800/30'
                            }`}>
                              {p.tier}
                            </span>
                          </td>

                          {/* Desktop Table Dynamic Cells per Timeframe */}
                          {timeframe === 'weekly' ? (
                            <>
                              <td className="py-3 px-4 text-right font-mono-code font-black text-purple-400">
                                ⚡ {p.weeklyPoints.toLocaleString()} Pts
                              </td>
                              <td className="py-3 px-4 text-right font-mono-code font-black text-emerald-400">
                                ${p.weeklyEarningsUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-4 text-center font-mono-code">
                                <span className="font-bold text-amber-400">{p.weeklyWinRate}%</span>
                                <span className="text-[10px] text-slate-400 ml-1">({p.weeklyWins}W / {p.weeklyGamesPlayed}P)</span>
                              </td>
                              <td className="py-3 px-4 text-center font-mono-code">
                                <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20 text-[11px]">
                                  {p.weeklyProjectedPrize || 'Standard Pool'}
                                </span>
                              </td>
                            </>
                          ) : timeframe === 'all_time' ? (
                            <>
                              <td className="py-3 px-4 text-right font-mono-code font-black text-emerald-400">
                                💵 ${p.allTimeEarningsUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-4 text-center font-mono-code font-black text-amber-400">
                                {p.allTimeWins.toLocaleString()} victories
                              </td>
                              <td className="py-3 px-4 text-center font-mono-code">
                                <span className="font-bold text-cyan-400">{p.allTimeWinRate}%</span>
                                <span className="text-[10px] text-slate-400 ml-1">({p.allTimeGamesPlayed} played)</span>
                              </td>
                              <td className="py-3 px-4 text-center font-mono-code">
                                <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20">
                                  {p.allTimeCoins.toLocaleString()} 🪙
                                </span>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 px-4 text-right font-mono-code font-black text-purple-400">
                                ⚡ {p.lp.toLocaleString()} LP
                              </td>
                              <td className="py-3 px-4 text-right font-mono-code font-black text-emerald-400">
                                ${p.earningsUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-4 text-center font-mono-code">
                                <span className="font-bold text-amber-400">{p.winRate}%</span>
                                <span className="text-[10px] text-slate-400 ml-1">({p.wins}W)</span>
                              </td>
                              <td className="py-3 px-4 text-center font-mono-code">
                                <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-400 font-bold border border-orange-500/20">
                                  🔥 {p.winStreak}W
                                </span>
                              </td>
                            </>
                          )}

                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => {
                                sounds.playClick();
                                setSelectedPlayer(p);
                              }}
                              className={`px-3 py-1.5 rounded-xl border font-heading font-black text-[11px] transition-all cursor-pointer ${
                                isLight
                                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                                  : 'bg-[#21183d] hover:bg-[#2e2154] border-[#392969] text-slate-200'
                              }`}
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredLeaderboard.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          <p className="text-sm font-semibold">No players matched your search criteria.</p>
                          <button
                            onClick={() => setSearchQuery('')}
                            className="mt-2 text-xs text-purple-400 hover:underline cursor-pointer"
                          >
                            Clear search filter
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Real Player Season 4 Notice / Call to Action */}
            <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
              isLight ? 'bg-purple-50/70 border-purple-200 text-slate-800' : 'bg-[#181130] border-[#2f2254] text-white'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-xl shrink-0">
                  🏆
                </div>
                <div>
                  <h4 className={`font-heading font-black text-sm ${isLight ? 'text-purple-700' : 'text-purple-300'}`}>
                    Live PropRush Competitive Standings
                  </h4>
                  <p className="text-xs text-slate-400">
                    Leaderboard displays real, authenticated players on the platform. Complete matches to earn LP and advance through the leagues.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  sounds.playClick();
                  onNavigateHome();
                }}
                className="px-4 py-2 rounded-xl bg-[#7059e2] hover:bg-[#806bf0] text-white font-heading font-black text-xs transition-all shadow-md cursor-pointer shrink-0"
              >
                Play Ranked Match
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: LEAGUES & TIERS */}
        {activeTab === 'leagues' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {LEAGUES_TIERS_INFO.map((league) => {
              const isCurrent = user.leagueTier === league.tier;
              return (
                <div
                  key={league.tier}
                  className={`p-5 rounded-2xl border shadow-lg relative overflow-hidden flex flex-col justify-between transition-transform hover:-translate-y-1 ${
                    isCurrent
                      ? (isLight ? 'bg-purple-50/80 border-purple-400 ring-2 ring-purple-400/50' : 'bg-[#1e1538] border-purple-500 ring-2 ring-purple-500/30')
                      : isLight ? 'bg-white border-slate-200' : 'bg-[#140e26] border-[#281e47]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-3xl">{league.icon}</span>
                        <div>
                          <h3 className={`font-heading font-black text-lg ${league.textColor}`}>
                            {league.tier} League
                          </h3>
                          <span className="text-xs font-mono-code text-slate-400">
                            {league.lpRange}
                          </span>
                        </div>
                      </div>
                      {isCurrent && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase border border-emerald-500/30">
                          Active Tier
                        </span>
                      )}
                    </div>

                    <div className={`p-3 rounded-xl mb-3 text-xs ${
                      isLight ? 'bg-slate-50 text-slate-700' : 'bg-[#1b1333] text-slate-300'
                    }`}>
                      <div className="text-[10px] font-mono-code uppercase tracking-wider text-slate-400 mb-1 font-bold">
                        🎁 Weekly Season Rewards
                      </div>
                      <div className="font-semibold text-amber-400">
                        {league.rewards}
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-400">
                      <div className="text-[10px] font-mono-code uppercase tracking-wider text-slate-500 font-bold">
                        Perks & Privileges
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        {league.perks}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-500/10 flex items-center justify-between text-[11px] font-mono-code">
                    <span className="text-slate-400">Demotion Buffer:</span>
                    <span className="font-bold text-emerald-400">3 Loss Shield</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: WEEKLY TOURNAMENT CUP */}
        {activeTab === 'tournament' && (
          <div className={`p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-6 ${
            isLight
              ? 'bg-gradient-to-br from-purple-50 via-white to-amber-50 border-purple-200'
              : 'bg-gradient-to-br from-[#1a1033] via-[#140e26] to-[#0d091a] border-[#312354]'
          }`}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-black uppercase tracking-wider mb-2">
                  <span>⚡</span> PropRush Weekly Cup #18
                </div>
                <h2 className="text-2xl sm:text-3xl font-heading font-black tracking-tight">
                  High-Stakes Grand Prix Championship
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
                  Play in 5 or more rated matches this week to qualify. Top 10% of players share the $5,000 community prize purse!
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center shrink-0">
                <div className="text-[11px] font-mono-code uppercase tracking-wider text-amber-400 font-bold">
                  Total Prize Pool
                </div>
                <div className="text-2xl sm:text-3xl font-heading font-black text-amber-400 font-mono-code">
                  1,500 🪙 + $2,500
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  1st Place takes 40% ($1,000 USD)
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={`p-4 rounded-2xl border ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#1b1333] border-[#312354]'
              }`}>
                <div className="text-xs text-slate-400">Your Qualifying Matches</div>
                <div className="text-xl font-heading font-black text-purple-400 mt-1 font-mono-code">
                  {Math.min(user.stats.gamesPlayed, 5)} / 5 Completed
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {user.stats.gamesPlayed >= 5 ? '✅ Qualified for Weekly Cup' : `${Math.max(0, 5 - user.stats.gamesPlayed)} more matches to qualify`}
                </div>
              </div>

              <div className={`p-4 rounded-2xl border ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#1b1333] border-[#312354]'
              }`}>
                <div className="text-xs text-slate-400">Tournament Standing</div>
                <div className="text-xl font-heading font-black text-amber-400 mt-1">
                  {user.stats.gamesPlayed > 0 ? `Rank #${currentUserRank}` : 'Unranked'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {user.leaguePoints >= 1000 ? 'Top Bracket Prize Qualifier' : 'Standard Tier'}
                </div>
              </div>

              <div className={`p-4 rounded-2xl border ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#1b1333] border-[#312354]'
              }`}>
                <div className="text-xs text-slate-400">Final Roll Countdown</div>
                <div className="text-xl font-heading font-black text-emerald-400 mt-1 font-mono-code">
                  {countdown.days}d {countdown.hours}h {countdown.mins}m {countdown.secs}s
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Resets Sunday 23:59 UTC
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inspect Player Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#17102e] border-[#332259] text-white'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AvatarCharacter
                  avatarId={selectedPlayer.avatar}
                  frameId={selectedPlayer.frame}
                  size="md"
                />
                <div>
                  <h3 className="font-heading font-black text-lg">
                    {selectedPlayer.name}
                  </h3>
                  <p className="text-xs text-slate-400">{selectedPlayer.title}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-500/20 hover:bg-slate-500/30 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {timeframe === 'weekly' ? (
                <>
                  <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1f163d] border-[#362763]'}`}>
                    <div className="text-slate-400 text-[10px] uppercase font-mono-code">Weekly Cup Rank</div>
                    <div className="text-base font-black font-heading mt-0.5">#{selectedPlayer.rank}</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1f163d] border-[#362763]'}`}>
                    <div className="text-slate-400 text-[10px] uppercase font-mono-code">Weekly Cup Points</div>
                    <div className="text-base font-black text-purple-400 font-mono-code mt-0.5">{selectedPlayer.weeklyPoints.toLocaleString()} Pts</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1f163d] border-[#362763]'}`}>
                    <div className="text-slate-400 text-[10px] uppercase font-mono-code">Week Cash Won</div>
                    <div className="text-base font-black text-emerald-400 font-mono-code mt-0.5">${selectedPlayer.weeklyEarningsUsd.toFixed(2)}</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1f163d] border-[#362763]'}`}>
                    <div className="text-slate-400 text-[10px] uppercase font-mono-code">Week Record</div>
                    <div className="text-base font-black text-amber-400 font-mono-code mt-0.5">{selectedPlayer.weeklyWinRate}% ({selectedPlayer.weeklyWins}W)</div>
                  </div>
                </>
              ) : timeframe === 'all_time' ? (
                <>
                  <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1f163d] border-[#362763]'}`}>
                    <div className="text-slate-400 text-[10px] uppercase font-mono-code">All-Time Rank</div>
                    <div className="text-base font-black font-heading mt-0.5">#{selectedPlayer.rank}</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1f163d] border-[#362763]'}`}>
                    <div className="text-slate-400 text-[10px] uppercase font-mono-code">Total Cash Won</div>
                    <div className="text-base font-black text-emerald-400 font-mono-code mt-0.5">${selectedPlayer.allTimeEarningsUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1f163d] border-[#362763]'}`}>
                    <div className="text-slate-400 text-[10px] uppercase font-mono-code">Career Victories</div>
                    <div className="text-base font-black text-amber-400 font-mono-code mt-0.5">{selectedPlayer.allTimeWins.toLocaleString()} W</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1f163d] border-[#362763]'}`}>
                    <div className="text-slate-400 text-[10px] uppercase font-mono-code">Career Win Rate</div>
                    <div className="text-base font-black text-cyan-400 font-mono-code mt-0.5">{selectedPlayer.allTimeWinRate}%</div>
                  </div>
                </>
              ) : (
                <>
                  <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1f163d] border-[#362763]'}`}>
                    <div className="text-slate-400 text-[10px] uppercase font-mono-code">Global Rank</div>
                    <div className="text-base font-black font-heading mt-0.5">#{selectedPlayer.rank}</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1f163d] border-[#362763]'}`}>
                    <div className="text-slate-400 text-[10px] uppercase font-mono-code">League Points</div>
                    <div className="text-base font-black text-purple-400 font-mono-code mt-0.5">{selectedPlayer.lp.toLocaleString()} LP</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1f163d] border-[#362763]'}`}>
                    <div className="text-slate-400 text-[10px] uppercase font-mono-code">Total Winnings</div>
                    <div className="text-base font-black text-emerald-400 font-mono-code mt-0.5">${selectedPlayer.earningsUsd.toFixed(2)}</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1f163d] border-[#362763]'}`}>
                    <div className="text-slate-400 text-[10px] uppercase font-mono-code">Win Rate</div>
                    <div className="text-base font-black text-amber-400 font-mono-code mt-0.5">{selectedPlayer.winRate}% ({selectedPlayer.wins}W)</div>
                  </div>
                </>
              )}
            </div>

            <div className={`p-3 rounded-xl text-xs flex items-center justify-between ${
              isLight ? 'bg-slate-50 text-slate-700' : 'bg-[#1f163d] text-slate-300'
            }`}>
              <span>Favorite Arena:</span>
              <span className="font-bold text-purple-400">{selectedPlayer.favoriteMap}</span>
            </div>

            {selectedPlayer.city && (
              <div className={`p-3 rounded-xl text-xs flex items-center justify-between ${
                isLight ? 'bg-slate-50 text-slate-700' : 'bg-[#1f163d] text-slate-300'
              }`}>
                <span>Hometown / Region:</span>
                <span className="font-bold text-slate-300">📍 {selectedPlayer.city}, {selectedPlayer.country}</span>
              </div>
            )}

            {selectedPlayer.joinedDate && (
              <div className={`p-3 rounded-xl text-xs flex items-center justify-between ${
                isLight ? 'bg-slate-50 text-slate-700' : 'bg-[#1f163d] text-slate-300'
              }`}>
                <span>Member Since:</span>
                <span className="font-mono-code text-slate-400">{selectedPlayer.joinedDate}</span>
              </div>
            )}

            <button
              onClick={() => setSelectedPlayer(null)}
              className="w-full py-2.5 rounded-xl bg-[#7059e2] text-white font-heading font-black text-xs cursor-pointer hover:bg-[#5e46d0] transition-colors"
            >
              Close Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
