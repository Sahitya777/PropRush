import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from '../context/UserContext';
import { LeagueTier } from '../types/user';
import { useTheme } from '../context/ThemeContext';
import { AvatarCharacter } from '../components/AvatarCharacter';
import { sounds } from '../utils/audio';

export interface LeaderboardPlayer {
  rank: number;
  id: string;
  name: string;
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
  isCurrentUser?: boolean;
}

const GLOBAL_CHAMPIONS_SEED: Omit<LeaderboardPlayer, 'rank'>[] = [
  {
    id: 'usr_top1',
    name: 'MonopolyKing99',
    avatar: 'king',
    frame: 'pfp_crown',
    tier: 'Tycoon',
    lp: 2840,
    earningsUsd: 14250.00,
    wins: 412,
    gamesPlayed: 520,
    winRate: 79.2,
    winStreak: 12,
    favoriteMap: 'Classic RichUp Grid',
    title: 'Grand Tycoon Champion'
  },
  {
    id: 'usr_top2',
    name: 'CyberWhale',
    avatar: 'cyber',
    frame: 'pfp_neon',
    tier: 'Tycoon',
    lp: 2610,
    earningsUsd: 11800.00,
    wins: 345,
    gamesPlayed: 460,
    winRate: 75.0,
    winStreak: 8,
    favoriteMap: 'Cyber Neon Metropolis',
    title: 'High Stakes Master'
  },
  {
    id: 'usr_top3',
    name: 'Sahitya',
    avatar: 'vip',
    frame: 'pfp_gold_sparkle',
    tier: 'Tycoon',
    lp: 2490,
    earningsUsd: 9450.00,
    wins: 290,
    gamesPlayed: 395,
    winRate: 73.4,
    winStreak: 6,
    favoriteMap: 'NYC High Stakes Arena',
    title: 'PropRush Founder'
  },
  {
    id: 'usr_top4',
    name: 'ValkyrieQueen',
    avatar: 'vip',
    frame: 'pfp_gold_sparkle',
    tier: 'Master',
    lp: 2210,
    earningsUsd: 8340.00,
    wins: 240,
    gamesPlayed: 350,
    winRate: 68.5,
    winStreak: 5,
    favoriteMap: 'Worldwide Grand Tour',
    title: 'Board Dominator'
  },
  {
    id: 'usr_top5',
    name: 'DiceDoctor',
    avatar: 'neon',
    frame: 'pfp_emerald',
    tier: 'Master',
    lp: 2050,
    earningsUsd: 6920.00,
    wins: 198,
    gamesPlayed: 300,
    winRate: 66.0,
    winStreak: 4,
    favoriteMap: 'Classic RichUp Grid',
    title: 'Probability Expert'
  },
  {
    id: 'usr_top6',
    name: 'TokyoDrifter',
    avatar: 'cyber',
    frame: 'pfp_neon',
    tier: 'Master',
    lp: 1940,
    earningsUsd: 5810.00,
    wins: 175,
    gamesPlayed: 275,
    winRate: 63.6,
    winStreak: 3,
    favoriteMap: 'Tokyo Fast 2x Blitz',
    title: 'Speed Strategist'
  },
  {
    id: 'usr_top7',
    name: 'EmeraldBaron',
    avatar: 'gold',
    frame: 'pfp_emerald',
    tier: 'Diamond',
    lp: 1680,
    earningsUsd: 4320.00,
    wins: 132,
    gamesPlayed: 215,
    winRate: 61.4,
    winStreak: 4,
    favoriteMap: 'Medieval Kingdom Castle',
    title: 'Dice Wizard'
  },
  {
    id: 'usr_top8',
    name: 'OctoTycoon',
    avatar: 'navy',
    frame: 'none',
    tier: 'Diamond',
    lp: 1520,
    earningsUsd: 3890.00,
    wins: 119,
    gamesPlayed: 200,
    winRate: 59.5,
    winStreak: 3,
    favoriteMap: 'Pirate Treasure Cove',
    title: 'Deep Sea Landlord'
  },
  {
    id: 'usr_top9',
    name: 'SolarFlare',
    avatar: 'orange',
    frame: 'none',
    tier: 'Platinum',
    lp: 1280,
    earningsUsd: 2950.00,
    wins: 98,
    gamesPlayed: 170,
    winRate: 57.6,
    winStreak: 4,
    favoriteMap: 'Death Valley Wasteland',
    title: 'Property Pioneer'
  },
  {
    id: 'usr_top10',
    name: 'AppleInvestor',
    avatar: 'apple',
    frame: 'none',
    tier: 'Platinum',
    lp: 1150,
    earningsUsd: 2410.00,
    wins: 84,
    gamesPlayed: 150,
    winRate: 56.0,
    winStreak: 3,
    favoriteMap: 'Candy Wonderland',
    title: 'Venture Capitalist'
  },
  {
    id: 'usr_top11',
    name: 'BrickMaster',
    avatar: 'purple',
    frame: 'none',
    tier: 'Gold',
    lp: 880,
    earningsUsd: 1420.00,
    wins: 62,
    gamesPlayed: 120,
    winRate: 51.6,
    winStreak: 2,
    favoriteMap: 'Classic RichUp Grid',
    title: 'Urban Developer'
  },
  {
    id: 'usr_top12',
    name: 'LuckyStriker',
    avatar: 'navy',
    frame: 'none',
    tier: 'Gold',
    lp: 740,
    earningsUsd: 980.00,
    wins: 48,
    gamesPlayed: 95,
    winRate: 50.5,
    winStreak: 1,
    favoriteMap: 'Worldwide Grand Tour',
    title: 'Hotel Mogul'
  }
];

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
    rewards: '5,000 Coins / wk + Golden Crown Avatar Frame + 0% Cashout Fee',
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
    rewards: '2,500 Coins / wk + Cosmic Frame + Custom Table Themes',
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
    rewards: '1,200 Coins / wk + Diamond Badge + 10% Store Discount',
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
    rewards: '600 Coins / wk + Platinum Nameplate',
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
    rewards: '300 Coins / wk + Gold Rank Shield',
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
    rewards: '150 Coins / wk',
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
    rewards: '50 Coins / wk',
    perks: 'Beginner Match Protection'
  }
];

export const RankingsLeaguesView: React.FC<{ onNavigateHome: () => void }> = ({ onNavigateHome }) => {
  const { user } = useUser();
  const { isLight } = useTheme();

  const [activeTab, setActiveTab] = useState<'leaderboard' | 'leagues' | 'tournament'>('leaderboard');
  const [timeframe, setTimeframe] = useState<'season' | 'weekly' | 'all_time'>('season');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<LeaderboardPlayer | null>(null);

  // Dynamic tournament countdown
  const [countdown, setCountdown] = useState({ days: 3, hours: 14, mins: 22, secs: 45 });

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

  const currentUserPlayerObj: LeaderboardPlayer = useMemo(() => ({
    rank: 0,
    id: user.id || 'usr_current',
    name: user.username || 'You',
    avatar: user.avatar || 'orange',
    frame: user.avatarFrame,
    tier: user.leagueTier || 'Bronze',
    lp: user.leaguePoints || 0,
    earningsUsd: user.stats.totalEarningsUsd || 0,
    wins: user.stats.gamesWon || 0,
    gamesPlayed: user.stats.gamesPlayed || 0,
    winRate: userWinRate,
    winStreak: user.stats.winStreak || 0,
    favoriteMap: user.mapSkin === 'cyber' ? 'Cyber Neon' : user.mapSkin === 'worldwide' ? 'Worldwide' : 'Classic RichUp Grid',
    title: user.leaguePoints >= 2300 ? 'Tycoon Overlord' : user.leaguePoints >= 1800 ? 'Grandmaster' : user.leaguePoints >= 1000 ? 'High Roller' : 'Challenger',
    isCurrentUser: true
  }), [user, userWinRate]);

  // Merge current user with global champion seeds & sort dynamically
  const fullLeaderboard: LeaderboardPlayer[] = useMemo(() => {
    const list: Omit<LeaderboardPlayer, 'rank'>[] = [...GLOBAL_CHAMPIONS_SEED];
    
    // Replace duplicate if username matches Sahitya
    const existingIndex = list.findIndex(p => p.name.toLowerCase() === user.username.toLowerCase());
    if (existingIndex >= 0) {
      list[existingIndex] = {
        ...list[existingIndex],
        lp: Math.max(list[existingIndex].lp, user.leaguePoints),
        earningsUsd: Math.max(list[existingIndex].earningsUsd, user.stats.totalEarningsUsd),
        wins: Math.max(list[existingIndex].wins, user.stats.gamesWon),
        winStreak: Math.max(list[existingIndex].winStreak, user.stats.winStreak),
        isCurrentUser: true
      };
    } else {
      list.push(currentUserPlayerObj);
    }

    // Sort by timeframe
    if (timeframe === 'weekly') {
      list.sort((a, b) => (b.wins * 25 + b.winStreak * 10) - (a.wins * 25 + a.winStreak * 10));
    } else if (timeframe === 'all_time') {
      list.sort((a, b) => b.earningsUsd - a.earningsUsd);
    } else {
      // Season 4 standard LP
      list.sort((a, b) => b.lp - a.lp);
    }

    return list.map((p, idx) => ({
      ...p,
      rank: idx + 1
    }));
  }, [currentUserPlayerObj, timeframe, user]);

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
      {/* Top Banner Header (Standard Non-Sticky Layout to prevent any visual overlap) */}
      <div className={`w-full border-b transition-colors ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#140e26] border-[#281e47]'
      }`}>
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                sounds.playClick();
                onNavigateHome();
              }}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800' : 'bg-[#20173d] hover:bg-[#2b2052] border-[#362763] text-white'
              }`}
              title="Return to Lobby"
            >
              ← Back to Lobby
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏆</span>
                <h1 className="text-xl sm:text-2xl font-heading font-black tracking-tight">
                  Global Rankings & League Championship
                </h1>
              </div>
              <p className="text-xs text-slate-400">
                Official competitive ladder, ranked tiers, prize pool leaders and weekly tournaments
              </p>
            </div>
          </div>

          {/* Tab Selection Switcher */}
          <div className={`p-1 rounded-2xl border flex items-center gap-1 shrink-0 ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#1b1333] border-[#312354]'
          }`}>
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('leaderboard');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
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
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
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
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
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
        {/* User Real Standing Hero Banner */}
        <div className={`p-5 sm:p-6 rounded-2xl border shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 ${
          isLight
            ? 'bg-gradient-to-r from-purple-50 via-white to-indigo-50 border-purple-200'
            : 'bg-gradient-to-r from-[#1c1338] via-[#140e26] to-[#120c22] border-[#312354]'
        }`}>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <AvatarCharacter
              avatarId={user.avatar || 'orange'}
              frameId={user.avatarFrame}
              size="md"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-heading font-black tracking-tight">
                  {user.username}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#7059e2]/20 text-[#a394f7] border border-[#7059e2]/40">
                  {user.leagueTier} League
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-mono-code font-bold">
                  Rank #{currentUserRank}
                </span>
              </div>
              <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3 mt-1 font-mono-code">
                <span className="text-purple-400 font-bold">⚡ {user.leaguePoints.toLocaleString()} LP</span>
                <span>•</span>
                <span className="text-emerald-400 font-bold">🏆 {user.stats.gamesWon} Wins</span>
                <span>•</span>
                <span className="text-amber-400 font-bold">🎯 {userWinRate}% Win Rate</span>
                <span>•</span>
                <span className="text-emerald-400 font-bold">💵 ${user.stats.totalEarningsUsd.toFixed(2)} Won</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            {nextTierInfo && (
              <div className="hidden sm:block min-w-40 text-right">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                  Next Tier: {nextTierInfo.tier}
                </div>
                <div className="w-full bg-slate-700/30 rounded-full h-2 mt-1.5 overflow-hidden border border-slate-700/50">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${lpProgress}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-400 font-mono-code mt-1">
                  {Math.max(0, nextTierInfo.minLp - user.leaguePoints)} LP to promote
                </div>
              </div>
            )}
            <div className={`h-8 w-px hidden sm:block ${isLight ? 'bg-slate-200' : 'bg-[#312354]'}`} />
            <div className="text-right">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">
                Weekly Cup Reset
              </div>
              <div className="text-sm sm:text-base font-mono-code font-black text-amber-400">
                {countdown.days}d {countdown.hours}h {countdown.mins}m {countdown.secs}s
              </div>
            </div>
            <div className={`h-8 w-px ${isLight ? 'bg-slate-200' : 'bg-[#312354]'}`} />
            <div className="text-right">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">
                Tier Payout
              </div>
              <div className="text-sm sm:text-base font-mono-code font-black text-emerald-400">
                +{currentTierInfo.rewards.split(' ')[0]} 🪙
              </div>
            </div>
          </div>
        </div>

        {/* TAB 1: LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Search player, league or title..."
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

              <div className={`p-1 rounded-xl border flex items-center gap-1 ${
                isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#160f2a] border-[#291e47]'
              }`}>
                <button
                  onClick={() => setTimeframe('season')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    timeframe === 'season'
                      ? 'bg-[#7059e2] text-white shadow-sm'
                      : isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  Season 4 (LP)
                </button>
                <button
                  onClick={() => setTimeframe('weekly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    timeframe === 'weekly'
                      ? 'bg-[#7059e2] text-white shadow-sm'
                      : isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  This Week
                </button>
                <button
                  onClick={() => setTimeframe('all_time')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    timeframe === 'all_time'
                      ? 'bg-[#7059e2] text-white shadow-sm'
                      : isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  All-Time Winnings
                </button>
              </div>
            </div>

            {/* Leaderboard Table */}
            <div className={`rounded-2xl border overflow-hidden shadow-xl ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#140e26] border-[#281e47]'
            }`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b text-[11px] font-mono-code uppercase tracking-wider ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#181130] border-[#281e47] text-slate-400'
                    }`}>
                      <th className="py-3 px-4 w-16 text-center">Rank</th>
                      <th className="py-3 px-4">Tycoon Player</th>
                      <th className="py-3 px-4 text-center">League Tier</th>
                      <th className="py-3 px-4 text-right">League Points</th>
                      <th className="py-3 px-4 text-right">Wager Earnings</th>
                      <th className="py-3 px-4 text-center">Win Rate</th>
                      <th className="py-3 px-4 text-center">Streak</th>
                      <th className="py-3 px-4 text-center">Action</th>
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
                                <div className="text-[10px] text-slate-400">
                                  {p.title}
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
                  </tbody>
                </table>
              </div>
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
                  50,000 🪙 + $2,500
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
            </div>

            <div className={`p-3 rounded-xl text-xs flex items-center justify-between ${
              isLight ? 'bg-slate-50 text-slate-700' : 'bg-[#1f163d] text-slate-300'
            }`}>
              <span>Favorite Arena:</span>
              <span className="font-bold text-purple-400">{selectedPlayer.favoriteMap}</span>
            </div>

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
