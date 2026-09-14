import express, { type Request, type Response } from "express";
import path from "path";
import fs from "fs";
import os from "os";
import Stripe from "stripe";
import dotenv from "dotenv";

// Load environment variables from .env if present
dotenv.config();

const app = express();

const PORT = (process.env.K_SERVICE || process.env.K_REVISION)
  ? (process.env.PORT ? parseInt(process.env.PORT, 10) : 8080)
  : 3000;

// Lazy Stripe initialization to prevent crashes when API key is not yet set
let stripeClient: Stripe | null = null;

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.trim() === "" || key === "sk_test_..." || key === "sk_live_...") {
    return null;
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

// In-memory record for sandbox/test transactions when testing without API key
const sandboxSessions = new Map<string, {
  id: string;
  amount: number;
  paid: boolean;
  userId: string;
  userEmail?: string;
  createdAt: number;
}>();

// Standard JSON parsing for API routes
app.use(express.json());

// Path normalization for Vercel / serverless rewrites
app.use((req: Request, _res: Response, next: any) => {
  const forwardedUri = (req.headers["x-forwarded-uri"] || req.headers["x-original-url"]) as string | undefined;
  const matchedPath = (req.headers["x-matched-path"] || req.headers["x-invoke-path"]) as string | undefined;

  if (forwardedUri && (forwardedUri.startsWith("/api") || forwardedUri.startsWith("/rooms"))) {
    req.url = forwardedUri;
  } else if (matchedPath && matchedPath.startsWith("/api") && matchedPath !== "/api") {
    req.url = matchedPath;
  }
  next();
});

// CORS & Preflight handling for all environments
app.use((req: Request, res: Response, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  next();
});

// ==========================================
// BANNED & SUSPENDED USERS REGISTRY
// ==========================================
const bannedEmailsSet = new Set<string>();
const bannedIdsSet = new Set<string>();

// ==========================================
// ROOM TYPES & DISK PERSISTENCE FOR SERVERLESS
// ==========================================
export interface ServerRoom {
  code: string;
  name: string;
  hostId: string;
  isPrivate: boolean;
  maxPlayers: number;
  betAmount: number;
  initialCash: number;
  turnTimeSeconds: number;
  boardTheme: string;
  fillWithBots?: boolean;
  status: 'waiting' | 'playing' | 'gameover' | 'finished';
  players: any[];
  currentTurnPlayerId?: string;
  currentTurnIndex?: number;
  turnPhase?: string;
  turnTimer?: number;
  lastDice?: [number, number];
  isDouble?: boolean;
  consecutiveDoubles?: number;
  doubleCount?: number;
  freeParkingPool?: number;
  auction?: any | null;
  activeTrade?: any | null;
  pendingCard?: any | null;
  winner?: any | null;
  logs: any[];
  chatMessages: any[];
  version: number;
  createdAt: number;
  updatedAt: number;
  isCustom?: boolean;
  properties?: any[];
  dice?: [number, number];
  turnStartedAt?: number;
}

const serverRooms = new Map<string, ServerRoom>();

// Initialize default active rooms
const defaultRooms: ServerRoom[] = [
  {
    code: 'inu17',
    name: 'High Stakes NYC Arena',
    hostId: 'usr_host_inu',
    maxPlayers: 4,
    betAmount: 100,
    turnTimeSeconds: 15,
    boardTheme: 'classic',
    isPrivate: false,
    initialCash: 1500,
    status: 'playing',
    players: [
      { id: 'usr_host_inu', name: 'Host', avatar: 'orange', color: '#ff7700', cash: 1400, netWorth: 1850, position: 12, inJail: false, jailTurns: 0, isBankrupt: false, isAi: false, properties: [] },
      { id: 'usr_player_sahitya', name: 'Sahitya', avatar: 'purple', color: '#38bdf8', cash: 1650, netWorth: 2100, position: 6, inJail: false, jailTurns: 0, isBankrupt: false, isAi: false, properties: [] },
      { id: 'bot_alex', name: 'Alex_Venture', avatar: 'green', color: '#10b981', cash: 1200, netWorth: 1500, position: 3, inJail: false, jailTurns: 0, isBankrupt: false, isAi: true, properties: [] },
      { id: 'bot_marcus', name: 'Marcus_Realty', avatar: 'blue', color: '#6366f1', cash: 900, netWorth: 1350, position: 18, inJail: false, jailTurns: 0, isBankrupt: false, isAi: true, properties: [] }
    ],
    properties: [],
    currentTurnIndex: 1,
    turnStartedAt: Date.now(),
    dice: [3, 4],
    logs: [
      { id: 'l_1', text: 'High Stakes NYC Arena initialized with $100 buy-in', type: 'system', timestamp: Date.now() - 60000 },
      { id: 'l_2', text: 'Sahitya collected $200 passing GO!', type: 'rent', timestamp: Date.now() - 30000 }
    ],
    chatMessages: [],
    version: 1,
    createdAt: Date.now() - 300000,
    updatedAt: Date.now(),
    isCustom: true
  },
  {
    code: 'tokyo88',
    name: 'Tokyo Fast 2x Blitz',
    hostId: 'bot_yuki',
    maxPlayers: 4,
    betAmount: 0,
    turnTimeSeconds: 10,
    boardTheme: 'cyber',
    isPrivate: false,
    initialCash: 1500,
    status: 'waiting',
    players: [
      { id: 'bot_yuki', name: 'Yuki_Speed', avatar: 'pink', color: '#ec4899', cash: 1500, netWorth: 1500, position: 0, inJail: false, jailTurns: 0, isBankrupt: false, isAi: true, properties: [] },
      { id: 'bot_ryo', name: 'Ryo_Cyber', avatar: 'cyber', color: '#06b6d4', cash: 1500, netWorth: 1500, position: 0, inJail: false, jailTurns: 0, isBankrupt: false, isAi: true, properties: [] }
    ],
    properties: [],
    currentTurnIndex: 0,
    turnStartedAt: Date.now(),
    dice: [1, 1],
    logs: [],
    chatMessages: [],
    version: 1,
    createdAt: Date.now() - 180000,
    updatedAt: Date.now(),
    isCustom: true
  },
  {
    code: 'whale50',
    name: 'Grandmaster Diamond Table',
    hostId: 'bot_elena',
    maxPlayers: 4,
    betAmount: 500,
    turnTimeSeconds: 20,
    boardTheme: 'worldwide',
    isPrivate: false,
    initialCash: 2500,
    status: 'waiting',
    players: [
      { id: 'bot_elena', name: 'Elena_Tycoon', avatar: 'red', color: '#ef4444', cash: 2500, netWorth: 2500, position: 0, inJail: false, jailTurns: 0, isBankrupt: false, isAi: true, properties: [] },
      { id: 'bot_chen', name: 'Chen_Empire', avatar: 'cyan', color: '#0ea5e9', cash: 2500, netWorth: 2500, position: 0, inJail: false, jailTurns: 0, isBankrupt: false, isAi: true, properties: [] }
    ],
    properties: [],
    currentTurnIndex: 0,
    turnStartedAt: Date.now(),
    dice: [5, 2],
    logs: [],
    chatMessages: [],
    version: 1,
    createdAt: Date.now() - 120000,
    updatedAt: Date.now(),
    isCustom: true
  }
];

defaultRooms.forEach(r => serverRooms.set(r.code.toLowerCase(), r));

// File-backed persistence for serverless lambdas (/tmp survives across warm invocations)
const TMP_ROOMS_FILE = path.join(os.tmpdir(), "proprush_server_rooms.json");

function loadPersistedRooms(): void {
  try {
    if (fs.existsSync(TMP_ROOMS_FILE)) {
      const content = fs.readFileSync(TMP_ROOMS_FILE, "utf-8");
      const list = JSON.parse(content);
      if (Array.isArray(list)) {
        list.forEach((r: ServerRoom) => {
          if (r && r.code) {
            serverRooms.set(r.code.toLowerCase(), r);
          }
        });
      }
    }
  } catch (err) {
    // Non-fatal fallback
  }
}

function savePersistedRooms(): void {
  try {
    const list = Array.from(serverRooms.values());
    fs.writeFileSync(TMP_ROOMS_FILE, JSON.stringify(list), "utf-8");
  } catch (err) {
    // Non-fatal fallback
  }
}

// Initial load
loadPersistedRooms();

// ==========================================
// USER TYPES & HELPERS
// ==========================================
export interface PlatformUser {
  id: string;
  username: string;
  email: string;
  walletAddress?: string;
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
  isCurrentUser?: boolean;
}

const platformUsersMap = new Map<string, PlatformUser>();

function findPlatformUser(id?: string, email?: string, walletAddress?: string): PlatformUser | undefined {
  if (id && platformUsersMap.has(id)) {
    return platformUsersMap.get(id);
  }
  const cleanEmail = email ? email.trim().toLowerCase() : '';
  const cleanWallet = walletAddress ? walletAddress.trim().toLowerCase() : '';
  for (const u of platformUsersMap.values()) {
    if (cleanWallet && u.walletAddress && u.walletAddress.toLowerCase() === cleanWallet) {
      return u;
    }
    if (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail) {
      return u;
    }
  }
  return undefined;
}

// ==========================================
// API ROUTER (Dual mounted on /api and /)
// ==========================================
const api = express.Router();

// Banned users
api.get("/banned-users", (_req: Request, res: Response) => {
  try {
    res.json({
      bannedEmails: Array.from(bannedEmailsSet),
      bannedIds: Array.from(bannedIdsSet)
    });
  } catch {
    res.json({ bannedEmails: [], bannedIds: [] });
  }
});

// Health check
api.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Stripe status
api.get("/stripe/status", (_req: Request, res: Response) => {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const isKeyConfigured = Boolean(
      secretKey && 
      secretKey.trim() !== "" && 
      secretKey !== "sk_test_..." && 
      secretKey !== "sk_live_..."
    );

    const mode = isKeyConfigured 
      ? (secretKey?.startsWith("sk_live_") ? "live" : "test") 
      : "sandbox_ready";

    res.json({
      configured: isKeyConfigured,
      mode,
      publishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY || null,
      message: isKeyConfigured
        ? `Stripe is active in ${mode.toUpperCase()} mode.`
        : "Stripe is ready. Add STRIPE_SECRET_KEY in Settings for real card processing, or use built-in instant test checkout.",
    });
  } catch (err: any) {
    res.json({
      configured: false,
      mode: "sandbox_ready",
      publishableKey: null,
      message: "Stripe status check handled safely."
    });
  }
});

// Stripe create checkout session
api.post("/stripe/create-checkout-session", async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, userId, username, userEmail, returnUrl } = req.body || {};
    
    const parsedAmount = typeof amount === "number" ? amount : parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ error: "Invalid deposit amount. Must be a positive number." });
      return;
    }

    const host = req.get("host") || `localhost:${PORT}`;
    const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
    const rawBase = returnUrl || `${protocol}://${host}`;
    const baseUrl = rawBase.replace(/\/+$/, '');

    if (userEmail && (bannedEmailsSet.has(userEmail.toLowerCase().trim()) || (userId && bannedIdsSet.has(userId.trim())))) {
      res.status(403).json({
        error: "Access Denied: Your account has been suspended by PropRush administration. Deposits and wagers are disabled."
      });
      return;
    }

    const stripe = getStripe();

    if (stripe) {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "PropRush Wager & Wallet Deposit ($ USD)",
                description: `Instant deposit into PropRush account wallet for multiplayer real-estate matches.`,
                images: [
                  "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=400&q=80"
                ],
              },
              unit_amount: Math.round(parsedAmount * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        client_reference_id: userId || "guest_player",
        customer_email: userEmail && userEmail.includes("@") ? userEmail : undefined,
        metadata: {
          userId: userId || "guest_player",
          username: username || "Player",
          depositAmount: parsedAmount.toString(),
          app: "PropRush",
        },
        success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}&deposit_success=true&amount=${parsedAmount}`,
        cancel_url: `${baseUrl}/?deposit_canceled=true`,
      });

      res.json({
        success: true,
        sessionId: session.id,
        url: session.url,
        mode: "stripe",
      });
      return;
    }

    // Sandbox fallback
    const simulatedSessionId = `cs_sandbox_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sandboxSessions.set(simulatedSessionId, {
      id: simulatedSessionId,
      amount: parsedAmount,
      paid: true,
      userId: userId || "guest_player",
      userEmail: userEmail || "player@example.com",
      createdAt: Date.now(),
    });

    res.json({
      success: true,
      sessionId: simulatedSessionId,
      url: `${baseUrl}/?session_id=${simulatedSessionId}&deposit_success=true&amount=${parsedAmount}&mode=sandbox`,
      mode: "sandbox",
      message: "Sandbox test session created. Add STRIPE_SECRET_KEY to Settings for live Stripe cards.",
    });
  } catch (error: any) {
    console.error("Error creating Stripe checkout session:", error);
    res.status(500).json({
      error: error.message || "Failed to create Stripe checkout session",
    });
  }
});

// Stripe verify session
api.get("/stripe/verify-session", async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ error: "sessionId parameter is required" });
      return;
    }

    if (sessionId.startsWith("cs_sandbox_")) {
      const record = sandboxSessions.get(sessionId);
      if (record) {
        res.json({
          success: true,
          paid: record.paid,
          amount: record.amount,
          currency: "usd",
          customerEmail: record.userEmail,
          userId: record.userId,
          mode: "sandbox",
        });
        return;
      }
    }

    const stripe = getStripe();
    if (!stripe) {
      res.json({
        success: true,
        paid: true,
        amount: parseFloat(req.query.amount as string) || 20,
        currency: "usd",
        mode: "sandbox_unverified",
      });
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const isPaid = session.payment_status === "paid" || session.status === "complete";
    const amountTotal = (session.amount_total ? session.amount_total / 100 : 0);

    res.json({
      success: true,
      paid: isPaid,
      amount: amountTotal,
      currency: session.currency || "usd",
      customerEmail: session.customer_details?.email || session.customer_email,
      metadata: session.metadata,
      mode: "stripe",
    });
  } catch (error: any) {
    console.error("Error verifying Stripe session:", error);
    res.status(500).json({
      error: error.message || "Failed to verify Stripe checkout session",
    });
  }
});

// ==========================================
// GAME ROOM ENDPOINTS
// ==========================================

// GET /rooms - List active rooms
api.get("/rooms", (_req: Request, res: Response) => {
  try {
    loadPersistedRooms();
    const list = Array.from(serverRooms.values()).map(r => {
      const players = Array.isArray(r.players) ? r.players : [];
      const hostPlayer = players.find(p => p && p.id === r.hostId) || players[0];
      return {
        code: r.code,
        name: r.name || `Room ${r.code.toUpperCase()}`,
        host: hostPlayer?.name || 'Host',
        hostAvatar: hostPlayer?.avatar || 'orange',
        players: players.length,
        max: r.maxPlayers || 4,
        bet: typeof r.betAmount === 'number' ? r.betAmount : 0,
        turnTime: r.turnTimeSeconds || 15,
        map: (r.boardTheme || '').toLowerCase().includes('cyber') ? 'Cyber Neon' : (r.boardTheme || '').toLowerCase().includes('world') ? 'Worldwide' : 'Classic',
        status: r.status || 'waiting',
        createdAt: r.createdAt || Date.now(),
        initialCash: r.initialCash || 1500,
        isCustom: r.isCustom ?? true
      };
    });
    res.json({ rooms: list });
  } catch (err: any) {
    console.error("Error in GET /rooms:", err);
    res.json({ rooms: [] });
  }
});

// GET /rooms/:code - Retrieve live room state
api.get("/rooms/:code", (req: Request, res: Response): void => {
  try {
    const code = (req.params.code || '').trim().toLowerCase();
    loadPersistedRooms();
    let room = serverRooms.get(code);
    if (!room) {
      res.status(404).json({ exists: false, error: `Room ${code} not found` });
      return;
    }
    res.json({ exists: true, room });
  } catch (err: any) {
    res.status(500).json({ exists: false, error: err.message || "Server error" });
  }
});

// POST /rooms - Create room
api.post("/rooms", (req: Request, res: Response): void => {
  try {
    const raw = req.body || {};
    const hostEmail = (raw.hostEmail || raw.email || (raw.players && raw.players[0]?.email) || '').toLowerCase().trim();
    const hostId = (raw.hostId || (raw.players && raw.players[0]?.id) || '').trim();

    if ((hostEmail && bannedEmailsSet.has(hostEmail)) || (hostId && bannedIdsSet.has(hostId))) {
      res.status(403).json({
        error: "Access Denied: Your account has been suspended by PropRush administration. You cannot create game tables."
      });
      return;
    }

    const code = (raw.code || raw.roomCode || 'room_' + Math.random().toString(36).substring(2, 7)).trim().toLowerCase();
    loadPersistedRooms();
    const existing = serverRooms.get(code);
    const now = Date.now();

    if (existing && existing.status !== 'finished') {
      res.json({ success: true, room: existing });
      return;
    }

    const newRoom: ServerRoom = {
      code,
      name: raw.name || raw.roomName || `Room ${code.toUpperCase()}`,
      hostId: hostId || (raw.players && raw.players[0]?.id) || 'host_' + now,
      isPrivate: Boolean(raw.isPrivate),
      maxPlayers: raw.maxPlayers || raw.max || 4,
      betAmount: typeof raw.betAmount === 'number' ? raw.betAmount : (typeof raw.bet === 'number' ? raw.bet : 0),
      initialCash: raw.initialCash || 1500,
      turnTimeSeconds: raw.turnTimeSeconds || raw.turnTime || 15,
      boardTheme: raw.boardTheme || raw.map || 'classic',
      fillWithBots: Boolean(raw.fillWithBots),
      status: raw.status || 'waiting',
      players: Array.isArray(raw.players) ? raw.players : [],
      currentTurnPlayerId: raw.currentTurnPlayerId || (raw.players && raw.players[0]?.id) || '',
      currentTurnIndex: raw.currentTurnIndex || 0,
      turnPhase: raw.turnPhase || 'roll',
      turnTimer: raw.turnTimer || raw.turnTimeSeconds || 15,
      lastDice: raw.lastDice || [1, 2],
      isDouble: Boolean(raw.isDouble),
      consecutiveDoubles: raw.consecutiveDoubles || 0,
      doubleCount: raw.doubleCount || 0,
      freeParkingPool: raw.freeParkingPool || 100,
      auction: raw.auction || null,
      activeTrade: raw.activeTrade || null,
      pendingCard: raw.pendingCard || null,
      winner: raw.winner || null,
      logs: Array.isArray(raw.logs) ? raw.logs : [
        { id: 'l_' + now, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: `Room ${code} created. Waiting for players...`, type: 'info' }
      ],
      chatMessages: Array.isArray(raw.chatMessages) ? raw.chatMessages : [
        { id: 'c_' + now, sender: 'System', avatar: 'navy', text: `Welcome to room ${code}!`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ],
      version: 1,
      createdAt: now,
      updatedAt: now,
      isCustom: true
    };

    serverRooms.set(code, newRoom);
    savePersistedRooms();
    res.json({ success: true, room: newRoom });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create room' });
  }
});

// POST /rooms/:code/join - Join player to room
api.post("/rooms/:code/join", (req: Request, res: Response): void => {
  try {
    const code = (req.params.code || '').trim().toLowerCase();
    const body = req.body || {};
    const player = body.player || body;

    if (!player || (!player.id && !player.name)) {
      res.status(400).json({ error: 'Player data is required' });
      return;
    }

    if (!player.id) {
      player.id = 'usr_' + Math.random().toString(36).substring(2, 8);
    }

    const playerEmail = (player.email || '').toLowerCase().trim();
    const playerId = (player.id || '').trim();

    if ((playerEmail && bannedEmailsSet.has(playerEmail)) || (playerId && bannedIdsSet.has(playerId))) {
      res.status(403).json({
        error: "Access Denied: Your account has been suspended by PropRush administration. You cannot enter game tables."
      });
      return;
    }

    loadPersistedRooms();
    let room = serverRooms.get(code);

    // Auto-create room if joining by code or share link
    const now = Date.now();
    if (!room) {
      const isDefault = code === 'tokyo88' || code === 'whale50' || code === 'inu17';
      room = {
        code,
        name: `Room ${code.toUpperCase()}`,
        hostId: player.id,
        isPrivate: false,
        maxPlayers: 4,
        betAmount: 0,
        initialCash: 1500,
        turnTimeSeconds: 15,
        boardTheme: 'classic',
        fillWithBots: false,
        status: 'waiting',
        players: [],
        logs: [],
        chatMessages: [],
        version: 1,
        createdAt: now,
        updatedAt: now,
        isCustom: !isDefault
      };
      serverRooms.set(code, room);
    }

    if (!Array.isArray(room.players)) room.players = [];
    if (!Array.isArray(room.logs)) room.logs = [];
    if (!Array.isArray(room.chatMessages)) room.chatMessages = [];

    // Check if player already in room
    let existingPlayerIndex = room.players.findIndex(p => p && p.id === player.id);

    if (existingPlayerIndex >= 0) {
      room.players[existingPlayerIndex] = {
        ...room.players[existingPlayerIndex],
        ...player,
        name: player.name || room.players[existingPlayerIndex].name
      };
    } else {
      if (room.players.length >= room.maxPlayers) {
        res.status(400).json({ error: `Room is full (${room.players.length}/${room.maxPlayers} players).` });
        return;
      }

      const playerColors = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
      const assignedColor = player.color || playerColors[room.players.length % playerColors.length];
      
      let displayName = player.name || 'Player';
      const sameNameCount = room.players.filter(p => p && (p.name === displayName || String(p.name || '').startsWith(displayName + ' '))).length;
      if (sameNameCount > 0) {
        displayName = `${displayName} (${sameNameCount + 1})`;
      }

      const newPlayer = {
        id: player.id,
        name: displayName,
        avatar: player.avatar || (room.players.length % 2 === 1 ? 'purple' : 'orange'),
        avatarFrame: player.avatarFrame,
        diceSkin: player.diceSkin || 'dice_golden',
        color: assignedColor,
        cash: room.initialCash || 1500,
        netWorth: room.initialCash || 1500,
        position: 0,
        inJail: false,
        jailTurns: 0,
        getOutOfJailCards: 0,
        properties: [],
        mortgaged: [],
        houses: {},
        isBankrupt: false,
        isBot: Boolean(player.isBot),
        isHost: room.players.length === 0 || (room.hostId === player.id)
      };

      room.players.push(newPlayer);

      if (!newPlayer.isBot && newPlayer.name) {
        const emailVal = player.email || `${newPlayer.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@player.proprush.com`;
        const existingP = findPlatformUser(newPlayer.id, emailVal);
        if (!existingP) {
          platformUsersMap.set(newPlayer.id, {
            id: newPlayer.id,
            username: newPlayer.name,
            email: emailVal,
            avatar: newPlayer.avatar || 'orange',
            avatarFrame: newPlayer.avatarFrame,
            walletBalance: 100.0,
            coins: 50,
            leaguePoints: 300,
            leagueTier: 'Silver',
            level: 1,
            stats: {
              gamesPlayed: 1,
              gamesWon: 0,
              winStreak: 0,
              bestWinStreak: 0,
              totalEarningsUsd: 0,
              totalCoinsEarned: 50
            },
            role: 'player',
            isBanned: false,
            country: 'Global',
            city: 'Online',
            joinedDate: new Date().toISOString().split('T')[0],
            title: 'Active Competitor',
            lastActive: now
          });
        }
      }

      room.logs.unshift({
        id: 'l_' + now,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `👋 ${newPlayer.name} joined the room! (${room.players.length}/${room.maxPlayers})`,
        type: 'info'
      });
    }

    room.version = (room.version || 0) + 1;
    room.updatedAt = now;
    serverRooms.set(code, room);
    savePersistedRooms();

    res.json({ success: true, room });
  } catch (err: any) {
    console.error("Error in /rooms/:code/join:", err);
    res.status(500).json({ error: err.message || "Failed to join room" });
  }
});

// POST /rooms/:code/state - State synchronization
api.post("/rooms/:code/state", (req: Request, res: Response): void => {
  try {
    const code = (req.params.code || '').trim().toLowerCase();
    const body = req.body || {};
    const updatedRoom = body.room || body;

    if (!updatedRoom) {
      res.status(400).json({ error: 'Room state required' });
      return;
    }

    loadPersistedRooms();
    let existing = serverRooms.get(code);
    const now = Date.now();

    const merged: ServerRoom = {
      ...(existing || {}),
      ...updatedRoom,
      code,
      version: (existing ? (existing.version || 0) : 0) + 1,
      updatedAt: now
    };

    serverRooms.set(code, merged);
    savePersistedRooms();
    res.json({ success: true, version: merged.version });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update state' });
  }
});

// POST /rooms/:code/chat - Append chat message
api.post("/rooms/:code/chat", (req: Request, res: Response): void => {
  try {
    const code = (req.params.code || '').trim().toLowerCase();
    const body = req.body || {};
    const message = body.message || body;

    if (!message || !message.text) {
      res.status(400).json({ error: 'Valid chat message required' });
      return;
    }

    loadPersistedRooms();
    let room = serverRooms.get(code);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const chatEntry = {
      id: message.id || 'c_' + Date.now(),
      sender: message.sender || 'Player',
      avatar: message.avatar || 'orange',
      text: message.text,
      time: message.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    room.chatMessages = [...(room.chatMessages || []).slice(-40), chatEntry];
    room.version = (room.version || 0) + 1;
    room.updatedAt = Date.now();

    serverRooms.set(code, room);
    savePersistedRooms();
    res.json({ success: true, message: chatEntry, chatMessages: room.chatMessages });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to send chat' });
  }
});

// ==========================================
// USER DIRECTORY & RANKINGS ENDPOINTS
// ==========================================

api.get("/users", (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || '').toLowerCase().trim();
    const seenIds = new Set<string>();
    const seenEmails = new Set<string>();
    let list: PlatformUser[] = [];

    for (const u of platformUsersMap.values()) {
      if (u.email && u.email.endsWith('@proprush.player') && String(u.username || '').toLowerCase() === 'sahitya') {
        u.email = 'sahityagroovy@gmail.com';
      }

      const cleanEmail = (u.email || '').toLowerCase().trim();
      if (seenIds.has(u.id)) continue;
      if (cleanEmail && seenEmails.has(cleanEmail)) continue;

      seenIds.add(u.id);
      if (cleanEmail) seenEmails.add(cleanEmail);
      list.push(u);
    }

    if (query) {
      list = list.filter(u => 
        String(u.username || '').toLowerCase().includes(query) || 
        String(u.email || '').toLowerCase().includes(query) ||
        String(u.city || '').toLowerCase().includes(query) ||
        String(u.country || '').toLowerCase().includes(query) ||
        String(u.title || '').toLowerCase().includes(query)
      );
    }

    res.json({ users: list, total: list.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to list users", users: [], total: 0 });
  }
});

api.post("/users/sync", (req: Request, res: Response): void => {
  try {
    const { user } = req.body || {};
    if (!user) {
      res.status(400).json({ error: "Missing user profile data" });
      return;
    }

    const rawId = (user.id || user.dynamicUserId || '').trim();
    const rawWallet = (user.walletAddress || '').trim();
    const rawEmail = (user.email || '').trim();
    const rawUsername = (user.username || '').trim();

    let existing = findPlatformUser(rawId, rawEmail, rawWallet);

    const resolvedId = existing?.id || rawId || (rawWallet ? `usr_${rawWallet.slice(2, 10)}` : ('usr_' + Date.now()));
    const resolvedEmail = rawEmail || existing?.email || '';
    const resolvedWallet = rawWallet || existing?.walletAddress || '';

    const isAdmin = resolvedEmail.toLowerCase() === 'sahityanijhawan@gmail.com' || (existing?.role === 'admin') || (user.role === 'admin');

    const updatedUser: PlatformUser = {
      id: resolvedId,
      username: rawUsername || existing?.username || (resolvedWallet ? `${resolvedWallet.slice(0, 6)}...${resolvedWallet.slice(-4)}` : (resolvedEmail ? resolvedEmail.split('@')[0] : 'Player')),
      email: resolvedEmail,
      walletAddress: resolvedWallet,
      avatar: user.avatar || existing?.avatar || 'orange',
      avatarFrame: user.avatarFrame || existing?.avatarFrame,
      profilePictureUrl: user.profilePictureUrl || existing?.profilePictureUrl,
      walletBalance: typeof user.walletBalance === 'number'
        ? user.walletBalance
        : (existing?.walletBalance ?? 0),
      coins: typeof user.coins === 'number'
        ? user.coins
        : (existing?.coins ?? 0),
      leaguePoints: typeof user.leaguePoints === 'number'
        ? user.leaguePoints
        : (existing?.leaguePoints ?? 0),
      leagueTier: user.leagueTier || existing?.leagueTier || 'Bronze',
      level: user.level || existing?.level || 1,
      stats: {
        gamesPlayed: typeof user.stats?.gamesPlayed === 'number' ? user.stats.gamesPlayed : (existing?.stats?.gamesPlayed || 0),
        gamesWon: typeof user.stats?.gamesWon === 'number' ? user.stats.gamesWon : (existing?.stats?.gamesWon || 0),
        winStreak: typeof user.stats?.winStreak === 'number' ? user.stats.winStreak : (existing?.stats?.winStreak || 0),
        bestWinStreak: typeof user.stats?.bestWinStreak === 'number' ? user.stats.bestWinStreak : (existing?.stats?.bestWinStreak || 0),
        totalEarningsUsd: typeof user.stats?.totalEarningsUsd === 'number' ? user.stats.totalEarningsUsd : (existing?.stats?.totalEarningsUsd || 0),
        totalCoinsEarned: typeof user.stats?.totalCoinsEarned === 'number' ? user.stats.totalCoinsEarned : (existing?.stats?.totalCoinsEarned || 0),
      },
      role: isAdmin ? 'admin' : (existing?.role || 'player'),
      isBanned: existing?.isBanned || (Boolean(resolvedEmail) && bannedEmailsSet.has(resolvedEmail.toLowerCase())) || bannedIdsSet.has(resolvedId),
      country: existing?.country || 'United States',
      city: existing?.city || 'San Francisco',
      joinedDate: existing?.joinedDate || new Date().toISOString().split('T')[0],
      title: existing?.title || (isAdmin ? 'Platform Administrator' : 'Competitive Player'),
      lastActive: Date.now()
    };

    for (const [key, val] of platformUsersMap.entries()) {
      if (
        (resolvedEmail && val.email && val.email.toLowerCase() === resolvedEmail.toLowerCase()) ||
        (resolvedWallet && val.walletAddress && val.walletAddress.toLowerCase() === resolvedWallet.toLowerCase()) ||
        (key === resolvedId)
      ) {
        platformUsersMap.delete(key);
      }
    }

    platformUsersMap.set(resolvedId, updatedUser);
    res.json({ success: true, user: updatedUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to sync user" });
  }
});

api.get("/rankings", (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as string || 'season').toLowerCase();
    const search = (req.query.search as string || '').toLowerCase().trim();
    const currentEmail = (req.query.currentEmail as string || '').toLowerCase().trim();

    const seenEmails = new Set<string>();
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const uniqueUsers: PlatformUser[] = [];

    for (const u of platformUsersMap.values()) {
      const cleanEmail = (u.email || '').toLowerCase().trim();
      const cleanName = String(u.username || '').toLowerCase().trim();
      if (seenIds.has(u.id)) continue;
      if (cleanEmail && seenEmails.has(cleanEmail)) continue;
      if (cleanName && seenNames.has(cleanName)) continue;

      seenIds.add(u.id);
      if (cleanEmail) seenEmails.add(cleanEmail);
      if (cleanName) seenNames.add(cleanName);
      uniqueUsers.push(u);
    }

    let list = uniqueUsers.map(u => {
      const isCurrent = Boolean(
        currentEmail && u.email && u.email.toLowerCase() === currentEmail
      );
      const stats = u.stats || { gamesPlayed: 0, gamesWon: 0, winStreak: 0, bestWinStreak: 0, totalEarningsUsd: 0, totalCoinsEarned: 0 };
      const winRate = stats.gamesPlayed > 0 
        ? Number(((stats.gamesWon / stats.gamesPlayed) * 100).toFixed(1))
        : 0;

      const weeklyWins = Math.max(0, Math.min(stats.gamesWon, Math.round(stats.gamesWon * 0.22) || (stats.gamesWon > 0 ? 1 : 0)));
      const weeklyGames = Math.max(weeklyWins, Math.min(stats.gamesPlayed, Math.round(stats.gamesPlayed * 0.22) || (stats.gamesPlayed > 0 ? 1 : 0)));
      const weeklyEarnings = Number((stats.totalEarningsUsd * 0.20).toFixed(2));
      const weeklyStreak = Math.min(stats.winStreak, weeklyWins);
      const weeklyPoints = Math.round(weeklyWins * 45 + weeklyStreak * 15 + ((u.leaguePoints || 0) * 0.08));
      const weeklyWinRate = weeklyGames > 0
        ? Number(((weeklyWins / weeklyGames) * 100).toFixed(1))
        : 0;

      return {
        id: u.id,
        name: u.username || 'Player',
        email: u.email || '',
        avatar: u.avatar || 'orange',
        frame: u.avatarFrame,
        profilePictureUrl: u.profilePictureUrl,
        tier: u.leagueTier || 'Bronze',
        lp: u.leaguePoints || 0,
        earningsUsd: stats.totalEarningsUsd || 0,
        wins: stats.gamesWon || 0,
        gamesPlayed: stats.gamesPlayed || 0,
        winRate,
        winStreak: stats.winStreak || 0,
        favoriteMap: u.avatar === 'cyber' ? 'Cyber Neon Metropolis' : u.avatar === 'gold' ? 'Worldwide Grand Tour' : 'Classic RichUp Grid',
        title: u.title || 'Player',
        country: u.country || 'Global',
        city: u.city || 'Online',
        joinedDate: u.joinedDate || new Date().toISOString().split('T')[0],
        isCurrentUser: isCurrent,
        weeklyPoints,
        weeklyEarningsUsd: weeklyEarnings,
        weeklyWins,
        weeklyGamesPlayed: weeklyGames,
        weeklyWinRate,
        weeklyStreak,
        weeklyProjectedPrize: '',
        allTimeEarningsUsd: stats.totalEarningsUsd || 0,
        allTimeWins: stats.gamesWon || 0,
        allTimeGamesPlayed: stats.gamesPlayed || 0,
        allTimeWinRate: winRate,
        allTimeBestStreak: stats.bestWinStreak || stats.winStreak || 0,
        allTimeCoins: stats.totalCoinsEarned || u.coins || 0,
      };
    });

    if (search) {
      list = list.filter(p => 
        String(p.name || '').toLowerCase().includes(search) || 
        String(p.title || '').toLowerCase().includes(search) ||
        String(p.city || '').toLowerCase().includes(search) ||
        String(p.country || '').toLowerCase().includes(search) ||
        String(p.tier || '').toLowerCase().includes(search)
      );
    }

    if (timeframe === 'weekly') {
      list.sort((a, b) => {
        if (b.weeklyPoints !== a.weeklyPoints) return b.weeklyPoints - a.weeklyPoints;
        return b.weeklyEarningsUsd - a.weeklyEarningsUsd;
      });
    } else if (timeframe === 'all_time') {
      list.sort((a, b) => {
        if (b.allTimeEarningsUsd !== a.allTimeEarningsUsd) return b.allTimeEarningsUsd - a.allTimeEarningsUsd;
        return b.allTimeWins - a.allTimeWins;
      });
    } else {
      list.sort((a, b) => {
        if (b.lp !== a.lp) return b.lp - a.lp;
        return b.earningsUsd - a.earningsUsd;
      });
    }

    const rankedList = list.map((item, index) => {
      const rank = index + 1;
      let prize = '+10 🪙';
      if (rank === 1) prize = '🥇 +60 🪙 & Diamond Badge';
      else if (rank === 2) prize = '🥈 +40 🪙';
      else if (rank === 3) prize = '🥉 +25 🪙';

      return {
        ...item,
        rank,
        weeklyProjectedPrize: prize
      };
    });

    res.json({ 
      timeframe,
      rankings: rankedList, 
      total: rankedList.length 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to get rankings", rankings: [], total: 0 });
  }
});

api.post("/admin/users/action", (req: Request, res: Response): void => {
  try {
    const { email, id, action, value } = req.body || {};
    if (!email && !id) {
      res.status(400).json({ error: "User email or ID required" });
      return;
    }

    let target = findPlatformUser(id, email);
    if (!target) {
      const userEmail = (email || '').toLowerCase().trim();
      const userId = id || ('usr_' + Date.now());
      target = {
        id: userId,
        username: userEmail ? userEmail.split('@')[0] : 'Player',
        email: userEmail || `${userId}@proprush.player`,
        avatar: 'orange',
        walletBalance: 0,
        coins: 0,
        leaguePoints: 0,
        leagueTier: 'Bronze',
        level: 1,
        stats: {
          gamesPlayed: 0,
          gamesWon: 0,
          winStreak: 0,
          bestWinStreak: 0,
          totalEarningsUsd: 0,
          totalCoinsEarned: 0
        },
        role: 'player',
        isBanned: false,
        country: 'Global',
        city: 'Online',
        joinedDate: new Date().toISOString().split('T')[0],
        title: 'Player',
        lastActive: Date.now()
      };
      platformUsersMap.set(target.id, target);
    }

    const emailKey = target.email ? target.email.toLowerCase().trim() : '';

    if (action === 'credit') {
      const amount = parseFloat(value);
      if (!isNaN(amount) && amount > 0) {
        target.walletBalance = Math.round((target.walletBalance + amount) * 100) / 100;
      }
    } else if (action === 'toggleBan') {
      target.isBanned = !target.isBanned;
      if (target.isBanned) {
        if (emailKey) bannedEmailsSet.add(emailKey);
        if (target.id) bannedIdsSet.add(target.id);
      } else {
        if (emailKey) bannedEmailsSet.delete(emailKey);
        if (target.id) bannedIdsSet.delete(target.id);
      }
    } else if (action === 'ban') {
      target.isBanned = true;
      if (emailKey) bannedEmailsSet.add(emailKey);
      if (target.id) bannedIdsSet.add(target.id);
    } else if (action === 'unban') {
      target.isBanned = false;
      if (emailKey) bannedEmailsSet.delete(emailKey);
      if (target.id) bannedIdsSet.delete(target.id);
    } else if (action === 'delete') {
      if (target.id) {
        platformUsersMap.delete(target.id);
        bannedIdsSet.delete(target.id);
      }
      if (emailKey) {
        bannedEmailsSet.delete(emailKey);
        for (const [k, u] of platformUsersMap.entries()) {
          if (u.email && u.email.toLowerCase().trim() === emailKey) {
            platformUsersMap.delete(k);
          }
        }
      }
      res.json({ success: true, deleted: true, id: target.id });
      return;
    } else if (action === 'role') {
      target.role = value === 'admin' ? 'admin' : 'player';
    }

    platformUsersMap.set(target.id, target);
    res.json({ success: true, user: target });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed action" });
  }
});

// Mount the API router at both /api and / so it matches whether path prefix is preserved or stripped
app.use("/api", api);
app.use("/", api);

// Global API error handler
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error("Unhandled API error:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
});

export default app;
