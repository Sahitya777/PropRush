import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { GameRoom, Player } from '../types/game';
import { AvatarCharacter } from '../components/AvatarCharacter';
import { sounds } from '../utils/audio';
import { getActiveMatch, clearActiveMatch, formatRemainingTime, ActiveSavedMatch } from '../utils/reconnectStorage';

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
  }) => void;
  onOpenWallet: () => void;
  onOpenStore: () => void;
}

export const HomeLobbyView: React.FC<HomeLobbyViewProps> = ({
  onJoinRoom,
  onOpenWallet,
  onOpenStore
}) => {
  const { user, deductBuyIn } = useUser();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

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
    return () => clearInterval(interval);
  }, []);

  // Room config state
  const [roomName, setRoomName] = useState('Room ' + Math.random().toString(36).substring(2, 6).toUpperCase());
  const [roomCode, setRoomCode] = useState('lnu17');
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [wagerPreset, setWagerPreset] = useState<string>('10');
  const [customWagerAmount, setCustomWagerAmount] = useState<string>('75');
  const [betAmount, setBetAmount] = useState<number>(10);
  const [initialCash, setInitialCash] = useState<number>(1500);
  const [turnTimeSeconds, setTurnTimeSeconds] = useState<number>(15);
  const [boardTheme, setBoardTheme] = useState<string>('classic');
  const [fillWithBots, setFillWithBots] = useState<boolean>(true);

  // Sample active public rooms for quick joining
  const activeRooms = [
    {
      code: 'lnu17',
      name: 'High Stakes NYC Arena',
      host: 'RichUp_Admin',
      hostAvatar: 'navy',
      players: 3,
      max: 4,
      bet: 100,
      turnTime: 15,
      map: 'Classic'
    },
    {
      code: 'tokyo88',
      name: 'Tokyo Fast 2x Blitz',
      host: 'Kenji',
      hostAvatar: 'cyber',
      players: 2,
      max: 4,
      bet: 0,
      turnTime: 10,
      map: 'Cyber Neon'
    },
    {
      code: 'whale50',
      name: 'Grandmaster Diamond Table',
      host: 'Victor_Mogul',
      hostAvatar: 'king',
      players: 3,
      max: 4,
      bet: 500,
      turnTime: 20,
      map: 'Worldwide'
    }
  ];

  const handleQuickPlay = (bet: number = 0, timer: number = 15) => {
    if (bet > 0) {
      if (user.walletBalance < bet) {
        onOpenWallet();
        return;
      }
      deductBuyIn(bet);
    }

    sounds.playCashRegister();
    onJoinRoom({
      roomCode: 'quick_' + Math.floor(Math.random() * 1000),
      roomName: bet > 0 ? `$${bet} Wager Blitz` : 'Casual Fast Room',
      maxPlayers: 4,
      betAmount: bet,
      initialCash: 1500,
      turnTimeSeconds: timer,
      boardTheme: 'classic',
      fillWithBots: true
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

  const handleCreateRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveBet = wagerPreset === 'custom' ? (parseInt(customWagerAmount, 10) || 0) : betAmount;

    if (effectiveBet > 0) {
      if (user.walletBalance < effectiveBet) {
        onOpenWallet();
        return;
      }
      deductBuyIn(effectiveBet);
    }

    sounds.playCashRegister();
    onJoinRoom({
      roomCode: roomCode || 'room_' + Math.random().toString(36).substring(2, 7),
      roomName: roomName || 'Custom Room',
      maxPlayers,
      betAmount: effectiveBet,
      initialCash,
      turnTimeSeconds: turnTimeSeconds || 15,
      boardTheme,
      fillWithBots
    });
    setShowCreateModal(false);
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    sounds.playClick();
    onJoinRoom({
      roomCode: roomCodeInput.trim().toLowerCase(),
      roomName: `Room ${roomCodeInput.trim().toUpperCase()}`,
      maxPlayers: 4,
      betAmount: 0,
      initialCash: 1500,
      turnTimeSeconds: 30,
      boardTheme: 'classic',
      fillWithBots: true
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

  const totalPot = maxPlayers * betAmount;
  const winnerPayout = totalPot > 0 ? (totalPot * 0.95).toFixed(2) : '0';
  const platformFee = totalPot > 0 ? (totalPot * 0.05).toFixed(2) : '0';

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8 animate-fade-in">
      {/* Active Match Reconnection Alert Banner */}
      {activeSavedMatch && secondsRemaining > 0 && (
        <div className="w-full rounded-2xl bg-gradient-to-r from-[#2c174f] via-[#1f153b] to-[#15112a] border-2 border-[#7059e2] p-4 sm:p-5 shadow-[0_0_30px_rgba(112,89,226,0.4)] flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in relative overflow-hidden">
          {/* Shimmer / Progress background bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-900">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-[#7059e2] to-emerald-400 transition-all duration-1000"
              style={{ width: `${Math.min(100, (secondsRemaining / 120) * 100)}%` }}
            />
          </div>

          <div className="flex items-center gap-3.5 min-w-0 w-full sm:w-auto">
            <div className="w-12 h-12 rounded-2xl bg-[#7059e2]/30 border border-[#7059e2] flex items-center justify-center text-2xl flex-shrink-0 animate-bounce">
              ⚡
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono-code font-bold uppercase tracking-wide flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  Active Match In Progress
                </span>
                <span className="text-xs font-mono-code text-slate-300">
                  Room: <strong className="text-white font-black">{activeSavedMatch.roomConfig.roomCode.toUpperCase()}</strong>
                </span>
              </div>
              <h3 className="font-heading font-black text-base sm:text-lg text-white truncate">
                {activeSavedMatch.roomConfig.roomName}
              </h3>
              <div className="text-xs text-slate-300 flex items-center gap-2 mt-0.5">
                <span>⏱️ Reconnect grace period:</span>
                <span className="font-mono-code font-extrabold text-amber-400 text-sm bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/40">
                  {formatRemainingTime(secondsRemaining)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0 w-full sm:w-auto justify-end">
            <button
              id="btn-forfeit-reconnect-match"
              onClick={() => {
                sounds.playBankrupt();
                clearActiveMatch();
                setActiveSavedMatch(null);
                setSecondsRemaining(0);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900/80 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/50 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              title="Abandon match and clear saved session"
            >
              <span>✕</span>
              <span>Forfeit</span>
            </button>
            <button
              id="btn-reconnect-match"
              onClick={() => {
                sounds.playCashRegister();
                onJoinRoom(activeSavedMatch.roomConfig);
              }}
              className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#7059e2] to-[#8e76f7] hover:from-[#5e46d0] hover:to-[#7b61f0] text-white font-heading font-black text-xs sm:text-sm shadow-[0_0_20px_rgba(112,89,226,0.6)] cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>⚡</span>
              <span>RECONNECT & RESUME</span>
            </button>
          </div>
        </div>
      )}

      {/* Hero Section matching RichUp clean dark vibe */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7059e2]/20 border border-[#7059e2]/40 text-[#a390ff] text-xs font-bold font-mono-code mb-1">
          <span>⚡</span> FAST-PACED MULTIPLAYER MONOPOLY
        </div>
        <h1 className="font-heading font-black text-4xl sm:text-6xl text-white tracking-tight">
          RULE THE <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7059e2] via-[#a855f7] to-[#38bdf8]">ECONOMY</span>
        </h1>
        <p className="text-sm sm:text-base text-slate-300">
          Roll the dice, buy luxury properties, build hotels, collect huge rents, and bet real money in fast competitive rooms!
        </p>

        {/* Big Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <button
            id="btn-quick-play"
            onClick={() => handleQuickPlay(0, 15)}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#7059e2] to-[#8e76f7] hover:from-[#6047d8] hover:to-[#7f63f3] text-white font-heading font-black text-sm shadow-[0_0_25px_rgba(112,89,226,0.6)] cursor-pointer transition-all active:scale-95 flex items-center gap-2"
          >
            <span>🎲</span>
            <span>PLAY CASUAL (FREE)</span>
          </button>

          <button
            id="btn-create-custom-room"
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 rounded-2xl bg-[#211a3b] hover:bg-[#2b224d] text-slate-200 border border-[#7059e2]/50 font-heading font-bold text-sm cursor-pointer transition-all active:scale-95 flex items-center gap-2"
          >
            <span>⚙️</span>
            <span>CUSTOM ROOM & WAGER</span>
          </button>

          <button
            id="btn-wager-match"
            onClick={() => handleQuickPlay(10, 15)}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-heading font-black text-sm shadow-[0_0_25px_rgba(16,185,129,0.5)] cursor-pointer transition-all active:scale-95 flex items-center gap-2"
          >
            <span>💰</span>
            <span>$10 STAKES MATCH</span>
          </button>
        </div>

        {/* Quick Wager Stakes Bar */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-slate-400 font-mono-code text-[11px]">Quick Buy-in Stakes:</span>
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
              className="px-2.5 py-1 rounded-xl bg-[#1a1433] hover:bg-emerald-950/80 border border-[#3b2f66] hover:border-emerald-500/60 text-slate-300 hover:text-emerald-300 font-mono-code font-bold text-[11px] cursor-pointer transition-all active:scale-95"
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
            className="px-2.5 py-1 rounded-xl bg-[#7059e2]/20 hover:bg-[#7059e2]/40 border border-[#7059e2]/50 text-[#b4a4ff] font-mono-code font-bold text-[11px] cursor-pointer transition-all"
          >
            ✏️ Custom $
          </button>
        </div>
      </div>

      {/* Join via Room Code / Link Bar */}
      <div className="w-full max-w-xl mx-auto p-2 rounded-2xl bg-[#19142b] border border-[#2b2447] shadow-xl">
        <form onSubmit={handleJoinByCode} className="flex gap-2">
          <input
            type="text"
            placeholder="Enter Room Code or Link (e.g. lnu17)"
            value={roomCodeInput}
            onChange={e => setRoomCodeInput(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#7059e2]"
          />
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-[#7059e2] hover:bg-[#5f45d8] text-white font-bold text-xs cursor-pointer transition-all"
          >
            Join Room
          </button>
        </form>
      </div>

      {/* Active Public Rooms Browser */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-black text-xl sm:text-2xl text-white flex items-center gap-2">
            <span>🌐</span> Active Game Rooms
          </h2>
          <span className="text-xs text-slate-400 font-mono-code">
            {activeRooms.length} Live Rooms Available
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {activeRooms.map(r => (
            <div
              key={r.code}
              className="p-5 rounded-2xl bg-[#19142b] border border-[#2b2447] hover:border-[#7059e2]/50 transition-all flex flex-col justify-between gap-4 shadow-lg group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AvatarCharacter avatarId={r.hostAvatar} size="xs" />
                    <span className="text-xs text-slate-400 font-medium">{r.host}</span>
                  </div>
                  {r.bet > 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono-code font-bold">
                      ${r.bet} Buy-in
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold">
                      Casual Free
                    </span>
                  )}
                </div>

                <h3 className="font-heading font-black text-lg text-white group-hover:text-[#a390ff] transition-colors">
                  {r.name}
                </h3>

                <div className="flex items-center gap-3 text-xs text-slate-400 font-mono-code mt-2">
                  <span>👥 {r.players}/{r.max} Players</span>
                  <span>⏱️ {r.turnTime}s timer</span>
                  <span>🗺️ {r.map}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleCopyShareLink(r.code)}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 cursor-pointer"
                  title="Copy share link"
                >
                  🔗
                </button>
                <button
                  onClick={() => {
                    onJoinRoom({
                      roomCode: r.code,
                      roomName: r.name,
                      maxPlayers: r.max,
                      betAmount: r.bet,
                      initialCash: 1500,
                      turnTimeSeconds: r.turnTime,
                      boardTheme: r.map.toLowerCase(),
                      fillWithBots: true
                    });
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#7059e2] hover:bg-[#5f45d8] font-heading font-bold text-xs text-white cursor-pointer shadow-md transition-all active:scale-95"
                >
                  JOIN GAME ROOM →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#2b2447]">
        <div className="p-4 rounded-2xl bg-[#151124] border border-slate-800/80 flex items-start gap-3">
          <span className="text-2xl">⚡</span>
          <div>
            <h4 className="font-bold text-white text-sm">Ultra Fast Pacing</h4>
            <p className="text-xs text-slate-400 mt-0.5">15-second turns, instant speed auctions, and smooth 2x turbo animations.</p>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-[#151124] border border-slate-800/80 flex items-start gap-3">
          <span className="text-2xl">💵</span>
          <div>
            <h4 className="font-bold text-white text-sm">Wager Prize Pools</h4>
            <p className="text-xs text-slate-400 mt-0.5">Bet $10 with 4 players, winner takes $38 (95%), 5% platform fee.</p>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-[#151124] border border-slate-800/80 flex items-start gap-3">
          <span className="text-2xl">🏆</span>
          <div>
            <h4 className="font-bold text-white text-sm">League Ranks & Badges</h4>
            <p className="text-xs text-slate-400 mt-0.5">Climb from Bronze to Tycoon rank, unlock rare avatars and achievements.</p>
          </div>
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-lg bg-[#181329] border-2 border-[#7059e2] rounded-3xl shadow-2xl p-6 flex flex-col gap-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚙️</span>
                <div>
                  <h3 className="font-heading font-black text-lg text-white">
                    CREATE CUSTOM ROOM
                  </h3>
                  <p className="text-xs text-slate-400">Configure your match settings & invite friends</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRoomSubmit} className="space-y-4 text-xs">
              {/* Room Name & Unique Link */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">Room Name</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-medium focus:outline-none focus:border-[#7059e2]"
                />
              </div>

              {/* Room Code Identifier (e.g. lnu17) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-300">Custom Room Code / Link</label>
                  <button
                    type="button"
                    onClick={() => handleCopyShareLink(roomCode)}
                    className="text-emerald-400 hover:underline text-[11px]"
                  >
                    {copiedLink ? 'Copied to Clipboard! ✓' : 'Copy Room Link 🔗'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-mono-code">richup.io/room/</span>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={e => setRoomCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono-code font-bold focus:outline-none focus:border-[#7059e2]"
                  />
                </div>
              </div>

              {/* Player Count & Wager */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Max Players</label>
                  <select
                    value={maxPlayers}
                    onChange={e => setMaxPlayers(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none"
                  >
                    <option value={2}>2 Players (1v1 Duel)</option>
                    <option value={3}>3 Players</option>
                    <option value={4}>4 Players (Standard)</option>
                    <option value={6}>6 Players (Mayhem)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Wager Buy-in</label>
                  <select
                    value={wagerPreset}
                    onChange={e => handleWagerPresetChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none font-mono-code text-xs"
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
                <div className="p-3 bg-[#130e24] border border-[#7059e2]/50 rounded-2xl space-y-2.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-xs text-[#b4a4ff] flex items-center gap-1.5">
                      <span>✏️</span>
                      <span>Enter Custom Wager Buy-in ($)</span>
                    </label>
                    <span className="text-[10px] font-mono-code text-slate-400">
                      Balance: ${user.walletBalance.toFixed(2)}
                    </span>
                  </div>

                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-base font-bold text-emerald-400 font-mono-code">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customWagerAmount}
                      onChange={e => handleCustomWagerChange(e.target.value)}
                      placeholder="e.g. 75, 250, 2500..."
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono-code font-extrabold text-sm focus:outline-none focus:border-[#7059e2] focus:ring-1 focus:ring-[#7059e2]"
                    />
                  </div>

                  {/* Quick Helper Chips for adding custom amounts */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-400 font-mono-code mr-1">Quick Add:</span>
                    {[10, 50, 100, 500, 1000, 5000].map(addVal => (
                      <button
                        key={addVal}
                        type="button"
                        onClick={() => handleAddCustomChips(addVal)}
                        className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-[#281f4a] border border-slate-800 hover:border-[#7059e2]/60 text-[10px] font-mono-code font-bold text-slate-300 hover:text-white cursor-pointer transition-all active:scale-95"
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
                      className="px-2 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-[10px] font-mono-code font-bold text-rose-300 cursor-pointer ml-auto"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* Wager Prize Breakdown banner */}
              {betAmount > 0 && (
                <div className="p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl space-y-1 font-mono-code">
                  <div className="flex justify-between text-slate-300">
                    <span>Pot: {maxPlayers} x ${betAmount.toLocaleString()}</span>
                    <span className="font-bold text-white">${totalPot.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>Winner Takes (95%):</span>
                    <span>+${winnerPayout}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[10px]">
                    <span>Platform Rake (5%):</span>
                    <span>${platformFee}</span>
                  </div>
                </div>
              )}

              {/* Timer & Theme */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Turn Timer</label>
                  <select
                    value={turnTimeSeconds}
                    onChange={e => setTurnTimeSeconds(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none font-mono-code text-xs"
                  >
                    <option value={10}>⚡ 10s (Turbo Blitz - Fastest)</option>
                    <option value={15}>⏱️ 15s (Fast - RichUp Standard)</option>
                    <option value={20}>⚡ 20s (Dynamic Action)</option>
                    <option value={30}>🕒 30s (Relaxed Pacing)</option>
                    <option value={45}>⏳ 45s (Strategic Deep Play)</option>
                    <option value={60}>🧘 60s (Extended Clock)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Board Theme</label>
                  <select
                    value={boardTheme}
                    onChange={e => setBoardTheme(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none text-xs"
                  >
                    <option value="classic">Classic Monopoly</option>
                    <option value="worldwide">Mr. Worldwide</option>
                    <option value="death_valley">Death Valley</option>
                    <option value="cyber_neon">Cyber Neon</option>
                  </select>
                </div>
              </div>

              {/* Auto-fill with AI Bots */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div>
                  <div className="font-bold text-slate-200">Fill Empty Slots with AI Bots</div>
                  <div className="text-[10px] text-slate-400">Play immediately without waiting for other players</div>
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
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#7059e2] to-[#8e76f7] hover:from-[#6047d8] hover:to-[#7f63f3] font-heading font-black text-white cursor-pointer shadow-lg active:scale-95"
                >
                  Launch Room 🚀
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
