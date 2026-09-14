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
      // Find credentials
      const creds = Array.isArray(dynamicUser?.verifiedCredentials) ? dynamicUser.verifiedCredentials : [];
      const blockchainCred = creds.find((c: any) => c.format === 'blockchain' || c.walletName);
      const emailCred = creds.find((c: any) => c.format === 'email');
      const oauthCred = creds.find((c: any) => c.format === 'oauth' || c.oauthProvider);

      // Extract wallet address
      const walletAddress = primaryWallet?.address || blockchainCred?.address || (dynamicUser as any)?.walletAddress;

      // Extract email from profile or credentials or oauth
      const email = dynamicUser?.email || 
        emailCred?.email ||
        oauthCred?.oauthEmails?.[0] ||
        oauthCred?.email;

      // Extract display name or social username or wallet
      const name = dynamicUser?.username || 
        oauthCred?.oauthDisplayName ||
        oauthCred?.oauthUsername ||
        dynamicUser?.firstName || 
        dynamicUser?.ens?.name || 
        (email ? email.split('@')[0] : (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Crypto Tycoon'));

      // Extract social profile picture or ENS avatar if available
      const avatar = oauthCred?.oauthAccountPhotos?.[0] || dynamicUser?.ens?.avatar || undefined;
      const chain = primaryWallet?.chain || 'ETH';
      const userId = dynamicUser?.userId || walletAddress || `usr_dyn_${Date.now()}`;

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
