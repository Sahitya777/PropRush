import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { GameRoom, Player } from '../types/game';
import { AvatarCharacter } from '../components/AvatarCharacter';
import { MatchStatsAnalyticsModal } from '../components/MatchStatsAnalyticsModal';
import { generateSampleCompletedMatch } from '../utils/matchAnalytics';
import { sounds } from '../utils/audio';
import { getActiveMatch, clearActiveMatch, formatRemainingTime, ActiveSavedMatch } from '../utils/reconnectStorage';
import {
  getAllActiveRooms,
  findActiveRoomByCode,
  findActiveRoomByCodeAsync,
  refreshActiveRoomsFromServer,
  registerActiveRoom,
  removeActiveRoom,
  ActiveRoomInfo
} from '../utils/activeRoomsRegistry';
import { fetchServerRoom, createServerRoom, disbandServerRoom } from '../utils/serverRoomSync';
import { useSafeDynamic } from '../context/DynamicIntegration';
import { createWagerPool, getWalletClient } from '../contracts/client';
import { getBaseScanTxUrl } from '../contracts/config';
import { Loader2, Shield, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';

interface HomeLobbyViewProps {
  onJoinRoom: (roomConfig: {
    roomCode: string;
    roomName: string;
    maxPlayers: number;
    betAmount: number;
    initialCash: number;
    turnTimeSeconds: number;
    boardTheme: string;
    fillWithBots: boolean;
    isCreator?: boolean;
    isPrivate?: boolean;
    wagerMode?: 'free' | 'crypto';
    wagerContractAddress?: string;
  }) => void;
  onOpenWallet: () => void;
  onOpenStore: () => void;
}

function extractRoomCode(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  // Check if URL with query parameter ?room=xyz
  if (trimmed.includes('room=')) {
    const match = trimmed.match(/room=([a-zA-Z0-9_-]+)/i);
    if (match) return match[1].toLowerCase();
  }
  // Check if path with /room/xyz
  if (trimmed.includes('/room/')) {
    const parts = trimmed.split('/room/');
    if (parts[1]) {
      return parts[1].split('?')[0].split('/')[0].toLowerCase();
    }
  }
  return trimmed.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
}

export const HomeLobbyView: React.FC<HomeLobbyViewProps> = ({
  onJoinRoom,
  onOpenWallet,
  onOpenStore
}) => {
  const { user, deductBuyIn, depositFunds, isLoggedIn, openAuthModal, isBanned } = useUser();
  const { isLight } = useTheme();
  const { primaryWallet } = useSafeDynamic();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoinErrorShaking, setIsJoinErrorShaking] = useState(false);
  const [sampleCompletedMatch, setSampleCompletedMatch] = useState<GameRoom | null>(null);

  // WagerPool on-chain deployment state for room creation
  const [isDeployingPool, setIsDeployingPool] = useState(false);
  const [poolDeployStatus, setPoolDeployStatus] = useState<string | null>(null);
  const [createRoomError, setCreateRoomError] = useState<string | null>(null);

  // Active rooms registry state
  const [activeRooms, setActiveRooms] = useState<ActiveRoomInfo[]>(() => getAllActiveRooms());

  // Periodically refresh active rooms from server and local store
  useEffect(() => {
    let isMounted = true;
    const refreshRooms = async () => {
      const serverList = await refreshActiveRoomsFromServer();
      if (isMounted && serverList) {
        setActiveRooms(serverList);
      }
    };
    refreshRooms();
    const interval = setInterval(refreshRooms, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Active match reconnection state
  const [activeSavedMatch, setActiveSavedMatch] = useState<ActiveSavedMatch | null>(() => getActiveMatch());
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const match = getActiveMatch();
    return match ? Math.max(0, Math.floor((match.expiresAt - Date.now()) / 1000)) : 0;
  });

  // Check active match timer every second
  useEffect(() => {
    const checkActiveMatch = () => {
      const match = getActiveMatch();
      if (!match) {
        setActiveSavedMatch(null);
        setSecondsRemaining(0);
        return;
      }
      const secs = Math.max(0, Math.floor((match.expiresAt - Date.now()) / 1000));
      if (secs <= 0) {
        clearActiveMatch();
        setActiveSavedMatch(null);
        setSecondsRemaining(0);
      } else {
        setActiveSavedMatch(match);
        setSecondsRemaining(secs);
      }
    };

    checkActiveMatch();
    const interval = setInterval(checkActiveMatch, 1000);

    // Also check immediately when window gains focus or storage changes (e.g. from another tab or back navigation)
    const handleFocus = () => checkActiveMatch();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  // Room config state
  const [roomName, setRoomName] = useState('Room ' + Math.random().toString(36).substring(2, 6).toUpperCase());
  const [roomCode, setRoomCode] = useState(() => Math.random().toString(36).substring(2, 6).toLowerCase());
  const [isRoomCodeCustomized, setIsRoomCodeCustomized] = useState<boolean>(false);
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [wagerPreset, setWagerPreset] = useState<string>('10');
  const [wagerMode, setWagerMode] = useState<'free' | 'crypto'>('crypto');
  const [customWagerAmount, setCustomWagerAmount] = useState<string>('75');
  const [betAmount, setBetAmount] = useState<number>(10);
  const [initialCash, setInitialCash] = useState<number>(1500);
  const [turnTimeSeconds, setTurnTimeSeconds] = useState<number>(15);
  const [boardTheme, setBoardTheme] = useState<string>('classic');
  const [fillWithBots, setFillWithBots] = useState<boolean>(false);

  const handleQuickPlay = (bet: number = 0, timer: number = 15) => {
    if (isBanned) {
      sounds.playBankrupt();
      alert('⛔ Account Suspended: Your account has been suspended by PropRush administration. Matchmaking is disabled.');
      return;
    }
    if (bet > 0) {
      if (!isLoggedIn) {
        openAuthModal('Log in or sign up with Dynamic to enter cash stakes matches and win real prize pools.');
        return;
      }
      // When bet > 0, on-chain WagerPool must be deployed via wallet confirmation first:
      setBetAmount(bet);
      setWagerPreset(bet.toString());
      setWagerMode('crypto');
      setTurnTimeSeconds(timer);
      setCreateRoomError(null);
      setShowCreateModal(true);
      return;
    }

    const quickCode = 'quick_' + Math.floor(100 + Math.random() * 900);
    const quickRoomName = 'Casual Fast Room';

    // Register active room into live registry
    registerActiveRoom({
      code: quickCode,
      name: quickRoomName,
      host: user.username || 'Player',
      hostAvatar: user.avatar || 'orange',
      hostId: user.id,
      players: 1,
      max: 4,
      bet: 0,
      turnTime: timer,
      map: 'Classic',
      initialCash: 1500,
      wagerMode: 'free'
    });
    setActiveRooms(getAllActiveRooms());

    sounds.playCashRegister();
    onJoinRoom({
      roomCode: quickCode,
      roomName: quickRoomName,
      maxPlayers: 4,
      betAmount: 0,
      initialCash: 1500,
      turnTimeSeconds: timer,
      boardTheme: 'classic',
      fillWithBots: true,
      wagerMode: 'free',
      isCreator: true
    });
  };

  const handleWagerPresetChange = (value: string) => {
    setWagerPreset(value);
    if (value === 'custom') {
      const parsed = Math.max(1, parseInt(customWagerAmount, 10) || 1);
      setBetAmount(parsed);
    } else {
      const parsed = parseInt(value, 10) || 0;
      setBetAmount(parsed);
    }
  };

  const handleCustomWagerChange = (valStr: string) => {
    // Only allow positive integers
    const cleanStr = valStr.replace(/[^0-9]/g, '');
    setCustomWagerAmount(cleanStr);
    const parsed = parseInt(cleanStr, 10) || 0;
    setBetAmount(parsed);
  };

  const handleAddCustomChips = (delta: number) => {
    const current = parseInt(customWagerAmount, 10) || 0;
    const nextVal = Math.max(1, current + delta);
    setCustomWagerAmount(nextVal.toString());
    setBetAmount(nextVal);
  };

  const handleCreateRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBanned) {
      sounds.playBankrupt();
      alert('⛔ Account Suspended: Your account has been suspended by PropRush administration. Creating rooms is disabled.');
      return;
    }
    const effectiveBet = wagerPreset === 'custom' ? (parseInt(customWagerAmount, 10) || 0) : betAmount;

    let deployedPoolAddress: string | undefined = undefined;

    // IF MONEY / WAGER IS INVOLVED: Deploy WagerPool on-chain first via wallet approval!
    if (effectiveBet > 0) {
      if (!isLoggedIn) {
        openAuthModal('Log in or sign up with Dynamic to create real-money wager rooms.');
        return;
      }

      setIsDeployingPool(true);
      setCreateRoomError(null);
      setPoolDeployStatus('1/2: Please confirm the WagerPool creation in your wallet popup (MetaMask / Dynamic)...');

      try {
        const { walletClient } = await getWalletClient(primaryWallet);
        setPoolDeployStatus(`2/2: Deploying WagerPool ($${effectiveBet} USDC, ${maxPlayers} max players) on Base Sepolia... Waiting for block confirmation...`);
        
        const result = await createWagerPool(
          walletClient,
          effectiveBet,
          maxPlayers,
          500 // 5% platform fee
        );

        deployedPoolAddress = result.poolAddress;
        setPoolDeployStatus(`✓ WagerPool confirmed on Base Sepolia at ${result.poolAddress.slice(0, 6)}...${result.poolAddress.slice(-4)}! Launching room...`);
      } catch (err: any) {
        console.error('Failed to create WagerPool on-chain:', err);
        setIsDeployingPool(false);
        setPoolDeployStatus(null);
        sounds.playBankrupt();
        const errText = err?.shortMessage || err?.message || 'Transaction rejected by user or failed on chain.';
        setCreateRoomError(`Wallet transaction failed: ${errText}. Room creation cancelled.`);
        return; // CRITICAL: Stop execution! Do NOT make room!
      }
    }

    const nameSlug = (roomName || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
    const effectiveCode = (roomCode || nameSlug || 'room_' + Math.random().toString(36).substring(2, 7)).trim().toLowerCase();
    const effectiveName = roomName.trim() || (effectiveCode ? effectiveCode.toUpperCase() : 'Custom Room');
    const effectiveHostId = user.id || 'host_' + Date.now();

    // Persist creator role for this browser session & local storage
    try {
      sessionStorage.setItem(`proprush_creator_${effectiveCode}`, 'true');
      localStorage.setItem(`proprush_creator_${effectiveCode}`, 'true');
    } catch {}

    const mapTheme: 'classic' | 'cyber' | 'worldwide' = boardTheme === 'cyber' ? 'cyber' : boardTheme === 'worldwide' ? 'worldwide' : 'classic';

    // Register into active rooms registry
    registerActiveRoom({
      code: effectiveCode,
      name: effectiveName,
      host: user.username || 'Host',
      hostAvatar: user.avatar || 'orange',
      hostId: effectiveHostId,
      players: 1,
      max: maxPlayers,
      bet: effectiveBet,
      turnTime: turnTimeSeconds || 15,
      map: boardTheme === 'cyber' ? 'Cyber Neon' : boardTheme === 'worldwide' ? 'Worldwide' : 'Classic',
      initialCash,
      wagerContractAddress: deployedPoolAddress,
      wagerMode: effectiveBet > 0 ? 'crypto' : 'free'
    });
    setActiveRooms(getAllActiveRooms());

    // Register on backend server before proceeding so other players can discover immediately
    try {
      await Promise.race([
        createServerRoom({
          code: effectiveCode,
          name: effectiveName,
          hostId: effectiveHostId,
          maxPlayers,
          betAmount: effectiveBet,
          boardTheme: mapTheme,
          isPrivate: false,
          fillWithBots,
          wagerMode: effectiveBet > 0 ? 'crypto' : 'free',
          wagerContractAddress: deployedPoolAddress,
          players: [
            {
              id: effectiveHostId,
              name: user.username || 'Host',
              avatar: user.avatar || 'orange',
              isHost: true,
              walletAddress: user.walletAddress,
              cash: initialCash,
              netWorth: initialCash,
              position: 0,
              properties: [],
              mortgaged: [],
              houses: {},
              inJail: false,
              jailTurns: 0,
              getOutOfJailCards: 0,
              isBankrupt: false,
              isBot: false,
              color: '#e65c00'
            }
          ]
        } as any),
        new Promise(resolve => setTimeout(resolve, 800))
      ]);
    } catch (err) {
      console.warn('Could not post room to server ahead of join:', err);
    }

    sounds.playCashRegister();
    setIsDeployingPool(false);
    setPoolDeployStatus(null);
    onJoinRoom({
      roomCode: effectiveCode,
      roomName: effectiveName,
      maxPlayers,
      betAmount: effectiveBet,
      initialCash,
      turnTimeSeconds: turnTimeSeconds || 15,
      boardTheme,
      fillWithBots,
      wagerMode: effectiveBet > 0 ? 'crypto' : 'free',
      wagerContractAddress: deployedPoolAddress,
      isCreator: true
    });
    setShowCreateModal(false);
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBanned) {
      sounds.playBankrupt();
      setJoinError('⛔ Account Suspended: Your account has been suspended by PropRush administration.');
      return;
    }
    const cleanCode = extractRoomCode(roomCodeInput);
    if (!cleanCode) {
      sounds.playBankrupt();
      setJoinError('Please enter an active room code or share link (e.g. lnu17).');
      setIsJoinErrorShaking(true);
      setTimeout(() => setIsJoinErrorShaking(false), 600);
      return;
    }

    // 1. Check if user is reconnecting to an active saved match session
    const activeSaved = getActiveMatch();
    if (activeSaved && activeSaved.roomConfig.roomCode.toLowerCase() === cleanCode) {
      setJoinError(null);
      sounds.playCashRegister();
      onJoinRoom(activeSaved.roomConfig);
      return;
    }

    // 2. Validate against active rooms (checks local cache + server)
    const foundRoom = await findActiveRoomByCodeAsync(cleanCode);
    if (foundRoom) {
      setJoinError(null);
      if (foundRoom.bet > 0) {
        if (!isLoggedIn) {
          openAuthModal(`Log in or sign up with Dynamic to enter "${foundRoom.name}" ($${foundRoom.bet} Buy-in).`);
          return;
        }
        if (user.walletBalance < foundRoom.bet) {
          onOpenWallet();
          return;
        }
      }

      sounds.playCashRegister();
      onJoinRoom({
        roomCode: foundRoom.code,
        roomName: foundRoom.name,
        maxPlayers: foundRoom.max,
        betAmount: foundRoom.bet,
        initialCash: foundRoom.initialCash || 1500,
        turnTimeSeconds: foundRoom.turnTime,
        boardTheme: foundRoom.map.toLowerCase(),
        fillWithBots: !foundRoom.isCustom,
        isCreator: false,
        wagerContractAddress: foundRoom.wagerContractAddress,
        wagerMode: foundRoom.wagerMode || (foundRoom.bet > 0 ? 'crypto' : 'free')
      });
      return;
    }

    // 3. Fallback check directly with server in case room was created recently
    const directServerRoom = await fetchServerRoom(cleanCode) || await fetchServerRoom('custom_' + cleanCode);
    if (directServerRoom) {
      setJoinError(null);
      sounds.playCashRegister();
      onJoinRoom({
        roomCode: directServerRoom.code || cleanCode,
        roomName: directServerRoom.name || `Room ${cleanCode.toUpperCase()}`,
        maxPlayers: directServerRoom.maxPlayers || 4,
        betAmount: (directServerRoom as any).betAmount || 0,
        initialCash: (directServerRoom as any).initialCash || 1500,
        turnTimeSeconds: directServerRoom.turnTimeLimit || (directServerRoom as any).turnTimeSeconds || 15,
        boardTheme: (directServerRoom.boardTheme || 'classic').toLowerCase(),
        fillWithBots: false,
        isCreator: false,
        wagerContractAddress: (directServerRoom as any).wagerContractAddress,
        wagerMode: (directServerRoom as any).wagerMode || (((directServerRoom as any).betAmount || 0) > 0 ? 'crypto' : 'free')
      });
      return;
    }

    // Room does not exist - block random room entry!
    sounds.playBankrupt();
    setJoinError(`Room "${cleanCode.toUpperCase()}" does not exist. Please check the code or verify the table has been created.`);
    setIsJoinErrorShaking(true);
    setTimeout(() => setIsJoinErrorShaking(false), 600);
  };

  const handleQuickJoinActiveRoom = (room: ActiveRoomInfo) => {
    setRoomCodeInput(room.code);
    setJoinError(null);
    if (room.bet > 0 && !isLoggedIn) {
      openAuthModal(`Log in or sign up with Dynamic to enter "${room.name}" ($${room.bet} Buy-in).`);
      return;
    }
    if (room.bet > 0 && user.walletBalance < room.bet) {
      onOpenWallet();
      return;
    }

    sounds.playCashRegister();
    onJoinRoom({
      roomCode: room.code,
      roomName: room.name,
      maxPlayers: room.max,
      betAmount: room.bet,
      initialCash: room.initialCash || 1500,
      turnTimeSeconds: room.turnTime,
      boardTheme: room.map.toLowerCase(),
      fillWithBots: !room.isCustom,
      isCreator: false,
      wagerContractAddress: room.wagerContractAddress,
      wagerMode: room.wagerMode || (room.bet > 0 ? 'crypto' : 'free')
    });
  };

  const handleCopyShareLink = (code: string) => {
    try {
      const link = `${window.location.origin}?room=${code}`;
      if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(link).catch(() => {});
      }
    } catch {
      // Ignore clipboard write issues
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const effectiveBet = wagerPreset === 'custom' ? (parseInt(customWagerAmount, 10) || 0) : betAmount;
  const totalPot = maxPlayers * effectiveBet;
  const winnerPayout = totalPot > 0 ? (totalPot * 0.95).toFixed(2) : '0';
  const platformFee = totalPot > 0 ? (totalPot * 0.05).toFixed(2) : '0';

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10 flex flex-col gap-6 sm:gap-8 animate-fade-in">
      {/* Active Match Reconnection Alert Banner */}
      {activeSavedMatch && secondsRemaining > 0 && (
        <div className={`w-full rounded-2xl border-2 p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in relative overflow-hidden ${
          isLight
            ? 'bg-gradient-to-r from-purple-50 via-indigo-50 to-white border-[#7059e2] text-slate-800'
            : 'bg-gradient-to-r from-[#2c174f] via-[#1f153b] to-[#15112a] border-[#7059e2] text-white shadow-[0_0_30px_rgba(112,89,226,0.4)]'
        }`}>
          {/* Shimmer / Progress background bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-900/30">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-[#7059e2] to-emerald-400 transition-all duration-1000"
              style={{ width: `${Math.min(100, (secondsRemaining / 120) * 100)}%` }}
            />
          </div>

          <div className="flex items-center gap-3.5 min-w-0 w-full sm:w-auto">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#7059e2]/20 border border-[#7059e2] flex items-center justify-center text-2xl flex-shrink-0 animate-bounce">
              ⚡
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono-code font-bold uppercase tracking-wide flex items-center gap-1 border ${
                  activeSavedMatch.room?.status === 'waiting'
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-ping ${activeSavedMatch.room?.status === 'waiting' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {activeSavedMatch.room?.status === 'waiting' ? 'Waiting Lobby Active' : 'Match In Progress'}
                </span>
                <span className={`text-xs font-mono-code ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  Room: <strong className={`font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{activeSavedMatch.roomConfig.roomCode.toUpperCase()}</strong>
                </span>
                {activeSavedMatch.roomConfig.betAmount > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40 text-[10px] font-mono-code font-bold">
                    ${activeSavedMatch.roomConfig.betAmount} Buy-in
                  </span>
                )}
              </div>
              <h3 className={`font-heading font-black text-base sm:text-lg truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {activeSavedMatch.roomConfig.roomName}
              </h3>
              <div className={`text-xs flex items-center gap-2 mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                <span>{activeSavedMatch.room?.status === 'waiting' ? '⏱️ Table active for:' : '⏱️ Reconnect grace period:'}</span>
                <span className="font-mono-code font-extrabold text-amber-600 dark:text-amber-400 text-sm bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-500/40">
                  {formatRemainingTime(secondsRemaining)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0 w-full sm:w-auto justify-end">
            <button
              id="btn-forfeit-reconnect-match"
              onClick={() => {
                const code = activeSavedMatch.roomConfig.roomCode.toLowerCase();
                if (activeSavedMatch.room?.status === 'waiting' && activeSavedMatch.roomConfig.betAmount > 0) {
                  depositFunds(activeSavedMatch.roomConfig.betAmount, 'room_forfeit_refund');
                  sounds.playCashRegister();
                } else {
                  sounds.playBankrupt();
                }
                if (activeSavedMatch.room?.status === 'waiting') {
                  disbandServerRoom(code, user.id, user.id).catch(() => {});
                  removeActiveRoom(code);
                  setActiveRooms(getAllActiveRooms());
                }
                try {
                  localStorage.removeItem(`proprush_paid_${code}`);
                  sessionStorage.removeItem(`proprush_paid_${code}`);
                  localStorage.removeItem(`proprush_creator_${code}`);
                  sessionStorage.removeItem(`proprush_creator_${code}`);
                } catch {}
                clearActiveMatch();
                setActiveSavedMatch(null);
                setSecondsRemaining(0);
              }}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                isLight
                  ? 'bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border-slate-300 hover:border-rose-300'
                  : 'bg-slate-900/80 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border-slate-700 hover:border-rose-500/50'
              }`}
              title={activeSavedMatch.room?.status === 'waiting' ? 'Cancel table and refund buy-in' : 'Abandon match and forfeit'}
            >
              <span>✕</span>
              <span>
                {activeSavedMatch.room?.status === 'waiting'
                  ? (activeSavedMatch.roomConfig.betAmount > 0 ? `Cancel & Refund ($${activeSavedMatch.roomConfig.betAmount})` : 'Cancel Table')
                  : 'Forfeit'}
              </span>
            </button>
            <button
              id="btn-reconnect-match"
              onClick={() => {
                sounds.playCashRegister();
                onJoinRoom(activeSavedMatch.roomConfig);
              }}
              className="flex-1 sm:flex-initial px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#7059e2] to-[#8e76f7] hover:from-[#5e46d0] hover:to-[#7b61f0] text-white font-heading font-black text-xs sm:text-sm shadow-[0_0_20px_rgba(112,89,226,0.6)] cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>⚡</span>
              <span>{activeSavedMatch.room?.status === 'waiting' ? 'REJOIN TABLE' : 'RECONNECT & RESUME'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold font-mono-code mb-1 border ${
          isLight
            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
            : 'bg-[#7059e2]/20 border-[#7059e2]/40 text-[#a390ff]'
        }`}>
          <span>⚡</span> FAST-PACED MULTIPLAYER MONOPOLY
        </div>
        <h1 className={`font-heading font-black text-3xl sm:text-5xl md:text-6xl tracking-tight ${
          isLight ? 'text-slate-900' : 'text-white'
        }`}>
          RULE THE <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7059e2] via-[#a855f7] to-[#38bdf8]">ECONOMY</span>
        </h1>
        <p className={`text-sm sm:text-base ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
          Roll the dice, buy luxury properties, build hotels, collect huge rents, and wager real money in fast competitive rooms!
        </p>

        {/* Big Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-3">
          <button
            id="btn-quick-play"
            onClick={() => handleQuickPlay(0, 15)}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#7059e2] to-[#8e76f7] hover:from-[#6047d8] hover:to-[#7f63f3] text-white font-heading font-black text-sm shadow-[0_0_20px_rgba(112,89,226,0.5)] cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <span>🎲</span>
            <span>PLAY CASUAL (FREE)</span>
          </button>

          <button
            id="btn-create-custom-room"
            onClick={() => setShowCreateModal(true)}
            className={`px-6 py-3.5 rounded-2xl font-heading font-bold text-sm cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2 border ${
              isLight
                ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 shadow-sm hover:border-[#7059e2]'
                : 'bg-[#211a3b] hover:bg-[#2b224d] text-slate-200 border-[#7059e2]/50'
            }`}
          >
            <span>⚙️</span>
            <span>CUSTOM ROOM & WAGER</span>
          </button>

          <button
            id="btn-wager-match"
            onClick={() => handleQuickPlay(10, 15)}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-heading font-black text-sm shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <span>💰</span>
            <span>$10 STAKES MATCH</span>
          </button>

          <button
            id="btn-sample-completed-game"
            onClick={() => {
              sounds.playDiceRoll();
              setSampleCompletedMatch(generateSampleCompletedMatch());
            }}
            className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-white font-heading font-black text-sm shadow-[0_0_20px_rgba(245,158,11,0.4)] cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2"
            title="Inspect full match stats, graphs, timeline, dice bell curve & property breakdown for a finished game"
          >
            <span>📊</span>
            <span>DEMO FINISHED GAME</span>
          </button>
        </div>

        {/* Quick Wager Stakes Bar */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-xs">
          <span className={`font-mono-code text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Quick Buy-in Stakes:</span>
          {[
            { amount: 5, label: '$5' },
            { amount: 10, label: '$10' },
            { amount: 25, label: '$25' },
            { amount: 50, label: '$50' },
            { amount: 100, label: '$100' },
            { amount: 200, label: '$200' },
            { amount: 500, label: '$500' },
            { amount: 1000, label: '$1k' },
            { amount: 5000, label: '$5k' },
            { amount: 10000, label: '$10k' }
          ].map(tier => (
            <button
              key={tier.amount}
              onClick={() => handleQuickPlay(tier.amount, 15)}
              className={`px-2.5 py-1 rounded-xl font-mono-code font-bold text-[11px] cursor-pointer transition-all active:scale-95 border ${
                isLight
                  ? 'bg-white hover:bg-emerald-50 border-slate-200 hover:border-emerald-400 text-slate-700 hover:text-emerald-700 shadow-xs'
                  : 'bg-[#1a1433] hover:bg-emerald-950/80 border-[#3b2f66] hover:border-emerald-500/60 text-slate-300 hover:text-emerald-300'
              }`}
              title={`Quick Play with $${tier.amount.toLocaleString()} buy-in`}
            >
              {tier.label}
            </button>
          ))}
          <button
            onClick={() => {
              setWagerPreset('custom');
              setShowCreateModal(true);
            }}
            className={`px-2.5 py-1 rounded-xl font-mono-code font-bold text-[11px] cursor-pointer transition-all border ${
              isLight
                ? 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700'
                : 'bg-[#7059e2]/20 hover:bg-[#7059e2]/40 border-[#7059e2]/50 text-[#b4a4ff]'
            }`}
          >
            ✏️ Custom $
          </button>
        </div>
      </div>

      {/* Join via Room Code / Link Bar */}
      <div className={`w-full max-w-xl mx-auto rounded-2xl shadow-lg border p-3.5 sm:p-4 flex flex-col gap-3 ${
        isJoinErrorShaking ? 'animate-shake' : ''
      } ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#19142b] border-[#2b2447]'
      }`}>
        <div className="flex items-center justify-between">
          <label className={`text-xs font-bold flex items-center gap-1.5 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
            <span>🔑</span>
            <span>Join with Room Code or Invite Link</span>
          </label>
          <span className={`text-[11px] font-mono-code ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Active only
          </span>
        </div>

        <form onSubmit={handleJoinByCode} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="e.g. lnu17, tokyo88, whale50"
              value={roomCodeInput}
              onChange={e => {
                setRoomCodeInput(e.target.value);
                if (joinError) setJoinError(null);
              }}
              className={`w-full px-4 py-2.5 rounded-xl text-sm font-mono-code font-bold focus:outline-none transition-all border ${
                joinError
                  ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 placeholder-rose-400'
                  : isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#7059e2] focus:bg-white'
                    : 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-[#7059e2] focus:bg-slate-950'
              }`}
            />
            {roomCodeInput && (
              <button
                type="button"
                onClick={() => {
                  setRoomCodeInput('');
                  setJoinError(null);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="submit"
            id="btn-submit-join-room"
            className="px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#7059e2] to-[#8e76f7] hover:from-[#5f45d8] hover:to-[#7c63f2] text-white font-heading font-black text-xs cursor-pointer transition-all active:scale-95 shadow-md whitespace-nowrap flex items-center gap-1.5"
          >
            <span>JOIN</span>
            <span>→</span>
          </button>
        </form>

        {/* Error message when attempting to join a non-active/invalid code */}
        {joinError && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex flex-col gap-2 animate-fade-in">
            <div className="flex items-start gap-2">
              <span className="text-base flex-shrink-0">⚠️</span>
              <div className="flex-1 font-medium">
                {joinError}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-rose-500/20">
              <span className="text-[11px] font-bold text-rose-800 dark:text-rose-200">Active rooms right now:</span>
              {activeRooms.slice(0, 3).map(room => (
                <button
                  key={room.code}
                  type="button"
                  onClick={() => handleQuickJoinActiveRoom(room)}
                  className="px-2 py-0.5 rounded-md font-mono-code font-bold text-[11px] bg-rose-500/20 hover:bg-rose-500/30 text-rose-900 dark:text-rose-100 border border-rose-500/40 cursor-pointer transition-all"
                >
                  {room.code} (${room.bet})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active room quick click chips */}
        {!joinError && activeRooms.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs pt-0.5">
            <span className={`text-[11px] font-mono-code ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Active codes:
            </span>
            {activeRooms.map(room => (
              <button
                key={room.code}
                type="button"
                onClick={() => handleQuickJoinActiveRoom(room)}
                className={`px-2 py-0.5 rounded-md font-mono-code font-bold text-[11px] cursor-pointer transition-all border ${
                  roomCodeInput.toLowerCase() === room.code.toLowerCase()
                    ? 'bg-[#7059e2] text-white border-[#7059e2]'
                    : isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
                title={`Join ${room.name} (${room.code})`}
              >
                {room.code} {room.bet > 0 ? `($${room.bet})` : '(Free)'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active Public Rooms Browser */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className={`font-heading font-black text-xl sm:text-2xl flex items-center gap-2 ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            <span>🌐</span> Active Game Rooms
          </h2>
          <span className={`text-xs font-mono-code ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {activeRooms.length} Live Rooms Available
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeRooms.map(r => {
            const isHostOfRoom = Boolean(
              (r.hostId && r.hostId === user.id) ||
              (user.username && r.host === user.username) ||
              (typeof window !== 'undefined' && (
                localStorage.getItem(`proprush_creator_${r.code.toLowerCase()}`) === 'true' ||
                sessionStorage.getItem(`proprush_creator_${r.code.toLowerCase()}`) === 'true'
              ))
            );

            return (
              <div
                key={r.code}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 shadow-sm hover:shadow-md group ${
                  isHostOfRoom
                    ? isLight
                      ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-400/40'
                      : 'bg-[#221a36] border-amber-500/40 ring-1 ring-amber-500/30'
                    : isLight
                      ? 'bg-white border-slate-200 hover:border-[#7059e2]/60'
                      : 'bg-[#19142b] border-[#2b2447] hover:border-[#7059e2]/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AvatarCharacter avatarId={r.hostAvatar} size="xs" />
                      <span className={`text-xs font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        {r.host}
                        {isHostOfRoom && ' (You)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isHostOfRoom && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-code font-extrabold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                          👑 Host
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono-code font-bold ${
                        isLight ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        Code: {r.code}
                      </span>
                      {r.bet > 0 ? (
                        <>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono-code font-bold border ${
                            isLight
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          }`}>
                            ${r.bet} Buy-in
                          </span>
                          <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/15 text-blue-500 dark:text-blue-400 border border-blue-500/30">
                            🔵 Base Sepolia Escrow
                          </span>
                        </>
                      ) : (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'
                        }`}>
                          Casual Free
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className={`font-heading font-black text-lg transition-colors ${
                    isLight ? 'text-slate-900 group-hover:text-[#7059e2]' : 'text-white group-hover:text-[#a390ff]'
                  }`}>
                    {r.name}
                  </h3>

                  <div className={`flex items-center gap-3 text-xs font-mono-code mt-2 ${
                    isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    <span>👥 {r.players}/{r.max} Players</span>
                    <span>⏱️ {r.turnTime}s timer</span>
                    <span>🗺️ {r.map}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyShareLink(r.code)}
                    className={`px-3 py-2 rounded-xl text-xs cursor-pointer border transition-all active:scale-95 ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                    }`}
                    title="Copy share link"
                  >
                    🔗
                  </button>

                  {isHostOfRoom ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const msg = r.bet > 0
                            ? `Cancel "${r.name}" and refund $${r.bet} buy-in to your wallet?`
                            : `Cancel and close table "${r.name}"?`;
                          if (confirm(msg)) {
                            if (r.bet > 0) {
                              depositFunds(r.bet, 'room_cancel_refund');
                              sounds.playCashRegister();
                            }
                            const cleanCode = r.code.toLowerCase();
                            disbandServerRoom(cleanCode, user.id, user.id).catch(() => {});
                            removeActiveRoom(cleanCode);
                            clearActiveMatch();
                            try {
                              localStorage.removeItem(`proprush_paid_${cleanCode}`);
                              sessionStorage.removeItem(`proprush_paid_${cleanCode}`);
                              localStorage.removeItem(`proprush_creator_${cleanCode}`);
                              sessionStorage.removeItem(`proprush_creator_${cleanCode}`);
                            } catch {}
                            setActiveRooms(getAllActiveRooms());
                            setActiveSavedMatch(null);
                          }
                        }}
                        className="px-3 py-2 rounded-xl text-xs font-bold border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
                        title="Cancel table and refund"
                      >
                        ✕ Refund
                      </button>
                      <button
                        onClick={() => handleQuickJoinActiveRoom(r)}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 font-heading font-black text-xs text-slate-950 cursor-pointer shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <span>RESUME YOUR TABLE</span>
                        <span>→</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleQuickJoinActiveRoom(r)}
                      className="flex-1 py-2.5 rounded-xl bg-[#7059e2] hover:bg-[#5f45d8] font-heading font-bold text-xs text-white cursor-pointer shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <span>JOIN GAME ROOM</span>
                      <span>→</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t ${
        isLight ? 'border-slate-200' : 'border-[#2b2447]'
      }`}>
        <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
          isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#151124] border-slate-800/80'
        }`}>
          <span className="text-2xl">⚡</span>
          <div>
            <h4 className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>Ultra Fast Pacing</h4>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>15-second turns, instant speed auctions, and smooth 2x turbo animations.</p>
          </div>
        </div>
        <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
          isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#151124] border-slate-800/80'
        }`}>
          <span className="text-2xl">💵</span>
          <div>
            <h4 className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>Wager Prize Pools</h4>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Bet $10 with 4 players, winner takes $38 (95%), 5% platform fee.</p>
          </div>
        </div>
        <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
          isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#151124] border-slate-800/80'
        }`}>
          <span className="text-2xl">🏆</span>
          <div>
            <h4 className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>League Ranks & Badges</h4>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Climb from Bronze to Tycoon rank, unlock rare avatars and achievements.</p>
          </div>
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className={`w-full max-w-lg rounded-3xl shadow-2xl p-5 sm:p-6 flex flex-col gap-4 my-auto max-h-[90vh] overflow-y-auto border-2 ${
            isLight
              ? 'bg-white border-[#7059e2] text-slate-900'
              : 'bg-[#181329] border-[#7059e2] text-white'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${
              isLight ? 'border-slate-200' : 'border-slate-800'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚙️</span>
                <div>
                  <h3 className={`font-heading font-black text-lg ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    CREATE CUSTOM ROOM
                  </h3>
                  <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Configure your match settings & invite friends</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer ${
                  isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRoomSubmit} className="space-y-4 text-xs">
              {/* Active Deployment Card */}
              {isDeployingPool && (
                <div className="p-4 rounded-2xl border bg-gradient-to-r from-blue-900/50 via-indigo-900/50 to-purple-900/50 border-blue-400/50 text-white text-xs space-y-2 animate-fade-in shadow-xl">
                  <div className="flex items-center gap-2 font-bold text-blue-300 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
                    <span>Deploying On-Chain Escrow Smart Contract</span>
                  </div>
                  <p className="text-[11px] text-slate-200 leading-relaxed font-mono-code">
                    {poolDeployStatus}
                  </p>
                  <p className="text-[10px] text-amber-300 font-bold flex items-center gap-1.5 pt-1 border-t border-blue-400/20">
                    <span>⚠️</span>
                    <span>Please approve the transaction prompt in your wallet popup. Do not close this tab.</span>
                  </p>
                </div>
              )}

              {/* Deployment Error Alert */}
              {createRoomError && (
                <div className="p-3.5 rounded-xl border bg-rose-500/15 border-rose-500/40 text-rose-300 text-xs space-y-1 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-rose-400">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Room Creation Cancelled</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreateRoomError(null)}
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{createRoomError}</p>
                </div>
              )}

              {/* On-Chain Escrow Info Banner when bet > 0 */}
              {effectiveBet > 0 && !isDeployingPool && (
                <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  isLight ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-blue-950/30 border-blue-500/30 text-blue-300'
                }`}>
                  <Shield className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-xs">Base Sepolia Smart Contract Escrow</div>
                    <p className={`text-[11px] leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                      When creating this room, your wallet will prompt you to deploy the on-chain WagerPool contract (${effectiveBet} USDC buy-in). The room is only created once approved and confirmed on-chain.
                    </p>
                  </div>
                </div>
              )}

              {/* Room Name & Unique Link */}
              <div>
                <label className={`block font-bold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Room Name</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={e => {
                    const val = e.target.value;
                    setRoomName(val);
                    if (!isRoomCodeCustomized) {
                      setRoomCode(val.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16));
                    }
                  }}
                  className={`w-full px-3 py-2 rounded-xl font-medium focus:outline-none focus:border-[#7059e2] border ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-900'
                      : 'bg-slate-900 border-slate-700 text-white'
                  }`}
                />
              </div>

              {/* Room Code Identifier (e.g. lnu17) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={`font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Custom Room Code / Link</label>
                  <button
                    type="button"
                    onClick={() => handleCopyShareLink(roomCode || roomName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16))}
                    className="text-emerald-500 hover:underline text-[11px] font-bold cursor-pointer"
                  >
                    {copiedLink ? 'Copied to Clipboard! ✓' : 'Copy Room Link 🔗'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono-code ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>proprush.com/room/</span>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={e => {
                      setIsRoomCodeCustomized(true);
                      setRoomCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                    }}
                    className={`flex-1 px-3 py-2 rounded-xl font-mono-code font-bold focus:outline-none focus:border-[#7059e2] border ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-900'
                        : 'bg-slate-900 border-slate-700 text-white'
                    }`}
                  />
                </div>
              </div>

              {/* Player Count & Wager */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block font-bold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Max Players</label>
                  <select
                    value={maxPlayers}
                    onChange={e => setMaxPlayers(parseInt(e.target.value, 10))}
                    className={`w-full px-3 py-2 rounded-xl focus:outline-none border ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-900'
                        : 'bg-slate-900 border-slate-700 text-white'
                    }`}
                  >
                    <option value={2}>2 Players (1v1 Duel)</option>
                    <option value={3}>3 Players</option>
                    <option value={4}>4 Players (Standard)</option>
                    <option value={6}>6 Players (Mayhem)</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-bold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Wager Buy-in</label>
                  <select
                    value={wagerPreset}
                    onChange={e => handleWagerPresetChange(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl focus:outline-none font-mono-code text-xs border ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-900'
                        : 'bg-slate-900 border-slate-700 text-white'
                    }`}
                  >
                    <option value="0">$0 (Free Casual Match)</option>
                    <option value="5">$5 per player (Micro Stakes)</option>
                    <option value="10">$10 per player (Standard - Recommended)</option>
                    <option value="25">$25 per player (Club Stakes)</option>
                    <option value="50">$50 per player (High Roller)</option>
                    <option value="100">$100 per player (Pro League Arena)</option>
                    <option value="200">$200 per player (Master Circuit Table)</option>
                    <option value="500">$500 per player (Grandmaster Arena)</option>
                    <option value="1000">$1,000 per player (Diamond Syndicate)</option>
                    <option value="5000">$5,000 per player (VIP Whale Tier)</option>
                    <option value="10000">$10,000 per player (Billionaire Elite)</option>
                    <option value="custom">✏️ Custom Amount (Enter Any Buy-in)</option>
                  </select>
                </div>
              </div>

              {/* Custom Wager Amount Input Field when Custom is Selected */}
              {wagerPreset === 'custom' && (
                <div className={`p-3 border rounded-2xl space-y-2.5 animate-fade-in ${
                  isLight ? 'bg-indigo-50/70 border-indigo-200' : 'bg-[#130e24] border-[#7059e2]/50'
                }`}>
                  <div className="flex items-center justify-between">
                    <label className={`font-bold text-xs flex items-center gap-1.5 ${
                      isLight ? 'text-indigo-900' : 'text-[#b4a4ff]'
                    }`}>
                      <span>✏️</span>
                      <span>Enter Custom Wager Buy-in ($)</span>
                    </label>
                    <span className={`text-[10px] font-mono-code ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Balance: ${user.walletBalance.toFixed(2)}
                    </span>
                  </div>

                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-base font-bold text-emerald-500 font-mono-code">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customWagerAmount}
                      onChange={e => handleCustomWagerChange(e.target.value)}
                      placeholder="e.g. 75, 250, 2500..."
                      className={`w-full pl-8 pr-4 py-2.5 rounded-xl font-mono-code font-extrabold text-sm focus:outline-none focus:border-[#7059e2] border ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900'
                          : 'bg-slate-950 border-slate-700 text-white'
                      }`}
                    />
                  </div>

                  {/* Quick Helper Chips for adding custom amounts */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className={`text-[10px] font-mono-code mr-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Quick Add:</span>
                    {[10, 50, 100, 500, 1000, 5000].map(addVal => (
                      <button
                        key={addVal}
                        type="button"
                        onClick={() => handleAddCustomChips(addVal)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-mono-code font-bold cursor-pointer transition-all active:scale-95 border ${
                          isLight
                            ? 'bg-white hover:bg-indigo-100 border-slate-200 text-slate-700'
                            : 'bg-slate-900 hover:bg-[#281f4a] border-slate-800 hover:border-[#7059e2]/60 text-slate-300 hover:text-white'
                        }`}
                      >
                        +${addVal.toLocaleString()}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setCustomWagerAmount('0');
                        setBetAmount(0);
                      }}
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono-code font-bold cursor-pointer ml-auto border ${
                        isLight
                          ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
                          : 'bg-rose-950/40 hover:bg-rose-900/60 border-rose-800/40 text-rose-300'
                      }`}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* Wager Prize Breakdown banner */}
              {betAmount > 0 && (
                <div className={`p-3 rounded-xl space-y-1 font-mono-code border ${
                  isLight
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-emerald-950/50 border-emerald-500/40'
                }`}>
                  <div className="flex justify-between">
                    <span className={isLight ? 'text-slate-600' : 'text-slate-300'}>Pot: {maxPlayers} x ${betAmount.toLocaleString()}</span>
                    <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>${totalPot.toLocaleString()}</span>
                  </div>
                  <div className={`flex justify-between font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                    <span>Winner Takes (95%):</span>
                    <span>+${winnerPayout}</span>
                  </div>
                  <div className={`flex justify-between text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    <span>Platform Rake (5%):</span>
                    <span>${platformFee}</span>
                  </div>
                </div>
              )}

              {/* Escrow Settlement Mode: Base Sepolia USDC Smart Contract vs In-App Virtual Chips */}
              {betAmount > 0 && (
                <div
                  id="wager-settlement-mode-selector"
                  className={`p-3 rounded-2xl border space-y-2 ${
                    isLight ? 'bg-blue-50/70 border-blue-200' : 'bg-blue-950/20 border-blue-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-bold flex items-center gap-1.5 ${isLight ? 'text-blue-900' : 'text-blue-200'}`}>
                      <span>🛡️</span> Escrow Settlement Mode
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
                      Base Sepolia Testnet
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      id="opt-wager-mode-crypto"
                      onClick={() => setWagerMode('crypto')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        wagerMode === 'crypto'
                          ? isLight
                            ? 'bg-white border-blue-500 shadow-sm ring-2 ring-blue-500/20 text-blue-950'
                            : 'bg-blue-900/40 border-blue-400 shadow-md ring-1 ring-blue-400/40 text-white'
                          : isLight
                          ? 'bg-white/60 border-slate-200 text-slate-600 hover:border-slate-300'
                          : 'bg-slate-900/40 border-slate-700/50 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1">🔵 On-Chain WagerPool</span>
                        {wagerMode === 'crypto' && <span className="text-blue-400 text-xs">✓ Active</span>}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Base Sepolia smart contract escrow (MockUSDC). Non-custodial 95% winner payout.
                      </div>
                    </button>

                    <button
                      type="button"
                      id="opt-wager-mode-free"
                      onClick={() => setWagerMode('free')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        wagerMode === 'free'
                          ? isLight
                            ? 'bg-white border-blue-500 shadow-sm ring-2 ring-blue-500/20 text-blue-950'
                            : 'bg-blue-900/40 border-blue-400 shadow-md ring-1 ring-blue-400/40 text-white'
                          : isLight
                          ? 'bg-white/60 border-slate-200 text-slate-600 hover:border-slate-300'
                          : 'bg-slate-900/40 border-slate-700/50 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1">💵 Platform Balance</span>
                        {wagerMode === 'free' && <span className="text-blue-400 text-xs">✓ Active</span>}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Settles with in-game PropRush cash balance.
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Timer & Theme */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block font-bold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Turn Timer</label>
                  <select
                    value={turnTimeSeconds}
                    onChange={e => setTurnTimeSeconds(parseInt(e.target.value, 10))}
                    className={`w-full px-3 py-2 rounded-xl focus:outline-none font-mono-code text-xs border ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-900'
                        : 'bg-slate-900 border-slate-700 text-white'
                    }`}
                  >
                    <option value={10}>⚡ 10s (Turbo Blitz - Fastest)</option>
                    <option value={15}>⏱️ 15s (Fast - PropRush Standard)</option>
                    <option value={20}>⚡ 20s (Dynamic Action)</option>
                    <option value={30}>🕒 30s (Relaxed Pacing)</option>
                    <option value={45}>⏳ 45s (Strategic Deep Play)</option>
                    <option value={60}>🧘 60s (Extended Clock)</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-bold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Board Theme</label>
                  <select
                    value={boardTheme}
                    onChange={e => setBoardTheme(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl focus:outline-none text-xs border ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-900'
                        : 'bg-slate-900 border-slate-700 text-white'
                    }`}
                  >
                    <option value="classic">Classic Monopoly</option>
                    <option value="worldwide">Mr. Worldwide</option>
                    <option value="death_valley">Death Valley</option>
                    <option value="cyber_neon">Cyber Neon 2099</option>
                    <option value="candy">Candy Kingdom</option>
                    <option value="space">Space Odyssey</option>
                    <option value="medieval">Medieval Castle Keep</option>
                    <option value="pirate">Pirate Treasure Cove</option>
                    <option value="egypt">Ancient Egypt Pyramids</option>
                  </select>
                </div>
              </div>

              {/* Auto-fill with AI Bots */}
              <div className={`flex items-center justify-between p-3 rounded-xl border ${
                isLight
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-slate-900/60 border-slate-800'
              }`}>
                <div>
                  <div className={`font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>Fill Empty Slots with AI Bots</div>
                  <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Play immediately without waiting for other players</div>
                </div>
                <input
                  type="checkbox"
                  checked={fillWithBots}
                  onChange={e => setFillWithBots(e.target.checked)}
                  className="w-4 h-4 accent-[#7059e2] cursor-pointer"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeployingPool}
                  onClick={() => setShowCreateModal(false)}
                  className={`flex-1 py-2.5 rounded-xl font-bold cursor-pointer transition-all disabled:opacity-50 ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeployingPool}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#7059e2] to-[#8e76f7] hover:from-[#6047d8] hover:to-[#7f63f3] disabled:opacity-60 font-heading font-black text-white cursor-pointer shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isDeployingPool ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Deploying Escrow ({poolDeployStatus ? 'In Progress' : 'Prompting'}...)...</span>
                    </>
                  ) : effectiveBet > 0 ? (
                    <>
                      <Shield className="w-4 h-4" />
                      <span>Deploy Escrow & Launch Room 🚀</span>
                    </>
                  ) : (
                    <span>Launch Free Room 🚀</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sample Completed Match Analytics Preview Modal */}
      {sampleCompletedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
          <MatchStatsAnalyticsModal
            room={sampleCompletedMatch}
            myPlayerId={user.id}
            onClose={() => setSampleCompletedMatch(null)}
            onReturnHome={() => setSampleCompletedMatch(null)}
            onPlayAgain={() => {
              setSampleCompletedMatch(null);
              handleQuickPlay(0, 15);
            }}
            isStandalonePreview={true}
          />
        </div>
      )}
    </div>
  );
};

