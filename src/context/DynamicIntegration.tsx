import React, { createContext, useContext, useState } from 'react';
import {
  DynamicContextProvider,
  useDynamicContext as useDynamicContextOriginal,
  DynamicUserProfile,
} from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';

interface DynamicConfigContextType {
  environmentId: string | null;
  setEnvironmentId: (id: string) => void;
  isDynamicConfigured: boolean;
  clearEnvironmentId: () => void;
}

const DynamicConfigContext = createContext<DynamicConfigContextType>({
  environmentId: null,
  setEnvironmentId: () => {},
  isDynamicConfigured: false,
  clearEnvironmentId: () => {},
});

export const useDynamicConfig = () => useContext(DynamicConfigContext);

interface DynamicStateContextType {
  isLoaded: boolean;
  isAuthenticated: boolean;
  user: any;
  primaryWallet: any;
  setShowAuthFlow: (show: boolean) => void;
  showAuthFlow: boolean;
  handleLogOut: () => Promise<void>;
  setShowDynamicUserProfile: (show: boolean) => void;
  setSimulatedUser?: (user: any) => void;
}

const defaultDynamicState: DynamicStateContextType = {
  isLoaded: true,
  isAuthenticated: false,
  user: null,
  primaryWallet: null,
  setShowAuthFlow: () => {},
  showAuthFlow: false,
  handleLogOut: async () => {},
  setShowDynamicUserProfile: () => {},
};

const DynamicStateContext = createContext<DynamicStateContextType>(defaultDynamicState);

export const useSafeDynamic = () => useContext(DynamicStateContext);

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class DynamicErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn('[Dynamic SDK Boundary Notice]: Dynamic provider failed gracefully', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Bridge component rendered inside DynamicContextProvider to populate safe context
const DynamicStateBridge: React.FC<{
  children: React.ReactNode;
  simulatedUser: any;
  setSimulatedUser: (u: any) => void;
  simulatedShowAuth: boolean;
  setSimulatedShowAuth: (s: boolean) => void;
  triggerLogoutReset: () => void;
}> = ({ children, simulatedUser, setSimulatedUser, simulatedShowAuth, setSimulatedShowAuth, triggerLogoutReset }) => {
  let dynamic: any = null;
  try {
    // Attempt to access dynamic context if available
    dynamic = useDynamicContextOriginal();
  } catch {
    // Dynamic context not available or errored
  }

  const isDynAuth = Boolean(dynamic?.user || dynamic?.primaryWallet);
  const isAuthenticated = isDynAuth || Boolean(simulatedUser);

  const stateValue: DynamicStateContextType = {
    isLoaded: dynamic?.sdkHasLoaded ?? true,
    isAuthenticated,
    user: dynamic?.user || simulatedUser || null,
    primaryWallet: dynamic?.primaryWallet || (simulatedUser?.walletAddress ? { address: simulatedUser.walletAddress } : null),
    setShowAuthFlow: (show: boolean) => {
      setSimulatedShowAuth(show);
      if (typeof dynamic?.setShowAuthFlow === 'function') {
        try {
          dynamic.setShowAuthFlow(show);
        } catch (e) {
          console.warn('[Dynamic] setShowAuthFlow invocation issue:', e);
        }
      }
    },
    showAuthFlow: Boolean(dynamic?.showAuthFlow || simulatedShowAuth),
    handleLogOut: async () => {
      setSimulatedUser(null);
      setSimulatedShowAuth(false);
      if (typeof dynamic?.handleLogOut === 'function') {
        try {
          await dynamic.handleLogOut();
        } catch (e) {
          console.warn('[Dynamic] handleLogOut exception:', e);
        }
      }
      if (typeof dynamic?.setShowAuthFlow === 'function') {
        try {
          dynamic.setShowAuthFlow(false);
        } catch {
          // ignore
        }
      }
      // Trigger a clean re-initialization of DynamicContextProvider if needed
      triggerLogoutReset();
    },
    setShowDynamicUserProfile: (show: boolean) => {
      if (typeof dynamic?.setShowDynamicUserProfile === 'function') {
        try {
          dynamic.setShowDynamicUserProfile(show);
        } catch {
          // ignore
        }
      }
    },
    setSimulatedUser,
  };

  return (
    <DynamicStateContext.Provider value={stateValue}>
      {children}
      {isDynAuth && <DynamicUserProfile />}
    </DynamicStateContext.Provider>
  );
};

// Working sandbox environment ID for Dynamic Web3 authentication
export const DEFAULT_DYNAMIC_ENVIRONMENT_ID = 'ee9cc749-fbf9-478e-8885-c144fda9b3ef';
export const DEFAULT_DEMO_ENVIRONMENT_ID = DEFAULT_DYNAMIC_ENVIRONMENT_ID;

export function isValidDynamicEnvId(id: string | null | undefined): boolean {
  if (!id) return false;
  const trimmed = id.trim();
  // Must be a valid UUID/ID with length >= 16 and no whitespace
  return trimmed.length >= 16 && !trimmed.includes(' ');
}

export const DynamicIntegrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const envVarId = (((import.meta as any).env?.VITE_DYNAMIC_ENVIRONMENT_ID as string | undefined) || '').trim();

  const [environmentId, setEnvironmentIdInternal] = useState<string>(() => {
    if (isValidDynamicEnvId(envVarId)) return envVarId;
    const local = localStorage.getItem('proprush_dynamic_env_id')?.trim() || '';
    if (isValidDynamicEnvId(local)) return local;
    return DEFAULT_DYNAMIC_ENVIRONMENT_ID;
  });

  const [simulatedUser, setSimulatedUser] = useState<any>(null);
  const [simulatedShowAuth, setSimulatedShowAuth] = useState(false);
  const [logoutSessionKey, setLogoutSessionKey] = useState(0);

  const triggerLogoutReset = () => {
    setLogoutSessionKey(prev => prev + 1);
  };

  const setEnvironmentId = (id: string) => {
    const trimmed = id.trim();
    if (trimmed) {
      localStorage.setItem('proprush_dynamic_env_id', trimmed);
      setEnvironmentIdInternal(trimmed);
    }
  };

  const clearEnvironmentId = () => {
    localStorage.removeItem('proprush_dynamic_env_id');
    setEnvironmentIdInternal(isValidDynamicEnvId(envVarId) ? envVarId : DEFAULT_DYNAMIC_ENVIRONMENT_ID);
  };

  const isDynamicConfigured = isValidDynamicEnvId(environmentId);
  const activeEnvironmentId = environmentId || DEFAULT_DYNAMIC_ENVIRONMENT_ID;

  const configValue: DynamicConfigContextType = {
    environmentId: activeEnvironmentId,
    setEnvironmentId,
    isDynamicConfigured,
    clearEnvironmentId,
  };

  const fallbackContent = (
    <DynamicStateContext.Provider
      value={{
        ...defaultDynamicState,
        isAuthenticated: Boolean(simulatedUser),
        user: simulatedUser,
        primaryWallet: simulatedUser?.walletAddress ? { address: simulatedUser.walletAddress } : null,
        showAuthFlow: simulatedShowAuth,
        setShowAuthFlow: setSimulatedShowAuth,
        handleLogOut: async () => setSimulatedUser(null),
        setSimulatedUser,
      }}
    >
      {children}
    </DynamicStateContext.Provider>
  );

  return (
    <DynamicConfigContext.Provider value={configValue}>
      {isDynamicConfigured ? (
        <DynamicErrorBoundary key={`dynamic-boundary-${logoutSessionKey}`} fallback={fallbackContent}>
          <DynamicContextProvider
            key={`dynamic-provider-${logoutSessionKey}`}
            settings={{
              environmentId: activeEnvironmentId,
              appName: 'PropRush',
              walletConnectors: [EthereumWalletConnectors],
            }}
            theme="dark"
          >
            <DynamicStateBridge
              simulatedUser={simulatedUser}
              setSimulatedUser={setSimulatedUser}
              simulatedShowAuth={simulatedShowAuth}
              setSimulatedShowAuth={setSimulatedShowAuth}
              triggerLogoutReset={triggerLogoutReset}
            >
              {children}
            </DynamicStateBridge>
          </DynamicContextProvider>
        </DynamicErrorBoundary>
      ) : (
        fallbackContent
      )}
    </DynamicConfigContext.Provider>
  );
};
