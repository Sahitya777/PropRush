import React, { useState } from 'react';
import { DynamicWidget } from '@dynamic-labs/sdk-react-core';
import { useSafeDynamic, useDynamicConfig } from '../context/DynamicIntegration';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { sounds } from '../utils/audio';

interface DynamicActiveAuthProps {
  onClose: () => void;
  onOpenConfig?: () => void;
}

class SafeWidgetBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: any) {
    console.warn('[DynamicWidget caught]:', err);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export const DynamicActiveAuth: React.FC<DynamicActiveAuthProps> = ({ onClose, onOpenConfig }) => {
  const { environmentId, isDynamicConfigured } = useDynamicConfig();
  const { isAuthenticated, user: dynamicUser, primaryWallet, setShowAuthFlow, handleLogOut, setShowDynamicUserProfile } = useSafeDynamic();
  const { user, isLoggedIn, logoutUser } = useUser();
  const { isLight } = useTheme();

  const [copied, setCopied] = useState(false);

  const effectiveSignedIn = isLoggedIn || (isAuthenticated && Boolean(primaryWallet || dynamicUser));
  const currentWalletAddress = primaryWallet?.address || user.walletAddress;

  const handleCopyWallet = () => {
    if (currentWalletAddress) {
      navigator.clipboard.writeText(currentWalletAddress);
      setCopied(true);
      sounds.playClick();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnectWallet = () => {
    sounds.playClick();
    try {
      setShowAuthFlow(true);
    } catch {
      // ignore
    }
    // Also dispatch click on the embedded dynamic widget button if present
    setTimeout(() => {
      const widgetBtn = document.querySelector('.dynamic-widget-inline-controls button, [data-testid="dynamic-widget-button"], .dynamic-shadow-dom-container button') as HTMLButtonElement | null;
      if (widgetBtn) {
        widgetBtn.click();
      }
    }, 50);
  };

  const handleManageProfile = () => {
    sounds.playClick();
    setShowDynamicUserProfile(true);
  };

  const handleSignOut = async () => {
    sounds.playClick();
    try {
      await handleLogOut();
    } catch (e) {
      console.error('Dynamic logout error', e);
    }
    logoutUser();
    onClose();
  };

  // If user is actively logged in, display their connected account card
  if (effectiveSignedIn) {
    return (
      <div className="flex flex-col gap-4">
        <div className={`p-4 rounded-2xl border space-y-3 ${
          isLight ? 'bg-emerald-50/70 border-emerald-200' : 'bg-emerald-950/20 border-emerald-800/40'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className={`text-xs font-black uppercase tracking-wider ${
                isLight ? 'text-emerald-900' : 'text-emerald-400'
              }`}>
                Authenticated & Connected
              </span>
            </div>
            <span className={`text-[10px] font-mono-code px-2 py-0.5 rounded-full border ${
              isLight ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-emerald-900/50 border-emerald-700 text-emerald-300'
            }`}>
              {primaryWallet?.chain || 'Ethereum / EVM'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-lg font-black text-white shadow-sm shrink-0">
              {user.username ? user.username.slice(0, 1).toUpperCase() : '👤'}
            </div>
            <div className="min-w-0 flex-1">
              <span className={`font-heading font-black text-sm block truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {user.username || 'Web3 Player'}
              </span>
              <span className="text-xs text-slate-400 block truncate font-mono-code">
                {user.email || 'Web3 Wallet Authenticated'}
              </span>
            </div>
          </div>

          {currentWalletAddress && (
            <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
              isLight ? 'bg-white border-emerald-200' : 'bg-[#0d0a18] border-slate-800'
            }`}>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] text-slate-400 block uppercase font-mono-code">Public Address</span>
                <span className="text-xs font-mono-code font-bold truncate block text-purple-400">
                  {currentWalletAddress}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyWallet}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  copied 
                    ? 'bg-emerald-500 text-white' 
                    : isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {isAuthenticated && (
              <button
                type="button"
                onClick={handleManageProfile}
                className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>⚙️</span>
                <span>Dynamic Profile</span>
              </button>
            )}
            <button
              type="button"
              id="btn-auth-disconnect"
              onClick={handleSignOut}
              className="flex-1 py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer text-center"
            >
              Sign Out / Disconnect
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Dynamic Native Web3 Authentication */}
      <div className="flex flex-col gap-3">
        <div className={`flex flex-col items-center justify-center p-5 rounded-2xl border text-center gap-3 ${
          isLight
            ? 'bg-gradient-to-b from-indigo-50/70 to-purple-50/40 border-indigo-200/80 shadow-xs'
            : 'bg-gradient-to-b from-indigo-950/30 to-purple-950/20 border-indigo-500/20'
        }`}>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20">
            ⚡
          </div>
          <div>
            <h4 className={`font-heading font-black text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Dynamic Authentication
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Connect any Web3 wallet (MetaMask, Coinbase, Phantom, WalletConnect) or log in with Email and Socials.
            </p>
          </div>

          {/* Primary Action Button to trigger Dynamic Auth Modal */}
          <button
            id="btn-dynamic-auth-flow"
            type="button"
            onClick={handleConnectWallet}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-heading font-black text-sm shadow-lg shadow-indigo-500/30 transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2"
          >
            <span>🔗</span>
            <span>Connect Wallet / Log In</span>
          </button>

          {/* Native Embedded DynamicWidget */}
          <div className="w-full flex justify-center pt-2">
            <SafeWidgetBoundary>
              <DynamicWidget />
            </SafeWidgetBoundary>
          </div>
        </div>

        {/* Supported Providers List */}
        <div className="grid grid-cols-4 gap-2 pt-1 text-center">
          {[
            { name: 'MetaMask', icon: '🦊' },
            { name: 'Coinbase', icon: '🔵' },
            { name: 'Phantom', icon: '👻' },
            { name: 'Social/Email', icon: '✨' },
          ].map(w => (
            <button
              type="button"
              key={w.name}
              onClick={handleConnectWallet}
              className={`p-2 rounded-xl border text-center transition-all cursor-pointer hover:scale-102 ${
                isLight 
                  ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700' 
                  : 'bg-slate-900/60 hover:bg-slate-800 border-slate-800 text-slate-300'
              }`}
            >
              <span className="text-lg block">{w.icon}</span>
              <span className="text-[10px] font-bold block truncate mt-0.5">{w.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
