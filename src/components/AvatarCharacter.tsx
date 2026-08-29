import React from 'react';

interface AvatarProps {
  avatarId: string;
  frameId?: string; // 'pfp_crown' | 'pfp_neon' | 'pfp_fire' | 'pfp_diamond' | 'pfp_cosmic' | 'pfp_electric' | 'pfp_rgb' | 'pfp_void' | 'pfp_sakura' | 'pfp_dragon' | 'none'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isAnimated?: boolean;
}

export const AvatarCharacter: React.FC<AvatarProps> = ({
  avatarId,
  frameId,
  size = 'md',
  className = '',
  isAnimated = true
}) => {
  const sizeClasses = {
    xs: 'w-5 h-5',
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20'
  }[size];

  const eyeSizeClasses = {
    xs: 'w-1 h-1',
    sm: 'w-1.5 h-1.5',
    md: 'w-2.5 h-2.5',
    lg: 'w-3.5 h-3.5',
    xl: 'w-5 h-5'
  }[size];

  const pupilSizeClasses = {
    xs: 'w-0.5 h-0.5',
    sm: 'w-0.5 h-0.5',
    md: 'w-1.5 h-1.5',
    lg: 'w-2 h-2',
    xl: 'w-2.5 h-2.5'
  }[size];

  const frameBadgeSize = {
    xs: 'text-[6px] -top-1 -right-0.5',
    sm: 'text-[8px] -top-1.5 -right-1',
    md: 'text-xs -top-2 -right-1.5',
    lg: 'text-sm -top-2.5 -right-2',
    xl: 'text-lg -top-3 -right-2.5'
  }[size];

  const renderSkinContent = () => {
    switch (avatarId) {
      case 'orange':
      case 'classic':
      case 'classic_blob':
      case 'sahi':
        return (
          <div className={`relative ${sizeClasses} rounded-full bg-gradient-to-b from-[#ff8c42] to-[#ff5722] flex flex-col items-center justify-center shadow-md border border-orange-300/60 overflow-hidden`}>
            <div className="flex gap-1 items-center z-10">
              <div className={`${eyeSizeClasses} bg-white rounded-full flex items-center justify-center shadow-inner`}>
                <div className={`${pupilSizeClasses} bg-slate-950 rounded-full`} />
              </div>
              <div className={`${eyeSizeClasses} bg-white rounded-full flex items-center justify-center shadow-inner`}>
                <div className={`${pupilSizeClasses} bg-slate-950 rounded-full`} />
              </div>
            </div>
            <div className="w-1.5 h-0.5 border-b border-orange-950 rounded-full mt-0.5 opacity-60" />
          </div>
        );

      case 'bu':
      case 'purple':
        return (
          <div className={`relative ${sizeClasses} rounded-full bg-gradient-to-b from-[#b066fe] to-[#8022ea] flex flex-col items-center justify-center shadow-md border border-purple-300/60 overflow-hidden`}>
            <div className="flex gap-1 items-center z-10">
              <div className={`${eyeSizeClasses} bg-white rounded-full flex items-center justify-center shadow-inner`}>
                <div className={`${pupilSizeClasses} bg-slate-950 rounded-full`} />
              </div>
              <div className={`${eyeSizeClasses} bg-white rounded-full flex items-center justify-center shadow-inner`}>
                <div className={`${pupilSizeClasses} bg-slate-950 rounded-full`} />
              </div>
            </div>
            <div className="flex justify-between w-3 mt-0.5 px-0.5">
              <div className="w-0.5 h-0.5 bg-pink-300 rounded-full" />
              <div className="w-0.5 h-0.5 bg-pink-300 rounded-full" />
            </div>
          </div>
        );

      case 'lilac':
        return (
          <div className={`relative ${sizeClasses} rounded-2xl bg-gradient-to-b from-[#c084fc] to-[#9333ea] flex flex-col items-center justify-center shadow-md border border-purple-200/80 overflow-hidden`}>
            <div className="flex gap-1 items-center z-10">
              <div className={`${eyeSizeClasses} bg-white rounded-full flex items-center justify-center shadow-inner`}>
                <div className={`${pupilSizeClasses} bg-purple-950 rounded-full`} />
              </div>
              <div className={`${eyeSizeClasses} bg-white rounded-full flex items-center justify-center shadow-inner`}>
                <div className={`${pupilSizeClasses} bg-purple-950 rounded-full`} />
              </div>
            </div>
            <div className="w-2 h-0.5 bg-purple-300/80 rounded-full mt-0.5" />
          </div>
        );

      case 'apple':
        return (
          <div className={`relative ${sizeClasses} rounded-full bg-gradient-to-b from-lime-400 to-green-600 flex items-center justify-center shadow-md border border-green-300/60`}>
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0.5 h-1.5 bg-amber-800 rounded-sm" />
            <div className="flex gap-1 items-center">
              <div className={`${eyeSizeClasses} bg-white rounded-full flex items-center justify-center shadow-inner`}>
                <div className={`${pupilSizeClasses} bg-slate-900 rounded-full`} />
              </div>
              <div className={`${eyeSizeClasses} bg-white rounded-full flex items-center justify-center shadow-inner`}>
                <div className={`${pupilSizeClasses} bg-slate-900 rounded-full`} />
              </div>
            </div>
          </div>
        );

      case 'fire':
        return (
          <div className={`relative ${sizeClasses} rounded-full bg-gradient-to-t from-red-600 via-orange-500 to-yellow-400 flex items-center justify-center shadow-md border border-orange-300/60`}>
            <div className="flex gap-1 items-center">
              <div className={`${eyeSizeClasses} bg-white rounded-full flex items-center justify-center shadow-inner`}>
                <div className={`${pupilSizeClasses} bg-slate-950 rounded-full`} />
              </div>
              <div className={`${eyeSizeClasses} bg-white rounded-full flex items-center justify-center shadow-inner`}>
                <div className={`${pupilSizeClasses} bg-slate-950 rounded-full`} />
              </div>
            </div>
          </div>
        );

      case 'ghost':
        return (
          <div className={`relative ${sizeClasses} rounded-t-full rounded-b-md bg-gradient-to-b from-slate-100 to-slate-300 flex items-center justify-center shadow-md border border-white/80`}>
            <div className="flex gap-1 items-center">
              <div className={`${eyeSizeClasses} bg-slate-900 rounded-full flex items-center justify-center`}>
                <div className={`${pupilSizeClasses} bg-cyan-300 rounded-full`} />
              </div>
              <div className={`${eyeSizeClasses} bg-slate-900 rounded-full flex items-center justify-center`}>
                <div className={`${pupilSizeClasses} bg-cyan-300 rounded-full`} />
              </div>
            </div>
          </div>
        );

      case 'cyber':
        return (
          <div className={`relative ${sizeClasses} rounded-xl bg-gradient-to-b from-cyan-600 to-slate-900 flex items-center justify-center shadow-md border border-cyan-400`}>
            <div className="w-3/4 h-2 bg-cyan-400 rounded-sm flex items-center justify-around shadow-[0_0_8px_#22d3ee]">
              <div className="w-0.5 h-0.5 bg-white rounded-full animate-pulse" />
              <div className="w-0.5 h-0.5 bg-white rounded-full animate-pulse" />
            </div>
          </div>
        );

      case 'king':
        return (
          <div className={`relative ${sizeClasses} rounded-full bg-gradient-to-b from-amber-300 to-yellow-500 flex items-center justify-center shadow-md border border-yellow-200`}>
            <div className="absolute -top-2 text-[10px] filter drop-shadow">👑</div>
            <div className="flex gap-1 items-center mt-0.5">
              <div className={`${eyeSizeClasses} bg-white rounded-full flex items-center justify-center shadow-inner`}>
                <div className={`${pupilSizeClasses} bg-amber-950 rounded-full`} />
              </div>
              <div className={`${eyeSizeClasses} bg-white rounded-full flex items-center justify-center shadow-inner`}>
                <div className={`${pupilSizeClasses} bg-amber-950 rounded-full`} />
              </div>
            </div>
          </div>
        );

      case 'ninja':
        return (
          <div className={`relative ${sizeClasses} rounded-full bg-gradient-to-b from-slate-800 to-slate-950 flex flex-col items-center justify-center shadow-md border border-slate-700`}>
            <div className="w-full h-2.5 bg-red-600/90 my-auto flex items-center justify-center">
              <div className="flex gap-1 items-center">
                <div className="w-1 h-0.5 bg-white rounded-sm" />
                <div className="w-1 h-0.5 bg-white rounded-sm" />
              </div>
            </div>
          </div>
        );

      case 'cat':
        return (
          <div className={`relative ${sizeClasses} rounded-full bg-gradient-to-b from-rose-500 to-pink-600 flex items-center justify-center shadow-md border border-pink-300`}>
            <div className="absolute -top-1 left-0.5 w-1.5 h-1.5 bg-pink-400 rotate-45 rounded-xs" />
            <div className="absolute -top-1 right-0.5 w-1.5 h-1.5 bg-pink-400 rotate-45 rounded-xs" />
            <div className="flex gap-1 items-center z-10">
              <div className={`${eyeSizeClasses} bg-cyan-200 rounded-full flex items-center justify-center shadow-[0_0_4px_#22d3ee]`}>
                <div className={`${pupilSizeClasses} bg-slate-950 rounded-full`} />
              </div>
              <div className={`${eyeSizeClasses} bg-cyan-200 rounded-full flex items-center justify-center shadow-[0_0_4px_#22d3ee]`}>
                <div className={`${pupilSizeClasses} bg-slate-950 rounded-full`} />
              </div>
            </div>
          </div>
        );

      case 'duck':
        return (
          <div className={`relative ${sizeClasses} rounded-full bg-gradient-to-b from-amber-300 to-yellow-400 flex flex-col items-center justify-center shadow-md border border-yellow-200`}>
            <div className="flex gap-1 items-center">
              <div className={`${eyeSizeClasses} bg-white rounded-full flex items-center justify-center`}>
                <div className={`${pupilSizeClasses} bg-slate-950 rounded-full`} />
              </div>
              <div className={`${eyeSizeClasses} bg-white rounded-full flex items-center justify-center`}>
                <div className={`${pupilSizeClasses} bg-slate-950 rounded-full`} />
              </div>
            </div>
            <div className="w-2.5 h-1 bg-orange-500 rounded-full mt-0.5 shadow-sm" />
          </div>
        );

      case 'boss':
        return (
          <div className={`relative ${sizeClasses} rounded-full bg-gradient-to-b from-slate-800 to-slate-950 flex flex-col items-center justify-center shadow-md border border-amber-500/60`}>
            <div className="w-4 h-1.5 bg-amber-400 rounded-xs flex items-center justify-around shadow-[0_0_5px_#facc15]">
              <div className="w-1 h-1 bg-slate-950 rounded-xs" />
              <div className="w-1 h-1 bg-slate-950 rounded-xs" />
            </div>
            <div className="w-1 h-1 bg-amber-500 rotate-45 mt-0.5" />
          </div>
        );

      case 'alien':
        return (
          <div className={`relative ${sizeClasses} rounded-full bg-gradient-to-b from-purple-500 via-indigo-600 to-slate-900 flex items-center justify-center shadow-md border border-purple-400`}>
            <div className="flex gap-1.5 items-center">
              <div className="w-2 h-2.5 bg-slate-950 rounded-full rotate-12 flex items-center justify-center border border-purple-300/40">
                <div className="w-0.5 h-0.5 bg-cyan-300 rounded-full" />
              </div>
              <div className="w-2 h-2.5 bg-slate-950 rounded-full -rotate-12 flex items-center justify-center border border-purple-300/40">
                <div className="w-0.5 h-0.5 bg-cyan-300 rounded-full" />
              </div>
            </div>
          </div>
        );

      case 'knight':
        return (
          <div className={`relative ${sizeClasses} rounded-lg bg-gradient-to-b from-slate-400 to-slate-700 flex flex-col items-center justify-center shadow-md border border-slate-300`}>
            <div className="w-full h-1 bg-amber-400 mb-0.5" />
            <div className="w-3/4 h-1.5 bg-slate-950 rounded-xs flex items-center justify-center">
              <div className="w-1.5 h-0.5 bg-cyan-400 rounded-xs animate-pulse" />
            </div>
          </div>
        );

      case 'dragon':
        return (
          <div className={`relative ${sizeClasses} rounded-full bg-gradient-to-b from-red-600 to-rose-950 flex flex-col items-center justify-center shadow-md border border-red-400`}>
            <div className="absolute -top-1 left-0.5 w-1 h-1.5 bg-amber-500 -rotate-12 rounded-sm" />
            <div className="absolute -top-1 right-0.5 w-1 h-1.5 bg-amber-500 rotate-12 rounded-sm" />
            <div className="flex gap-1 items-center">
              <div className={`${eyeSizeClasses} bg-yellow-400 rounded-full flex items-center justify-center`}>
                <div className="w-0.5 h-1.5 bg-slate-950 rounded-full" />
              </div>
              <div className={`${eyeSizeClasses} bg-yellow-400 rounded-full flex items-center justify-center`}>
                <div className="w-0.5 h-1.5 bg-slate-950 rounded-full" />
              </div>
            </div>
          </div>
        );

      case 'navy':
      default:
        return (
          <div className={`relative ${sizeClasses} rounded-full bg-gradient-to-b from-blue-500 to-indigo-600 flex items-center justify-center shadow-md border border-blue-300/50`}>
            <div className="flex gap-1 items-center">
              <div className={`${eyeSizeClasses} bg-white rounded-full flex items-center justify-center shadow-inner`}>
                <div className={`${pupilSizeClasses} bg-slate-900 rounded-full`} />
              </div>
              <div className={`${eyeSizeClasses} bg-white rounded-full flex items-center justify-center shadow-inner`}>
                <div className={`${pupilSizeClasses} bg-slate-900 rounded-full`} />
              </div>
            </div>
          </div>
        );
    }
  };

  // Discord Nitro-style Animated Profile Frame Effects
  const renderFramedAvatar = () => {
    if (!frameId || frameId === 'none') {
      return renderSkinContent();
    }

    switch (frameId) {
      case 'pfp_crown':
        return (
          <div className="relative inline-flex items-center justify-center p-1 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-200 to-amber-400 shadow-[0_0_15px_rgba(234,179,8,0.8)] ring-2 ring-yellow-300/80">
            <div className="absolute inset-0 rounded-full animate-spin-slow bg-gradient-to-r from-yellow-400/30 via-transparent to-amber-500/30 pointer-events-none" />
            {renderSkinContent()}
            <span className={`absolute ${frameBadgeSize} z-20 filter drop-shadow-md select-none animate-float`}>
              👑
            </span>
          </div>
        );

      case 'pfp_neon':
        return (
          <div className="relative inline-flex items-center justify-center p-1 rounded-full bg-gradient-to-tr from-cyan-500 via-sky-200 to-indigo-500 shadow-[0_0_15px_rgba(6,182,212,0.9)] ring-2 ring-cyan-300">
            <div className="absolute -inset-0.5 rounded-full border border-cyan-400/80 animate-spin-slow pointer-events-none border-dashed" />
            {renderSkinContent()}
            <span className={`absolute ${frameBadgeSize} z-20 filter drop-shadow-md select-none animate-pulse`}>
              ⚡
            </span>
          </div>
        );

      case 'pfp_fire':
        return (
          <div className="relative inline-flex items-center justify-center p-1.5 rounded-full bg-gradient-to-tr from-red-600 via-orange-500 to-yellow-400 shadow-[0_0_20px_rgba(249,115,22,0.9)] ring-2 ring-orange-400 animate-flame">
            <div className="absolute inset-0 rounded-full animate-spin-reverse-slow bg-gradient-to-t from-red-500/40 via-yellow-400/30 to-transparent pointer-events-none" />
            {renderSkinContent()}
            <span className={`absolute ${frameBadgeSize} z-20 filter drop-shadow-lg select-none`}>
              🔥
            </span>
          </div>
        );

      case 'pfp_diamond':
        return (
          <div className="relative inline-flex items-center justify-center p-1 rounded-full bg-gradient-to-tr from-sky-300 via-white to-blue-600 shadow-[0_0_18px_rgba(56,189,248,0.9)] ring-2 ring-sky-200">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-transparent via-sky-300/40 to-transparent animate-spin-fast pointer-events-none" />
            {renderSkinContent()}
            <span className={`absolute ${frameBadgeSize} z-20 filter drop-shadow-md select-none animate-bounce`}>
              💎
            </span>
          </div>
        );

      case 'pfp_cosmic':
        return (
          <div className="relative inline-flex items-center justify-center p-1.5 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-400 to-fuchsia-500 shadow-[0_0_22px_rgba(168,85,247,0.9)] ring-2 ring-purple-300 animate-cosmic">
            <div className="absolute -inset-1 rounded-full border-2 border-fuchsia-400/60 animate-spin-slow pointer-events-none" />
            <div className="absolute -inset-0.5 rounded-full border border-indigo-300/50 animate-spin-reverse-slow pointer-events-none" />
            {renderSkinContent()}
            <span className={`absolute ${frameBadgeSize} z-20 filter drop-shadow-lg select-none animate-spin-slow`}>
              ✨
            </span>
          </div>
        );

      case 'pfp_electric':
        return (
          <div className="relative inline-flex items-center justify-center p-1.5 rounded-full bg-gradient-to-tr from-cyan-400 via-blue-500 to-sky-300 shadow-[0_0_20px_rgba(56,189,248,0.95)] ring-2 ring-cyan-200 animate-electric">
            <div className="absolute -inset-1 rounded-full border-2 border-cyan-300 border-dashed animate-spin-fast pointer-events-none" />
            {renderSkinContent()}
            <span className={`absolute ${frameBadgeSize} z-20 filter drop-shadow-md select-none`}>
              ⚡
            </span>
          </div>
        );

      case 'pfp_rgb':
        return (
          <div className="relative inline-flex items-center justify-center p-1.5 rounded-full bg-gradient-to-tr from-red-500 via-green-500 to-blue-500 shadow-[0_0_24px_rgba(236,72,153,0.9)] ring-2 ring-white animate-rainbow">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-yellow-400 via-pink-500 to-cyan-400 animate-spin-slow opacity-75 blur-xs pointer-events-none" />
            {renderSkinContent()}
            <span className={`absolute ${frameBadgeSize} z-20 filter drop-shadow-lg select-none`}>
              🌈
            </span>
          </div>
        );

      case 'pfp_void':
        return (
          <div className="relative inline-flex items-center justify-center p-1.5 rounded-full bg-gradient-to-tr from-purple-950 via-violet-800 to-slate-950 shadow-[0_0_22px_rgba(107,33,168,0.95)] ring-2 ring-violet-500 animate-void">
            <div className="absolute -inset-1 rounded-full border border-purple-500/80 animate-spin-slow pointer-events-none" />
            {renderSkinContent()}
            <span className={`absolute ${frameBadgeSize} z-20 filter drop-shadow-lg select-none`}>
              🔮
            </span>
          </div>
        );

      case 'pfp_sakura':
        return (
          <div className="relative inline-flex items-center justify-center p-1.5 rounded-full bg-gradient-to-tr from-pink-400 via-rose-300 to-pink-500 shadow-[0_0_18px_rgba(244,114,182,0.85)] ring-2 ring-pink-200">
            <div className="absolute -inset-0.5 rounded-full border border-pink-300/80 animate-spin-slow pointer-events-none" />
            {renderSkinContent()}
            <span className={`absolute ${frameBadgeSize} z-20 filter drop-shadow-md select-none animate-float`}>
              🌸
            </span>
          </div>
        );

      case 'pfp_dragon':
        return (
          <div className="relative inline-flex items-center justify-center p-2 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-300 to-red-600 shadow-[0_0_28px_rgba(245,158,11,0.95)] ring-2 ring-yellow-400 animate-flame">
            <div className="absolute -inset-1.5 rounded-full border-2 border-yellow-300/80 border-dashed animate-spin-slow pointer-events-none" />
            {renderSkinContent()}
            <span className={`absolute ${frameBadgeSize} z-20 filter drop-shadow-xl select-none animate-pulse`}>
              🐉
            </span>
          </div>
        );

      default:
        return renderSkinContent();
    }
  };

  return (
    <div className={`inline-flex items-center justify-center select-none ${isAnimated ? 'hover:scale-105 transition-transform' : ''} ${className}`}>
      {renderFramedAvatar()}
    </div>
  );
};
