import React, { useState } from 'react';
import { useClerkConfig } from '../context/ClerkIntegration';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { sounds } from '../utils/audio';

interface ClerkSetupAuthProps {
  onClose: () => void;
}

export const ClerkSetupAuth: React.FC<ClerkSetupAuthProps> = ({ onClose }) => {
  const { setPublishableKey } = useClerkConfig();
  const { loginWithGoogle, closeAuthModal } = useUser();
  const { isLight } = useTheme();

  const [inputKey, setInputKey] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'clerk_setup' | 'quick_demo'>('clerk_setup');
  const [demoEmail, setDemoEmail] = useState('sahityanijhawan@gmail.com');
  const [demoName, setDemoName] = useState('sahi');

  const handleActivateClerk = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputKey.trim();
    if (!trimmed) {
      setKeyError('Please enter your Clerk Publishable Key (e.g. pk_test_... or pk_live_...)');
      return;
    }
    if (!trimmed.startsWith('pk_test_') && !trimmed.startsWith('pk_live_')) {
      setKeyError('Clerk publishable keys typically start with "pk_test_" or "pk_live_". Please verify your key in dashboard.clerk.com -> API Keys.');
      return;
    }
    setKeyError(null);
    sounds.playCashRegister();
    setPublishableKey(trimmed);
  };

  const handleDemoSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playClick();
    loginWithGoogle(demoEmail, demoName);
    closeAuthModal();
    sounds.playVictory();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Tab Selector: Connect Real Clerk vs Instant Demo */}
      <div className={`flex rounded-xl p-1 border text-xs font-bold ${
        isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/90 border-slate-800'
      }`}>
        <button
          onClick={() => {
            sounds.playClick();
            setActiveTab('clerk_setup');
          }}
          className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'clerk_setup'
              ? 'bg-[#7059e2] text-white shadow-md'
              : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>🔑</span>
          <span>Connect Clerk OAuth</span>
        </button>
        <button
          onClick={() => {
            sounds.playClick();
            setActiveTab('quick_demo');
          }}
          className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'quick_demo'
              ? (isLight ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-800 text-slate-200 shadow-md')
              : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>⚡</span>
          <span>Instant Demo Login</span>
        </button>
      </div>

      {activeTab === 'clerk_setup' ? (
        <div className="flex flex-col gap-4">
          {/* Clerk Integration Guide */}
          <div className={`p-4 rounded-2xl border space-y-2.5 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#19142e] border-[#3b2e6b]'
          }`}>
            <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider ${
              isLight ? 'text-amber-800' : 'text-amber-300'
            }`}>
              <span>📋</span> What is needed from your Clerk Dashboard:
            </div>
            <ol className={`text-xs space-y-2 list-decimal list-inside leading-relaxed ${
              isLight ? 'text-slate-700' : 'text-slate-300'
            }`}>
              <li>
                <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>Create a Clerk App:</span> Sign in to{' '}
                <a
                  href="https://dashboard.clerk.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#7059e2] dark:text-[#9d89fc] underline hover:text-[#5e46d0] font-bold inline-flex items-center gap-0.5"
                >
                  dashboard.clerk.com ↗
                </a>
              </li>
              <li>
                <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>Enable Google OAuth:</span> Go to{' '}
                <span className={`px-1.5 py-0.5 rounded font-mono-code text-[11px] ${
                  isLight ? 'bg-slate-200 text-slate-800' : 'bg-slate-900/80 text-slate-200'
                }`}>
                  Configure → Social Connections
                </span>{' '}
                and toggle <strong className={isLight ? 'text-slate-900' : 'text-white'}>Google</strong> ON.
              </li>
              <li>
                <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>Copy Publishable Key:</span> Go to{' '}
                <span className={`px-1.5 py-0.5 rounded font-mono-code text-[11px] ${
                  isLight ? 'bg-slate-200 text-slate-800' : 'bg-slate-900/80 text-slate-200'
                }`}>
                  API Keys
                </span>{' '}
                and copy your key (<code className="text-[#7059e2] dark:text-[#a390ff] font-mono-code">pk_test_...</code>).
              </li>
            </ol>
          </div>

          {/* Paste Key Form */}
          <form onSubmit={handleActivateClerk} className="flex flex-col gap-2.5">
            <label className={`text-xs font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              Enter your Clerk Publishable Key:
            </label>
            <input
              type="text"
              value={inputKey}
              onChange={(e) => {
                setInputKey(e.target.value);
                setKeyError(null);
              }}
              placeholder="pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxx"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono-code focus:outline-none shadow-inner ${
                isLight
                  ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[#7059e2]'
                  : 'bg-[#0d0a18] border-slate-700 focus:border-[#7059e2] text-white placeholder:text-slate-600'
              }`}
            />
            {keyError && (
              <span className="text-xs text-rose-500 font-semibold">{keyError}</span>
            )}
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#7059e2] to-[#8e76f7] hover:from-[#6047d8] hover:to-[#7d64f0] text-white font-heading font-black text-xs sm:text-sm shadow-[0_0_16px_rgba(112,89,226,0.6)] transition-all cursor-pointer transform active:scale-98 flex items-center justify-center gap-2"
            >
              <span>🚀</span>
              <span>Activate Clerk Google OAuth</span>
            </button>
          </form>

          <div className="text-[11px] text-slate-500 text-center">
            Or add <code className="font-mono-code px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-400">VITE_CLERK_PUBLISHABLE_KEY</code> to your environment variables.
          </div>
        </div>
      ) : (
        <form onSubmit={handleDemoSignIn} className="flex flex-col gap-3">
          <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Simulate a Google-verified login session with custom display name and email.
          </p>

          <div className="space-y-1.5">
            <label className={`text-xs font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Google Email</label>
            <input
              type="email"
              value={demoEmail}
              onChange={(e) => setDemoEmail(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none font-mono-code ${
                isLight
                  ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[#7059e2]'
                  : 'bg-[#0d0a18] border-slate-800 focus:border-[#7059e2] text-white'
              }`}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className={`text-xs font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Display Name</label>
            <input
              type="text"
              value={demoName}
              onChange={(e) => setDemoName(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none ${
                isLight
                  ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[#7059e2]'
                  : 'bg-[#0d0a18] border-slate-800 focus:border-[#7059e2] text-white'
              }`}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-md transition-all cursor-pointer transform active:scale-98 mt-1"
          >
            Sign In with Demo Google Session
          </button>
        </form>
      )}
    </div>
  );
};
