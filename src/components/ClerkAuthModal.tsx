import React, { useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { useClerkConfig } from '../context/ClerkIntegration';
import { useTheme } from '../context/ThemeContext';
import { ClerkActiveAuth } from './ClerkActiveAuth';
import { ClerkSetupAuth } from './ClerkSetupAuth';
import { sounds } from '../utils/audio';

export const ClerkAuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authModalReason,
    closeAuthModal,
    isLoggedIn,
  } = useUser();

  const { isClerkAvailable } = useClerkConfig();
  const { isLight } = useTheme();

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        sounds.playClick();
        closeAuthModal();
      }
    };
    if (isAuthModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      sounds.playClick();
      closeAuthModal();
    }
  };

  const handleClose = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sounds.playClick();
    closeAuthModal();
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto"
    >
      {/* Clerk Card Container */}
      <div
        className={`w-full max-w-md border rounded-3xl shadow-2xl relative overflow-hidden flex flex-col my-auto max-h-[92vh] ${
          isLight
            ? 'bg-white border-slate-200 text-slate-800'
            : 'bg-[#130f24] border-[#332958] text-white shadow-[0_10px_50px_rgba(0,0,0,0.85)]'
        }`}
      >
        {/* Ambient Glows */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#7059e2]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Top Header Bar with Prominent Reliable Close Button */}
        <div className={`flex items-center justify-between px-5 pt-4 pb-3 border-b shrink-0 z-20 ${
          isLight ? 'border-slate-100 bg-slate-50/50' : 'border-slate-800/80 bg-[#161129]/60'
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#7059e2] to-[#9279ff] flex items-center justify-center text-white font-black text-base shadow-sm">
              🎲
            </div>
            <div>
              <span className={`font-heading font-black text-sm tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                PROPRUSH
              </span>
              <span className="text-[10px] text-slate-400 block font-mono-code -mt-0.5">Player Auth</span>
            </div>
          </div>

          {/* Sizable, High-Hitbox Close Button */}
          <button
            id="btn-close-clerk-modal"
            type="button"
            onClick={handleClose}
            onTouchEnd={handleClose}
            aria-label="Close modal"
            className={`w-9 h-9 min-w-[36px] min-h-[36px] rounded-full border flex items-center justify-center transition-all cursor-pointer text-sm font-black shadow-xs active:scale-90 ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-600 hover:text-slate-900'
                : 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content Container */}
        <div className="p-4 sm:p-6 overflow-y-auto flex flex-col gap-4 z-10">
          {/* Action reason banner or intro text */}
          {authModalReason ? (
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
          ) : (
            <div className="text-center">
              <h2 className={`font-heading font-black text-lg ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {isLoggedIn ? 'Account Profile' : 'Sign in to PropRush'}
              </h2>
              <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Sign in to save cosmetics, deposit balance, and join matches.
              </p>
            </div>
          )}

          {/* Main Auth Component */}
          <div>
            {isClerkAvailable ? (
              <ClerkActiveAuth onClose={closeAuthModal} />
            ) : (
              <ClerkSetupAuth onClose={closeAuthModal} />
            )}
          </div>
        </div>

        {/* Footer Security Badges & Guest Mode */}
        <div className={`flex items-center justify-between px-5 py-3 border-t text-[11px] shrink-0 z-10 ${
          isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#100c1f] border-slate-800/80 text-slate-400'
        }`}>
          <div className="flex items-center gap-1.5 font-medium">
            <span>🛡️</span>
            <span>Clerk OAuth & Google Sync</span>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className={`transition-colors cursor-pointer font-bold ${
              isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Continue as Guest ✕
          </button>
        </div>
      </div>
    </div>
  );
};

