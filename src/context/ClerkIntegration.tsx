import React, { createContext, useContext, useState, useEffect } from 'react';
import { ClerkProvider, useUser as useClerkUser, useClerk, SignIn, SignUp } from '@clerk/clerk-react';
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
  clearPublishableKey: () => {}
});

export const useClerkConfig = () => useContext(ClerkConfigContext);

// Hook to check if publishable key is valid
function isValidClerkKey(key: string | null | undefined): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  return trimmed.startsWith('pk_test_') || trimmed.startsWith('pk_live_');
}

export const ClerkIntegrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default key from user's Clerk dashboard (app_3lcrT706042SF1VNW3fJOPSZszr)
  const DEFAULT_CLERK_PUB_KEY = 'pk_test_d29ya2luZy1sYXJrLTU4MDMuY2xlcmsuYWNjb3VudHMuZGV2JA';
  const envKey = (((import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY as string | undefined) || '').trim();
  
  const [publishableKey, setPublishableKeyInternal] = useState<string>(() => {
    const local = localStorage.getItem('proprush_clerk_pub_key')?.trim() || '';
    if (isValidClerkKey(envKey)) return envKey;
    if (isValidClerkKey(local)) return local;
    if (isValidClerkKey(DEFAULT_CLERK_PUB_KEY)) return DEFAULT_CLERK_PUB_KEY;
    return envKey || local || DEFAULT_CLERK_PUB_KEY;
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

  const contextValue: ClerkConfigContextType = {
    publishableKey: publishableKey || null,
    setPublishableKey,
    isClerkAvailable,
    clearPublishableKey
  };

  if (!isClerkAvailable) {
    return (
      <ClerkConfigContext.Provider value={contextValue}>
        {children}
      </ClerkConfigContext.Provider>
    );
  }

  return (
    <ClerkConfigContext.Provider value={contextValue}>
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
            dividerText: 'text-slate-500 text-xs uppercase'
          }
        }}
      >
        {children}
      </ClerkProvider>
    </ClerkConfigContext.Provider>
  );
};
