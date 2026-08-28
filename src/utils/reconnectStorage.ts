import { GameRoom } from '../types/game';

export interface RoomConfig {
  roomCode: string;
  roomName: string;
  maxPlayers: number;
  betAmount: number;
  initialCash: number;
  turnTimeSeconds: number;
  boardTheme: string;
  fillWithBots: boolean;
}

export interface ChatMsg {
  id: string;
  sender: string;
  avatar: string;
  text: string;
  time: string;
}

export interface ActiveSavedMatch {
  room: GameRoom;
  roomConfig: RoomConfig;
  chatMessages: ChatMsg[];
  savedAt: number;
  expiresAt: number; // timestamp in ms (2 minutes grace period)
  disconnectedAt?: number;
}

const STORAGE_KEY = 'richup_active_match_v1';
const RECONNECT_GRACE_PERIOD_MS = 120_000; // 2 minutes in milliseconds

/**
 * Saves the active match state to local storage with an expiration timestamp.
 */
export function saveActiveMatch(
  room: GameRoom,
  roomConfig: RoomConfig,
  chatMessages: ChatMsg[] = []
): void {
  try {
    // If the game is already finished or gameover, do not preserve it
    if (room.status === 'finished' || room.status === 'gameover') {
      clearActiveMatch();
      return;
    }

    const existing = getActiveMatch();
    const now = Date.now();
    
    const payload: ActiveSavedMatch = {
      room,
      roomConfig,
      chatMessages,
      savedAt: now,
      // If previously saved and disconnected, preserve the original expiresAt unless extending
      expiresAt: existing ? Math.max(existing.expiresAt, now + RECONNECT_GRACE_PERIOD_MS) : now + RECONNECT_GRACE_PERIOD_MS,
      disconnectedAt: existing?.disconnectedAt || undefined
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to save active match to localStorage:', err);
  }
}

/**
 * Marks that the user intentionally navigated away / disconnected, setting a strict 2-minute timer from now.
 */
export function markDisconnected(room: GameRoom, roomConfig: RoomConfig, chatMessages: ChatMsg[] = []): void {
  try {
    if (room.status === 'finished' || room.status === 'gameover') {
      clearActiveMatch();
      return;
    }
    const now = Date.now();
    const payload: ActiveSavedMatch = {
      room,
      roomConfig,
      chatMessages,
      savedAt: now,
      expiresAt: now + RECONNECT_GRACE_PERIOD_MS, // exactly 2 minutes from disconnect
      disconnectedAt: now
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to mark disconnected:', err);
  }
}

/**
 * Retrieves the active match if one exists and hasn't expired.
 */
export function getActiveMatch(): ActiveSavedMatch | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data: ActiveSavedMatch = JSON.parse(raw);
    const now = Date.now();

    // Check expiration (2-minute window)
    if (!data.expiresAt || data.expiresAt <= now) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    // Check game status
    if (data.room && (data.room.status === 'finished' || data.room.status === 'gameover')) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return data;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * Clears the active saved match (e.g. when abandoned or game over).
 */
export function clearActiveMatch(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear active match:', err);
  }
}

/**
 * Formats remaining seconds into MM:SS format.
 */
export function formatRemainingTime(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.floor(Math.max(0, seconds) % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
