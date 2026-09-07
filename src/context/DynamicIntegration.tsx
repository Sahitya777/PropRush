import React, { createContext, useContext, useState, useMemo } from 'react';
import {
  DynamicContextProvider,
  useDynamicContext as useDynamicContextOriginal,
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
}> = ({ children, simulatedUser, setSimulatedUser, simulatedShowAuth, setSimulatedShowAuth }) => {
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
        } catch {
          // ignore
        }
      }
    },
    showAuthFlow: Boolean(dynamic?.showAuthFlow || simulatedShowAuth),
    handleLogOut: async () => {
      setSimulatedUser(null);
      if (typeof dynamic?.handleLogOut === 'function') {
        try {
          await dynamic.handleLogOut();
        } catch {
          // ignore
        }
      }
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
    </DynamicStateContext.Provider>
  );
};

// Fallback demo environment ID if none configured yet
export const DEFAULT_DEMO_ENVIRONMENT_ID = '2762a57b-faa4-41ce-9f16-abff9300e2c9';

function isValidDynamicEnvId(id: string | null | undefined): boolean {
  if (!id) return false;
  const trimmed = id.trim();
  // UUID format or non-empty string with length >= 16
  return trimmed.length >= 16 && !trimmed.includes(' ');
}

export const DynamicIntegrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const envVarId = (((import.meta as any).env?.VITE_DYNAMIC_ENVIRONMENT_ID as string | undefined) || '').trim();

  const [environmentId, setEnvironmentIdInternal] = useState<string>(() => {
    const local = localStorage.getItem('proprush_dynamic_env_id')?.trim() || '';
    if (isValidDynamicEnvId(envVarId)) return envVarId;
    if (isValidDynamicEnvId(local)) return local;
    return DEFAULT_DEMO_ENVIRONMENT_ID;
  });

  const [simulatedUser, setSimulatedUser] = useState<any>(null);
  const [simulatedShowAuth, setSimulatedShowAuth] = useState(false);

  const setEnvironmentId = (id: string) => {
    const trimmed = id.trim();
    localStorage.setItem('proprush_dynamic_env_id', trimmed);
    setEnvironmentIdInternal(trimmed);
  };

  const clearEnvironmentId = () => {
    localStorage.removeItem('proprush_dynamic_env_id');
    setEnvironmentIdInternal(envVarId || DEFAULT_DEMO_ENVIRONMENT_ID);
  };

  const isDynamicConfigured = isValidDynamicEnvId(environmentId);
  const activeEnvironmentId = isDynamicConfigured ? environmentId : DEFAULT_DEMO_ENVIRONMENT_ID;

  const configValue: DynamicConfigContextType = {
    environmentId: activeEnvironmentId,
    setEnvironmentId,
    isDynamicConfigured,
    clearEnvironmentId,
  };

  // Safely wrap Ethereum wallet connectors to prevent "t is not a function"
  const safeWalletConnectors = useMemo(() => {
    if (typeof EthereumWalletConnectors === 'function') {
      return [
        (props: any) => {
          try {
            const connectors = EthereumWalletConnectors(props);
            return Array.isArray(connectors) ? connectors : [];
          } catch (err) {
            console.warn('[Dynamic] Safe connector fallback:', err);
            return [];
          }
        },
      ];
    }
    return [];
  }, []);

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
      <DynamicErrorBoundary fallback={fallbackContent}>
        <DynamicContextProvider
          settings={{
            environmentId: activeEnvironmentId,
            walletConnectors: safeWalletConnectors,
            appName: 'PropRush Monopoly',
            initialAuthenticationMode: 'connect-and-sign',
          }}
          theme="dark"
        >
          <DynamicStateBridge
            simulatedUser={simulatedUser}
            setSimulatedUser={setSimulatedUser}
            simulatedShowAuth={simulatedShowAuth}
            setSimulatedShowAuth={setSimulatedShowAuth}
          >
            {children}
          </DynamicStateBridge>
        </DynamicContextProvider>
      </DynamicErrorBoundary>
    </DynamicConfigContext.Provider>
  );
};
