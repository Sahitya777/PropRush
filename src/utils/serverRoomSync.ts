import { ActiveRoomInfo } from './activeRoomsRegistry';
import { GameRoom, Player } from '../types/game';

async function safeFetchJson(url: string, options?: RequestInit): Promise<any> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      // If /api/... failed, attempt root path /... fallback
      if (url.startsWith('/api/')) {
        const altUrl = url.replace(/^\/api/, '');
        const altRes = await fetch(altUrl, options);
        if (altRes.ok) {
          return await altRes.json();
        }
      }
      return null;
    }
    return await res.json();
  } catch (err) {
    // If original failed due to network, try alternate
    if (url.startsWith('/api/')) {
      try {
        const altUrl = url.replace(/^\/api/, '');
        const altRes = await fetch(altUrl, options);
        if (altRes.ok) {
          return await altRes.json();
        }
      } catch {}
    }
    return null;
  }
}

/**
 * Fetches all active rooms from the server for the lobby list and search.
 */
export async function fetchActiveRoomsFromServer(): Promise<ActiveRoomInfo[]> {
  try {
    const data = await safeFetchJson('/api/rooms');
    if (data && Array.isArray(data.rooms)) {
      return data.rooms;
    }
    return [];
  } catch (err) {
    console.warn('Could not fetch active rooms from server:', err);
    return [];
  }
}

/**
 * Fetches the full state of a room by its code from the server.
 */
export async function fetchServerRoom(code: string): Promise<GameRoom | null> {
  if (!code) return null;
  try {
    const clean = code.trim().toLowerCase();
    const data = await safeFetchJson(`/api/rooms/${clean}`);
    if (data && data.exists && data.room) {
      return data.room as GameRoom;
    }
    return null;
  } catch (err) {
    console.warn(`Could not fetch room ${code} from server:`, err);
    return null;
  }
}

/**
 * Creates or registers a room on the server.
 */
export async function createServerRoom(room: Partial<GameRoom> & { code: string; name: string }): Promise<GameRoom | null> {
  try {
    const data = await safeFetchJson('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(room)
    });
    return data?.room || null;
  } catch (err) {
    console.error('Error creating server room:', err);
    return null;
  }
}

/**
 * Joins the current player to a room on the server.
 */
export async function joinServerRoom(code: string, player: Partial<Player>): Promise<GameRoom | null> {
  try {
    const clean = code.trim().toLowerCase();
    const data = await safeFetchJson(`/api/rooms/${clean}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player })
    });
    return data?.room || null;
  } catch (err) {
    console.error(`Error joining server room ${code}:`, err);
    return null;
  }
}

/**
 * Synchronizes the full game room state to the server for all other cross-device players.
 */
export async function syncServerRoomState(code: string, room: GameRoom): Promise<boolean> {
  try {
    const clean = code.trim().toLowerCase();
    const data = await safeFetchJson(`/api/rooms/${clean}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room })
    });
    return Boolean(data && data.success);
  } catch (err) {
    console.warn(`Failed to sync room state to server for ${code}:`, err);
    return false;
  }
}

/**
 * Sends a chat message to the server for this room.
 */
export async function sendServerChatMessage(code: string, message: { id?: string; sender: string; avatar: string; text: string; time?: string }): Promise<boolean> {
  try {
    const clean = code.trim().toLowerCase();
    const data = await safeFetchJson(`/api/rooms/${clean}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    return Boolean(data && data.success);
  } catch (err) {
    console.warn(`Failed to send chat message for ${code}:`, err);
    return false;
  }
}
