import { fetchActiveRoomsFromServer, fetchServerRoom, createServerRoom } from './serverRoomSync';

export interface ActiveRoomInfo {
  code: string;
  name: string;
  host: string;
  hostAvatar: string;
  players: number;
  max: number;
  bet: number;
  turnTime: number;
  map: string;
  createdAt: number;
  initialCash?: number;
  isCustom?: boolean;
}

const STORAGE_KEY = 'proprush_active_rooms_registry_v1';
const ROOM_TTL_MS = 60 * 60 * 1000; // 1 hour TTL for custom rooms

export const DEFAULT_ACTIVE_ROOMS: ActiveRoomInfo[] = [
  {
    code: 'lnu17',
    name: 'High Stakes NYC Arena',
    host: 'PropRush_Admin',
    hostAvatar: 'navy',
    players: 3,
    max: 4,
    bet: 100,
    turnTime: 15,
    map: 'Classic',
    createdAt: Date.now() - 5 * 60 * 1000,
    initialCash: 1500
  },
  {
    code: 'tokyo88',
    name: 'Tokyo Fast 2x Blitz',
    host: 'Kenji',
    hostAvatar: 'cyber',
    players: 2,
    max: 4,
    bet: 0,
    turnTime: 10,
    map: 'Cyber Neon',
    createdAt: Date.now() - 10 * 60 * 1000,
    initialCash: 1500
  },
  {
    code: 'whale50',
    name: 'Grandmaster Diamond Table',
    host: 'Victor_Mogul',
    hostAvatar: 'king',
    players: 3,
    max: 4,
    bet: 500,
    turnTime: 20,
    map: 'Worldwide',
    createdAt: Date.now() - 15 * 60 * 1000,
    initialCash: 1500
  }
];

/**
 * Gets all currently active rooms from local cache.
 */
export function getAllActiveRooms(): ActiveRoomInfo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let customRooms: ActiveRoomInfo[] = [];
    if (raw) {
      const parsed: ActiveRoomInfo[] = JSON.parse(raw);
      const now = Date.now();
      // Filter out expired custom rooms
      customRooms = parsed.filter(r => now - r.createdAt < ROOM_TTL_MS);
      // Save cleaned list back
      if (customRooms.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(customRooms));
      }
    }

    // Merge default rooms with custom rooms (custom rooms take precedence if duplicate code)
    const customCodes = new Set(customRooms.map(r => r.code.toLowerCase()));
    const validDefaults = DEFAULT_ACTIVE_ROOMS.filter(d => !customCodes.has(d.code.toLowerCase()));

    return [...customRooms, ...validDefaults];
  } catch {
    return DEFAULT_ACTIVE_ROOMS;
  }
}

/**
 * Fetches active rooms from the server and updates local cache.
 */
export async function refreshActiveRoomsFromServer(): Promise<ActiveRoomInfo[]> {
  try {
    const serverRooms = await fetchActiveRoomsFromServer();
    if (serverRooms && serverRooms.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serverRooms));
      return serverRooms;
    }
  } catch (e) {
    console.warn('Failed to refresh rooms from server:', e);
  }
  return getAllActiveRooms();
}

/**
 * Finds an active room by code (case-insensitive) synchronously from cache.
 */
export function findActiveRoomByCode(code: string): ActiveRoomInfo | null {
  if (!code) return null;
  const cleanCode = code.trim().toLowerCase();
  const allRooms = getAllActiveRooms();
  return allRooms.find(r => r.code.toLowerCase() === cleanCode) || null;
}

/**
 * Finds an active room by code asynchronously, querying the server if not in local cache.
 */
export async function findActiveRoomByCodeAsync(code: string): Promise<ActiveRoomInfo | null> {
  if (!code) return null;
  const cleanCode = code.trim().toLowerCase();
  
  // 1. Check local cache
  const cached = findActiveRoomByCode(cleanCode);
  if (cached) return cached;

  // 2. Fetch directly from server API
  try {
    const serverRoom = await fetchServerRoom(cleanCode);
    if (serverRoom) {
      const s = serverRoom as any;
      const roomInfo: ActiveRoomInfo = {
        code: s.code || cleanCode,
        name: s.name,
        host: s.players?.[0]?.name || 'Host',
        hostAvatar: s.players?.[0]?.avatar || 'orange',
        players: s.players?.length || 1,
        max: s.maxPlayers || 4,
        bet: s.betAmount || 0,
        turnTime: s.turnTimeSeconds || s.turnTimeLimit || 15,
        map: s.boardTheme === 'cyber' ? 'Cyber Neon' : s.boardTheme === 'worldwide' ? 'Worldwide' : 'Classic',
        createdAt: Date.now(),
        initialCash: s.initialCash || 1500,
        isCustom: true
      };
      registerActiveRoom(roomInfo);
      return roomInfo;
    }
  } catch (err) {
    console.warn('Error querying server for room:', err);
  }

  return null;
}

/**
 * Registers a newly created custom room into the active rooms registry and backend server.
 */
export function registerActiveRoom(room: Omit<ActiveRoomInfo, 'createdAt'>): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let currentRooms: ActiveRoomInfo[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();

    // Clean expired & duplicates
    currentRooms = currentRooms.filter(r => now - r.createdAt < ROOM_TTL_MS && r.code.toLowerCase() !== room.code.toLowerCase());

    const newEntry: ActiveRoomInfo = {
      ...room,
      createdAt: now,
      isCustom: true
    };

    currentRooms.unshift(newEntry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentRooms));

    const mapTheme: 'classic' | 'cyber' | 'worldwide' = room.map.toLowerCase().includes('cyber')
      ? 'cyber'
      : room.map.toLowerCase().includes('world')
      ? 'worldwide'
      : 'classic';

    // Also register on Express backend server
    createServerRoom({
      code: room.code,
      name: room.name,
      maxPlayers: room.max,
      betAmount: room.bet,
      boardTheme: mapTheme,
      isPrivate: false,
      fillWithBots: false
    } as any).catch(err => console.warn('Could not post room to server:', err));
  } catch (err) {
    console.error('Failed to register active room:', err);
  }
}

/**
 * Updates the player count of an active room in the registry.
 */
export function updateActiveRoomPlayerCount(code: string, playersCount: number): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const currentRooms: ActiveRoomInfo[] = JSON.parse(raw);
    const updated = currentRooms.map(r => {
      if (r.code.toLowerCase() === code.trim().toLowerCase()) {
        return { ...r, players: playersCount };
      }
      return r;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update active room player count:', err);
  }
}

/**
 * Removes a room from the registry when completed or disbanded.
 */
export function removeActiveRoom(code: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const currentRooms: ActiveRoomInfo[] = JSON.parse(raw);
    const filtered = currentRooms.filter(r => r.code.toLowerCase() !== code.trim().toLowerCase());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to remove active room:', err);
  }
}

