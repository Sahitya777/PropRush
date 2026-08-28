import React from 'react';

interface AvatarProps {
  avatarId: string;
  frameId?: string; // e.g. 'pfp_crown' | 'pfp_neon' | 'pfp_fire' | 'pfp_diamond' | 'none'
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

  // Specific skins styling
  const renderSkinContent = () => {
    switch (avatarId) {
      case 'orange':
      case 'classic':
      case 'classic_blob':
      case 'sahi':
        return (
          <div className={`relative ${sizeClasses} rounded-full bg-gradient-to-b from-[#ff8c42] to-[#ff5722] flex flex-col items-center justify-center shadow-md border border-orange-300/60 overflow-hidden`}>
            {/* Eyes */}
            <div className="flex gap-1 items-center z-10">
              <div className={`${eyeSizeClasses} bg-white rounded-full flex items-center justify-center shadow-inner`}>
                <div className={`${pupilSizeClasses} bg-slate-950 rounded-full`} />
              </div>
              <div className={`${eyeSizeClasses} bg-white rounded-full flex items-center justify-center shadow-inner`}>
                <div className={`${pupilSizeClasses} bg-slate-950 rounded-full`} />
              </div>
            </div>
            {/* Smile */}
            <div className="w-1.5 h-0.5 border-b border-orange-950 rounded-full mt-0.5 opacity-60" />
          </div>
        );

      case 'bu':
      case 'purple':
      case 'lilac':
        return (
          <div className={`relative ${sizeClasses} rounded-full bg-gradient-to-b from-[#b066fe] to-[#8022ea] flex flex-col items-center justify-center shadow-md border border-purple-300/60 overflow-hidden`}>
            {/* Eyes */}
            <div className="flex gap-1 items-center z-10">
              <div className={`${eyeSizeClasses} bg-white rounded-full flex items-center justify-center shadow-inner`}>
                <div className={`${pupilSizeClasses} bg-slate-950 rounded-full`} />
              </div>
              <div className={`${eyeSizeClasses} bg-white rounded-full flex items-center justify-center shadow-inner`}>
                <div className={`${pupilSizeClasses} bg-slate-950 rounded-full`} />
              </div>
            </div>
            {/* Cute blush */}
            <div className="flex justify-between w-3 mt-0.5 px-0.5">
              <div className="w-0.5 h-0.5 bg-pink-300 rounded-full" />
              <div className="w-0.5 h-0.5 bg-pink-300 rounded-full" />
            </div>
          </div>
        );

      case 'apple':
        return (
          <div className={`relative ${sizeClasses} rounded-full bg-gradient-to-b from-lime-400 to-green-500 flex items-center justify-center shadow-md border border-green-300/60`}>
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
          <div className={`relative ${sizeClasses} rounded-t-full rounded-b-md bg-gradient-to-b from-slate-100 to-slate-300 flex items-center justify-center shadow-md border border-white/60`}>
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
            <div className="w-3/4 h-2 bg-cyan-400 rounded-sm flex items-center justify-around shadow-[0_0_6px_#22d3ee]">
              <div className="w-0.5 h-0.5 bg-white rounded-full animate-pulse" />
              <div className="w-0.5 h-0.5 bg-white rounded-full animate-pulse" />
            </div>
          </div>
        );

      case 'king':
        return (
          <div className={`relative ${sizeClasses} rounded-full bg-gradient-to-b from-amber-300 to-yellow-500 flex items-center justify-center shadow-md border border-yellow-200`}>
            <div className="absolute -top-2 text-[10px]">👑</div>
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

  // Render Frame Container if frameId is specified
  const renderFramedAvatar = () => {
    if (!frameId || frameId === 'none') {
      return renderSkinContent();
    }

    switch (frameId) {
      case 'pfp_crown':
        return (
          <div className="relative inline-flex items-center justify-center p-0.5 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-200 to-amber-400 shadow-[0_0_10px_rgba(234,179,8,0.7)] ring-1.5 ring-yellow-300">
            {renderSkinContent()}
            <span className={`absolute ${frameBadgeSize} z-20 filter drop-shadow-md select-none`}>
              👑
            </span>
          </div>
        );

      case 'pfp_neon':
        return (
          <div className="relative inline-flex items-center justify-center p-0.5 rounded-full bg-gradient-to-tr from-cyan-500 via-sky-200 to-indigo-500 shadow-[0_0_10px_rgba(6,182,212,0.8)] ring-1.5 ring-cyan-300">
            {renderSkinContent()}
            <span className={`absolute ${frameBadgeSize} z-20 filter drop-shadow-md select-none`}>
              ⚡
            </span>
          </div>
        );

      case 'pfp_fire':
        return (
          <div className="relative inline-flex items-center justify-center p-0.5 rounded-full bg-gradient-to-tr from-red-600 via-orange-400 to-yellow-300 shadow-[0_0_10px_rgba(249,115,22,0.8)] ring-1.5 ring-orange-400">
            {renderSkinContent()}
            <span className={`absolute ${frameBadgeSize} z-20 filter drop-shadow-md select-none`}>
              🔥
            </span>
          </div>
        );

      case 'pfp_diamond':
        return (
          <div className="relative inline-flex items-center justify-center p-0.5 rounded-full bg-gradient-to-tr from-sky-400 via-teal-100 to-blue-500 shadow-[0_0_10px_rgba(56,189,248,0.8)] ring-1.5 ring-sky-300">
            {renderSkinContent()}
            <span className={`absolute ${frameBadgeSize} z-20 filter drop-shadow-md select-none`}>
              💎
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
