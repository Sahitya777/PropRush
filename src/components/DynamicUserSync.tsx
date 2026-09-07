import React, { useEffect } from 'react';
import { useSafeDynamic, useDynamicConfig } from '../context/DynamicIntegration';
import { useUser } from '../context/UserContext';

export const DynamicUserSync: React.FC = () => {
  const { isDynamicConfigured } = useDynamicConfig();
  const { isLoaded, isAuthenticated, user: dynamicUser, primaryWallet } = useSafeDynamic();
  const { syncDynamicUser, closeAuthModal } = useUser();

  useEffect(() => {
    if (!isLoaded) return;

    if (isAuthenticated && (dynamicUser || primaryWallet)) {
      // Extract wallet address
      const walletAddress = primaryWallet?.address || 
        dynamicUser?.verifiedCredentials?.find((c: any) => c.format === 'blockchain' || c.walletName)?.address;

      // Extract email
      const email = dynamicUser?.email || 
        dynamicUser?.verifiedCredentials?.find((c: any) => c.format === 'email')?.email;

      // Extract username or format wallet
      const name = dynamicUser?.username || 
        dynamicUser?.firstName || 
        dynamicUser?.ens?.name || 
        (email ? email.split('@')[0] : (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Crypto Tycoon'));

      const avatar = dynamicUser?.ens?.avatar || undefined;
      const chain = primaryWallet?.chain || 'ETH';
      const userId = dynamicUser?.userId || walletAddress || 'usr_dynamic';

      syncDynamicUser({
        id: userId,
        email,
        username: name,
        walletAddress,
        chain,
        imageUrl: avatar,
      });

      closeAuthModal();
    }
  }, [isLoaded, isAuthenticated, dynamicUser?.userId, dynamicUser?.email, primaryWallet?.address]);

  return null;
};
