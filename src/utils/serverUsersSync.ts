import { UserProfile } from '../types/user';

export interface PlatformMember {
  id: string;
  name: string;
  email: string;
  avatar: string;
  frame?: string;
  profilePictureUrl?: string;
  tier: string;
  lp: number;
  earningsUsd: number;
  wins: number;
  gamesPlayed: number;
  winRate: number;
  winStreak: number;
  favoriteMap: string;
  title: string;
  country?: string;
  city?: string;
  joinedDate?: string;
  isCurrentUser?: boolean;
  rank?: number;
}

export interface AdminUserRecord {
  id: string;
  username: string;
  email: string;
  avatar: string;
  avatarFrame?: string;
  profilePictureUrl?: string;
  walletBalance: number;
  coins: number;
  leaguePoints: number;
  leagueTier: string;
  level: number;
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    winStreak: number;
    bestWinStreak: number;
    totalEarningsUsd: number;
    totalCoinsEarned: number;
  };
  role: 'admin' | 'player';
  isBanned: boolean;
  country: string;
  city: string;
  joinedDate: string;
  title: string;
  lastActive: number;
}

export async function fetchServerRankings(
  timeframe: 'season' | 'weekly' | 'all_time' = 'season',
  search = '',
  currentEmail = ''
): Promise<PlatformMember[]> {
  try {
    const params = new URLSearchParams({
      timeframe,
      search,
      currentEmail: currentEmail.toLowerCase()
    });
    const res = await fetch(`/api/rankings?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.rankings || [];
  } catch (err) {
    console.warn('Could not fetch server rankings, falling back to local dataset', err);
    return [];
  }
}

export async function fetchServerUsers(query = ''): Promise<AdminUserRecord[]> {
  try {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    const res = await fetch(`/api/users?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.users || [];
  } catch (err) {
    console.warn('Could not fetch server users, using fallback', err);
    return [];
  }
}

export async function syncUserProfileToServer(user: UserProfile): Promise<boolean> {
  try {
    const res = await fetch('/api/users/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user })
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not sync user profile to server', err);
    return false;
  }
}

export async function performAdminUserAction(
  email: string,
  action: 'credit' | 'toggleBan' | 'role' | 'ban' | 'unban' | 'delete',
  value?: any,
  id?: string
): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/users/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, id, action, value })
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to perform admin user action', err);
    return false;
  }
}
