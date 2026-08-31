import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { sounds } from '../utils/audio';
import { fireConfetti } from '../utils/confetti';
import { useUser } from '../context/UserContext';

interface NotFoundViewProps {
  onNavigateHome: () => void;
  onNavigateStore?: () => void;
  onNavigateProfile?: () => void;
  onJoinRoomByCode?: (code: string) => void;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  onNavigateHome,
  onNavigateStore,
  onNavigateProfile,
  onJoinRoomByCode,
}) => {
  const { isLight } = useTheme();
  const { depositFunds } = useUser();
  const [dice1, setDice1] = useState(4);
  const [dice2, setDice2] = useState(4);
  const [isRolling, setIsRolling] = useState(false);
  const [escapeStatus, setEscapeStatus] = useState<string | null>(null);
  const [roomInput, setRoomInput] = useState('');
  const [chanceCardFlipped, setChanceCardFlipped] = useState(false);

  // Play a soft sound on load
  useEffect(() => {
    sounds.playDiceRoll();
  }, []);

  const handleRollDice = () => {
    if (isRolling) return;
    setIsRolling(true);
    sounds.playDiceRoll();
    setEscapeStatus(null);

    let rolls = 0;
    const interval = setInterval(() => {
      setDice1(Math.floor(Math.random() * 6) + 1);
      setDice2(Math.floor(Math.random() * 6) + 1);
      rolls++;
      if (rolls > 12) {
        clearInterval(interval);
        const final1 = Math.floor(Math.random() * 6) + 1;
        const final2 = Math.floor(Math.random() * 6) + 1;
        setDice1(final1);
        setDice2(final2);
        setIsRolling(false);

        if (final1 === final2) {
          sounds.playVictory();
          fireConfetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
          depositFunds(50, 'bonus');
          setEscapeStatus(`🎉 DOUBLES! You rolled [${final1} & ${final2}]! You escaped 404 Jail & earned +$50 bonus coins!`);
        } else {
          sounds.playCashRegister();
          setEscapeStatus(`🎲 You rolled [${final1} + ${final2} = ${final1 + final2}]! You advanced towards the Lobby.`);
        }
      }
    }, 60);
  };

  const handleSearchRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = roomInput.trim().toUpperCase();
    if (clean && onJoinRoomByCode) {
      sounds.playClick();
      onJoinRoomByCode(clean);
    } else {
      onNavigateHome();
    }
  };

  const diceFaceMap: Record<number, string> = {
    1: '⚀',
    2: '⚁',
    3: '⚂',
    4: '⚃',
    5: '⚄',
    6: '⚅',
  };

  return (
    <div className={`min-h-[85vh] w-full flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-200 ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#0d0a18] text-white'
    }`}>
      {/* Container Card */}
      <div className={`w-full max-w-3xl rounded-3xl border-2 shadow-2xl p-6 sm:p-10 flex flex-col items-center text-center relative overflow-hidden transition-all ${
        isLight 
          ? 'bg-white border-indigo-200/80 shadow-indigo-100/50' 
          : 'bg-gradient-to-b from-[#18132d] via-[#130f24] to-[#0f0b1d] border-[#3b2d6a] shadow-[0_20px_60px_rgba(0,0,0,0.8)]'
      }`}>
        {/* Background glow effects */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-[#7059e2]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Monopoly Themed Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold uppercase tracking-wider mb-4">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span>Go Directly to Jail • Error 404</span>
        </div>

        {/* Animated Monopoly Jail / Lost Deed Graphic */}
        <div className="relative my-2 flex items-center justify-center">
          {/* Monopoly Jail & Real Estate Tile Visual */}
          <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-3xl border-4 border-amber-500/70 bg-[#161228] p-3 flex flex-col items-center justify-between shadow-2xl overflow-hidden group">
            {/* Tile Header */}
            <div className="w-full bg-rose-600 text-white font-heading font-black text-xs py-1 rounded-t-lg tracking-wider uppercase flex items-center justify-center gap-1">
              <span>🚨 IN JAIL / JUST VISITING</span>
            </div>

            {/* Jail Bars & Monopoly Avatar */}
            <div className="relative w-full flex-1 flex items-center justify-center my-1 bg-[#0b0816] rounded-xl border border-slate-700/60 overflow-hidden">
              {/* Vertical Jail Bars */}
              <div className="absolute inset-0 flex justify-evenly pointer-events-none opacity-60">
                <div className="w-1.5 bg-gradient-to-b from-slate-400 to-slate-600 h-full shadow-sm" />
                <div className="w-1.5 bg-gradient-to-b from-slate-400 to-slate-600 h-full shadow-sm" />
                <div className="w-1.5 bg-gradient-to-b from-slate-400 to-slate-600 h-full shadow-sm" />
                <div className="w-1.5 bg-gradient-to-b from-slate-400 to-slate-600 h-full shadow-sm" />
              </div>

              {/* Animated Avatar */}
              <div className="text-4xl sm:text-5xl animate-bounce filter drop-shadow-[0_0_12px_rgba(244,63,94,0.6)] z-10 select-none">
                🎩
              </div>
              <div className="absolute bottom-1 text-[9px] font-mono-code font-bold text-amber-400 bg-black/60 px-2 py-0.5 rounded">
                DEED NOT FOUND
              </div>
            </div>

            {/* Floating Money & Dice Elements */}
            <div className="w-full flex items-center justify-between px-2 text-[10px] font-bold text-slate-300">
              <span className="text-emerald-400">💵 Cost: $0</span>
              <span className="text-amber-400">🎲 Roll 4 & 4</span>
            </div>
          </div>

          {/* 404 Floating Number Badges */}
          <div className="absolute -left-4 top-1/2 -translate-y-1/2 bg-[#7059e2] text-white font-heading font-black text-2xl sm:text-3xl px-3 py-1.5 rounded-2xl shadow-xl rotate-[-12deg] border border-[#a291ff]">
            4
          </div>
          <div className="absolute -right-4 top-1/2 -translate-y-1/2 bg-emerald-600 text-white font-heading font-black text-2xl sm:text-3xl px-3 py-1.5 rounded-2xl shadow-xl rotate-[12deg] border border-emerald-400">
            4
          </div>
        </div>

        {/* Headline */}
        <h1 className={`font-heading font-black text-2xl sm:text-4xl tracking-tight mt-4 ${
          isLight ? 'text-slate-900' : 'text-white'
        }`}>
          Property Deed Not Found on This Board!
        </h1>

        <p className={`mt-2 max-w-lg text-sm sm:text-base leading-relaxed ${
          isLight ? 'text-slate-600' : 'text-slate-300'
        }`}>
          You took a wrong turn past Boardwalk and landed on an unmapped district.
          Do not pass GO, do not collect $200 — but you can roll the dice to escape!
        </p>

        {/* Mini Interactive Dice Escape Game */}
        <div className={`w-full max-w-md my-6 p-4 rounded-2xl border flex flex-col items-center gap-3 ${
          isLight ? 'bg-slate-100/90 border-slate-200' : 'bg-[#150f28]/90 border-[#3b2d6a]'
        }`}>
          <div className="flex items-center justify-between w-full text-xs font-bold">
            <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>🎲 Interactive Jail Break Mini-Game:</span>
            <span className="text-amber-500 font-mono-code">Roll Doubles = +$50 Bonus</span>
          </div>

          {/* Dice Display */}
          <div className="flex items-center gap-4 my-1">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-mono-code border-2 shadow-lg transition-transform ${
              isRolling ? 'animate-spin scale-110' : 'hover:scale-105'
            } ${
              isLight ? 'bg-white border-indigo-300 text-[#7059e2]' : 'bg-[#20183e] border-[#7059e2] text-amber-300 shadow-[#7059e2]/30'
            }`}>
              {diceFaceMap[dice1] || dice1}
            </div>

            <div className="font-heading font-black text-lg text-slate-400">+</div>

            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-mono-code border-2 shadow-lg transition-transform ${
              isRolling ? 'animate-spin scale-110' : 'hover:scale-105'
            } ${
              isLight ? 'bg-white border-emerald-300 text-emerald-600' : 'bg-[#182822] border-emerald-500 text-emerald-300 shadow-emerald-500/30'
            }`}>
              {diceFaceMap[dice2] || dice2}
            </div>
          </div>

          <button
            onClick={handleRollDice}
            disabled={isRolling}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7059e2] to-emerald-600 hover:brightness-110 text-white font-heading font-black text-xs cursor-pointer shadow-md active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <span>🎲</span>
            <span>{isRolling ? 'Rolling Dice...' : 'Roll Dice to Escape 404'}</span>
          </button>

          {escapeStatus && (
            <div className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-3 py-1.5 rounded-xl animate-fade-in text-center">
              {escapeStatus}
            </div>
          )}
        </div>

        {/* Chance Card Flippable Widget */}
        <div 
          onClick={() => {
            sounds.playCardFlip();
            setChanceCardFlipped(!chanceCardFlipped);
          }}
          className={`w-full max-w-md p-3.5 rounded-2xl border cursor-pointer select-none transition-all hover:scale-[1.01] mb-6 ${
            chanceCardFlipped
              ? 'bg-amber-500 text-slate-900 border-amber-300 shadow-lg'
              : isLight
              ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
              : 'bg-amber-950/30 border-amber-500/30 text-amber-200 hover:bg-amber-950/50'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <span>❓</span>
              <span>{chanceCardFlipped ? 'CHANCE CARD REVEALED:' : 'Tap to Flip Lucky Chance Card'}</span>
            </span>
            <span className="text-[10px] font-mono-code uppercase opacity-80">
              {chanceCardFlipped ? 'Click to flip back' : 'Tap Card ➔'}
            </span>
          </div>
          {chanceCardFlipped ? (
            <p className="mt-2 text-xs font-heading font-bold text-slate-950 leading-relaxed text-left">
              "ADVANCE TO THE LOBBY! You are exempt from all property taxes and rent on missing routes. Claim your seat in the next multiplayer match!"
            </p>
          ) : (
            <p className="mt-1 text-[11px] opacity-75 text-left">
              Draw a community chest chance card to receive safe passage back to the board.
            </p>
          )}
        </div>

        {/* Search Room by Code direct form */}
        <form onSubmit={handleSearchRoom} className="w-full max-w-md flex items-center gap-2 mb-6">
          <input
            type="text"
            value={roomInput}
            onChange={e => setRoomInput(e.target.value)}
            placeholder="Have a Room Code? (e.g. LNU17)"
            className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs font-mono-code uppercase tracking-wider focus:outline-none focus:border-[#7059e2] ${
              isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#120e22] border-[#3b2d6a] text-white'
            }`}
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-[#7059e2] hover:bg-[#836df3] text-white font-heading font-bold text-xs cursor-pointer shadow-md transition-all whitespace-nowrap"
          >
            Join Match
          </button>
        </form>

        {/* Quick Action Navigation Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full max-w-lg">
          <button
            onClick={() => {
              sounds.playClick();
              onNavigateHome();
            }}
            className="p-3 rounded-xl bg-gradient-to-r from-[#7059e2] to-[#8a75fa] hover:brightness-110 text-white font-heading font-bold text-xs cursor-pointer shadow-lg transition-all flex flex-col items-center justify-center gap-1 active:scale-95"
          >
            <span className="text-lg">🏠</span>
            <span>Return Home</span>
          </button>

          {onNavigateStore && (
            <button
              onClick={() => {
                sounds.playClick();
                onNavigateStore();
              }}
              className={`p-3 rounded-xl border font-heading font-bold text-xs cursor-pointer transition-all flex flex-col items-center justify-center gap-1 active:scale-95 ${
                isLight 
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' 
                  : 'bg-[#18132d] hover:bg-[#221b3f] border-[#3b2d6a] text-white'
              }`}
            >
              <span className="text-lg">🛍️</span>
              <span>Shop Skins</span>
            </button>
          )}

          {onNavigateProfile && (
            <button
              onClick={() => {
                sounds.playClick();
                onNavigateProfile();
              }}
              className={`p-3 rounded-xl border font-heading font-bold text-xs cursor-pointer transition-all flex flex-col items-center justify-center gap-1 active:scale-95 ${
                isLight 
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' 
                  : 'bg-[#18132d] hover:bg-[#221b3f] border-[#3b2d6a] text-white'
              }`}
            >
              <span className="text-lg">🏆</span>
              <span>Leaderboard</span>
            </button>
          )}

          <button
            onClick={() => {
              sounds.playVictory();
              fireConfetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
              onNavigateHome();
            }}
            className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-heading font-bold text-xs cursor-pointer shadow-lg transition-all flex flex-col items-center justify-center gap-1 active:scale-95"
          >
            <span className="text-lg">💰</span>
            <span>Pass GO ($200)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
