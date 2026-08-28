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
}

export const DiceRoller: React.FC<DiceRollerProps> = ({
  dice,
  isDouble,
  isRolling,
  canRoll,
  onRoll,
  timer,
  fastSpeed = false
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

  const renderDots = (value: number) => {
    // 3x3 grid dots placement
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
              <div className="w-2.5 h-2.5 bg-slate-900 rounded-full shadow-inner" />
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
          className={`w-14 h-14 bg-gradient-to-br from-white via-slate-100 to-slate-200 rounded-xl shadow-lg border-2 border-white/80 flex items-center justify-center transition-all ${
            rollingNow ? 'animate-dice-roll scale-110' : 'scale-100 hover:rotate-3'
          }`}
          style={{
            boxShadow: '0 8px 16px -2px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.9)'
          }}
        >
          {renderDots(dice[0])}
        </div>

        {/* Die 2 */}
        <div
          className={`w-14 h-14 bg-gradient-to-br from-white via-slate-100 to-slate-200 rounded-xl shadow-lg border-2 border-white/80 flex items-center justify-center transition-all ${
            rollingNow ? 'animate-dice-roll scale-110' : 'scale-100 hover:-rotate-3'
          }`}
          style={{
            boxShadow: '0 8px 16px -2px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.9)',
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
