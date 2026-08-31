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
 * Gets all currently active rooms (default active rooms + valid custom user-created rooms).
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
 * Finds an active room by code (case-insensitive).
 * Returns the room config if active, or null if it does not exist.
 */
export function findActiveRoomByCode(code: string): ActiveRoomInfo | null {
  if (!code) return null;
  const cleanCode = code.trim().toLowerCase();
  const allRooms = getAllActiveRooms();
  return allRooms.find(r => r.code.toLowerCase() === cleanCode) || null;
}

/**
 * Registers a newly created custom room into the active rooms registry so others can join it by code.
 */
export function registerActiveRoom(room: Omit<ActiveRoomInfo, 'createdAt'>): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let currentRooms: ActiveRoomInfo[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();

    // Clean expired
    currentRooms = currentRooms.filter(r => now - r.createdAt < ROOM_TTL_MS && r.code.toLowerCase() !== room.code.toLowerCase());

    const newEntry: ActiveRoomInfo = {
      ...room,
      createdAt: now,
      isCustom: true
    };

    currentRooms.unshift(newEntry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentRooms));
  } catch (err) {
    console.error('Failed to register active room:', err);
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
