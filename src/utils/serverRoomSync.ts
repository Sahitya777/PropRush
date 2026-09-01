import { ActiveRoomInfo } from './activeRoomsRegistry';
import { GameRoom, Player } from '../types/game';

/**
 * Fetches all active rooms from the server for the lobby list and search.
 */
export async function fetchActiveRoomsFromServer(): Promise<ActiveRoomInfo[]> {
  try {
    const res = await fetch('/api/rooms');
    if (!res.ok) throw new Error('Failed to fetch rooms');
    const data = await res.json();
    return data.rooms || [];
  } catch (err) {
    console.warn('Could not fetch active rooms from server, using local fallback:', err);
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
    const res = await fetch(`/api/rooms/${clean}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.exists && data.room) {
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
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(room)
    });
    if (!res.ok) throw new Error('Failed to create server room');
    const data = await res.json();
    return data.room || null;
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
    const res = await fetch(`/api/rooms/${clean}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player })
    });
    if (!res.ok) throw new Error('Failed to join room on server');
    const data = await res.json();
    return data.room || null;
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
    const res = await fetch(`/api/rooms/${clean}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room })
    });
    return res.ok;
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
    const res = await fetch(`/api/rooms/${clean}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    return res.ok;
  } catch (err) {
    console.warn(`Failed to send chat message for ${code}:`, err);
    return false;
  }
}
