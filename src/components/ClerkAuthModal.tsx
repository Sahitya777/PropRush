import React, { useState } from 'react';
import { useUser } from '../context/UserContext';
import { sounds } from '../utils/audio';
import confetti from 'canvas-confetti';

export const ClerkAuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authModalReason,
    closeAuthModal,
    loginWithGoogle,
    loginWithEmail,
    loginWithSocial
  } = useUser();

  const [authStep, setAuthStep] = useState<'main' | 'google_accounts' | 'email_code'>('main');
  const [emailInput, setEmailInput] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  const handleGoogleClick = () => {
    sounds.playClick();
    setAuthStep('google_accounts');
  };

  const handleSelectGoogleAccount = (email: string, name: string, avatar: string) => {
    setIsLoading(true);
    setLoadingProvider('google');
    sounds.playClick();

    setTimeout(() => {
      loginWithGoogle(email, name, avatar);
      setIsLoading(false);
      setLoadingProvider(null);
      closeAuthModal();
      sounds.playVictory();
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 }
        });
      } catch {
        // ignore in tests
      }
    }, 650);
  };

  const handleSocialLogin = (provider: 'github' | 'discord' | 'apple') => {
    setIsLoading(true);
    setLoadingProvider(provider);
    sounds.playClick();

    setTimeout(() => {
      loginWithSocial(provider);
      setIsLoading(false);
      setLoadingProvider(null);
      closeAuthModal();
      sounds.playVictory();
    }, 600);
  };

  const handleSendEmailCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !emailInput.includes('@')) return;
    setIsLoading(true);
    sounds.playClick();

    setTimeout(() => {
      setIsLoading(false);
      setAuthStep('email_code');
    }, 500);
  };

  const handleVerifyEmailCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) return;
    setIsLoading(true);
    sounds.playClick();

    setTimeout(() => {
      loginWithEmail(emailInput);
      setIsLoading(false);
      closeAuthModal();
      sounds.playVictory();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      {/* Clerk Card Container */}
      <div className="w-full max-w-md bg-[#130f24] border border-[#332958] rounded-3xl shadow-[0_10px_50px_rgba(0,0,0,0.85)] p-6 sm:p-7 relative overflow-hidden flex flex-col gap-5">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#7059e2]/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          id="btn-close-clerk-modal"
          onClick={closeAuthModal}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer z-10"
        >
          ✕
        </button>

        {/* Clerk Logo & Header */}
        <div className="flex flex-col items-center text-center gap-1.5 z-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7059e2] to-[#9279ff] flex items-center justify-center text-white font-black text-lg shadow-lg">
              🎲
            </div>
            <span className="font-heading font-black text-xl text-white tracking-tight">
              PROPRUSH
            </span>
          </div>

          <h2 className="font-heading font-extrabold text-xl text-slate-100 mt-2">
            {authStep === 'google_accounts'
              ? 'Choose a Google Account'
              : authStep === 'email_code'
              ? 'Enter Verification Code'
              : 'Sign in to PropRush'}
          </h2>

          <p className="text-xs text-slate-400 max-w-xs">
            {authModalReason ||
              'Access real-money deposits, cash stakes games, and store coin purchases.'}
          </p>
        </div>

        {/* Required Notice Badge */}
        {authModalReason && authStep === 'main' && (
          <div className="p-2.5 rounded-xl bg-[#7059e2]/15 border border-[#7059e2]/40 flex items-center gap-2 text-xs text-slate-200 z-10">
            <span className="text-sm">🔒</span>
            <span className="font-medium">
              Free casual games can be played as Guest. Sign in is required for deposits, coins & stakes.
            </span>
          </div>
        )}

        {/* Step 1: MAIN CLERK AUTH SCREEN */}
        {authStep === 'main' && (
          <div className="flex flex-col gap-3.5 z-10">
            {/* Primary: Continue with Google */}
            <button
              id="btn-clerk-google"
              disabled={isLoading}
              onClick={handleGoogleClick}
              className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm flex items-center justify-center gap-3 transition-all cursor-pointer shadow-md hover:shadow-lg transform active:scale-98 disabled:opacity-50"
            >
              {loadingProvider === 'google' ? (
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.37 7.33 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.63 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                  />
                </svg>
              )}
              <span>Continue with Google</span>
            </button>

            {/* Social Row: GitHub, Discord, Apple */}
            <div className="grid grid-cols-3 gap-2">
              <button
                id="btn-clerk-github"
                disabled={isLoading}
                onClick={() => handleSocialLogin('github')}
                className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>🐙</span> GitHub
              </button>
              <button
                id="btn-clerk-discord"
                disabled={isLoading}
                onClick={() => handleSocialLogin('discord')}
                className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>💬</span> Discord
              </button>
              <button
                id="btn-clerk-apple"
                disabled={isLoading}
                onClick={() => handleSocialLogin('apple')}
                className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>🍏</span> Apple
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-slate-800" />
              <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                or with email
              </span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            {/* Email form */}
            <form onSubmit={handleSendEmailCode} className="flex flex-col gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-400">Email address</label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-[#7059e2] focus:ring-1 focus:ring-[#7059e2] text-sm text-white placeholder-slate-600 outline-none transition-all"
                />
              </div>

              <button
                id="btn-clerk-continue-email"
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-[#7059e2] hover:bg-[#6047d8] text-white font-bold text-sm transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                <span>Continue</span>
                <span>→</span>
              </button>
            </form>
          </div>
        )}

        {/* Step 2: GOOGLE ACCOUNT CHOOSER (Clerk style) */}
        {authStep === 'google_accounts' && (
          <div className="flex flex-col gap-3 z-10 animate-fade-in">
            <div className="text-xs text-slate-400 text-center mb-1">
              to continue to <span className="text-white font-bold">PropRush</span>
            </div>

            <div className="flex flex-col gap-2">
              {/* Account 1: Sahitya Nijhawan */}
              <button
                onClick={() =>
                  handleSelectGoogleAccount('sahityanijhawan@gmail.com', 'Sahitya', 'apple')
                }
                className="w-full p-3 rounded-2xl bg-slate-900/90 hover:bg-[#221a42] border border-slate-800 hover:border-[#7059e2]/60 flex items-center gap-3 transition-all cursor-pointer text-left group"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-md group-hover:scale-105 transition-transform">
                  S
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-white group-hover:text-[#a390ff] transition-colors">
                    Sahitya Nijhawan
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    sahityanijhawan@gmail.com
                  </div>
                </div>
                <span className="text-xs text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Active
                </span>
              </button>

              {/* Account 2: Tycoon Pro */}
              <button
                onClick={() =>
                  handleSelectGoogleAccount('sahi@gmail.com', 'sahi', 'orange')
                }
                className="w-full p-3 rounded-2xl bg-slate-900/90 hover:bg-[#221a42] border border-slate-800 hover:border-[#7059e2]/60 flex items-center gap-3 transition-all cursor-pointer text-left group"
              >
                <div className="w-10 h-10 rounded-full bg-[#7059e2] text-white font-bold flex items-center justify-center text-sm shadow-md group-hover:scale-105 transition-transform">
                  🎯
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-white group-hover:text-[#a390ff] transition-colors">
                    sahi (PropRush VIP)
                  </div>
                  <div className="text-xs text-slate-400 truncate">sahi@gmail.com</div>
                </div>
                <span className="text-xs text-[#a390ff] font-bold bg-[#7059e2]/20 px-2 py-0.5 rounded-full border border-[#7059e2]/40">
                  VIP
                </span>
              </button>

              {/* Custom Google Account */}
              <button
                onClick={() => {
                  const custom = prompt('Enter your Google email:', 'player@gmail.com');
                  if (custom && custom.includes('@')) {
                    const name = custom.split('@')[0];
                    handleSelectGoogleAccount(custom, name, 'fire');
                  }
                }}
                className="w-full p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 text-xs font-bold text-slate-400 hover:text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>➕</span> Use another Google account
              </button>
            </div>

            <button
              onClick={() => setAuthStep('main')}
              className="text-xs text-slate-400 hover:text-white text-center mt-2 transition-colors cursor-pointer"
            >
              ← Back to all sign in options
            </button>
          </div>
        )}

        {/* Step 3: EMAIL OTP CODE */}
        {authStep === 'email_code' && (
          <form onSubmit={handleVerifyEmailCode} className="flex flex-col gap-3 z-10 animate-fade-in">
            <div className="text-xs text-slate-400 text-center">
              We sent a 6-digit confirmation code to <br />
              <span className="text-white font-mono font-bold">{emailInput}</span>
            </div>

            <div className="flex flex-col gap-1 my-2">
              <label className="text-[11px] font-bold text-slate-400 text-center">
                Enter code (try 123456)
              </label>
              <input
                type="text"
                maxLength={6}
                required
                placeholder="123456"
                value={otpCode}
                onChange={e => setOtpCode(e.target.value)}
                className="w-full tracking-widest text-center px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-[#7059e2] text-lg font-mono font-bold text-white outline-none"
              />
            </div>

            <button
              id="btn-verify-otp"
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all cursor-pointer shadow-md"
            >
              {isLoading ? 'Verifying...' : 'Verify & Continue'}
            </button>

            <button
              type="button"
              onClick={() => setAuthStep('main')}
              className="text-xs text-slate-400 hover:text-white text-center mt-1 transition-colors cursor-pointer"
            >
              ← Back
            </button>
          </form>
        )}

        {/* Footer: Secured by Clerk */}
        <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between text-[11px] text-slate-500 z-10">
          <div className="flex items-center gap-1">
            <span>🛡️</span>
            <span>Secured by <strong className="text-slate-300">Clerk</strong></span>
          </div>
          <button
            onClick={closeAuthModal}
            className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            Play as Guest
          </button>
        </div>
      </div>
    </div>
  );
};
