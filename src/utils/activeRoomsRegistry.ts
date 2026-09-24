import { fetchActiveRoomsFromServer, fetchServerRoom, createServerRoom } from './serverRoomSync';

export interface ActiveRoomInfo {
  code: string;
  name: string;
  host: string;
  hostAvatar: string;
  hostId?: string;
  players: number;
  max: number;
  bet: number;
  turnTime: number;
  map: string;
  createdAt: number;
  initialCash?: number;
  isCustom?: boolean;
  wagerContractAddress?: string;
  wagerMode?: 'free' | 'crypto';
}

const STORAGE_KEY = 'proprush_active_rooms_registry_v1';
const ROOM_TTL_MS = 60 * 60 * 1000; // 1 hour TTL for custom rooms

export const DEFAULT_ACTIVE_ROOMS: ActiveRoomInfo[] = [
  {
    code: 'tokyo88',
    name: 'Tokyo Fast 2x Blitz',
    host: 'Yuki_Speed',
    hostAvatar: 'pink',
    players: 2,
    max: 4,
    bet: 0,
    turnTime: 10,
    map: 'Cyber Neon',
    createdAt: Date.now() - 180000,
    initialCash: 1500,
    isCustom: false
  },
  {
    code: 'whale50',
    name: 'Grandmaster Diamond Table',
    host: 'Elena_Tycoon',
    hostAvatar: 'red',
    players: 2,
    max: 4,
    bet: 500,
    turnTime: 20,
    map: 'Worldwide',
    createdAt: Date.now() - 120000,
    initialCash: 2500,
    isCustom: false
  },
  {
    code: 'inu17',
    name: 'High Stakes NYC Arena',
    host: 'Host',
    hostAvatar: 'orange',
    players: 2,
    max: 4,
    bet: 100,
    turnTime: 15,
    map: 'Classic',
    createdAt: Date.now() - 300000,
    initialCash: 1500,
    isCustom: false
  }
];

/**
 * Gets all currently active rooms from local cache, combined with active defaults.
 */
export function getAllActiveRooms(): ActiveRoomInfo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let customRooms: ActiveRoomInfo[] = [];
    if (raw) {
      const parsed: ActiveRoomInfo[] = JSON.parse(raw);
      const now = Date.now();
      // Filter out expired custom rooms (older than TTL)
      customRooms = parsed.filter(r => (now - (r.createdAt || now) < ROOM_TTL_MS));
      // Save cleaned list back
      if (customRooms.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(customRooms));
      }
    }

    // Merge default tables so players always have active tables available
    const combined = [...customRooms];
    DEFAULT_ACTIVE_ROOMS.forEach(def => {
      if (!combined.some(r => r.code.toLowerCase() === def.code.toLowerCase())) {
        combined.push(def);
      }
    });

    return combined;
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
    const existingLocal = getAllActiveRooms();
    const now = Date.now();
    // Preserve local custom rooms created recently
    const activeLocalCustom = existingLocal.filter(r => r.isCustom && (now - (r.createdAt || 0) < ROOM_TTL_MS));

    const merged: ActiveRoomInfo[] = [];

    // Add server rooms first
    if (Array.isArray(serverRooms) && serverRooms.length > 0) {
      serverRooms.forEach(sr => {
        if (!merged.some(m => m.code.toLowerCase() === sr.code.toLowerCase())) {
          merged.push(sr);
        }
      });
    }

    // Keep active local custom rooms so host's table is never lost
    activeLocalCustom.forEach(lr => {
      const existingIdx = merged.findIndex(m => m.code.toLowerCase() === lr.code.toLowerCase());
      if (existingIdx >= 0) {
        merged[existingIdx] = { ...lr, ...merged[existingIdx] };
      } else {
        merged.push(lr);
      }
    });

    // Merge default rooms
    DEFAULT_ACTIVE_ROOMS.forEach(def => {
      if (!merged.some(r => r.code.toLowerCase() === def.code.toLowerCase())) {
        merged.push(def);
      }
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch (e) {
    console.warn('Failed to refresh rooms from server:', e);
  }
  return getAllActiveRooms();
}

/**
 * Finds an active room by code or name (case-insensitive) synchronously from cache.
 */
export function findActiveRoomByCode(code: string): ActiveRoomInfo | null {
  if (!code) return null;
  const cleanCode = code.trim().toLowerCase();
  const allRooms = getAllActiveRooms();
  return allRooms.find(r => 
    r.code.toLowerCase() === cleanCode ||
    (r.name && r.name.toLowerCase().trim() === cleanCode) ||
    (r.name && r.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanCode)
  ) || null;
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
        name: s.name || `Room ${cleanCode.toUpperCase()}`,
        host: s.players?.[0]?.name || 'Host',
        hostAvatar: s.players?.[0]?.avatar || 'orange',
        players: s.players?.length || 1,
        max: s.maxPlayers || 4,
        bet: typeof s.betAmount === 'number' ? s.betAmount : 0,
        turnTime: s.turnTimeSeconds || s.turnTimeLimit || 15,
        map: (s.boardTheme || '').toLowerCase().includes('cyber') ? 'Cyber Neon' : (s.boardTheme || '').toLowerCase().includes('world') ? 'Worldwide' : 'Classic',
        createdAt: Date.now(),
        initialCash: s.initialCash || 1500,
        isCustom: true,
        wagerContractAddress: s.wagerContractAddress,
        wagerMode: s.wagerMode
      };
      registerActiveRoom(roomInfo);
      return roomInfo;
    }
  } catch (err) {
    console.warn('Error querying server for room:', err);
  }

  // 3. Check default rooms
  const def = DEFAULT_ACTIVE_ROOMS.find(r => 
    r.code.toLowerCase() === cleanCode ||
    r.name.toLowerCase().trim() === cleanCode ||
    r.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanCode
  );
  if (def) return def;

  return null;
}

/**
 * Removes an active room from local storage (e.g. upon disband or completion).
 */
export function removeActiveRoom(code: string): void {
  try {
    const clean = code.trim().toLowerCase();
    const all = getAllActiveRooms().filter(r => 
      r.code.toLowerCase() !== clean &&
      (r.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') !== clean
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

    try {
      const bc = new BroadcastChannel('proprush_rooms_directory');
      bc.postMessage({ type: 'ROOM_REMOVED', code: clean });
      bc.close();
    } catch {}
  } catch {}
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

    // Also broadcast over directory channel so other tabs immediately see room
    try {
      const bc = new BroadcastChannel('proprush_rooms_directory');
      bc.postMessage({ type: 'ROOM_REGISTERED', room: newEntry });
      bc.close();
    } catch {}

    const mapTheme: 'classic' | 'cyber' | 'worldwide' = room.map.toLowerCase().includes('cyber')
      ? 'cyber'
      : room.map.toLowerCase().includes('world')
      ? 'worldwide'
      : 'classic';

    const effectiveHostId = room.hostId || 'host_' + now;

    // Also register on Express backend server with explicit host identity
    createServerRoom({
      code: room.code,
      name: room.name,
      hostId: effectiveHostId,
      maxPlayers: room.max,
      betAmount: room.bet,
      boardTheme: mapTheme,
      isPrivate: false,
      fillWithBots: false,
      players: [
        {
          id: effectiveHostId,
          name: room.host || 'Host',
          avatar: room.hostAvatar || 'orange',
          isHost: true,
          cash: room.initialCash || 1500,
          netWorth: room.initialCash || 1500,
          position: 0,
          properties: [],
          mortgaged: [],
          houses: {},
          inJail: false,
          jailTurns: 0,
          getOutOfJailCards: 0,
          isBankrupt: false,
          isBot: false,
          color: '#e65c00'
        }
      ]
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

