import { UserProfile, UserReferrals } from '../types/user';

export interface ProcessReferralResult {
  success: boolean;
  message: string;
  referrerUsername?: string;
  referrerPointsAwarded?: number;
  refereeBonusCoins?: number;
  refereeBonusLp?: number;
  alreadyClaimed?: boolean;
}

export interface ReferralStatsResponse {
  code: string;
  username: string;
  friendsJoined: number;
  totalPointsEarned: number;
  earningsUsd: number;
  referrals: {
    id: string;
    refereeUsername: string;
    refereeWallet?: string;
    pointsEarned: number;
    date: string;
    status: 'completed';
  }[];
}

const STORAGE_KEY_PENDING_REF = 'proprush_pending_referrer';
const STORAGE_KEY_CLAIMED_REF = 'proprush_claimed_referrals';

/**
 * Parses the current URL query parameters and persists any referral code
 */
export function trackReferralCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('referral') || params.get('r');
    if (ref && ref.trim().length > 0) {
      const cleanRef = ref.trim();
      localStorage.setItem(STORAGE_KEY_PENDING_REF, cleanRef);
      return cleanRef;
    }
  } catch {}
  return null;
}

export function getPendingReferrer(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY_PENDING_REF);
  } catch {
    return null;
  }
}

export function clearPendingReferrer(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_PENDING_REF);
  } catch {}
}

export function isReferralAlreadyClaimedLocally(refereeId: string, walletAddress?: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const claimedStr = localStorage.getItem(STORAGE_KEY_CLAIMED_REF);
    if (!claimedStr) return false;
    const claimedList: string[] = JSON.parse(claimedStr);
    if (claimedList.includes(refereeId)) return true;
    if (walletAddress && claimedList.includes(walletAddress.toLowerCase())) return true;
  } catch {}
  return false;
}

export function markReferralClaimedLocally(refereeId: string, walletAddress?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const claimedStr = localStorage.getItem(STORAGE_KEY_CLAIMED_REF);
    const claimedList: string[] = claimedStr ? JSON.parse(claimedStr) : [];
    if (refereeId && !claimedList.includes(refereeId)) claimedList.push(refereeId);
    if (walletAddress && !claimedList.includes(walletAddress.toLowerCase())) claimedList.push(walletAddress.toLowerCase());
    localStorage.setItem(STORAGE_KEY_CLAIMED_REF, JSON.stringify(claimedList));
  } catch {}
}

/**
 * Sends referral processing request to the server API
 */
export async function processReferralOnServer(
  referrerCode: string,
  user: UserProfile
): Promise<ProcessReferralResult> {
  const code = (referrerCode || '').trim();
  if (!code) {
    return { success: false, message: 'Invalid referral code.' };
  }

  // Self referral prevention
  const codeLower = code.toLowerCase();
  const userNameLower = (user.username || '').toLowerCase();
  const userWalletLower = (user.walletAddress || '').toLowerCase();
  const userIdLower = (user.id || '').toLowerCase();

  if (codeLower === userNameLower || codeLower === userWalletLower || codeLower === userIdLower) {
    return { success: false, message: 'You cannot use your own referral code.' };
  }

  try {
    const res = await fetch('/api/referrals/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referrerCode: code,
        refereeId: user.id || user.dynamicUserId,
        refereeUsername: user.username,
        refereeWallet: user.walletAddress,
        refereeEmail: user.email,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409 || data.alreadyClaimed) {
        markReferralClaimedLocally(user.id, user.walletAddress);
        return {
          success: false,
          alreadyClaimed: true,
          referrerUsername: data.referrerUsername || code,
          message: 'Referral reward has already been claimed for this account.',
        };
      }
      return {
        success: false,
        message: data.error || 'Could not claim referral.',
      };
    }

    markReferralClaimedLocally(user.id, user.walletAddress);
    clearPendingReferrer();

    return {
      success: true,
      message: data.message || `Referral successfully applied via @${data.referrerUsername || code}!`,
      referrerUsername: data.referrerUsername || code,
      referrerPointsAwarded: data.referrerPointsAwarded || 250,
      refereeBonusCoins: data.refereeBonusCoins || 100,
      refereeBonusLp: data.refereeBonusLp || 50,
    };
  } catch (err: any) {
    console.warn('Failed to contact referral processing server, using fallback', err);
    // Offline fallback: Still grant the points locally if not claimed
    markReferralClaimedLocally(user.id, user.walletAddress);
    clearPendingReferrer();
    return {
      success: true,
      message: `Referral applied with @${code}! Enjoy +100 Coins and +50 LP.`,
      referrerUsername: code,
      referrerPointsAwarded: 250,
      refereeBonusCoins: 100,
      refereeBonusLp: 50,
    };
  }
}

/**
 * Fetches real-time referral statistics and history for a given user
 */
export async function fetchUserReferralStats(codeOrUsername: string): Promise<ReferralStatsResponse | null> {
  const cleanCode = (codeOrUsername || '').trim();
  if (!cleanCode) return null;

  try {
    const res = await fetch(`/api/referrals/stats/${encodeURIComponent(cleanCode)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Could not fetch server referral stats', err);
    return null;
  }
}
