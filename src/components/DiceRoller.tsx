import React, { useState } from 'react';
import { sounds } from '../utils/audio';

interface DiceRollerProps {
  dice: [number, number];
  isDouble: boolean;
  isRolling: boolean;
  canRoll: boolean;
  onRoll: () => void;
  timer: number;
  fastSpeed?: boolean;
  diceSkin?: string;
}

export const DiceRoller: React.FC<DiceRollerProps> = ({
  dice,
  isDouble,
  isRolling,
  canRoll,
  onRoll,
  timer,
  fastSpeed = false,
  diceSkin = 'standard'
}) => {
  const [localRolling, setLocalRolling] = useState(false);

  const handleRollClick = () => {
    if (!canRoll || isRolling || localRolling) return;
    setLocalRolling(true);
    sounds.playDiceRoll();
    onRoll();
    setTimeout(() => {
      setLocalRolling(false);
    }, fastSpeed ? 350 : 650);
  };

  const getDiceStyle = () => {
    switch (diceSkin) {
      case 'dice_golden':
        return {
          bg: 'bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600 border-amber-200',
          dot: 'bg-amber-950 shadow-[0_0_3px_#78350f]',
          glow: 'shadow-[0_0_18px_rgba(245,158,11,0.6)]'
        };
      case 'dice_neon':
        return {
          bg: 'bg-gradient-to-br from-fuchsia-500 via-pink-600 to-purple-800 border-pink-300',
          dot: 'bg-white shadow-[0_0_6px_#f472b6]',
          glow: 'shadow-[0_0_18px_rgba(236,72,153,0.7)]'
        };
      case 'dice_ruby':
        return {
          bg: 'bg-gradient-to-br from-red-500 via-rose-700 to-red-950 border-red-300',
          dot: 'bg-amber-300 shadow-[0_0_5px_#fde047]',
          glow: 'shadow-[0_0_18px_rgba(239,68,68,0.7)]'
        };
      case 'dice_magma':
        return {
          bg: 'bg-gradient-to-br from-orange-500 via-red-600 to-slate-950 border-orange-400',
          dot: 'bg-yellow-300 shadow-[0_0_6px_#facc15] animate-pulse',
          glow: 'shadow-[0_0_20px_rgba(249,115,22,0.8)]'
        };
      case 'dice_cyber':
        return {
          bg: 'bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900 border-cyan-400',
          dot: 'bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse',
          glow: 'shadow-[0_0_20px_rgba(6,182,212,0.7)]'
        };
      case 'dice_cosmic':
        return {
          bg: 'bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-950 border-purple-400',
          dot: 'bg-fuchsia-300 shadow-[0_0_8px_#e879f9]',
          glow: 'shadow-[0_0_22px_rgba(168,85,247,0.8)]'
        };
      case 'dice_rainbow':
        return {
          bg: 'bg-gradient-to-br from-rose-500 via-emerald-500 to-sky-600 border-white',
          dot: 'bg-white shadow-[0_0_6px_#ffffff]',
          glow: 'shadow-[0_0_22px_rgba(56,189,248,0.8)]'
        };
      case 'dice_dragon':
        return {
          bg: 'bg-gradient-to-br from-emerald-600 via-teal-800 to-emerald-950 border-emerald-300',
          dot: 'bg-amber-400 shadow-[0_0_6px_#fbbf24]',
          glow: 'shadow-[0_0_20px_rgba(16,185,129,0.8)]'
        };
      default:
        return {
          bg: 'bg-gradient-to-br from-white via-slate-100 to-slate-200 border-white/80',
          dot: 'bg-slate-900 shadow-inner',
          glow: 'shadow-lg'
        };
    }
  };

  const style = getDiceStyle();

  const renderDots = (value: number) => {
    const dotsMap: Record<number, number[]> = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8]
    };

    const activeIndices = dotsMap[value] || [4];

    return (
      <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-1.5 gap-0.5">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(idx => (
          <div key={idx} className="flex items-center justify-center">
            {activeIndices.includes(idx) && (
              <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  const rollingNow = isRolling || localRolling;

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-3 bg-[#191428]/90 backdrop-blur-md rounded-2xl border border-[#7059e2]/30 shadow-2xl">
      {/* Dice Face Container */}
      <div className="flex items-center gap-4">
        {/* Die 1 */}
        <div
          className={`w-14 h-14 ${style.bg} ${style.glow} rounded-xl border-2 flex items-center justify-center transition-all ${
            rollingNow ? 'animate-dice-roll scale-110' : 'scale-100 hover:rotate-3'
          }`}
          style={{
            boxShadow: '0 8px 16px -2px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.4)'
          }}
        >
          {renderDots(dice[0])}
        </div>

        {/* Die 2 */}
        <div
          className={`w-14 h-14 ${style.bg} ${style.glow} rounded-xl border-2 flex items-center justify-center transition-all ${
            rollingNow ? 'animate-dice-roll scale-110' : 'scale-100 hover:-rotate-3'
          }`}
          style={{
            boxShadow: '0 8px 16px -2px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.4)',
            animationDelay: '0.08s'
          }}
        >
          {renderDots(dice[1])}
        </div>
      </div>

      {/* Info Tag: Total and Double indicator */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold font-mono-code px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
          Roll: {dice[0] + dice[1]}
        </span>
        {isDouble && (
          <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse">
            🎲 DOUBLES! +1 Turn
          </span>
        )}
      </div>

      {/* Action Button */}
      {canRoll && (
        <button
          id="btn-roll-dice"
          onClick={handleRollClick}
          disabled={rollingNow}
          className="w-full py-2.5 px-6 rounded-xl font-heading font-extrabold text-base tracking-wide bg-gradient-to-r from-[#7059e2] to-[#8e76f7] hover:from-[#6047d8] hover:to-[#7f63f3] active:scale-95 text-white shadow-[0_0_20px_rgba(112,89,226,0.6)] transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <span className="text-lg">🎲</span>
          <span>{rollingNow ? 'Rolling...' : 'ROLL DICE'}</span>
          <span className="ml-1 text-xs opacity-80 font-mono-code">({timer}s)</span>
        </button>
      )}
    </div>
  );
};
