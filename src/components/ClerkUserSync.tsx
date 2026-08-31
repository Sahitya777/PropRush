import React, { useEffect } from 'react';
import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import { useSafeClerkUser, useClerkConfig } from '../context/ClerkIntegration';
import { useUser } from '../context/UserContext';

export const ClerkUserSync: React.FC = () => {
  const { isClerkAvailable } = useClerkConfig();
  const { isLoaded, isSignedIn, user: clerkUser } = useSafeClerkUser();
  const { syncClerkUser, closeAuthModal } = useUser();

  const isCallbackUrl = isClerkAvailable && typeof window !== 'undefined' && (
    window.location.search.includes('__clerk') ||
    window.location.hash.includes('__clerk')
  );

  useEffect(() => {
    if (isLoaded && isSignedIn && clerkUser) {
      const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress;
      const name = clerkUser.fullName || clerkUser.username || clerkUser.firstName || (primaryEmail ? primaryEmail.split('@')[0] : 'Tycoon');
      
      syncClerkUser({
        id: clerkUser.id,
        email: primaryEmail,
        username: name,
        fullName: clerkUser.fullName || undefined,
        imageUrl: clerkUser.imageUrl || undefined
      });
      closeAuthModal();
    }
  }, [isLoaded, isSignedIn, clerkUser?.id, clerkUser?.updatedAt]);

  if (isCallbackUrl) {
    return <AuthenticateWithRedirectCallback />;
  }

  return null;
};
