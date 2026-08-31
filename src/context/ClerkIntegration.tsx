import React, { createContext, useContext, useState } from 'react';
import {
  ClerkProvider,
  useUser as useClerkUserOriginal,
  useClerk as useClerkOriginal,
  useSignIn as useSignInOriginal,
  useSignUp as useSignUpOriginal,
} from '@clerk/clerk-react';
import { dark } from '@clerk/themes';

interface ClerkConfigContextType {
  publishableKey: string | null;
  setPublishableKey: (key: string) => void;
  isClerkAvailable: boolean;
  clearPublishableKey: () => void;
}

const ClerkConfigContext = createContext<ClerkConfigContextType>({
  publishableKey: null,
  setPublishableKey: () => {},
  isClerkAvailable: false,
  clearPublishableKey: () => {},
});

export const useClerkConfig = () => useContext(ClerkConfigContext);

interface ClerkStateContextType {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: any;
  clerk: any;
  signIn: any;
  isSignInLoaded: boolean;
  signUp: any;
  isSignUpLoaded: boolean;
}

const defaultClerkState: ClerkStateContextType = {
  isLoaded: true,
  isSignedIn: false,
  user: null,
  clerk: null,
  signIn: null,
  isSignInLoaded: false,
  signUp: null,
  isSignUpLoaded: false,
};

const ClerkStateContext = createContext<ClerkStateContextType>(defaultClerkState);

export const useSafeClerkUser = () => {
  const state = useContext(ClerkStateContext);
  return {
    isLoaded: state.isLoaded,
    isSignedIn: state.isSignedIn,
    user: state.user,
  };
};

export const useSafeClerk = () => {
  const state = useContext(ClerkStateContext);
  return state.clerk;
};

export const useSafeSignIn = () => {
  const state = useContext(ClerkStateContext);
  return {
    isLoaded: state.isSignInLoaded,
    signIn: state.signIn,
  };
};

export const useSafeSignUp = () => {
  const state = useContext(ClerkStateContext);
  return {
    isLoaded: state.isSignUpLoaded,
    signUp: state.signUp,
  };
};

// Bridge component rendered inside ClerkProvider
const ClerkStateBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded, isSignedIn, user } = useClerkUserOriginal();
  const clerk = useClerkOriginal();
  const { signIn, isLoaded: isSignInLoaded } = useSignInOriginal();
  const { signUp, isLoaded: isSignUpLoaded } = useSignUpOriginal();

  const stateValue: ClerkStateContextType = {
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    user: user || null,
    clerk: clerk || null,
    signIn: signIn || null,
    isSignInLoaded,
    signUp: signUp || null,
    isSignUpLoaded,
  };

  return (
    <ClerkStateContext.Provider value={stateValue}>
      {children}
    </ClerkStateContext.Provider>
  );
};

// Hook to check if publishable key is valid
function isValidClerkKey(key: string | null | undefined): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  return trimmed.startsWith('pk_test_') || trimmed.startsWith('pk_live_');
}

export const ClerkIntegrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const envKey = (((import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY as string | undefined) || '').trim();
  
  const [publishableKey, setPublishableKeyInternal] = useState<string>(() => {
    const local = localStorage.getItem('proprush_clerk_pub_key')?.trim() || '';
    if (isValidClerkKey(envKey)) return envKey;
    if (isValidClerkKey(local)) return local;
    return '';
  });

  const setPublishableKey = (key: string) => {
    const trimmed = key.trim();
    localStorage.setItem('proprush_clerk_pub_key', trimmed);
    setPublishableKeyInternal(trimmed);
  };

  const clearPublishableKey = () => {
    localStorage.removeItem('proprush_clerk_pub_key');
    setPublishableKeyInternal(envKey || '');
  };

  const isClerkAvailable = isValidClerkKey(publishableKey);

  const configValue: ClerkConfigContextType = {
    publishableKey: publishableKey || null,
    setPublishableKey,
    isClerkAvailable,
    clearPublishableKey,
  };

  if (!isClerkAvailable || !publishableKey) {
    return (
      <ClerkConfigContext.Provider value={configValue}>
        <ClerkStateContext.Provider value={defaultClerkState}>
          {children}
        </ClerkStateContext.Provider>
      </ClerkConfigContext.Provider>
    );
  }

  return (
    <ClerkConfigContext.Provider value={configValue}>
      <ClerkProvider
        publishableKey={publishableKey}
        appearance={{
          baseTheme: dark,
          variables: {
            colorPrimary: '#7059e2',
            colorBackground: '#130f24',
            colorInputBackground: '#0d0a18',
            colorInputText: '#ffffff',
            colorText: '#f8fafc',
            colorTextSecondary: '#94a3b8',
            borderRadius: '1rem',
          },
          elements: {
            card: 'bg-[#130f24] border border-[#332958] shadow-[0_10px_50px_rgba(0,0,0,0.85)] rounded-3xl',
            headerTitle: 'font-heading font-black text-white text-xl',
            headerSubtitle: 'text-slate-400 text-sm',
            socialButtonsBlockButton: 'bg-[#1c1634] hover:bg-[#271f47] border border-[#332958] text-white rounded-xl py-3 font-semibold transition-all',
            socialButtonsBlockButtonText: 'text-white font-semibold',
            formButtonPrimary: 'bg-[#7059e2] hover:bg-[#836df3] text-white font-bold rounded-xl py-3 shadow-lg transition-all',
            formFieldInput: 'bg-[#0d0a18] border border-slate-800 focus:border-[#7059e2] text-white rounded-xl py-2.5',
            footerActionLink: 'text-[#9d89fc] hover:text-[#b4a4ff] font-semibold',
            dividerLine: 'bg-slate-800',
            dividerText: 'text-slate-500 text-xs uppercase',
          },
        }}
      >
        <ClerkStateBridge>
          {children}
        </ClerkStateBridge>
      </ClerkProvider>
    </ClerkConfigContext.Provider>
  );
};
