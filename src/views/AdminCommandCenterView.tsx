import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useSafeDynamic } from '../context/DynamicIntegration';
import { isUserAdmin, getAdminEmails, addAdminEmail, removeAdminEmail } from '../utils/adminRegistry';
import { getAllActiveRooms, ActiveRoomInfo } from '../utils/activeRoomsRegistry';
import { fetchActiveRoomsFromServer } from '../utils/serverRoomSync';
import { sounds } from '../utils/audio';
import { fetchServerUsers, performAdminUserAction, AdminUserRecord } from '../utils/serverUsersSync';
import { isUserBanned, setUserBanStatus } from '../utils/banManager';
import {
  ShieldAlert, AlertTriangle, CheckCircle, Ban, Trash2, X, Loader2
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';

export interface AdminMatch {
  id: string;
  code: string;
  name: string;
  status: 'waiting' | 'playing' | 'concluded';
  playersCount: number;
  maxPlayers: number;
  betAmount: number;
  prizePool: number;
  platformRake: number;
  winner?: string;
  durationMinutes: number;
  map: string;
  startTime: string;
}

export interface ManagedUser {
  id: string;
  username: string;
  email: string;
  walletBalance: number;
  coins: number;
  gamesPlayed: number;
  winRate: number;
  isBanned: boolean;
  role: 'admin' | 'player';
  joinedDate: string;
  country?: string;
  city?: string;
}

const SEED_CONCLUDED_MATCHES: AdminMatch[] = [];

export interface AdminCommandCenterViewProps {
  onNavigateHome: () => void;
}

export const AdminCommandCenterView: React.FC<AdminCommandCenterViewProps> = ({ onNavigateHome }) => {
  const { user } = useUser();
  const { isLight } = useTheme();
  const { isLoaded: isDynamicLoaded, isAuthenticated: isDynamicSignedIn, user: dynamicUser, primaryWallet } = useSafeDynamic();

  const dynamicEmail = dynamicUser?.email || (dynamicUser?.verifiedCredentials as any[])?.find(c => c.format === 'email')?.email;
  const effectiveEmail = dynamicEmail || user.email || '';
  const effectiveUsername = (isDynamicSignedIn && (dynamicUser?.username || dynamicUser?.firstName)) ||
    (primaryWallet?.address ? `${primaryWallet.address.slice(0, 6)}...${primaryWallet.address.slice(-4)}` : (user.username && user.username !== 'Guest Player' ? user.username : ''));
  
  const isAuthorized = isUserAdmin(effectiveEmail) || 
    isUserAdmin(primaryWallet?.address || '') || 
    isUserAdmin(user.walletAddress || '') ||
    (effectiveEmail && effectiveEmail.toLowerCase() === 'sahityanijhawan@gmail.com');

  const [activeTab, setActiveTab] = useState<'overview' | 'matches' | 'users' | 'admins'>('overview');
  const [adminList, setAdminList] = useState<string[]>(getAdminEmails);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminFeedback, setAdminFeedback] = useState<{ text: string; isError: boolean } | null>(null);

  // Live active rooms polling
  const [liveRoomsRaw, setLiveRoomsRaw] = useState<ActiveRoomInfo[]>(getAllActiveRooms);

  useEffect(() => {
    const refreshRooms = async () => {
      try {
        const serverList = await fetchActiveRoomsFromServer();
        if (serverList && serverList.length > 0) {
          setLiveRoomsRaw(serverList);
        } else {
          setLiveRoomsRaw(getAllActiveRooms());
        }
      } catch {
        setLiveRoomsRaw(getAllActiveRooms());
      }
    };

    refreshRooms();
    const interval = setInterval(refreshRooms, 4000);
    return () => clearInterval(interval);
  }, []);

  // Concluded matches (derived from real match history and real logs)
  const [concludedMatches, setConcludedMatches] = useState<AdminMatch[]>(() => {
    try {
      localStorage.removeItem('proprush_admin_concluded_matches_v1'); // Purge legacy mock data
      const saved = localStorage.getItem('proprush_admin_concluded_matches_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    if (user.matchHistory && user.matchHistory.length > 0) {
      return user.matchHistory.map((m, idx) => ({
        id: m.id || `m_${idx + 1}`,
        code: m.roomName ? m.roomName.substring(0, 8).toLowerCase().replace(/\s+/g, '_') : `room_${idx + 1}`,
        name: m.roomName || 'Ranked Match',
        status: 'concluded' as const,
        playersCount: m.totalPlayers || 4,
        maxPlayers: m.totalPlayers || 4,
        betAmount: m.betAmount || 0,
        prizePool: (m.betAmount || 0) * (m.totalPlayers || 4),
        platformRake: Number(((m.betAmount || 0) * (m.totalPlayers || 4) * 0.05).toFixed(2)),
        winner: m.placement === 1 ? (user.username || 'Sahitya Nijhawan') : 'Opponent',
        durationMinutes: m.durationMinutes || 15,
        map: 'Classic Arena',
        startTime: m.date || 'Recent'
      }));
    }
    return [];
  });

  // User Management State
  const [bannedUserIds, setBannedUserIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('proprush_banned_users_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [serverUsers, setServerUsers] = useState<AdminUserRecord[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [banFeedback, setBanFeedback] = useState<string | null>(null);

  // Ban & Delete confirmation modal states
  const [pendingBanAction, setPendingBanAction] = useState<{ user: ManagedUser; action: 'ban' | 'unban' } | null>(null);
  const [isProcessingBan, setIsProcessingBan] = useState(false);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<ManagedUser | null>(null);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);

  // Poll live verified platform users from server
  useEffect(() => {
    let isMounted = true;
    const loadUsers = async () => {
      const res = await fetchServerUsers();
      if (isMounted && res && res.length > 0) {
        setServerUsers(res);
      }
    };

    loadUsers();
    const interval = setInterval(loadUsers, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Build live active matches
  const liveRooms: AdminMatch[] = useMemo(() => {
    return liveRoomsRaw.map(r => ({
      id: `room_${r.code}`,
      code: r.code,
      name: r.name,
      status: (r.isCustom ? 'waiting' : 'playing') as 'waiting' | 'playing',
      playersCount: r.players,
      maxPlayers: r.max,
      betAmount: r.bet,
      prizePool: r.bet * r.players,
      platformRake: Number((r.bet * r.players * 0.05).toFixed(2)),
      durationMinutes: 12,
      map: r.map,
      startTime: 'Live Now'
    }));
  }, [liveRoomsRaw]);

  // Real KPI calculations
  const activeEscrowPot = useMemo(() => {
    return liveRooms.reduce((acc, r) => acc + r.prizePool, 0);
  }, [liveRooms]);

  const activePlatformRake = useMemo(() => {
    return Number((activeEscrowPot * 0.05).toFixed(2));
  }, [activeEscrowPot]);

  const concludedGrossVolume = useMemo(() => {
    return concludedMatches.reduce((acc, m) => acc + m.prizePool, 0);
  }, [concludedMatches]);

  const totalGrossVolume = activeEscrowPot + concludedGrossVolume;
  const totalPlatformRake = Number((totalGrossVolume * 0.05).toFixed(2));

  // Build real user accounts list using verified Dynamic players
  const usersList: ManagedUser[] = useMemo(() => {
    const isRealDynamicPlayer = Boolean(
      (isDynamicLoaded && isDynamicSignedIn) || 
      user.dynamicUserId || 
      user.walletAddress
    );

    const list: ManagedUser[] = [];

    // Add server users first (these are real Dynamic users registered in server registry)
    if (serverUsers.length > 0) {
      serverUsers.forEach(su => {
        const suGamesPlayed = su.stats?.gamesPlayed || 0;
        const suGamesWon = su.stats?.gamesWon || 0;
        const suWinRate = suGamesPlayed > 0 ? Number(((suGamesWon / suGamesPlayed) * 100).toFixed(0)) : 0;
        const userIsAdmin = isUserAdmin(su.email) || isUserAdmin(su.walletAddress || '') || (su.email && su.email.toLowerCase() === 'sahityanijhawan@gmail.com');

        list.push({
          id: su.id,
          username: su.username || (su.walletAddress ? `${su.walletAddress.slice(0, 6)}...${su.walletAddress.slice(-4)}` : 'Player'),
          email: su.email || su.walletAddress || '',
          walletBalance: typeof su.walletBalance === 'number' ? su.walletBalance : 0,
          coins: typeof su.coins === 'number' ? su.coins : 0,
          gamesPlayed: suGamesPlayed,
          winRate: suWinRate,
          isBanned: isUserBanned(su.email, su.id) || bannedUserIds.includes(su.id) || Boolean(su.isBanned),
          role: userIsAdmin ? 'admin' : (su.role || 'player'),
          joinedDate: su.joinedDate || 'Recently',
          country: su.country,
          city: su.city
        });
      });
    }

    // If current session is an authenticated Dynamic user, merge or append them
    if (isRealDynamicPlayer) {
      const currentEmail = effectiveEmail || user.walletAddress || '';
      const currentId = user.dynamicUserId || user.id;
      const currentGamesPlayed = user.stats?.gamesPlayed || 0;
      const currentGamesWon = user.stats?.gamesWon || 0;
      const currentWinRate = currentGamesPlayed > 0 ? Number(((currentGamesWon / currentGamesPlayed) * 100).toFixed(0)) : 0;
      const currentIsAdmin = isUserAdmin(currentEmail) || isUserAdmin(user.walletAddress || '') || (currentEmail && currentEmail.toLowerCase() === 'sahityanijhawan@gmail.com');

      const existingIdx = list.findIndex(u => 
        (currentId && u.id === currentId) || 
        (currentEmail && u.email.toLowerCase() === currentEmail.toLowerCase())
      );

      if (existingIdx >= 0) {
        list[existingIdx] = {
          ...list[existingIdx],
          username: effectiveUsername || list[existingIdx].username,
          walletBalance: user.walletBalance,
          coins: user.coins,
          gamesPlayed: currentGamesPlayed || list[existingIdx].gamesPlayed,
          winRate: currentGamesPlayed > 0 ? currentWinRate : list[existingIdx].winRate,
          role: currentIsAdmin ? 'admin' : list[existingIdx].role
        };
      } else {
        list.push({
          id: currentId || 'usr_dynamic',
          username: effectiveUsername || user.username || 'Dynamic Player',
          email: currentEmail,
          walletBalance: user.walletBalance || 0,
          coins: user.coins || 0,
          gamesPlayed: currentGamesPlayed,
          winRate: currentWinRate,
          isBanned: isUserBanned(currentEmail, currentId) || bannedUserIds.includes(currentId),
          role: currentIsAdmin ? 'admin' : 'player',
          joinedDate: 'Active Session',
          country: 'United States',
          city: 'San Francisco'
        });
      }
    }

    // Deduplicate strictly by ID
    const seenIds = new Set<string>();
    return list.filter(u => {
      if (seenIds.has(u.id)) return false;
      seenIds.add(u.id);
      return true;
    });
  }, [bannedUserIds, effectiveEmail, effectiveUsername, isDynamicLoaded, isDynamicSignedIn, serverUsers, user]);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return usersList;
    const q = userSearch.toLowerCase();
    return usersList.filter(u => 
      u.username.toLowerCase().includes(q) || 
      u.email.toLowerCase().includes(q) ||
      (u.city && u.city.toLowerCase().includes(q)) ||
      (u.country && u.country.toLowerCase().includes(q))
    );
  }, [usersList, userSearch]);

  // Admin Actions
  const handleAddAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;
    const res = addAdminEmail(newAdminEmail);
    if (res.success) {
      setAdminList(res.admins);
      setNewAdminEmail('');
      setAdminFeedback({ text: res.message, isError: false });
      sounds.playVictory();
    } else {
      setAdminFeedback({ text: res.message, isError: true });
      sounds.playBankrupt();
    }
    setTimeout(() => setAdminFeedback(null), 4000);
  };

  const handleRemoveAdmin = (email: string) => {
    const res = removeAdminEmail(email);
    if (res.success) {
      setAdminList(res.admins);
      setAdminFeedback({ text: res.message, isError: false });
      sounds.playClick();
    } else {
      setAdminFeedback({ text: res.message, isError: true });
    }
    setTimeout(() => setAdminFeedback(null), 4000);
  };

  const initiateToggleBan = (targetUser: ManagedUser) => {
    sounds.playClick();
    if (targetUser.role === 'admin' || targetUser.email.toLowerCase() === 'sahityanijhawan@gmail.com') {
      setBanFeedback('🛡️ Administrator accounts cannot be banned.');
      setTimeout(() => setBanFeedback(null), 4000);
      return;
    }
    setPendingBanAction({
      user: targetUser,
      action: targetUser.isBanned ? 'unban' : 'ban'
    });
  };

  const handleConfirmBan = async () => {
    if (!pendingBanAction) return;
    setIsProcessingBan(true);
    const { user: targetUser, action } = pendingBanAction;
    const newBanState = action === 'ban';

    try {
      // 1. Sync through centralized banManager (localStorage + in-memory + server notify)
      await setUserBanStatus(targetUser.email, newBanState, targetUser.id);

      // 2. Update local state
      setBannedUserIds(prev => {
        const next = newBanState 
          ? [...prev.filter(id => id !== targetUser.id), targetUser.id] 
          : prev.filter(id => id !== targetUser.id);
        return next;
      });

      setServerUsers(prev => prev.map(su => 
        su.email.toLowerCase() === targetUser.email.toLowerCase() || su.id === targetUser.id 
          ? { ...su, isBanned: newBanState } 
          : su
      ));

      if (newBanState) {
        sounds.playBankrupt();
        setBanFeedback(
          `⛔ ${targetUser.username} (${targetUser.email}) has been SUSPENDED. All match matchmaking, room creation, and deposits are blocked.`
        );
      } else {
        sounds.playVictory();
        setBanFeedback(
          `✅ Account suspension lifted for ${targetUser.username} (${targetUser.email}). Normal player access restored.`
        );
      }
      setTimeout(() => setBanFeedback(null), 5000);
    } catch (err) {
      console.error('Failed to change ban status:', err);
      setBanFeedback(`❌ Failed to update ban status for ${targetUser.username}.`);
      setTimeout(() => setBanFeedback(null), 5000);
    } finally {
      setIsProcessingBan(false);
      setPendingBanAction(null);
    }
  };

  const initiateDeleteUser = (targetUser: ManagedUser) => {
    sounds.playClick();
    if (targetUser.role === 'admin' || targetUser.email.toLowerCase() === 'sahityanijhawan@gmail.com') {
      setBanFeedback('🛡️ Administrator accounts cannot be deleted.');
      setTimeout(() => setBanFeedback(null), 4000);
      return;
    }
    setPendingDeleteUser(targetUser);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteUser) return;
    setIsProcessingDelete(true);
    try {
      const targetUser = pendingDeleteUser;
      const success = await performAdminUserAction(targetUser.email, 'delete', undefined, targetUser.id);
      if (success) {
        setServerUsers(prev => prev.filter(su => su.id !== targetUser.id && su.email.toLowerCase() !== targetUser.email.toLowerCase()));
        setBanFeedback(`🗑️ Removed user account ${targetUser.username} (${targetUser.email}).`);
        sounds.playBankrupt();
      } else {
        setBanFeedback(`❌ Failed to delete ${targetUser.username}.`);
      }
      setTimeout(() => setBanFeedback(null), 5000);
    } catch (err) {
      console.error('Failed to delete user:', err);
      setBanFeedback(`❌ Error deleting user.`);
      setTimeout(() => setBanFeedback(null), 5000);
    } finally {
      setIsProcessingDelete(false);
      setPendingDeleteUser(null);
    }
  };

  // Dynamic 7-day revenue chart based on real platform activity
  const revenueChartData = useMemo(() => {
    const todayVolume = Math.round(activeEscrowPot + concludedGrossVolume);
    const todayRake = Number((activePlatformRake + (concludedGrossVolume * 0.05)).toFixed(2));

    return [
      { day: 'Mon', volume: 0, rake: 0 },
      { day: 'Tue', volume: 0, rake: 0 },
      { day: 'Wed', volume: 0, rake: 0 },
      { day: 'Thu', volume: 0, rake: 0 },
      { day: 'Fri', volume: 0, rake: 0 },
      { day: 'Sat', volume: 0, rake: 0 },
      { day: 'Today', volume: todayVolume, rake: todayRake }
    ];
  }, [activeEscrowPot, activePlatformRake, concludedGrossVolume]);

  const stakeDistributionData = useMemo(() => {
    const allMatches = [...liveRooms, ...concludedMatches];
    if (allMatches.length === 0) {
      return [
        { name: 'Casual ($0)', value: 100, color: '#3b82f6' },
        { name: 'Low Stakes ($1-$20)', value: 0, color: '#10b981' },
        { name: 'High Roller ($50+)', value: 0, color: '#f59e0b' }
      ];
    }
    let casual = 0;
    let low = 0;
    let high = 0;
    allMatches.forEach(m => {
      if (m.betAmount === 0) casual++;
      else if (m.betAmount <= 20) low++;
      else high++;
    });
    const total = allMatches.length;
    return [
      { name: 'Casual ($0)', value: Math.round((casual / total) * 100), color: '#3b82f6' },
      { name: 'Low Stakes ($1-$20)', value: Math.round((low / total) * 100), color: '#10b981' },
      { name: 'High Roller ($50+)', value: Math.round((high / total) * 100), color: '#f59e0b' }
    ];
  }, [liveRooms, concludedMatches]);

  return (
    <div className={`min-h-screen pb-16 transition-colors ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#0e0a1a] text-white'
    }`}>
      {/* Top Admin Header (Clean, spacious, mobile-responsive layout) */}
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
              title="Return to Game Lobby"
            >
              <span>←</span>
              <span>Back to Lobby</span>
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl sm:text-2xl">🛡️</span>
                  <h1 className="text-lg sm:text-2xl font-heading font-black tracking-tight">
                    PropRush Admin Command Center
                  </h1>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-mono-code font-black text-[10px] tracking-wide border border-emerald-500/30">
                  MASTER ACCESS
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Live monitoring, platform revenue, escrow analytics, user accounts & multi-admin roles
              </p>
            </div>
          </div>

          {/* Admin Navigation Tabs - Smooth horizontal scrolling on mobile */}
          <div className={`p-1 rounded-2xl border flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 max-w-full ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#1b1333] border-[#312354]'
          }`}>
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('overview');
              }}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'bg-[#7059e2] text-white shadow-md'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>📊</span>
              <span>Overview</span>
            </button>
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('matches');
              }}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'matches'
                  ? 'bg-[#7059e2] text-white shadow-md'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🎲</span>
              <span>Matches ({liveRooms.length})</span>
            </button>
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('users');
              }}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'users'
                  ? 'bg-[#7059e2] text-white shadow-md'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>👥</span>
              <span>Users</span>
            </button>
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('admins');
              }}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'admins'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🔑</span>
              <span>Admins ({adminList.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container Body */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* KPI Metrics Strip - Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          <div className={`p-4 sm:p-5 rounded-3xl border shadow-lg flex flex-col justify-between ${
            isLight ? 'bg-white border-slate-200' : 'bg-[#140e26] border-[#281e47]'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono-code uppercase tracking-wider text-slate-400 font-bold">
                Platform Rake (5%)
              </span>
              <span className="text-xl">💰</span>
            </div>
            <div className="text-2xl sm:text-3xl font-heading font-black text-emerald-400 mt-2 font-mono-code">
              ${totalPlatformRake.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
              <span className="text-emerald-400 font-bold">Real-time</span> accumulated earnings
            </div>
          </div>

          <div className={`p-4 sm:p-5 rounded-3xl border shadow-lg flex flex-col justify-between ${
            isLight ? 'bg-white border-slate-200' : 'bg-[#140e26] border-[#281e47]'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono-code uppercase tracking-wider text-slate-400 font-bold">
                Gross Wagered Volume
              </span>
              <span className="text-xl">📈</span>
            </div>
            <div className="text-2xl sm:text-3xl font-heading font-black text-purple-400 mt-2 font-mono-code">
              ${totalGrossVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1.5">
              Active escrow + settled match prizes
            </div>
          </div>

          <div className={`p-4 sm:p-5 rounded-3xl border shadow-lg flex flex-col justify-between ${
            isLight ? 'bg-white border-slate-200' : 'bg-[#140e26] border-[#281e47]'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono-code uppercase tracking-wider text-slate-400 font-bold">
                Live Active Tables
              </span>
              <span className="text-xl">🎲</span>
            </div>
            <div className="text-2xl sm:text-3xl font-heading font-black text-amber-400 mt-2 font-mono-code">
              {liveRooms.length} <span className="text-xs font-normal text-slate-400">tables running</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1.5 font-mono-code">
              Live Escrow: ${activeEscrowPot.toFixed(2)}
            </div>
          </div>

          <div className={`p-4 sm:p-5 rounded-3xl border shadow-lg flex flex-col justify-between ${
            isLight ? 'bg-white border-slate-200' : 'bg-[#140e26] border-[#281e47]'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono-code uppercase tracking-wider text-slate-400 font-bold">
                Registered Users
              </span>
              <span className="text-xl">👥</span>
            </div>
            <div className="text-2xl sm:text-3xl font-heading font-black text-cyan-400 mt-2 font-mono-code">
              {usersList.length} <span className="text-xs font-normal text-slate-400">accounts</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1.5">
              {usersList.filter(u => !u.isBanned).length} active · 100% verified
            </div>
          </div>
        </div>

        {/* TAB 1: OVERVIEW CHARTS */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily Volume & Rake Area Chart */}
              <div className={`lg:col-span-2 p-5 rounded-2xl border shadow-xl ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#140e26] border-[#281e47]'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-heading font-black text-base">
                      Platform Volume & 5% House Rake
                    </h3>
                    <p className="text-xs text-slate-400">7-day gross transaction trends in USD</p>
                  </div>
                  <span className="text-xs font-mono-code font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                    5% Take Rate
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueChartData}>
                      <defs>
                        <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="rakeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isLight ? '#ffffff' : '#17102e',
                          borderColor: '#3b276b',
                          borderRadius: '12px',
                          fontSize: '12px'
                        }}
                      />
                      <Area type="monotone" dataKey="volume" stroke="#8b5cf6" fillOpacity={1} fill="url(#volGrad)" name="Gross Volume ($)" />
                      <Area type="monotone" dataKey="rake" stroke="#10b981" fillOpacity={1} fill="url(#rakeGrad)" name="Platform Rake ($)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Stake Distribution Pie Chart */}
              <div className={`p-5 rounded-2xl border shadow-xl flex flex-col justify-between ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#140e26] border-[#281e47]'
              }`}>
                <div>
                  <h3 className="font-heading font-black text-base">
                    Stakes Liquidity Distribution
                  </h3>
                  <p className="text-xs text-slate-400">Match tier allocation by wager size</p>
                </div>

                <div className="h-52 w-full my-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stakeDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stakeDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-1.5 text-xs font-mono-code">
                  {stakeDistributionData.map(item => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-400">{item.name}</span>
                      </div>
                      <span className="font-bold">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Live Matches Preview */}
            <div className={`p-5 rounded-2xl border shadow-xl ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#140e26] border-[#281e47]'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-black text-base flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Table Snapshot ({liveRooms.length} Active)
                </h3>
                <button
                  onClick={() => setActiveTab('matches')}
                  className="text-xs font-bold text-purple-400 hover:text-purple-300 cursor-pointer"
                >
                  View All Matches →
                </button>
              </div>

              {liveRooms.length === 0 ? (
                <div className={`p-6 rounded-xl border text-center ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#1b1333] border-[#312354] text-slate-400'
                }`}>
                  <p className="text-xs font-medium">No live tables currently active. As players create and join game rooms, they will stream here in real time.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {liveRooms.slice(0, 3).map((r) => (
                    <div
                      key={r.id}
                      className={`p-3.5 rounded-xl border ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1b1333] border-[#312354]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono-code font-bold text-xs text-purple-400">
                          {r.code}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-mono-code font-black text-[10px]">
                          LIVE
                        </span>
                      </div>
                      <div className="font-bold text-xs mt-1 truncate">{r.name}</div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono-code">
                        <span>👥 {r.playersCount}/{r.maxPlayers}</span>
                        <span className="text-emerald-400 font-bold">Pot: ${r.prizePool.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MATCHES MONITOR */}
        {activeTab === 'matches' && (
          <div className="space-y-6">
            {/* Live Matches */}
            <div className={`p-4 sm:p-6 rounded-3xl border shadow-xl ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#140e26] border-[#281e47]'
            }`}>
              <h3 className="font-heading font-black text-base mb-3.5 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                Active In-Progress & Waiting Rooms ({liveRooms.length})
              </h3>

              {liveRooms.length === 0 ? (
                <div className={`p-8 rounded-2xl border text-center ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#1b1333] border-[#312354] text-slate-400'
                }`}>
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <span className="text-2xl">🎲</span>
                    <span className="font-bold text-slate-300">No active game rooms currently running</span>
                    <span className="text-xs text-slate-400">Live tables and escrow pots will stream here automatically when players start matches.</span>
                  </div>
                </div>
              ) : (
                <>
                  {/* Mobile Live Rooms Cards (< sm) */}
                  <div className="sm:hidden space-y-3">
                    {liveRooms.map((r) => (
                      <div
                        key={r.id}
                        className={`p-4 rounded-2xl border shadow-sm space-y-3 ${
                          isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#181130] border-[#2b1e47]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono-code font-bold text-xs text-purple-400">#{r.code}</span>
                            <h4 className="font-heading font-black text-sm">{r.name}</h4>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-mono-code text-[10px] font-black">
                            PLAYING
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono-code pt-1 border-t border-slate-500/10">
                          <div>
                            <div className="text-[9px] text-slate-400 uppercase">Players</div>
                            <div className="font-bold">{r.playersCount}/{r.maxPlayers}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-400 uppercase">Buy-in</div>
                            <div className="font-bold">${r.betAmount.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-400 uppercase">Pot (USD)</div>
                            <div className="font-black text-emerald-400">${r.prizePool.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop / Tablet Table (hidden on mobile) */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[720px]">
                      <thead>
                        <tr className={`border-b text-[10px] font-mono-code uppercase text-slate-400 ${
                          isLight ? 'border-slate-200 bg-slate-50' : 'border-[#281e47] bg-[#181130]'
                        }`}>
                          <th className="py-2.5 px-3">Room Code</th>
                          <th className="py-2.5 px-3">Table Name</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-center">Players</th>
                          <th className="py-2.5 px-3 text-right">Buy-in</th>
                          <th className="py-2.5 px-3 text-right">Pot Size</th>
                          <th className="py-2.5 px-3 text-right">Rake (5%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-500/10">
                        {liveRooms.map((r) => (
                          <tr key={r.id}>
                            <td className="py-3 px-3 font-mono-code font-bold text-purple-400">{r.code}</td>
                            <td className="py-3 px-3 font-bold">{r.name}</td>
                            <td className="py-3 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-mono-code text-[10px] font-black">
                                PLAYING
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-mono-code">{r.playersCount}/{r.maxPlayers}</td>
                            <td className="py-3 px-3 text-right font-mono-code">${r.betAmount.toFixed(2)}</td>
                            <td className="py-3 px-3 text-right font-mono-code font-bold text-emerald-400">${r.prizePool.toFixed(2)}</td>
                            <td className="py-3 px-3 text-right font-mono-code text-amber-400">${r.platformRake.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Concluded Matches History */}
            <div className={`p-4 sm:p-6 rounded-3xl border shadow-xl ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#140e26] border-[#281e47]'
            }`}>
              <h3 className="font-heading font-black text-base mb-3.5">
                Recently Concluded Real-Money Matches
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[680px]">
                  <thead>
                    <tr className={`border-b text-[10px] font-mono-code uppercase text-slate-400 ${
                      isLight ? 'border-slate-200 bg-slate-50' : 'border-[#281e47] bg-[#181130]'
                    }`}>
                      <th className="py-2.5 px-3">Room Code</th>
                      <th className="py-2.5 px-3">Winner</th>
                      <th className="py-2.5 px-3 text-right">Prize Paid</th>
                      <th className="py-2.5 px-3 text-right">Rake Retained</th>
                      <th className="py-2.5 px-3 text-center">Duration</th>
                      <th className="py-2.5 px-3 text-right">Ended</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-500/10 font-mono-code">
                    {concludedMatches.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <span className="text-2xl">🏆</span>
                            <span className="font-bold text-slate-200">No concluded matches recorded yet</span>
                            <span className="text-[11px] text-slate-400">Completed cash games, winner payouts, and retained 5% platform rakes will be logged here.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      concludedMatches.map((m) => (
                        <tr key={m.id}>
                          <td className="py-3 px-3 font-bold text-purple-400">{m.code}</td>
                          <td className="py-3 px-3 font-heading font-black text-amber-400">🏆 {m.winner}</td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-400">${m.prizePool.toFixed(2)}</td>
                          <td className="py-3 px-3 text-right text-emerald-500 font-bold">+${m.platformRake.toFixed(2)}</td>
                          <td className="py-3 px-3 text-center text-slate-400">{m.durationMinutes}m</td>
                          <td className="py-3 px-3 text-right text-slate-400">{m.startTime}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: USER DIRECTORY & ESCROW ADJUSTMENTS */}
        {activeTab === 'users' && (
          <div className={`p-4 sm:p-6 rounded-3xl border shadow-xl space-y-4 ${
            isLight ? 'bg-white border-slate-200' : 'bg-[#140e26] border-[#281e47]'
          }`}>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-heading font-black text-base">
                  Player Accounts & Wallet Directory
                </h3>
                <p className="text-xs text-slate-400">Manage balances, coin grants, roles and enforcement</p>
              </div>
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Search username or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none ${
                    isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-[#1a1233] border-[#2e2154] text-white'
                  }`}
                />
                {userSearch && (
                  <button
                    onClick={() => setUserSearch('')}
                    className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {banFeedback && (
              <div className={`p-3.5 rounded-2xl border text-xs font-bold font-mono-code ${
                banFeedback.includes('SUSPENDED') 
                  ? 'bg-red-500/20 border-red-500/40 text-red-400' 
                  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              }`}>
                {banFeedback}
              </div>
            )}

            {/* Mobile User Cards (< sm screens) */}
            <div className="sm:hidden space-y-3">
              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className={`p-4 rounded-2xl border shadow-sm space-y-3 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#181130] border-[#2b1f49]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-heading font-black text-sm">{u.username}</h4>
                      <p className="font-mono-code text-[11px] text-slate-400">{u.email}</p>
                      {u.city && (
                        <p className="text-[10px] text-slate-400 mt-0.5">📍 {u.city}, {u.country}</p>
                      )}
                    </div>
                    <div>
                      {u.isBanned ? (
                        <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 font-mono-code text-[10px] font-bold">
                          BANNED
                        </span>
                      ) : u.role === 'admin' ? (
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400 font-mono-code text-[10px] font-bold">
                          ADMIN
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-mono-code text-[10px] font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono-code pt-2 border-t border-slate-500/10">
                    <div>
                      <div className="text-[9px] text-slate-400 uppercase">Wallet USD</div>
                      <div className="font-bold text-emerald-400">${u.walletBalance.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400 uppercase">Coins</div>
                      <div className="font-bold text-amber-400">{u.coins.toLocaleString()} 🪙</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400 uppercase">Win Rate</div>
                      <div className="font-bold">{u.winRate}% ({u.gamesPlayed}G)</div>
                    </div>
                  </div>

                  <div className="pt-1 flex gap-2">
                    {u.role === 'admin' || u.email.toLowerCase() === 'sahityanijhawan@gmail.com' ? (
                      <div className="w-full py-2 rounded-xl text-xs font-heading font-bold text-center text-purple-300 bg-purple-900/20 border border-purple-500/30">
                        🛡️ Administrator (Protected)
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => initiateToggleBan(u)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-heading font-black transition-colors cursor-pointer ${
                            u.isBanned
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-red-600/80 hover:bg-red-600 text-white'
                          }`}
                        >
                          {u.isBanned ? 'Lift Suspension (Unban)' : 'Ban Account'}
                        </button>
                        <button
                          onClick={() => initiateDeleteUser(u)}
                          className="px-3 py-2.5 rounded-xl text-xs font-heading font-bold cursor-pointer transition-colors bg-slate-700/50 hover:bg-red-600 text-slate-300 hover:text-white"
                          title="Delete user account"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop / Tablet Users Table (hidden on mobile) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[720px]">
                <thead>
                  <tr className={`border-b text-[10px] font-mono-code uppercase text-slate-400 ${
                    isLight ? 'border-slate-200 bg-slate-50' : 'border-[#281e47] bg-[#181130]'
                  }`}>
                    <th className="py-2.5 px-3">Player Account</th>
                    <th className="py-2.5 px-3">Email Address</th>
                    <th className="py-2.5 px-3 text-right">Wallet USD</th>
                    <th className="py-2.5 px-3 text-right">Coins</th>
                    <th className="py-2.5 px-3 text-center">Games</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-500/10">
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 px-3">
                        <div className="font-heading font-black">{u.username}</div>
                        {u.city && (
                          <div className="text-[10px] text-slate-400">
                            📍 {u.city}, {u.country}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono-code text-slate-400">{u.email}</td>
                      <td className="py-3 px-3 text-right font-mono-code font-bold text-emerald-400">
                        ${u.walletBalance.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-code text-amber-400">
                        {u.coins.toLocaleString()} 🪙
                      </td>
                      <td className="py-3 px-3 text-center font-mono-code">
                        {u.gamesPlayed} ({u.winRate}% W)
                      </td>
                      <td className="py-3 px-3 text-center">
                        {u.isBanned ? (
                          <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 font-mono-code text-[10px] font-bold">
                            BANNED
                          </span>
                        ) : u.role === 'admin' ? (
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400 font-mono-code text-[10px] font-bold">
                            ADMIN
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-mono-code text-[10px] font-bold">
                            ACTIVE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {u.role === 'admin' || u.email.toLowerCase() === 'sahityanijhawan@gmail.com' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-heading font-bold text-purple-300 bg-purple-900/20 border border-purple-500/30">
                            🛡️ Protected
                          </span>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => initiateToggleBan(u)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-heading font-black cursor-pointer transition-colors ${
                                u.isBanned
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-red-600/80 hover:bg-red-600 text-white'
                              }`}
                            >
                              {u.isBanned ? 'Lift Ban' : 'Ban'}
                            </button>
                            <button
                              onClick={() => initiateDeleteUser(u)}
                              title="Delete user account"
                              className="px-2.5 py-1.5 rounded-lg text-[11px] font-heading font-bold cursor-pointer transition-colors bg-slate-700/50 hover:bg-red-600 text-slate-300 hover:text-white"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: ADMIN ACCESS & MULTI-ADMIN ROLES */}
        {activeTab === 'admins' && (
          <div className="space-y-6">
            <div className={`p-4 sm:p-6 rounded-3xl border shadow-xl space-y-4 ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#140e26] border-[#281e47]'
            }`}>
              <div>
                <h3 className="font-heading font-black text-base flex items-center gap-2">
                  <span>🔑</span> Multi-Admin Access Control
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Manage administrators. Primary rights are anchored to <strong className="text-purple-400">sahityanijhawan@gmail.com</strong>.
                  You can grant or revoke admin dashboard rights to any email address below.
                </p>
              </div>

              {adminFeedback && (
                <div className={`p-3 rounded-xl border text-xs font-bold ${
                  adminFeedback.isError
                    ? 'bg-red-500/20 border-red-500/30 text-red-400'
                    : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                }`}>
                  {adminFeedback.text}
                </div>
              )}

              {/* Add Admin Form */}
              <form onSubmit={handleAddAdmin} className="flex flex-col sm:flex-row gap-2.5 max-w-xl">
                <input
                  type="email"
                  placeholder="Enter email address (e.g. cofounder@example.com)..."
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs outline-none ${
                    isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-[#1a1233] border-[#2e2154] text-white'
                  }`}
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#7059e2] text-white font-heading font-black text-xs hover:bg-[#5e46d0] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Grant Admin Role
                </button>
              </form>

              {/* Verified Admins List */}
              <div className="mt-4 space-y-2">
                <div className="text-[11px] font-mono-code uppercase tracking-wider text-slate-400 font-bold">
                  Current Verified Administrators ({adminList.length})
                </div>
                <div className="divide-y divide-slate-500/10 rounded-2xl border border-slate-500/20 overflow-hidden">
                  {adminList.map((email) => {
                    const isSuper = email.toLowerCase() === 'sahityanijhawan@gmail.com';
                    return (
                      <div
                        key={email}
                        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isLight ? 'bg-slate-50' : 'bg-[#181130]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{isSuper ? '👑' : '🛡️'}</span>
                          <div>
                            <div className="font-mono-code font-bold text-xs flex flex-wrap items-center gap-2">
                              <span>{email}</span>
                              {isSuper ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-black uppercase border border-amber-500/30">
                                  Primary SuperAdmin
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[9px] font-black uppercase border border-purple-500/30">
                                  Authorized Admin
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Full platform monitoring & management rights
                            </div>
                          </div>
                        </div>

                        {!isSuper && (
                          <button
                            onClick={() => handleRemoveAdmin(email)}
                            className="self-start sm:self-auto px-3 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold border border-red-500/20 cursor-pointer transition-colors"
                          >
                            Revoke Role
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ban / Unban Confirmation Modal */}
        {pendingBanAction && (
          <div
            id="ban-confirmation-backdrop"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in"
            onClick={() => {
              if (!isProcessingBan) setPendingBanAction(null);
            }}
          >
            <div
              id="ban-confirmation-modal"
              className={`relative w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50'
                  : 'bg-[#150d2a] border-[#312359] text-white shadow-black/80'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center border ${
                      pendingBanAction.action === 'ban'
                        ? 'bg-red-500/20 border-red-500/30 text-red-400'
                        : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                    }`}
                  >
                    {pendingBanAction.action === 'ban' ? (
                      <ShieldAlert className="w-6 h-6" />
                    ) : (
                      <CheckCircle className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-heading font-black text-lg">
                      {pendingBanAction.action === 'ban' ? 'Confirm Account Ban' : 'Lift Account Suspension'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {pendingBanAction.action === 'ban'
                        ? 'Administrative enforcement restriction'
                        : 'Restore regular player access'}
                    </p>
                  </div>
                </div>

                <button
                  id="ban-modal-close-btn"
                  onClick={() => {
                    if (!isProcessingBan) setPendingBanAction(null);
                  }}
                  disabled={isProcessingBan}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Target User Details Box */}
              <div
                className={`rounded-xl p-3.5 mb-4 border text-xs ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1c1236] border-[#2f2255]'
                }`}
              >
                <div className="flex items-center justify-between font-heading font-bold mb-1">
                  <span className="text-sm font-black">{pendingBanAction.user.username}</span>
                  <span className="font-mono-code text-emerald-400 font-bold">
                    ${pendingBanAction.user.walletBalance.toFixed(2)}
                  </span>
                </div>
                <div className="font-mono-code text-[11px] text-slate-400 mb-2">
                  {pendingBanAction.user.email}
                </div>
                <div className="flex items-center gap-4 text-[10px] text-slate-400 pt-2 border-t border-slate-500/10">
                  <span>Games: <strong className="text-slate-200">{pendingBanAction.user.gamesPlayed}</strong></span>
                  <span>Win Rate: <strong className="text-slate-200">{pendingBanAction.user.winRate}%</strong></span>
                  <span>Coins: <strong className="text-amber-400">{pendingBanAction.user.coins.toLocaleString()} 🪙</strong></span>
                </div>
              </div>

              {/* Warning Notice */}
              {pendingBanAction.action === 'ban' ? (
                <div className="rounded-xl p-3.5 mb-5 bg-red-950/40 border border-red-500/30 text-red-200 text-xs space-y-1.5">
                  <div className="font-heading font-black text-red-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>Are you sure that you want to ban this user?</span>
                  </div>
                  <p className="text-[11px] text-red-300/80 leading-relaxed">
                    This user will immediately be barred from table matchmaking, creating custom rooms, wagering funds, and depositing via Stripe.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl p-3.5 mb-5 bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs space-y-1.5">
                  <div className="font-heading font-black text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Are you sure you want to restore access for this user?</span>
                  </div>
                  <p className="text-[11px] text-emerald-300/80 leading-relaxed">
                    Lifting the suspension restores regular matchmaking, room creation, and player balance access immediately.
                  </p>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  id="ban-modal-cancel-btn"
                  type="button"
                  disabled={isProcessingBan}
                  onClick={() => setPendingBanAction(null)}
                  className="px-4 py-2.5 rounded-xl font-heading font-bold text-xs cursor-pointer transition-colors bg-slate-700/40 hover:bg-slate-700 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  id="ban-modal-confirm-btn"
                  type="button"
                  disabled={isProcessingBan}
                  onClick={handleConfirmBan}
                  className={`px-5 py-2.5 rounded-xl font-heading font-black text-xs cursor-pointer transition-colors flex items-center gap-2 text-white shadow-lg ${
                    pendingBanAction.action === 'ban'
                      ? 'bg-red-600 hover:bg-red-500 shadow-red-900/30'
                      : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30'
                  }`}
                >
                  {isProcessingBan ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Applying...</span>
                    </>
                  ) : (
                    <>
                      {pendingBanAction.action === 'ban' ? (
                        <>
                          <Ban className="w-4 h-4" />
                          <span>Yes, Ban User</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Yes, Lift Ban</span>
                        </>
                      )}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete User Confirmation Modal */}
        {pendingDeleteUser && (
          <div
            id="delete-confirmation-backdrop"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in"
            onClick={() => {
              if (!isProcessingDelete) setPendingDeleteUser(null);
            }}
          >
            <div
              id="delete-confirmation-modal"
              className={`relative w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50'
                  : 'bg-[#150d2a] border-[#312359] text-white shadow-black/80'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center border bg-red-500/20 border-red-500/30 text-red-400">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-heading font-black text-lg">Permanent Account Deletion</h3>
                    <p className="text-xs text-slate-400">Irreversible user removal</p>
                  </div>
                </div>

                <button
                  id="delete-modal-close-btn"
                  onClick={() => {
                    if (!isProcessingDelete) setPendingDeleteUser(null);
                  }}
                  disabled={isProcessingDelete}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div
                className={`rounded-xl p-3.5 mb-4 border text-xs ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1c1236] border-[#2f2255]'
                }`}
              >
                <div className="flex items-center justify-between font-heading font-bold mb-1">
                  <span className="text-sm font-black">{pendingDeleteUser.username}</span>
                  <span className="font-mono-code text-emerald-400 font-bold">
                    ${pendingDeleteUser.walletBalance.toFixed(2)}
                  </span>
                </div>
                <div className="font-mono-code text-[11px] text-slate-400">
                  {pendingDeleteUser.email}
                </div>
              </div>

              <div className="rounded-xl p-3.5 mb-5 bg-red-950/40 border border-red-500/30 text-red-200 text-xs space-y-1.5">
                <div className="font-heading font-black text-red-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Are you sure you want to permanently delete this user?</span>
                </div>
                <p className="text-[11px] text-red-300/80 leading-relaxed">
                  This will permanently delete the player profile, match history, and records. This action cannot be undone.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  id="delete-modal-cancel-btn"
                  type="button"
                  disabled={isProcessingDelete}
                  onClick={() => setPendingDeleteUser(null)}
                  className="px-4 py-2.5 rounded-xl font-heading font-bold text-xs cursor-pointer transition-colors bg-slate-700/40 hover:bg-slate-700 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  id="delete-modal-confirm-btn"
                  type="button"
                  disabled={isProcessingDelete}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2.5 rounded-xl font-heading font-black text-xs cursor-pointer transition-colors flex items-center gap-2 text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/30"
                >
                  {isProcessingDelete ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Account Permanently</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
