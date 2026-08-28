import React from 'react';
import { useUser } from '../context/UserContext';
import { AvatarCharacter } from './AvatarCharacter';
import { sounds } from '../utils/audio';

interface HeaderNavbarProps {
  currentView: 'home' | 'game' | 'store' | 'profile';
  onNavigate: (view: 'home' | 'store' | 'profile') => void;
  onOpenWallet: () => void;
  onOpenRules?: () => void;
  onOpenAuth?: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const HeaderNavbar: React.FC<HeaderNavbarProps> = ({
  currentView,
  onNavigate,
  onOpenWallet,
  isMuted,
  onToggleMute
}) => {
  const { user } = useUser();

  return (
    <header className="w-full bg-[#141024]/90 backdrop-blur-md border-b border-[#2b2447] px-4 py-2.5 flex items-center justify-between sticky top-0 z-40">
      {/* Left: Sound Toggle + Logo */}
      <div className="flex items-center gap-3">
        {/* Sound Toggle */}
        <button
          id="btn-sound-toggle"
          onClick={onToggleMute}
          className="w-8 h-8 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>

        {/* Brand Logo */}
        <div
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 cursor-pointer group select-none"
        >
          <div className="w-8 h-8 bg-white rounded-lg shadow-md flex items-center justify-center text-slate-900 font-black text-sm group-hover:rotate-6 transition-transform">
            🎲
          </div>
          <div className="flex flex-col">
            <span className="font-heading font-black text-lg sm:text-xl tracking-tight text-white flex items-center">
              RICHUP<span className="text-[#7059e2]">.IO</span>
            </span>
          </div>
        </div>
      </div>

      {/* Center/Right Items */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Wallet Balance ($ Wager system) */}
        <button
          id="btn-wallet-open"
          onClick={onOpenWallet}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 font-mono-code font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-sm"
          title="Deposit/Withdraw & Wager Balance"
        >
          <span>💵</span>
          <span>${user.walletBalance.toFixed(2)}</span>
          <span className="text-[10px] bg-emerald-500/20 px-1 py-0.2 rounded text-emerald-400 hidden sm:inline">
            + DEPOSIT
          </span>
        </button>

        {/* Unified Store & Coins Balance Button */}
        <button
          id="btn-nav-store"
          onClick={() => onNavigate('store')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            currentView === 'store'
              ? 'bg-[#7059e2] text-white shadow-[0_0_14px_rgba(112,89,226,0.6)] border border-[#8e76f7]'
              : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-[#7059e2]/50'
          }`}
          title="RichUp Store & Coins"
        >
          <span className="flex items-center gap-1">
            <span>🛒</span>
            <span className="font-heading font-black">STORE</span>
          </span>
          <span className="h-3.5 w-px bg-slate-700" />
          <span className="flex items-center gap-1 text-amber-300 font-mono-code font-bold text-xs">
            <span>🪙</span>
            <span>{user.coins}</span>
          </span>
        </button>

        {/* User Profile / Login */}
        <button
          id="btn-nav-profile"
          onClick={() => onNavigate('profile')}
          className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-slate-900 hover:bg-[#201838] border border-slate-800 text-xs font-bold text-slate-200 transition-all cursor-pointer"
        >
          <AvatarCharacter avatarId={user.avatar} frameId={user.avatarFrame} size="xs" />
          <span className="hidden sm:inline max-w-[80px] truncate">{user.username}</span>
        </button>
      </div>
    </header>
  );
};
