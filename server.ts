import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Stripe from "stripe";
import dotenv from "dotenv";

// Load environment variables from .env if present
dotenv.config();

const app = express();
const PORT = 3000;

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
  fillWithBots: boolean;
  status: 'waiting' | 'playing' | 'gameover' | 'finished';
  players: any[];
  currentTurnPlayerId: string;
  currentTurnIndex: number;
  turnPhase: string;
  turnTimer: number;
  lastDice: [number, number];
  isDouble: boolean;
  consecutiveDoubles: number;
  doubleCount: number;
  freeParkingPool: number;
  auction: any | null;
  activeTrade: any | null;
  pendingCard: any | null;
  winner: any | null;
  logs: any[];
  chatMessages: any[];
  version: number;
  createdAt: number;
  updatedAt: number;
  isCustom?: boolean;
}

const serverRooms = new Map<string, ServerRoom>();

// Initialize default active rooms into server memory
const defaultRooms: ServerRoom[] = [
  {
    code: 'lnu17',
    name: 'High Stakes NYC Arena',
    hostId: 'host_admin_nyc',
    isPrivate: false,
    maxPlayers: 4,
    betAmount: 100,
    initialCash: 1500,
    turnTimeSeconds: 15,
    boardTheme: 'classic',
    fillWithBots: true,
    status: 'playing',
    players: [
      { id: 'p_admin', name: 'NYC Tycoon', avatar: 'navy', color: '#3b82f6', cash: 1500, netWorth: 1500, position: 0, inJail: false, jailTurns: 0, getOutOfJailCards: 0, properties: [], mortgaged: [], houses: {}, isBankrupt: false, isBot: false, isHost: true },
      { id: 'b_wallstreet', name: 'WallStreet_Wolf', avatar: 'king', color: '#ec4899', cash: 1500, netWorth: 1500, position: 0, inJail: false, jailTurns: 0, getOutOfJailCards: 0, properties: [], mortgaged: [], houses: {}, isBankrupt: false, isBot: true, isHost: false },
      { id: 'b_empire', name: 'Empire_Builder', avatar: 'vip', color: '#10b981', cash: 1500, netWorth: 1500, position: 0, inJail: false, jailTurns: 0, getOutOfJailCards: 0, properties: [], mortgaged: [], houses: {}, isBankrupt: false, isBot: true, isHost: false }
    ],
    currentTurnPlayerId: 'p_admin',
    currentTurnIndex: 0,
    turnPhase: 'roll',
    turnTimer: 15,
    lastDice: [2, 3],
    isDouble: false,
    consecutiveDoubles: 0,
    doubleCount: 0,
    freeParkingPool: 100,
    auction: null,
    activeTrade: null,
    pendingCard: null,
    winner: null,
    logs: [
      { id: 'l1', timestamp: '12:00:00', text: 'High Stakes NYC Arena room ready for action.', type: 'info' }
    ],
    chatMessages: [
      { id: 'c1', sender: 'System', avatar: 'navy', text: 'Welcome to NYC High Stakes Arena ($100 Wager).', time: '12:00' }
    ],
    version: 1,
    createdAt: Date.now() - 10 * 60 * 1000,
    updatedAt: Date.now(),
    isCustom: false
  },
  {
    code: 'tokyo88',
    name: 'Tokyo Fast 2x Blitz',
    hostId: 'host_kenji',
    isPrivate: false,
    maxPlayers: 4,
    betAmount: 0,
    initialCash: 1500,
    turnTimeSeconds: 10,
    boardTheme: 'cyber',
    fillWithBots: true,
    status: 'playing',
    players: [
      { id: 'p_kenji', name: 'Kenji', avatar: 'cyber', color: '#8b5cf6', cash: 1500, netWorth: 1500, position: 0, inJail: false, jailTurns: 0, getOutOfJailCards: 0, properties: [], mortgaged: [], houses: {}, isBankrupt: false, isBot: false, isHost: true },
      { id: 'b_shibuya', name: 'Shibuya_Drifter', avatar: 'neon', color: '#06b6d4', cash: 1500, netWorth: 1500, position: 0, inJail: false, jailTurns: 0, getOutOfJailCards: 0, properties: [], mortgaged: [], houses: {}, isBankrupt: false, isBot: true, isHost: false }
    ],
    currentTurnPlayerId: 'p_kenji',
    currentTurnIndex: 0,
    turnPhase: 'roll',
    turnTimer: 10,
    lastDice: [3, 4],
    isDouble: false,
    consecutiveDoubles: 0,
    doubleCount: 0,
    freeParkingPool: 100,
    auction: null,
    activeTrade: null,
    pendingCard: null,
    winner: null,
    logs: [
      { id: 'l1', timestamp: '12:00:00', text: 'Tokyo Fast 2x Blitz active.', type: 'info' }
    ],
    chatMessages: [
      { id: 'c1', sender: 'System', avatar: 'cyber', text: 'Tokyo Blitz 10s Fast Turns Activated.', time: '12:00' }
    ],
    version: 1,
    createdAt: Date.now() - 15 * 60 * 1000,
    updatedAt: Date.now(),
    isCustom: false
  },
  {
    code: 'whale50',
    name: 'Grandmaster Diamond Table',
    hostId: 'host_victor',
    isPrivate: false,
    maxPlayers: 4,
    betAmount: 500,
    initialCash: 1500,
    turnTimeSeconds: 20,
    boardTheme: 'worldwide',
    fillWithBots: true,
    status: 'playing',
    players: [
      { id: 'p_victor', name: 'Victor_Mogul', avatar: 'king', color: '#f59e0b', cash: 1500, netWorth: 1500, position: 0, inJail: false, jailTurns: 0, getOutOfJailCards: 0, properties: [], mortgaged: [], houses: {}, isBankrupt: false, isBot: false, isHost: true },
      { id: 'b_dubai', name: 'Dubai_Sheikh', avatar: 'gold', color: '#e11d48', cash: 1500, netWorth: 1500, position: 0, inJail: false, jailTurns: 0, getOutOfJailCards: 0, properties: [], mortgaged: [], houses: {}, isBankrupt: false, isBot: true, isHost: false },
      { id: 'b_monaco', name: 'Monaco_Baron', avatar: 'navy', color: '#84cc16', cash: 1500, netWorth: 1500, position: 0, inJail: false, jailTurns: 0, getOutOfJailCards: 0, properties: [], mortgaged: [], houses: {}, isBankrupt: false, isBot: true, isHost: false }
    ],
    currentTurnPlayerId: 'p_victor',
    currentTurnIndex: 0,
    turnPhase: 'roll',
    turnTimer: 20,
    lastDice: [4, 4],
    isDouble: true,
    consecutiveDoubles: 1,
    doubleCount: 1,
    freeParkingPool: 100,
    auction: null,
    activeTrade: null,
    pendingCard: null,
    winner: null,
    logs: [
      { id: 'l1', timestamp: '12:00:00', text: 'Grandmaster Diamond Table active ($500 Wager).', type: 'info' }
    ],
    chatMessages: [
      { id: 'c1', sender: 'System', avatar: 'gold', text: 'Grandmaster High Stakes Diamond Table ($500 Wager).', time: '12:00' }
    ],
    version: 1,
    createdAt: Date.now() - 20 * 60 * 1000,
    updatedAt: Date.now(),
    isCustom: false
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
// 5. VITE MIDDLEWARE (Full-Stack Express + Vite)
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PropRush Full-Stack Server with Stripe running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
