import React, { useEffect } from 'react';
import { useUser as useClerkUser, AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import { useUser } from '../context/UserContext';

export const ClerkUserSync: React.FC = () => {
  const { isLoaded, isSignedIn, user: clerkUser } = useClerkUser();
  const { syncClerkUser, closeAuthModal } = useUser();

  const isCallbackUrl = typeof window !== 'undefined' && (
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
