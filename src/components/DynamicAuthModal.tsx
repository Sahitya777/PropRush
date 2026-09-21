import React, { useEffect, useState } from 'react';
import { useUser } from '../context/UserContext';
import { useSafeDynamic } from '../context/DynamicIntegration';
import { useTheme } from '../context/ThemeContext';
import { DynamicActiveAuth } from './DynamicActiveAuth';
import { DynamicSetupAuth } from './DynamicSetupAuth';
import { sounds } from '../utils/audio';

export const DynamicAuthModal: React.FC = () => {
  const { isAuthModalOpen, authModalReason, closeAuthModal, isLoggedIn } = useUser();
  const { showAuthFlow, setShowAuthFlow } = useSafeDynamic();
  const { isLight } = useTheme();

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [activeView, setActiveView] = useState<'auth' | 'config'>('auth');

  useEffect(() => {
    const handleOpen = () => {
      setIsConfigOpen(true);
      setActiveView('config');
    };
    window.addEventListener('open_dynamic_config', handleOpen);
    return () => window.removeEventListener('open_dynamic_config', handleOpen);
  }, []);

  const isOpen = isAuthModalOpen || showAuthFlow || isConfigOpen;

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    sounds.playClick();
    setIsConfigOpen(false);
    setActiveView('auth');
    closeAuthModal();
    try {
      setShowAuthFlow(false);
    } catch {
      // ignore
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto"
    >
      <div
        className={`w-full max-w-md border rounded-3xl shadow-2xl relative overflow-hidden flex flex-col my-auto max-h-[92vh] ${
          isLight
            ? 'bg-white border-slate-200 text-slate-800'
            : 'bg-[#130f24] border-[#332958] text-white shadow-[0_10px_50px_rgba(0,0,0,0.85)]'
        }`}
      >
        {/* Ambient Glows */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Top Header Bar */}
        <div className={`flex items-center justify-between px-5 pt-4 pb-3 border-b shrink-0 z-20 ${
          isLight ? 'border-slate-100 bg-slate-50/50' : 'border-slate-800/80 bg-[#161129]/60'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white font-black text-base shadow-sm">
              🎲
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-heading font-black text-sm tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  PROPRUSH
                </span>
                <span className="text-[10px] font-mono-code px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-bold">
                  {activeView === 'config' ? 'Dev Config' : 'Web3 Auth'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block font-mono-code -mt-0.5">
                {activeView === 'config' ? 'Developer Environment Setup' : 'Player Account & Wallet'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {activeView === 'config' && (
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setActiveView('auth');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                ← Back
              </button>
            )}

            <button
              id="btn-close-dynamic-modal"
              type="button"
              onClick={handleClose}
              aria-label="Close modal"
              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer text-xs font-black shadow-xs active:scale-90 ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-600 hover:text-slate-900'
                  : 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Content Container */}
        <div className="p-4 sm:p-6 overflow-y-auto flex flex-col gap-4 z-10">
          {/* Action reason banner if triggered by a protected action */}
          {authModalReason && activeView === 'auth' && (
            <div className={`p-3 rounded-2xl border text-xs flex items-center gap-2.5 shadow-xs ${
              isLight
                ? 'bg-purple-50 border-purple-200 text-purple-900'
                : 'bg-[#20173d] border-[#7059e2]/50 text-purple-200'
            }`}>
              <span className="text-lg shrink-0">🔒</span>
              <div className="text-xs font-semibold leading-tight">
                {authModalReason}
              </div>
            </div>
          )}

          {activeView === 'config' ? (
            <DynamicSetupAuth onClose={handleClose} />
          ) : (
            <DynamicActiveAuth
              onClose={handleClose}
              onOpenConfig={() => setActiveView('config')}
            />
          )}
        </div>

        {/* Footer Security Badges */}
        <div className={`flex items-center justify-between px-5 py-3 border-t text-[11px] shrink-0 z-10 ${
          isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#100c1f] border-slate-800/80 text-slate-400'
        }`}>
          <div className="flex items-center gap-1.5 font-medium">
            <span>🛡️</span>
            <span>Non-Custodial Web3 Auth</span>
          </div>
          {activeView === 'auth' ? (
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setActiveView('config');
              }}
              className="text-slate-400 hover:text-purple-400 transition-colors font-mono-code text-[10px] cursor-pointer"
            >
              ⚙️ Dev Settings
            </button>
          ) : (
            <span className="font-mono-code text-[10px] text-slate-500">
              Dynamic v3 Provider
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
