import React from 'react';

interface DiceFaceMiniProps {
  skinId?: string;
  pips?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const DiceFaceMini: React.FC<DiceFaceMiniProps> = ({
  skinId = 'dice_golden',
  pips = 5,
  size = 'md',
  className = ''
}) => {
  const getSkinStyle = () => {
    switch (skinId) {
      case 'dice_golden':
        return {
          bg: 'bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600 border-amber-200',
          dot: 'bg-amber-950 shadow-[0_0_2px_#78350f]',
          glow: 'shadow-[0_0_12px_rgba(245,158,11,0.5)]'
        };
      case 'dice_neon':
        return {
          bg: 'bg-gradient-to-br from-fuchsia-500 via-pink-600 to-purple-800 border-pink-300',
          dot: 'bg-white shadow-[0_0_4px_#f472b6]',
          glow: 'shadow-[0_0_12px_rgba(236,72,153,0.6)]'
        };
      case 'dice_ruby':
        return {
          bg: 'bg-gradient-to-br from-red-500 via-rose-700 to-red-950 border-red-300',
          dot: 'bg-amber-300 shadow-[0_0_3px_#fde047]',
          glow: 'shadow-[0_0_12px_rgba(239,68,68,0.6)]'
        };
      case 'dice_magma':
        return {
          bg: 'bg-gradient-to-br from-orange-500 via-red-600 to-slate-950 border-orange-400',
          dot: 'bg-yellow-300 shadow-[0_0_4px_#facc15] animate-pulse',
          glow: 'shadow-[0_0_14px_rgba(249,115,22,0.7)]'
        };
      case 'dice_cyber':
        return {
          bg: 'bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900 border-cyan-400',
          dot: 'bg-cyan-400 shadow-[0_0_6px_#22d3ee] animate-pulse',
          glow: 'shadow-[0_0_14px_rgba(6,182,212,0.6)]'
        };
      case 'dice_cosmic':
        return {
          bg: 'bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-950 border-purple-400',
          dot: 'bg-fuchsia-300 shadow-[0_0_5px_#e879f9]',
          glow: 'shadow-[0_0_14px_rgba(168,85,247,0.7)]'
        };
      case 'dice_rainbow':
        return {
          bg: 'bg-gradient-to-br from-rose-500 via-emerald-500 to-sky-600 border-white',
          dot: 'bg-white shadow-[0_0_4px_#ffffff]',
          glow: 'shadow-[0_0_14px_rgba(56,189,248,0.7)]'
        };
      case 'dice_dragon':
        return {
          bg: 'bg-gradient-to-br from-emerald-600 via-teal-800 to-emerald-950 border-emerald-300',
          dot: 'bg-amber-400 shadow-[0_0_4px_#fbbf24]',
          glow: 'shadow-[0_0_14px_rgba(16,185,129,0.7)]'
        };
      default:
        return {
          bg: 'bg-gradient-to-br from-white via-slate-100 to-slate-200 border-slate-300',
          dot: 'bg-slate-900 shadow-inner',
          glow: 'shadow-md'
        };
    }
  };

  const style = getSkinStyle();

  const dotsMap: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };

  const activeIndices = dotsMap[pips] || [4];

  const sizeClasses = {
    sm: 'w-7 h-7 rounded-lg border p-0.5',
    md: 'w-10 h-10 rounded-xl border-2 p-1',
    lg: 'w-16 h-16 rounded-2xl border-2 p-1.5'
  }[size];

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3'
  }[size];

  return (
    <div
      className={`${sizeClasses} ${style.bg} ${style.glow} flex items-center justify-center transition-all ${className}`}
      style={{
        boxShadow: '0 4px 10px -1px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.4)'
      }}
    >
      <div className="grid grid-cols-3 grid-rows-3 w-full h-full gap-0.5">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(idx => (
          <div key={idx} className="flex items-center justify-center">
            {activeIndices.includes(idx) && (
              <div className={`${dotSizes} rounded-full ${style.dot}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
