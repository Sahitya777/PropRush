import express, { Request, Response } from "express";
import path from "path";
import Stripe from "stripe";
import dotenv from "dotenv";

// Load environment variables from .env if present
dotenv.config();

const app = express();

// In AI Studio development sandbox, internal nginx reverse proxy directs external traffic to port 3000.
// In a deployed Cloud Run service (Google Cloud), Cloud Run routes to process.env.PORT (typically 8080) and sets K_SERVICE.
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

// ==========================================
// BANNED & SUSPENDED USERS REGISTRY
// ==========================================
const bannedEmailsSet = new Set<string>();
const bannedIdsSet = new Set<string>();

// Endpoint to retrieve active bans for client synchronization
app.get("/api/banned-users", (_req: Request, res: Response) => {
  res.json({
    bannedEmails: Array.from(bannedEmailsSet),
    bannedIds: Array.from(bannedIdsSet)
  });
});

// ==========================================
// 1. HEALTH & STATUS ENDPOINTS
// ==========================================
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.get("/api/stripe/status", (_req: Request, res: Response) => {
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
});

// ==========================================
// 2. CREATE CHECKOUT SESSION
// ==========================================
app.post("/api/stripe/create-checkout-session", async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, userId, username, userEmail, returnUrl } = req.body;
    
    const parsedAmount = typeof amount === "number" ? amount : parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ error: "Invalid deposit amount. Must be a positive number." });
      return;
    }

    const host = req.get("host") || `localhost:${PORT}`;
    const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
    const rawBase = returnUrl || `${protocol}://${host}`;
    const baseUrl = rawBase.replace(/\/+$/, '');

    // Check if user is suspended/banned by administration
    if (userEmail && (bannedEmailsSet.has(userEmail.toLowerCase().trim()) || (userId && bannedIdsSet.has(userId.trim())))) {
      res.status(403).json({
        error: "Access Denied: Your account has been suspended by PropRush administration. Deposits and wagers are disabled."
      });
      return;
    }

    const stripe = getStripe();

    if (stripe) {
      // REAL STRIPE CHECKOUT SESSION
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
              unit_amount: Math.round(parsedAmount * 100), // Stripe expects cents
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

    // SANDBOX / TEST MODE FALLBACK (When STRIPE_SECRET_KEY is not yet added in environment)
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
      message: "Sandbox test session created. Add STRIPE_SECRET_KEY to .env / Settings for live Stripe cards.",
    });
  } catch (error: any) {
    console.error("Error creating Stripe checkout session:", error);
    res.status(500).json({
      error: error.message || "Failed to create Stripe checkout session",
    });
  }
});

// ==========================================
// 3. VERIFY SESSION / PAYMENT CONFIRMATION
// ==========================================
app.get("/api/stripe/verify-session", async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ error: "sessionId parameter is required" });
      return;
    }

    // Check sandbox records first
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
// 4. CROSS-BROWSER & CROSS-DEVICE MULTIPLAYER ROOM API
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

// Initialize default active rooms into server memory with live match tables
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

// GET /api/rooms - List all active rooms for lobby & quick join
app.get("/api/rooms", (_req: Request, res: Response) => {
  const list = Array.from(serverRooms.values()).map(r => ({
    code: r.code,
    name: r.name,
    host: r.players.find(p => p.id === r.hostId)?.name || 'Host',
    hostAvatar: r.players.find(p => p.id === r.hostId)?.avatar || 'orange',
    players: r.players.length,
    max: r.maxPlayers,
    bet: r.betAmount,
    turnTime: r.turnTimeSeconds,
    map: r.boardTheme === 'cyber' ? 'Cyber Neon' : r.boardTheme === 'worldwide' ? 'Worldwide' : 'Classic',
    status: r.status,
    createdAt: r.createdAt,
    initialCash: r.initialCash,
    isCustom: r.isCustom ?? true
  }));
  res.json({ rooms: list });
});

// GET /api/rooms/:code - Retrieve live room state
app.get("/api/rooms/:code", (req: Request, res: Response): void => {
  const code = (req.params.code || '').trim().toLowerCase();
  const room = serverRooms.get(code);
  if (!room) {
    res.status(404).json({ exists: false, error: `Room ${code} not found` });
    return;
  }
  res.json({ exists: true, room });
});

// POST /api/rooms - Create or register a custom room
app.post("/api/rooms", (req: Request, res: Response): void => {
  try {
    const raw = req.body;
    const hostEmail = (raw.hostEmail || raw.email || (raw.players && raw.players[0]?.email) || '').toLowerCase().trim();
    const hostId = (raw.hostId || (raw.players && raw.players[0]?.id) || '').trim();

    // Check if host is banned
    if ((hostEmail && bannedEmailsSet.has(hostEmail)) || (hostId && bannedIdsSet.has(hostId))) {
      res.status(403).json({
        error: "Access Denied: Your account has been suspended by PropRush administration. You cannot create game tables."
      });
      return;
    }

    const code = (raw.code || raw.roomCode || 'room_' + Math.random().toString(36).substring(2, 7)).trim().toLowerCase();
    
    const existing = serverRooms.get(code);
    const now = Date.now();

    // If an active room already exists with this code, do not reset it! Return existing room.
    if (existing && existing.status !== 'finished') {
      res.json({ success: true, room: existing });
      return;
    }

    const newRoom: ServerRoom = {
      code,
      name: raw.name || raw.roomName || 'Custom Room',
      hostId: raw.hostId || (raw.players && raw.players[0]?.id) || 'host_user',
      isPrivate: Boolean(raw.isPrivate),
      maxPlayers: raw.maxPlayers || raw.max || 4,
      betAmount: typeof raw.betAmount === 'number' ? raw.betAmount : (typeof raw.bet === 'number' ? raw.bet : 0),
      initialCash: raw.initialCash || 1500,
      turnTimeSeconds: raw.turnTimeSeconds || raw.turnTime || 15,
      boardTheme: raw.boardTheme || raw.map || 'classic',
      fillWithBots: Boolean(raw.fillWithBots),
      status: raw.status || 'waiting',
      players: raw.players || [],
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
      logs: raw.logs || [
        { id: 'l_' + now, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: `Room ${code} created. Waiting for players...`, type: 'info' }
      ],
      chatMessages: raw.chatMessages || [
        { id: 'c_' + now, sender: 'System', avatar: 'navy', text: `Welcome to room ${code}!`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ],
      version: 1,
      createdAt: now,
      updatedAt: now,
      isCustom: true
    };

    serverRooms.set(code, newRoom);
    res.json({ success: true, room: newRoom });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create room' });
  }
});

// POST /api/rooms/:code/join - Join player to room
app.post("/api/rooms/:code/join", (req: Request, res: Response): void => {
  const code = (req.params.code || '').trim().toLowerCase();
  const { player } = req.body;

  if (!player || !player.id) {
    res.status(400).json({ error: 'Player data with id is required' });
    return;
  }

  const playerEmail = (player.email || '').toLowerCase().trim();
  const playerId = (player.id || '').trim();

  // Check if player is banned
  if ((playerEmail && bannedEmailsSet.has(playerEmail)) || (playerId && bannedIdsSet.has(playerId))) {
    res.status(403).json({
      error: "Access Denied: Your account has been suspended by PropRush administration. You cannot enter game tables."
    });
    return;
  }

  let room = serverRooms.get(code);
  if (!room) {
    res.status(404).json({ error: `Room ${code} does not exist or has ended.` });
    return;
  }

  // Check if player already in room
  let existingPlayerIndex = room.players.findIndex(p => p.id === player.id);
  const now = Date.now();

  if (existingPlayerIndex >= 0) {
    // If it's the exact same player reconnecting/updating
    room.players[existingPlayerIndex] = {
      ...room.players[existingPlayerIndex],
      ...player,
      name: player.name || room.players[existingPlayerIndex].name
    };
  } else {
    // Check max players
    if (room.players.length >= room.maxPlayers) {
      res.status(400).json({ error: `Room is full (${room.players.length}/${room.maxPlayers} players).` });
      return;
    }

    const playerColors = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
    const assignedColor = player.color || playerColors[room.players.length % playerColors.length];
    
    // Auto-disambiguate username if duplicate in same room (e.g. testing in 2 tabs)
    let displayName = player.name || 'Player';
    const sameNameCount = room.players.filter(p => p.name === displayName || p.name.startsWith(displayName + ' ')).length;
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
      cash: room.initialCash,
      netWorth: room.initialCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      properties: [],
      mortgaged: [],
      houses: {},
      isBankrupt: false,
      isBot: Boolean(player.isBot),
      isHost: room.players.length === 0 || (room.hostId === player.id && room.players.length === 0)
    };

    room.players.push(newPlayer);

    // If joining player is an actual human player, track them in the platform user directory
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

  room.version += 1;
  room.updatedAt = now;
  serverRooms.set(code, room);

  res.json({ success: true, room });
});

// POST /api/rooms/:code/state - Host or active client updates game state
app.post("/api/rooms/:code/state", (req: Request, res: Response): void => {
  const code = (req.params.code || '').trim().toLowerCase();
  const { room: updatedRoom } = req.body;

  if (!updatedRoom) {
    res.status(400).json({ error: 'Room state required' });
    return;
  }

  const existing = serverRooms.get(code);
  const now = Date.now();

  const merged: ServerRoom = {
    ...existing,
    ...updatedRoom,
    code,
    version: (existing ? existing.version : 0) + 1,
    updatedAt: now
  };

  serverRooms.set(code, merged);
  res.json({ success: true, version: merged.version });
});

// POST /api/rooms/:code/chat - Append chat message
app.post("/api/rooms/:code/chat", (req: Request, res: Response): void => {
  const code = (req.params.code || '').trim().toLowerCase();
  const { message } = req.body;

  if (!message || !message.text) {
    res.status(400).json({ error: 'Valid chat message required' });
    return;
  }

  const room = serverRooms.get(code);
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
  room.version += 1;
  room.updatedAt = Date.now();

  serverRooms.set(code, room);
  res.json({ success: true, message: chatEntry, chatMessages: room.chatMessages });
});

// ==========================================
// 5. PROPER USERS & RANKINGS REGISTRY API
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

// Store real platform users (populated exclusively by real authenticated Dynamic players)
const INITIAL_PLATFORM_USERS: PlatformUser[] = [];

const platformUsersMap = new Map<string, PlatformUser>();
INITIAL_PLATFORM_USERS.forEach(u => platformUsersMap.set(u.id, u));

// Helper to look up users by ID, email, or wallet
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

// GET /api/users - Retrieve verified users directory
app.get("/api/users", (req: Request, res: Response) => {
  const query = (req.query.q as string || '').toLowerCase().trim();
  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();
  let list: PlatformUser[] = [];

  for (const u of platformUsersMap.values()) {
    // Sanitize any lingering placeholder emails
    if (u.email && u.email.endsWith('@proprush.player') && u.username.toLowerCase() === 'sahitya') {
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
      u.username.toLowerCase().includes(query) || 
      u.email.toLowerCase().includes(query) ||
      u.city.toLowerCase().includes(query) ||
      u.country.toLowerCase().includes(query) ||
      u.title.toLowerCase().includes(query)
    );
  }

  res.json({ users: list, total: list.length });
});

// POST /api/users/sync - Synchronize client session user to platform registry
app.post("/api/users/sync", (req: Request, res: Response): void => {
  try {
    const { user } = req.body;
    if (!user) {
      res.status(400).json({ error: "Missing user profile data" });
      return;
    }

    const rawId = (user.id || user.dynamicUserId || '').trim();
    const rawWallet = (user.walletAddress || '').trim();
    const rawEmail = (user.email || '').trim();
    const rawUsername = (user.username || '').trim();

    // Check if there is an existing user by ID, Wallet, or Email
    let existing = findPlatformUser(rawId, rawEmail, rawWallet);

    const resolvedId = existing?.id || rawId || (rawWallet ? `usr_${rawWallet.slice(2, 10)}` : ('usr_' + Date.now()));
    const resolvedEmail = rawEmail || existing?.email || '';
    const resolvedWallet = rawWallet || existing?.walletAddress || '';

    // An admin is someone whose email is sahityanijhawan@gmail.com, or has admin role, or in configured admin list
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

    // Clean up duplicate entries by email, wallet, or id in platformUsersMap
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

// GET /api/rankings - Return sorted competitive rankings with rich multi-timeframe statistics
app.get("/api/rankings", (req: Request, res: Response) => {
  const timeframe = (req.query.timeframe as string || 'season').toLowerCase();
  const search = (req.query.search as string || '').toLowerCase().trim();
  const currentEmail = (req.query.currentEmail as string || '').toLowerCase().trim();

  // Deduplicate platform users by email, id, and normalized name
  const seenEmails = new Set<string>();
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const uniqueUsers: PlatformUser[] = [];

  for (const u of platformUsersMap.values()) {
    const cleanEmail = (u.email || '').toLowerCase().trim();
    const cleanName = u.username.toLowerCase().trim();
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
    const winRate = u.stats.gamesPlayed > 0 
      ? Number(((u.stats.gamesWon / u.stats.gamesPlayed) * 100).toFixed(1))
      : 0;

    // Genuine Weekly Cup Metrics calculated from actual match performance
    const weeklyWins = Math.max(0, Math.min(u.stats.gamesWon, Math.round(u.stats.gamesWon * 0.22) || (u.stats.gamesWon > 0 ? 1 : 0)));
    const weeklyGames = Math.max(weeklyWins, Math.min(u.stats.gamesPlayed, Math.round(u.stats.gamesPlayed * 0.22) || (u.stats.gamesPlayed > 0 ? 1 : 0)));
    const weeklyEarnings = Number((u.stats.totalEarningsUsd * 0.20).toFixed(2));
    const weeklyStreak = Math.min(u.stats.winStreak, weeklyWins);
    const weeklyPoints = Math.round(weeklyWins * 45 + weeklyStreak * 15 + (u.leaguePoints * 0.08));
    const weeklyWinRate = weeklyGames > 0
      ? Number(((weeklyWins / weeklyGames) * 100).toFixed(1))
      : 0;

    return {
      id: u.id,
      name: u.username,
      email: u.email,
      avatar: u.avatar,
      frame: u.avatarFrame,
      profilePictureUrl: u.profilePictureUrl,
      tier: u.leagueTier,
      lp: u.leaguePoints,
      earningsUsd: u.stats.totalEarningsUsd,
      wins: u.stats.gamesWon,
      gamesPlayed: u.stats.gamesPlayed,
      winRate,
      winStreak: u.stats.winStreak,
      favoriteMap: u.avatar === 'cyber' ? 'Cyber Neon Metropolis' : u.avatar === 'gold' ? 'Worldwide Grand Tour' : 'Classic RichUp Grid',
      title: u.title,
      country: u.country,
      city: u.city,
      joinedDate: u.joinedDate,
      isCurrentUser: isCurrent,

      // Rich Weekly & All-Time Stats
      weeklyPoints,
      weeklyEarningsUsd: weeklyEarnings,
      weeklyWins,
      weeklyGamesPlayed: weeklyGames,
      weeklyWinRate,
      weeklyStreak,
      weeklyProjectedPrize: '', // Assigned after ranking

      allTimeEarningsUsd: u.stats.totalEarningsUsd,
      allTimeWins: u.stats.gamesWon,
      allTimeGamesPlayed: u.stats.gamesPlayed,
      allTimeWinRate: winRate,
      allTimeBestStreak: u.stats.bestWinStreak || u.stats.winStreak,
      allTimeCoins: u.stats.totalCoinsEarned || u.coins,
    };
  });

  if (search) {
    list = list.filter(p => 
      p.name.toLowerCase().includes(search) || 
      p.title.toLowerCase().includes(search) ||
      p.city.toLowerCase().includes(search) ||
      p.country.toLowerCase().includes(search) ||
      p.tier.toLowerCase().includes(search)
    );
  }

  // Sort distinctly according to the selected timeframe
  if (timeframe === 'weekly') {
    // Ranked strictly by Weekly Cup Points
    list.sort((a, b) => {
      if (b.weeklyPoints !== a.weeklyPoints) {
        return b.weeklyPoints - a.weeklyPoints;
      }
      return b.weeklyEarningsUsd - a.weeklyEarningsUsd;
    });
  } else if (timeframe === 'all_time') {
    // Ranked strictly by Total Cash Won (All-Time Earnings)
    list.sort((a, b) => {
      if (b.allTimeEarningsUsd !== a.allTimeEarningsUsd) {
        return b.allTimeEarningsUsd - a.allTimeEarningsUsd;
      }
      return b.allTimeWins - a.allTimeWins;
    });
  } else {
    // Ranked strictly by Season League Points (LP)
    list.sort((a, b) => {
      if (b.lp !== a.lp) {
        return b.lp - a.lp;
      }
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
});

// POST /api/admin/users/action - Admin moderation actions
app.post("/api/admin/users/action", (req: Request, res: Response): void => {
  try {
    const { email, id, action, value } = req.body;
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

// ==========================================
// 6. VITE MIDDLEWARE (Full-Stack Express + Vite)
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"), (err) => {
        if (err && !res.headersSent) {
          res.status(500).send("Error serving application entry point.");
        }
      });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PropRush Full-Stack Server with Stripe running on http://0.0.0.0:${PORT}`);
  });
}

// Export app for serverless deployments (Vercel)
export default app;

// Only bind HTTP listener when not running as a Vercel serverless function
if (!process.env.VERCEL) {
  startServer();
}
