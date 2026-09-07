import React, { useState, useEffect } from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { useClerkConfig, useSafeClerk, useSafeSignIn, useSafeSignUp, useSafeClerkUser } from '../context/ClerkIntegration';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { sounds } from '../utils/audio';

interface ClerkActiveAuthProps {
  onClose: () => void;
}

export const ClerkActiveAuth: React.FC<ClerkActiveAuthProps> = ({ onClose }) => {
  const { publishableKey } = useClerkConfig();
  const { signIn, isLoaded: isSignInLoaded } = useSafeSignIn();
  const { signUp, isLoaded: isSignUpLoaded } = useSafeSignUp();
  const { isSignedIn, user: clerkUser } = useSafeClerkUser();
  const { loginWithGoogle, syncClerkUser } = useUser();
  const { isLight } = useTheme();
  const clerk = useSafeClerk();

  const [activeTab, setActiveTab] = useState<'oauth' | 'clerk_form'>('oauth');
  const [clerkMode, setClerkMode] = useState<'signin' | 'signup'>('signin');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [providerLoading, setProviderLoading] = useState<string | null>(null);
  const [isInsideIframe, setIsInsideIframe] = useState(false);

  useEffect(() => {
    try {
      setIsInsideIframe(window.self !== window.top);
    } catch (e) {
      setIsInsideIframe(true);
    }
  }, []);

  // Handle Google OAuth flow via Clerk
  const handleGoogleOAuth = async () => {
    if (!isSignInLoaded || !signIn) {
      if (clerk && clerk.openSignIn) {
        clerk.openSignIn();
        onClose();
        return;
      }
      return;
    }
    try {
      sounds.playClick();
      setIsProcessing(true);
      setProviderLoading('google');
      setErrorMessage(null);

      // If running inside AI Studio preview iframe, popup / open new tab
      if (isInsideIframe) {
        window.open(window.location.origin, '_blank');
        setIsProcessing(false);
        setProviderLoading(null);
        setErrorMessage('Opening PropRush in a full browser tab to complete Google OAuth without iframe restrictions.');
        return;
      }

      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: window.location.origin,
        redirectUrlComplete: window.location.origin,
      });
    } catch (err: any) {
      console.error('Clerk Google OAuth error:', err);
      setIsProcessing(false);
      setProviderLoading(null);
      if (signUp && isSignUpLoaded) {
        try {
          await signUp.authenticateWithRedirect({
            strategy: 'oauth_google',
            redirectUrl: window.location.origin,
            redirectUrlComplete: window.location.origin,
          });
          return;
        } catch (signUpErr: any) {
          console.error('Clerk Google SignUp redirect error:', signUpErr);
        }
      }
      setErrorMessage(
        err?.errors?.[0]?.message ||
          err?.message ||
          'Google OAuth requires standard popup or tab. You can sign in using Email / Password in the tab above.'
      );
    }
  };

  const handleOpenInNewTab = () => {
    sounds.playClick();
    window.open(window.location.origin, '_blank');
  };

  const handleInstantGoogleDemo = () => {
    sounds.playCashRegister();
    loginWithGoogle('sahityanijhawan@gmail.com', 'Sahitya Nijhawan');
    onClose();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Navigation Tabs */}
      <div className={`flex rounded-2xl p-1 border text-xs font-bold ${
        isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/90 border-slate-800'
      }`}>
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            setActiveTab('oauth');
          }}
          className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'oauth'
              ? 'bg-[#7059e2] text-white shadow-md'
              : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>⚡</span>
          <span>Google & Instant</span>
        </button>
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            setActiveTab('clerk_form');
          }}
          className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'clerk_form'
              ? 'bg-[#7059e2] text-white shadow-md'
              : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>🔑</span>
          <span>Email & Password</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2 animate-fade-in">
          <span>⚠️</span>
          <div className="flex-1 leading-snug">{errorMessage}</div>
        </div>
      )}

      {/* Tab 1: Google OAuth & Instant Access */}
      {activeTab === 'oauth' && (
        <div className="flex flex-col gap-3.5">
          {/* Main Google OAuth Button */}
          <button
            id="btn-clerk-google-oauth"
            type="button"
            onClick={handleGoogleOAuth}
            disabled={isProcessing}
            className={`w-full py-3.5 px-4 rounded-2xl font-heading font-bold text-sm flex items-center justify-center gap-3 shadow-md transition-all cursor-pointer transform active:scale-98 disabled:opacity-75 ${
              isLight
                ? 'bg-slate-900 hover:bg-slate-800 text-white'
                : 'bg-white hover:bg-slate-100 text-slate-900'
            }`}
          >
            {providerLoading === 'google' ? (
              <span className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${isLight ? 'border-white' : 'border-slate-900'}`} />
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>
              {providerLoading === 'google' ? 'Connecting to Google...' : 'Continue with Google'}
            </span>
          </button>

          {/* Instant 1-Click Sign-in */}
          <button
            type="button"
            onClick={handleInstantGoogleDemo}
            className={`w-full py-3 px-3.5 rounded-2xl border font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs ${
              isLight
                ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800'
                : 'bg-emerald-950/40 hover:bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <span>✨</span>
            <span>1-Click Verified Login as Sahi</span>
          </button>

          {/* Iframe Notice & One-Click New Tab Button if embedded */}
          {isInsideIframe && (
            <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2.5 text-xs ${
              isLight ? 'bg-purple-50 border-purple-200 text-purple-900' : 'bg-[#1f1938] border-[#4d3a8a] text-purple-200'
            }`}>
              <div className="text-[11px] leading-tight flex-1">
                <span>ℹ️ In AI Studio preview: </span>
                <span className="opacity-80">Use full browser tab for direct Google OAuth.</span>
              </div>
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="px-3 py-1.5 rounded-xl bg-[#7059e2] hover:bg-[#826bf3] text-white text-[11px] font-bold transition-all flex items-center gap-1 shadow-sm whitespace-nowrap cursor-pointer shrink-0"
              >
                <span>↗</span>
                <span>Open Tab</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Clerk Email / Password Form */}
      {activeTab === 'clerk_form' && (
        <div className="flex flex-col gap-3">
          {/* Submode toggle: Sign In vs Sign Up */}
          <div className="flex items-center justify-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setClerkMode('signin')}
              className={`px-3 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                clerkMode === 'signin'
                  ? 'text-[#7059e2] dark:text-[#a997ff] underline'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Sign In
            </button>
            <span className="text-slate-400">•</span>
            <button
              type="button"
              onClick={() => setClerkMode('signup')}
              className={`px-3 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                clerkMode === 'signup'
                  ? 'text-[#7059e2] dark:text-[#a997ff] underline'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Create Account
            </button>
          </div>

          <div className="w-full flex justify-center clerk-form-container">
            {clerkMode === 'signin' ? (
              <SignIn
                routing="virtual"
                appearance={{
                  elements: {
                    rootBox: 'w-full',
                    card: 'bg-transparent shadow-none border-none p-0 w-full',
                    header: 'hidden',
                    footer: 'text-slate-500 text-xs mt-2',
                    formButtonPrimary: 'bg-[#7059e2] hover:bg-[#826bf3] text-white font-bold rounded-xl py-2.5 text-xs shadow-md',
                    socialButtonsBlockButton: isLight ? 'bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-semibold rounded-xl py-2.5 text-xs' : 'bg-[#1b1536] hover:bg-[#251d4a] border border-[#35295f] text-white font-semibold rounded-xl py-2.5 text-xs',
                    formFieldInput: isLight ? 'bg-slate-50 border border-slate-300 text-slate-900 rounded-xl text-xs py-2' : 'bg-[#0d0a18] border border-slate-800 text-white rounded-xl text-xs py-2',
                    formFieldLabel: isLight ? 'text-slate-700 text-xs font-semibold' : 'text-slate-300 text-xs font-semibold',
                    dividerLine: isLight ? 'bg-slate-200' : 'bg-slate-800',
                    dividerText: 'text-slate-500 text-[11px]'
                  }
                }}
              />
            ) : (
              <SignUp
                routing="virtual"
                appearance={{
                  elements: {
                    rootBox: 'w-full',
                    card: 'bg-transparent shadow-none border-none p-0 w-full',
                    header: 'hidden',
                    footer: 'text-slate-500 text-xs mt-2',
                    formButtonPrimary: 'bg-[#7059e2] hover:bg-[#826bf3] text-white font-bold rounded-xl py-2.5 text-xs shadow-md',
                    socialButtonsBlockButton: isLight ? 'bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-semibold rounded-xl py-2.5 text-xs' : 'bg-[#1b1536] hover:bg-[#251d4a] border border-[#35295f] text-white font-semibold rounded-xl py-2.5 text-xs',
                    formFieldInput: isLight ? 'bg-slate-50 border border-slate-300 text-slate-900 rounded-xl text-xs py-2' : 'bg-[#0d0a18] border border-slate-800 text-white rounded-xl text-xs py-2',
                    formFieldLabel: isLight ? 'text-slate-700 text-xs font-semibold' : 'text-slate-300 text-xs font-semibold',
                    dividerLine: isLight ? 'bg-slate-200' : 'bg-slate-800',
                    dividerText: 'text-slate-500 text-[11px]'
                  }
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};


