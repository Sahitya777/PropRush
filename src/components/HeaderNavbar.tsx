import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { useSafeDynamic, useDynamicConfig } from '../context/DynamicIntegration';
import { useTheme } from '../context/ThemeContext';
import { AvatarCharacter } from './AvatarCharacter';
import { sounds } from '../utils/audio';
import { isUserAdmin } from '../utils/adminRegistry';

interface HeaderNavbarProps {
  currentView: 'home' | 'game' | 'store' | 'profile' | 'rankings' | 'admin' | '404';
  onNavigate: (view: 'home' | 'store' | 'profile' | 'rankings' | 'admin') => void;
  onOpenWallet: () => void;
  onOpenRules?: () => void;
  onOpenAuth?: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  roomCode?: string;
}

export const HeaderNavbar: React.FC<HeaderNavbarProps> = ({
  currentView,
  onNavigate,
  onOpenWallet,
  onOpenRules,
  isMuted,
  onToggleMute,
  roomCode
}) => {
  const { user, isLoggedIn, openAuthModal, requireAuth, logoutUser } = useUser();
  const { isDynamicConfigured } = useDynamicConfig();
  const { isLight, toggleTheme } = useTheme();
  const { isLoaded: isDynamicLoaded, isAuthenticated: isDynamicSignedIn, user: dynamicUser, primaryWallet, handleLogOut, setShowDynamicUserProfile, setShowAuthFlow } = useSafeDynamic();

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close user dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserDropdown]);

  // Handle ESC key to close drawer or dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDrawerOpen(false);
        setShowUserDropdown(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const effectiveIsLoggedIn = isLoggedIn || (isDynamicLoaded && !!isDynamicSignedIn);
  const walletAddress = primaryWallet?.address || user.walletAddress;
  const dynUserAny = dynamicUser as any;
  const effectiveUsername =
    (user.username && !/^0x[a-fA-F0-9]{10,}/i.test(user.username) ? user.username : null) ||
    (isDynamicSignedIn && (dynUserAny?.username || (dynUserAny?.firstName ? `${dynUserAny.firstName}${dynUserAny.lastName ? ` ${dynUserAny.lastName}` : ''}`.trim() : null) || dynUserAny?.alias)) ||
    user.username ||
    (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Player');
  const effectiveProfilePic = (isDynamicSignedIn && (dynamicUser?.ens?.avatar || dynamicUser?.profilePictureUrl)) || user.profilePictureUrl;
  const effectiveEmail = (isDynamicSignedIn && (dynamicUser?.email || dynamicUser?.verifiedCredentials?.find((c: any) => c.format === 'email')?.email)) || user.email;
  const isAdmin = isUserAdmin(effectiveEmail) || (effectiveEmail?.toLowerCase().includes('sahityanijhawan@gmail.com') ?? false);

  const handleWalletClick = () => {
    requireAuth('Connect your Web3 wallet or sign in with Dynamic to access your real-money wallet and deposit funds.', onOpenWallet);
  };

  const handleSignOut = async () => {
    sounds.playClick();
    setShowUserDropdown(false);
    setIsDrawerOpen(false);
    if (isDynamicSignedIn) {
      try {
        await handleLogOut();
      } catch (e) {
        console.error('Dynamic sign out error', e);
      }
    }
    logoutUser();
  };

  const handleDrawerNavigate = (view: 'home' | 'store' | 'profile' | 'rankings' | 'admin') => {
    sounds.playClick();
    setIsDrawerOpen(false);
    onNavigate(view);
  };

  return (
    <>
      <header className={`w-full backdrop-blur-md sticky top-0 z-40 transition-colors duration-200 ${
        isLight
          ? 'bg-white/95 border-b border-slate-200 text-slate-900 shadow-xs'
          : 'bg-[#141024]/95 border-b border-[#2b2447] text-white'
      }`}>
        {/* Primary Top Bar */}
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3">
          {/* Left Section: 3-Lines Hamburger Drawer Button (Mobile Only) + Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* 3-Lines Hamburger Menu Button - ONLY VISIBLE ON MOBILE (< md) */}
            <button
              id="btn-drawer-hamburger"
              type="button"
              onClick={() => {
                sounds.playClick();
                setIsDrawerOpen(true);
              }}
              className={`md:hidden w-9 h-9 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border shrink-0 active:scale-95 ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
                  : 'bg-[#1e1738] hover:bg-[#2a214d] border-[#372b5c] text-white'
              }`}
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <span className={`w-4.5 h-0.5 rounded-full ${isLight ? 'bg-slate-800' : 'bg-white'}`} />
              <span className={`w-4.5 h-0.5 rounded-full ${isLight ? 'bg-slate-800' : 'bg-white'}`} />
              <span className={`w-4.5 h-0.5 rounded-full ${isLight ? 'bg-slate-800' : 'bg-white'}`} />
            </button>

            {/* Brand Logo & Name */}
            <div
              onClick={() => onNavigate('home')}
              className="flex items-center gap-1.5 sm:gap-2 cursor-pointer group select-none"
            >
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg shadow-md flex items-center justify-center font-black text-xs sm:text-sm group-hover:rotate-6 transition-transform shrink-0 ${
                isLight ? 'bg-[#7059e2] text-white' : 'bg-white text-slate-900'
              }`}>
                🎲
              </div>
              <span className={`font-heading font-black text-base sm:text-lg tracking-tight flex items-center leading-none ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}>
                PROPRUSH
              </span>
            </div>
          </div>

          {/* Desktop Navigation & Actions (HIDDEN ON MOBILE, VISIBLE ON md+) */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {/* Sound Toggle (Desktop) */}
            <button
              id="btn-sound-toggle"
              onClick={onToggleMute}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer text-xs shrink-0 ${
                isLight
                  ? 'bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700'
                  : 'bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white'
              }`}
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>

            {/* Theme Toggle (Desktop) */}
            <button
              id="btn-theme-toggle"
              onClick={() => {
                sounds.playClick();
                toggleTheme();
              }}
              className={`h-8 px-2.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer text-xs font-bold shrink-0 ${
                isLight
                  ? 'bg-amber-100/80 hover:bg-amber-100 border border-amber-300/80 text-amber-900'
                  : 'bg-indigo-950/80 hover:bg-indigo-900/80 border border-indigo-700/60 text-indigo-200'
              }`}
              title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              <span>{isLight ? '🌙' : '☀️'}</span>
              <span className="text-[11px] font-mono-code">
                {isLight ? 'Dark' : 'Light'}
              </span>
            </button>

            {/* Wallet Balance ($ Wager system) */}
            <button
              id="btn-wallet-open"
              onClick={handleWalletClick}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono-code font-bold text-xs transition-all cursor-pointer shadow-xs shrink-0 ${
                isLight
                  ? 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800'
                  : 'bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300'
              }`}
              title="Real-Money Wallet Balance"
            >
              <span>💵</span>
              <span>${user.walletBalance.toFixed(2)}</span>
            </button>

            {/* Rankings & Leaderboard Button */}
            <button
              id="btn-nav-rankings"
              onClick={() => onNavigate('rankings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                currentView === 'rankings'
                  ? 'bg-[#7059e2] text-white shadow-sm border border-[#8e76f7]'
                  : isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-800'
              }`}
              title="Global Leaderboards & League Championship"
            >
              <span>🏆</span>
              <span>Rankings</span>
            </button>

            {/* Store & Coins Balance Button */}
            <button
              id="btn-nav-store"
              onClick={() => onNavigate('store')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                currentView === 'store'
                  ? 'bg-[#7059e2] text-white shadow-sm border border-[#8e76f7]'
                  : isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-800'
              }`}
              title="PropRush Store & Coins"
            >
              <span>🛒</span>
              <span className={`font-mono-code font-bold ${
                currentView === 'store' ? 'text-amber-200' : isLight ? 'text-amber-700' : 'text-amber-300'
              }`}>
                🪙 {user.coins}
              </span>
            </button>

            {/* Admin Console Button (Only if user has Admin rights) */}
            {isAdmin && (
              <button
                id="btn-nav-admin"
                onClick={() => onNavigate('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                  currentView === 'admin'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md border border-purple-400'
                    : 'bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 border border-purple-500/30'
                }`}
                title="Admin Command Center"
              >
                <span>🛡️</span>
                <span>Admin</span>
              </button>
            )}

            {/* Auth / Profile State */}
            {!effectiveIsLoggedIn ? (
              <button
                id="btn-nav-dynamic-signin"
                onClick={() => {
                  sounds.playClick();
                  setShowAuthFlow(true);
                }}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-heading font-black text-xs shadow-md shadow-indigo-500/25 transition-all cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
              >
                <span>✨</span>
                <span>Log in or sign up</span>
              </button>
            ) : (
              <div className="relative shrink-0" ref={dropdownRef}>
                <button
                  id="btn-nav-profile"
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className={`flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800'
                      : 'bg-slate-900 hover:bg-[#201838] border border-slate-800 hover:border-[#7059e2]/50 text-slate-200'
                  }`}
                  title="Your Player Profile & Locker"
                >
                  <AvatarCharacter
                    avatarId={user.avatar}
                    frameId={user.avatarFrame}
                    profilePictureUrl={effectiveProfilePic}
                    size="xs"
                  />
                  <span className="max-w-[100px] truncate text-xs">
                    {effectiveUsername}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-[9px] text-slate-400">▼</span>
                </button>

                {/* Dropdown Menu */}
                {showUserDropdown && (
                  <div className={`absolute right-0 mt-2 w-56 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 animate-fade-in border ${
                    isLight
                      ? 'bg-white border-slate-200 shadow-slate-300/50 text-slate-800'
                      : 'bg-[#17122b] border-[#372b5c] shadow-black/80 text-slate-200'
                  }`}>
                    <div className={`px-3 py-2 border-b space-y-1 ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                      <div className={`font-heading font-bold text-xs truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {effectiveUsername}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate font-mono-code">
                        {effectiveEmail || 'Dynamic Web3 User'}
                      </div>
                      {walletAddress && (
                        <div className={`flex items-center justify-between text-[10px] font-mono-code px-2 py-1 rounded-lg border ${
                          isLight ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-indigo-950/40 border-indigo-500/30 text-indigo-300'
                        }`}>
                          <span className="truncate">🔗 {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(walletAddress);
                              sounds.playClick();
                            }}
                            className="ml-1 text-xs hover:scale-110 cursor-pointer"
                            title="Copy Wallet Address"
                          >
                            📋
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        sounds.playClick();
                        setShowUserDropdown(false);
                        onNavigate('profile');
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                        isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-[#271f47] text-slate-200 hover:text-white'
                      }`}
                    >
                      <span>👤</span>
                      <span>Player Locker & Stats</span>
                    </button>

                    <button
                      onClick={() => {
                        sounds.playClick();
                        setShowUserDropdown(false);
                        setShowDynamicUserProfile(true);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                        isLight ? 'hover:bg-indigo-50 text-indigo-700' : 'hover:bg-indigo-950/40 text-indigo-300'
                      }`}
                    >
                      <span>🌐</span>
                      <span>Dynamic Web3 Settings</span>
                    </button>

                    <button
                      onClick={() => {
                        sounds.playClick();
                        setShowUserDropdown(false);
                        onNavigate('rankings');
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                        isLight ? 'hover:bg-purple-50 text-purple-700' : 'hover:bg-purple-950/40 text-purple-300'
                      }`}
                    >
                      <span>🏆</span>
                      <span>Rankings & Leagues</span>
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          sounds.playClick();
                          setShowUserDropdown(false);
                          onNavigate('admin');
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                          isLight ? 'hover:bg-purple-50 text-purple-800' : 'hover:bg-[#341d63] text-purple-300'
                        }`}
                      >
                        <span>🛡️</span>
                        <span>Admin Console</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        sounds.playClick();
                        setShowUserDropdown(false);
                        handleWalletClick();
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                        isLight ? 'hover:bg-emerald-50 text-emerald-700' : 'hover:bg-emerald-950/40 text-emerald-300'
                      }`}
                    >
                      <span>💵</span>
                      <span>Wallet (${user.walletBalance.toFixed(2)})</span>
                    </button>

                    <button
                      onClick={() => {
                        sounds.playClick();
                        setShowUserDropdown(false);
                        onNavigate('store');
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                        isLight ? 'hover:bg-amber-50 text-amber-700' : 'hover:bg-amber-950/40 text-amber-300'
                      }`}
                    >
                      <span>🛒</span>
                      <span>Store ({user.coins} Coins)</span>
                    </button>

                    <div className={`h-px my-1 ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`} />

                    <button
                      onClick={handleSignOut}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                        isLight ? 'hover:bg-rose-50 text-rose-600' : 'hover:bg-rose-950/40 text-rose-300 hover:text-rose-200'
                      }`}
                    >
                      <span>🚪</span>
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Slide-out Navigation Drawer (Like ASCESWAP Mobile Drawer Reference) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => {
              sounds.playClick();
              setIsDrawerOpen(false);
            }}
          />

          {/* Drawer Content Panel */}
          <div className={`relative w-72 sm:w-80 max-w-[85vw] h-full shadow-2xl flex flex-col justify-between z-10 transition-transform animate-slide-in-left border-r ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#120d24] border-[#2b2247] text-white'
          }`}>
            {/* Drawer Header */}
            <div>
              <div className={`flex items-center justify-between p-4 border-b ${
                isLight ? 'border-slate-200' : 'border-[#261e40]'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl shadow-md flex items-center justify-center font-black text-sm ${
                    isLight ? 'bg-[#7059e2] text-white' : 'bg-white text-slate-900'
                  }`}>
                    🎲
                  </div>
                  <span className="font-heading font-black text-lg tracking-tight">
                    PROPRUSH
                  </span>
                </div>

                {/* Close ✕ Button */}
                <button
                  id="btn-drawer-close"
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setIsDrawerOpen(false);
                  }}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold transition-all cursor-pointer ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-[#221a3f] hover:bg-[#2f2457] text-slate-200'
                  }`}
                  aria-label="Close navigation drawer"
                >
                  ✕
                </button>
              </div>

              {/* Navigation Links */}
              <div className="p-3 space-y-1.5">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Navigation
                </div>

                {/* Lobby */}
                <button
                  type="button"
                  onClick={() => handleDrawerNavigate('home')}
                  className={`w-full px-3.5 py-3 rounded-2xl font-bold text-sm flex items-center justify-between transition-all cursor-pointer ${
                    currentView === 'home'
                      ? 'bg-[#7059e2] text-white shadow-md'
                      : isLight
                      ? 'hover:bg-slate-100 text-slate-700'
                      : 'hover:bg-[#20183b] text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🏠</span>
                    <span>Lobby & Matches</span>
                  </div>
                  {currentView === 'home' && (
                    <span className="text-xs font-mono-code opacity-80">● Active</span>
                  )}
                </button>

                {/* Store */}
                <button
                  type="button"
                  onClick={() => handleDrawerNavigate('store')}
                  className={`w-full px-3.5 py-3 rounded-2xl font-bold text-sm flex items-center justify-between transition-all cursor-pointer ${
                    currentView === 'store'
                      ? 'bg-[#7059e2] text-white shadow-md'
                      : isLight
                      ? 'hover:bg-slate-100 text-slate-700'
                      : 'hover:bg-[#20183b] text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🛒</span>
                    <span>Cosmetics & Store</span>
                  </div>
                  <span className="text-xs font-mono-code font-bold text-amber-400">
                    🪙 {user.coins}
                  </span>
                </button>

                {/* Rankings & Leaderboards */}
                <button
                  type="button"
                  onClick={() => handleDrawerNavigate('rankings')}
                  className={`w-full px-3.5 py-3 rounded-2xl font-bold text-sm flex items-center justify-between transition-all cursor-pointer ${
                    currentView === 'rankings'
                      ? 'bg-[#7059e2] text-white shadow-md'
                      : isLight
                      ? 'hover:bg-purple-50 text-slate-700'
                      : 'hover:bg-[#20183b] text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🏆</span>
                    <span>Rankings & Leagues</span>
                  </div>
                  {currentView === 'rankings' && (
                    <span className="text-xs font-mono-code opacity-80">● Active</span>
                  )}
                </button>

                {/* Admin Console (if Admin) */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDrawerNavigate('admin')}
                    className={`w-full px-3.5 py-3 rounded-2xl font-bold text-sm flex items-center justify-between transition-all cursor-pointer ${
                      currentView === 'admin'
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                        : isLight
                        ? 'hover:bg-purple-100 text-purple-900 bg-purple-50'
                        : 'hover:bg-[#2b194f] text-purple-300 bg-purple-950/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🛡️</span>
                      <span>Admin Command Center</span>
                    </div>
                    {currentView === 'admin' && (
                      <span className="text-xs font-mono-code opacity-80">● Active</span>
                    )}
                  </button>
                )}

                {/* Player Profile & Locker */}
                <button
                  type="button"
                  onClick={() => handleDrawerNavigate('profile')}
                  className={`w-full px-3.5 py-3 rounded-2xl font-bold text-sm flex items-center justify-between transition-all cursor-pointer ${
                    currentView === 'profile'
                      ? 'bg-[#7059e2] text-white shadow-md'
                      : isLight
                      ? 'hover:bg-slate-100 text-slate-700'
                      : 'hover:bg-[#20183b] text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">👤</span>
                    <span>Locker & Profile</span>
                  </div>
                  {currentView === 'profile' && (
                    <span className="text-xs font-mono-code opacity-80">● Active</span>
                  )}
                </button>

                {/* Wallet / Cashier */}
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setIsDrawerOpen(false);
                    handleWalletClick();
                  }}
                  className={`w-full px-3.5 py-3 rounded-2xl font-bold text-sm flex items-center justify-between transition-all cursor-pointer ${
                    isLight
                      ? 'hover:bg-emerald-50 text-emerald-800'
                      : 'hover:bg-emerald-950/30 text-emerald-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">💵</span>
                    <span>Wallet & Cashier</span>
                  </div>
                  <span className="text-xs font-mono-code font-bold text-emerald-400">
                    ${user.walletBalance.toFixed(2)}
                  </span>
                </button>

                {/* Rules & Guide */}
                {onOpenRules && (
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setIsDrawerOpen(false);
                      onOpenRules();
                    }}
                    className={`w-full px-3.5 py-3 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all cursor-pointer ${
                      isLight
                        ? 'hover:bg-slate-100 text-slate-700'
                        : 'hover:bg-[#20183b] text-slate-300'
                    }`}
                  >
                    <span className="text-lg">📜</span>
                    <span>Game Rules & Guide</span>
                  </button>
                )}

                {/* Divider */}
                <div className={`h-px my-2 ${isLight ? 'bg-slate-200' : 'bg-[#261e40]'}`} />

                {/* Quick Preferences: Audio & Theme */}
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Settings
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      onToggleMute();
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800'
                        : 'bg-[#1a1433] border-[#2c224a] hover:bg-[#231b45] text-slate-200'
                    }`}
                  >
                    <span>{isMuted ? '🔇' : '🔊'}</span>
                    <span>{isMuted ? 'Muted' : 'Audio On'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      toggleTheme();
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      isLight
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-indigo-950/60 border-indigo-800/60 text-indigo-200'
                    }`}
                  >
                    <span>{isLight ? '🌙 Dark' : '☀️ Light'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Drawer Bottom / Auth Section */}
            <div className={`p-4 border-t ${isLight ? 'border-slate-200 bg-slate-50' : 'border-[#261e40] bg-[#0f0b1c]'}`}>
              {!effectiveIsLoggedIn ? (
                <button
                  type="button"
                  id="btn-drawer-dynamic-signin"
                  onClick={() => {
                    sounds.playClick();
                    setIsDrawerOpen(false);
                    setShowAuthFlow(true);
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-heading font-black text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                >
                  <span>✨</span>
                  <span>Log in or sign up</span>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <AvatarCharacter
                      avatarId={user.avatar}
                      frameId={user.avatarFrame}
                      profilePictureUrl={effectiveProfilePic}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-heading font-bold text-sm truncate">
                        {effectiveUsername}
                      </div>
                      <div className="text-xs text-slate-400 truncate font-mono-code">
                        {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : (effectiveEmail || 'Dynamic Web3 User')}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setIsDrawerOpen(false);
                      setShowDynamicUserProfile(true);
                    }}
                    className={`w-full py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isLight
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                        : 'bg-indigo-950/40 border-indigo-800/40 text-indigo-300 hover:bg-indigo-900/50'
                    }`}
                  >
                    <span>🌐</span>
                    <span>Dynamic Web3 Settings</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className={`w-full py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isLight
                        ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                        : 'bg-rose-950/30 border-rose-900/40 text-rose-300 hover:bg-rose-900/50'
                    }`}
                  >
                    <span>🚪</span>
                    <span>Disconnect / Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};


