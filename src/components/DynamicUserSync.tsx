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

      // Extract first name, last name, username
      const rawDynUser = dynamicUser as any;
      const firstName = rawDynUser?.firstName || '';
      const lastName = rawDynUser?.lastName || '';
      const dynamicUsername = rawDynUser?.username || rawDynUser?.alias || rawDynUser?.metadata?.username || '';

      // Extract display name: prioritize unique username, then full name, then oauth, email, or wallet
      let name = '';
      if (dynamicUsername && !/^0x[a-fA-F0-9]{10,}/i.test(dynamicUsername)) {
        name = dynamicUsername;
      } else if (firstName) {
        name = `${firstName}${lastName ? ` ${lastName}` : ''}`.trim();
      } else if (oauthCred?.oauthUsername) {
        name = oauthCred.oauthUsername;
      } else if (oauthCred?.oauthDisplayName) {
        name = oauthCred.oauthDisplayName;
      } else if (dynamicUser?.ens?.name) {
        name = dynamicUser.ens.name;
      } else if (email) {
        name = email.split('@')[0];
      } else if (walletAddress) {
        name = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
      } else {
        name = 'Crypto Tycoon';
      }

      // Extract social profile picture or ENS avatar if available
      const avatar = oauthCred?.oauthAccountPhotos?.[0] || dynamicUser?.ens?.avatar || undefined;
      const chain = primaryWallet?.chain || 'ETH';
      const userId = dynamicUser?.userId || walletAddress || `usr_dyn_${Date.now()}`;

      syncDynamicUser({
        id: userId,
        email,
        username: name,
        firstName,
        lastName,
        walletAddress,
        chain,
        imageUrl: avatar,
      });

      closeAuthModal();
    }
  }, [
    isLoaded,
    isAuthenticated,
    dynamicUser?.userId,
    dynamicUser?.email,
    (dynamicUser as any)?.username,
    (dynamicUser as any)?.firstName,
    (dynamicUser as any)?.lastName,
    (dynamicUser as any)?.alias,
    primaryWallet?.address
  ]);

  return null;
};
