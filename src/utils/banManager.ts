// Centralized Ban & Suspension Enforcement System
import { performAdminUserAction } from './serverUsersSync';

const BANNED_EMAILS_KEY = 'proprush_banned_emails_v2';
const BANNED_IDS_KEY = 'proprush_banned_ids_v2';

// In-memory set of banned emails (lowercased) and user IDs
let bannedEmails = new Set<string>();
let bannedIds = new Set<string>();

// Initialize from localStorage
try {
  const savedEmails = localStorage.getItem(BANNED_EMAILS_KEY);
  if (savedEmails) {
    const list: string[] = JSON.parse(savedEmails);
    list.forEach(e => bannedEmails.add(e.toLowerCase().trim()));
  }
  const savedIds = localStorage.getItem(BANNED_IDS_KEY);
  if (savedIds) {
    const list: string[] = JSON.parse(savedIds);
    list.forEach(id => bannedIds.add(id.trim()));
  }
} catch (e) {
  console.warn('Failed to load banned cache', e);
}

// Fetch server banned list to stay completely synced
export async function syncBannedUsersFromServer(): Promise<void> {
  try {
    const res = await fetch('/api/banned-users');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.bannedEmails)) {
        data.bannedEmails.forEach((em: string) => bannedEmails.add(em.toLowerCase().trim()));
        localStorage.setItem(BANNED_EMAILS_KEY, JSON.stringify(Array.from(bannedEmails)));
      }
      if (Array.isArray(data.bannedIds)) {
        data.bannedIds.forEach((id: string) => bannedIds.add(id.trim()));
        localStorage.setItem(BANNED_IDS_KEY, JSON.stringify(Array.from(bannedIds)));
      }
      window.dispatchEvent(new CustomEvent('proprush_ban_updated'));
    }
  } catch (err) {
    // Non-fatal if offline
  }
}

// Check whether a user is currently banned
export function isUserBanned(email?: string, id?: string): boolean {
  if (email && bannedEmails.has(email.toLowerCase().trim())) {
    return true;
  }
  if (id && bannedIds.has(id.trim())) {
    return true;
  }
  return false;
}

// Get all currently banned emails
export function getBannedEmails(): string[] {
  return Array.from(bannedEmails);
}

// Set ban status for an email and optional ID
export async function setUserBanStatus(
  email: string,
  isBanned: boolean,
  id?: string
): Promise<boolean> {
  const cleanEmail = email.toLowerCase().trim();
  
  if (isBanned) {
    bannedEmails.add(cleanEmail);
    if (id) bannedIds.add(id.trim());
  } else {
    bannedEmails.delete(cleanEmail);
    if (id) bannedIds.delete(id.trim());
  }

  // Persist locally
  try {
    localStorage.setItem(BANNED_EMAILS_KEY, JSON.stringify(Array.from(bannedEmails)));
    localStorage.setItem(BANNED_IDS_KEY, JSON.stringify(Array.from(bannedIds)));
  } catch (err) {
    console.error('Failed to save ban storage', err);
  }

  // Broadcast across app views
  window.dispatchEvent(new CustomEvent('proprush_ban_updated', {
    detail: { email: cleanEmail, isBanned, id }
  }));

  // Sync to backend server
  try {
    const success = await performAdminUserAction(cleanEmail, isBanned ? 'ban' : 'unban', undefined, id);
    return success;
  } catch {
    return false;
  }
}

// Listen for cross-tab or external changes
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === BANNED_EMAILS_KEY && e.newValue) {
      try {
        const list: string[] = JSON.parse(e.newValue);
        bannedEmails = new Set(list.map(x => x.toLowerCase().trim()));
        window.dispatchEvent(new CustomEvent('proprush_ban_updated'));
      } catch {}
    }
    if (e.key === BANNED_IDS_KEY && e.newValue) {
      try {
        const list: string[] = JSON.parse(e.newValue);
        bannedIds = new Set(list.map(x => x.trim()));
        window.dispatchEvent(new CustomEvent('proprush_ban_updated'));
      } catch {}
    }
  });

  // Initial sync on startup
  syncBannedUsersFromServer();
}
