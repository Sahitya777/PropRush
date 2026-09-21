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
  const { user, isLoggedIn, loginWithGoogle, syncDynamicUser, logoutUser } = useUser();
  const { isLight } = useTheme();

  const [copied, setCopied] = useState(false);
  const [demoWallet, setDemoWallet] = useState('0x71C3a58A4081E297127e997e20b329431E8C4392');
  const [demoName, setDemoName] = useState('Sahitya (Web3 Tycoon)');
  const [demoEmail, setDemoEmail] = useState('sahityanijhawan@gmail.com');
  const [googleEmail, setGoogleEmail] = useState('sahityanijhawan@gmail.com');
  const [googleName, setGoogleName] = useState('Sahitya');
  const [activeTab, setActiveTab] = useState<'web3' | 'google' | 'quick_demo'>('web3');

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
    setShowAuthFlow(true);
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

  const handleGoogleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playCashRegister();
    loginWithGoogle(googleEmail.trim(), googleName.trim());
    sounds.playVictory();
    onClose();
  };

  const handleDemoSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playCashRegister();
    syncDynamicUser({
      id: 'usr_sahi_web3',
      email: demoEmail.trim(),
      username: demoName.trim(),
      walletAddress: demoWallet.trim(),
      chain: 'ETH',
    });
    sounds.playVictory();
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
      {/* Tab Selector: Dynamic Web3 Connect vs 1-Click Google vs Instant Demo Wallet */}
      <div className={`flex rounded-xl p-1 border text-xs font-bold ${
        isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/90 border-slate-800'
      }`}>
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            setActiveTab('web3');
          }}
          className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'web3'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
              : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>🦊</span>
          <span>Web3 Wallet</span>
        </button>
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            setActiveTab('google');
          }}
          className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'google'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
              : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>✨</span>
          <span>Google / Email</span>
        </button>
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            setActiveTab('quick_demo');
          }}
          className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'quick_demo'
              ? (isLight ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-800 text-slate-200 shadow-md')
              : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>⚡</span>
          <span>Instant Tycoon</span>
        </button>
      </div>

      {activeTab === 'web3' && (
        <div className="flex flex-col gap-3">
          {/* Dynamic Native Embedded Widget for 1-click connect */}
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl border bg-gradient-to-b from-indigo-950/30 to-purple-950/20 border-indigo-500/20 text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20">
              ⚡
            </div>
            <div>
              <h4 className="font-heading font-black text-sm text-white">Dynamic Web3 Authentication</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Connect any EVM wallet (MetaMask, Coinbase, Phantom, Rainbow) or log in with Email/Socials to create an instant crypto wallet.
              </p>
            </div>

            {/* Primary Action Button via Dynamic SDK */}
            <button
              id="btn-dynamic-auth-flow"
              type="button"
              onClick={handleConnectWallet}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-heading font-black text-sm shadow-lg shadow-indigo-500/30 transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2"
            >
              <span>🔗</span>
              <span>Connect Wallet / Log In with Dynamic</span>
            </button>

            {/* Embedded Widget fallback */}
            <div className="w-full flex justify-center pt-2">
              <SafeWidgetBoundary>
                <DynamicWidget />
              </SafeWidgetBoundary>
            </div>
          </div>

          {/* Supported Wallets Grid */}
          <div className="grid grid-cols-4 gap-2 pt-1 text-center">
            {[
              { name: 'MetaMask', icon: '🦊' },
              { name: 'Coinbase', icon: '🔵' },
              { name: 'Phantom', icon: '👻' },
              { name: 'Social/Email', icon: '✨' },
            ].map(w => (
              <div
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
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'google' && (
        <form onSubmit={handleGoogleSignIn} className="flex flex-col gap-3">
          <div className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
            isLight ? 'bg-purple-50 border-purple-200 text-purple-900' : 'bg-purple-950/20 border-purple-800/40 text-purple-200'
          }`}>
            <span className="font-bold flex items-center gap-1.5">
              <span>✨</span> Fast Google & Social Sign-In
            </span>
            <p className="text-[11px] opacity-90 leading-relaxed">
              Sign in with your Google account to automatically preserve your token balances, properties, leaderboard stats, and store cosmetics.
            </p>
          </div>

          <div>
            <label className={`text-[11px] font-bold block mb-1 uppercase tracking-wider ${
              isLight ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Google Email Address
            </label>
            <input
              type="email"
              value={googleEmail}
              onChange={e => setGoogleEmail(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl text-xs font-mono-code border transition-all ${
                isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-900 border-slate-700 text-white'
              }`}
              required
            />
          </div>

          <div>
            <label className={`text-[11px] font-bold block mb-1 uppercase tracking-wider ${
              isLight ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Player Display Name
            </label>
            <input
              type="text"
              value={googleName}
              onChange={e => setGoogleName(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-900 border-slate-700 text-white'
              }`}
              required
            />
          </div>

          <button
            id="btn-signin-google-submit"
            type="submit"
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-1.5 mt-1"
          >
            <span>🚀</span>
            <span>Sign In with Google</span>
          </button>
        </form>
      )}

      {activeTab === 'quick_demo' && (
        <form onSubmit={handleDemoSignIn} className="flex flex-col gap-3">
          <div className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
            isLight ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-950/20 border-amber-800/40 text-amber-200'
          }`}>
            <span className="font-bold flex items-center gap-1.5">
              <span>⚡</span> Fast Web3 Sandbox Mode
            </span>
            <p className="text-[11px] opacity-90 leading-relaxed">
              Log in instantly with a pre-configured Web3 Tycoon identity and mock Ethereum wallet address to test high-stakes tables, blockchain transactions, and store purchases.
            </p>
          </div>

          <div>
            <label className={`text-[11px] font-bold block mb-1 uppercase tracking-wider ${
              isLight ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Player Username
            </label>
            <input
              type="text"
              value={demoName}
              onChange={e => setDemoName(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-900 border-slate-700 text-white'
              }`}
              required
            />
          </div>

          <div>
            <label className={`text-[11px] font-bold block mb-1 uppercase tracking-wider ${
              isLight ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Email Address
            </label>
            <input
              type="email"
              value={demoEmail}
              onChange={e => setDemoEmail(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl text-xs font-mono-code border transition-all ${
                isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-900 border-slate-700 text-white'
              }`}
              required
            />
          </div>

          <div>
            <label className={`text-[11px] font-bold block mb-1 uppercase tracking-wider ${
              isLight ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Ethereum / EVM Wallet Address
            </label>
            <input
              type="text"
              value={demoWallet}
              onChange={e => setDemoWallet(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl text-xs font-mono-code border transition-all ${
                isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-900 border-slate-700 text-white'
              }`}
              required
            />
          </div>

          <button
            id="btn-signin-demo-submit"
            type="submit"
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-1.5 mt-1"
          >
            <span>🚀</span>
            <span>Enter as Web3 Tycoon</span>
          </button>
        </form>
      )}
    </div>
  );
};
