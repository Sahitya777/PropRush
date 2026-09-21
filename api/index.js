// src/server/app.ts
import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import Stripe from "stripe";
import dotenv from "dotenv";

// src/db/index.ts
import { Pool } from "pg";
var pool = null;
var isInitialized = false;
function getDbPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || connectionString.trim() === "") {
    return null;
  }
  if (!pool) {
    try {
      const isSsl = connectionString.includes("sslmode=require") || connectionString.includes("neon.tech") || process.env.NODE_ENV === "production";
      pool = new Pool({
        connectionString,
        ssl: isSsl ? { rejectUnauthorized: false } : void 0,
        max: 10,
        idleTimeoutMillis: 3e4,
        connectionTimeoutMillis: 5e3
      });
      pool.on("error", (err) => {
        console.error("[Neon DB Pool Error]:", err.message);
      });
    } catch (err) {
      console.error("[Neon DB Init Error]:", err.message);
      pool = null;
    }
  }
  return pool;
}
async function initDatabase() {
  const p = getDbPool();
  if (!p) {
    console.log("[Neon DB] No DATABASE_URL configured. PropRush is operating with memory/local store.");
    return false;
  }
  if (isInitialized) return true;
  try {
    const client = await p.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(128) PRIMARY KEY,
          email VARCHAR(255),
          username VARCHAR(64) NOT NULL,
          wallet_balance NUMERIC(12, 2) DEFAULT 0.00,
          league_points INTEGER DEFAULT 0,
          all_time_earnings NUMERIC(12, 2) DEFAULT 0.00,
          weekly_points INTEGER DEFAULT 0,
          wins INTEGER DEFAULT 0,
          current_streak INTEGER DEFAULT 0,
          avatar VARCHAR(64) DEFAULT 'orange',
          avatar_frame VARCHAR(64),
          dice_skin VARCHAR(64),
          is_banned BOOLEAN DEFAULT FALSE,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_users_lp ON users(league_points DESC);
        CREATE INDEX IF NOT EXISTS idx_users_weekly_points ON users(weekly_points DESC);
        CREATE INDEX IF NOT EXISTS idx_users_all_time ON users(all_time_earnings DESC);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

        CREATE TABLE IF NOT EXISTS rooms (
          code VARCHAR(64) PRIMARY KEY,
          name VARCHAR(128) NOT NULL,
          host_id VARCHAR(128),
          status VARCHAR(32) DEFAULT 'waiting',
          bet_amount NUMERIC(10, 2) DEFAULT 0.00,
          max_players INTEGER DEFAULT 4,
          board_theme VARCHAR(32) DEFAULT 'classic',
          turn_time_seconds INTEGER DEFAULT 15,
          initial_cash NUMERIC(10, 2) DEFAULT 1500.00,
          players_count INTEGER DEFAULT 1,
          is_custom BOOLEAN DEFAULT TRUE,
          room_data JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
        CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at DESC);

        CREATE TABLE IF NOT EXISTS matches (
          id VARCHAR(128) PRIMARY KEY,
          room_code VARCHAR(64) NOT NULL,
          room_name VARCHAR(128),
          winner_id VARCHAR(128),
          winner_name VARCHAR(64),
          prize_pool NUMERIC(12, 2) DEFAULT 0.00,
          platform_fee NUMERIC(12, 2) DEFAULT 0.00,
          bet_amount NUMERIC(10, 2) DEFAULT 0.00,
          duration_seconds INTEGER DEFAULT 0,
          players_summary JSONB DEFAULT '[]'::jsonb,
          final_stats JSONB DEFAULT '{}'::jsonb,
          completed_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_matches_winner ON matches(winner_id);
        CREATE INDEX IF NOT EXISTS idx_matches_completed_at ON matches(completed_at DESC);

        CREATE TABLE IF NOT EXISTS transactions (
          id VARCHAR(128) PRIMARY KEY,
          user_id VARCHAR(128) NOT NULL,
          type VARCHAR(64) NOT NULL,
          amount NUMERIC(12, 2) NOT NULL,
          balance_after NUMERIC(12, 2),
          description VARCHAR(255),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, created_at DESC);
      `);
      isInitialized = true;
      console.log("[Neon DB] Successfully connected and schema verified.");
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[Neon DB Init Schema Error]:", err.message);
    return false;
  }
}
async function upsertDbUser(user) {
  const p = getDbPool();
  if (!p) return false;
  try {
    const id = user.id;
    const email = user.email || null;
    const username = user.username || "Player";
    const walletBalance = typeof user.walletBalance === "number" ? user.walletBalance : 0;
    const lp = typeof user.leaguePoints === "number" ? user.leaguePoints : user.stats?.leaguePoints || 0;
    const allTimeEarnings = typeof user.allTimeEarningsUsd === "number" ? user.allTimeEarningsUsd : user.stats?.totalEarningsUsd || 0;
    const weeklyPoints = typeof user.weeklyCupPoints === "number" ? user.weeklyCupPoints : 0;
    const wins = typeof user.stats?.wins === "number" ? user.stats.wins : 0;
    const streak = typeof user.stats?.currentStreak === "number" ? user.stats.currentStreak : 0;
    const avatar = user.avatar || "orange";
    const avatarFrame = user.avatarFrame || null;
    const diceSkin = user.diceSkin || null;
    const isBanned = Boolean(user.isBanned);
    const metadata = JSON.stringify(user);
    await p.query(
      `
      INSERT INTO users (
        id, email, username, wallet_balance, league_points, all_time_earnings,
        weekly_points, wins, current_streak, avatar, avatar_frame, dice_skin,
        is_banned, metadata, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      ON CONFLICT (id) DO UPDATE SET
        email = COALESCE(EXCLUDED.email, users.email),
        username = EXCLUDED.username,
        wallet_balance = EXCLUDED.wallet_balance,
        league_points = EXCLUDED.league_points,
        all_time_earnings = EXCLUDED.all_time_earnings,
        weekly_points = EXCLUDED.weekly_points,
        wins = EXCLUDED.wins,
        current_streak = EXCLUDED.current_streak,
        avatar = EXCLUDED.avatar,
        avatar_frame = EXCLUDED.avatar_frame,
        dice_skin = EXCLUDED.dice_skin,
        is_banned = EXCLUDED.is_banned,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();
      `,
      [
        id,
        email,
        username,
        walletBalance,
        lp,
        allTimeEarnings,
        weeklyPoints,
        wins,
        streak,
        avatar,
        avatarFrame,
        diceSkin,
        isBanned,
        metadata
      ]
    );
    return true;
  } catch (err) {
    console.error("[Neon DB upsertUser Error]:", err.message);
    return false;
  }
}
async function getDbRankings(timeframe = "season", searchQuery = "", limit = 100) {
  const p = getDbPool();
  if (!p) return null;
  try {
    let orderBy = "league_points DESC, all_time_earnings DESC";
    if (timeframe === "weekly") {
      orderBy = "weekly_points DESC, league_points DESC";
    } else if (timeframe === "all_time") {
      orderBy = "all_time_earnings DESC, wins DESC";
    }
    let query = `
      SELECT id, email, username, wallet_balance, league_points, all_time_earnings,
             weekly_points, wins, current_streak, avatar, avatar_frame, dice_skin,
             is_banned, metadata, updated_at
      FROM users
      WHERE is_banned = FALSE
    `;
    const params = [];
    if (searchQuery && searchQuery.trim() !== "") {
      params.push(`%${searchQuery.trim().toLowerCase()}%`);
      query += ` AND (LOWER(username) LIKE $${params.length} OR LOWER(COALESCE(email, '')) LIKE $${params.length})`;
    }
    query += ` ORDER BY ${orderBy} LIMIT $${params.length + 1}`;
    params.push(limit);
    const res = await p.query(query, params);
    return res.rows.map((r, idx) => {
      const meta = typeof r.metadata === "object" && r.metadata !== null ? r.metadata : {};
      return {
        ...meta,
        id: r.id,
        email: r.email,
        username: r.username,
        walletBalance: parseFloat(r.wallet_balance || 0),
        leaguePoints: parseInt(r.league_points || 0, 10),
        weeklyCupPoints: parseInt(r.weekly_points || 0, 10),
        allTimeEarningsUsd: parseFloat(r.all_time_earnings || 0),
        avatar: r.avatar,
        avatarFrame: r.avatar_frame,
        diceSkin: r.dice_skin,
        isBanned: r.is_banned,
        rank: idx + 1
      };
    });
  } catch (err) {
    console.error("[Neon DB getDbRankings Error]:", err.message);
    return null;
  }
}
async function upsertDbRoom(room) {
  const p = getDbPool();
  if (!p) return false;
  try {
    const code = room.code.toLowerCase();
    const name = room.name || code.toUpperCase();
    const hostId = room.hostId || null;
    const status = room.status || "waiting";
    const betAmount = room.betAmount || 0;
    const maxPlayers = room.maxPlayers || 4;
    const boardTheme = room.boardTheme || "classic";
    const turnTime = room.turnTimeSeconds || 15;
    const initialCash = room.initialCash || 1500;
    const playersCount = Array.isArray(room.players) ? room.players.length : 1;
    const isCustom = Boolean(room.isCustom);
    const roomData = JSON.stringify(room);
    await p.query(
      `
      INSERT INTO rooms (
        code, name, host_id, status, bet_amount, max_players, board_theme,
        turn_time_seconds, initial_cash, players_count, is_custom, room_data, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        host_id = EXCLUDED.host_id,
        status = EXCLUDED.status,
        bet_amount = EXCLUDED.bet_amount,
        max_players = EXCLUDED.max_players,
        board_theme = EXCLUDED.board_theme,
        turn_time_seconds = EXCLUDED.turn_time_seconds,
        initial_cash = EXCLUDED.initial_cash,
        players_count = EXCLUDED.players_count,
        is_custom = EXCLUDED.is_custom,
        room_data = EXCLUDED.room_data,
        updated_at = NOW();
      `,
      [
        code,
        name,
        hostId,
        status,
        betAmount,
        maxPlayers,
        boardTheme,
        turnTime,
        initialCash,
        playersCount,
        isCustom,
        roomData
      ]
    );
    return true;
  } catch (err) {
    console.error("[Neon DB upsertDbRoom Error]:", err.message);
    return false;
  }
}
async function deleteDbRoom(code) {
  const p = getDbPool();
  if (!p) return false;
  try {
    await p.query(`DELETE FROM rooms WHERE code = $1`, [code.toLowerCase()]);
    return true;
  } catch (err) {
    console.error("[Neon DB deleteDbRoom Error]:", err.message);
    return false;
  }
}
async function pruneStaleDbRooms() {
  const p = getDbPool();
  if (!p) return 0;
  try {
    const res = await p.query(`
      DELETE FROM rooms
      WHERE updated_at < NOW() - INTERVAL '20 minutes'
         OR (status IN ('finished', 'gameover') AND updated_at < NOW() - INTERVAL '5 minutes')
         OR players_count <= 0
    `);
    const count = res.rowCount || 0;
    if (count > 0) {
      console.log(`[Neon DB] Pruned ${count} stale/expired room(s) from database.`);
    }
    return count;
  } catch (err) {
    console.error("[Neon DB pruneStaleDbRooms Error]:", err.message);
    return 0;
  }
}
async function getDbRooms() {
  const p = getDbPool();
  if (!p) return null;
  try {
    const res = await p.query(`
      SELECT code, name, host_id, status, bet_amount, max_players,
             board_theme, turn_time_seconds, initial_cash, players_count,
             is_custom, room_data, created_at, updated_at
      FROM rooms
      ORDER BY updated_at DESC
    `);
    return res.rows.map((r) => {
      const data = typeof r.room_data === "object" && r.room_data !== null ? r.room_data : {};
      return {
        ...data,
        code: r.code,
        name: r.name,
        hostId: r.host_id,
        status: r.status,
        betAmount: parseFloat(r.bet_amount || 0),
        maxPlayers: r.max_players,
        boardTheme: r.board_theme,
        turnTimeSeconds: r.turn_time_seconds,
        initialCash: parseFloat(r.initial_cash || 1500),
        playersCount: r.players_count,
        isCustom: r.is_custom
      };
    });
  } catch (err) {
    console.error("[Neon DB getDbRooms Error]:", err.message);
    return null;
  }
}
async function recordDbMatch(match) {
  const p = getDbPool();
  if (!p) return false;
  try {
    await p.query(
      `
      INSERT INTO matches (
        id, room_code, room_name, winner_id, winner_name, prize_pool,
        platform_fee, bet_amount, duration_seconds, players_summary, final_stats, completed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (id) DO NOTHING;
      `,
      [
        match.id,
        match.roomCode,
        match.roomName || null,
        match.winnerId || null,
        match.winnerName || null,
        match.prizePool || 0,
        match.platformFee || 0,
        match.betAmount || 0,
        match.durationSeconds || 0,
        JSON.stringify(match.playersSummary || []),
        JSON.stringify(match.finalStats || {})
      ]
    );
    return true;
  } catch (err) {
    console.error("[Neon DB recordDbMatch Error]:", err.message);
    return false;
  }
}

// src/server/wagerKeeperService.ts
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
var RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
var serverPublicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL)
});
var WAGER_POOL_ABI = parseAbi([
  "function status() view returns (uint8)",
  "function keeper() view returns (address)",
  "function winner() view returns (address)",
  "function isJoined(address player) view returns (bool)",
  "function proposeResult(address _winner)",
  "function finalize()",
  "function getPlayers() view returns (address[])",
  "function buyIn() view returns (uint256)",
  "function poolValue() view returns (uint256)",
  "function proposalTime() view returns (uint256)",
  "function disputeWindow() view returns (uint256)",
  "function claimed() view returns (bool)"
]);
function getServerKeeperWallet() {
  const privateKey = process.env.KEEPER_PRIVATE_KEY;
  if (!privateKey) {
    return null;
  }
  const cleanKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  try {
    const account = privateKeyToAccount(cleanKey);
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(RPC_URL)
    });
    return { walletClient, account, address: account.address };
  } catch (err) {
    console.error("[Wager Keeper] Invalid KEEPER_PRIVATE_KEY format:", err);
    return null;
  }
}
async function keeperProposeResult(poolAddress, winnerAddress) {
  try {
    const cleanPool = poolAddress.trim();
    const cleanWinner = winnerAddress.trim();
    const keeperWallet = getServerKeeperWallet();
    if (!keeperWallet) {
      return {
        success: false,
        error: "KEEPER_PRIVATE_KEY not configured on server. Result can be proposed manually by the keeper wallet in UI."
      };
    }
    const status = await serverPublicClient.readContract({
      address: cleanPool,
      abi: WAGER_POOL_ABI,
      functionName: "status"
    });
    if (status !== 1) {
      if (status === 2) {
        return { success: true, error: "Result already proposed." };
      }
      return {
        success: false,
        error: `Cannot propose result: pool status is ${status} (expected 1: Locked).`
      };
    }
    const joined = await serverPublicClient.readContract({
      address: cleanPool,
      abi: WAGER_POOL_ABI,
      functionName: "isJoined",
      args: [cleanWinner]
    });
    if (!joined) {
      return {
        success: false,
        error: `Winner address ${cleanWinner} did not join this wager pool.`
      };
    }
    console.log(`[Wager Keeper] Proposing winner ${cleanWinner} for pool ${cleanPool}...`);
    const txHash = await keeperWallet.walletClient.writeContract({
      address: cleanPool,
      abi: WAGER_POOL_ABI,
      functionName: "proposeResult",
      args: [cleanWinner],
      account: keeperWallet.account,
      chain: baseSepolia
    });
    console.log(`[Wager Keeper] ProposeResult tx submitted: ${txHash}. Waiting for receipt...`);
    await serverPublicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`[Wager Keeper] ProposeResult confirmed on Base Sepolia: ${txHash}`);
    return { success: true, txHash };
  } catch (err) {
    console.error("[Wager Keeper] Error proposing result:", err);
    return { success: false, error: err?.message || "Failed to propose result on-chain" };
  }
}
async function getServerPoolStatus(poolAddress) {
  try {
    const cleanPool = poolAddress.trim();
    const [status, winner, players, buyIn, proposalTime, disputeWindow, claimed] = await Promise.all([
      serverPublicClient.readContract({ address: cleanPool, abi: WAGER_POOL_ABI, functionName: "status" }),
      serverPublicClient.readContract({ address: cleanPool, abi: WAGER_POOL_ABI, functionName: "winner" }),
      serverPublicClient.readContract({ address: cleanPool, abi: WAGER_POOL_ABI, functionName: "getPlayers" }),
      serverPublicClient.readContract({ address: cleanPool, abi: WAGER_POOL_ABI, functionName: "buyIn" }),
      serverPublicClient.readContract({ address: cleanPool, abi: WAGER_POOL_ABI, functionName: "proposalTime" }),
      serverPublicClient.readContract({ address: cleanPool, abi: WAGER_POOL_ABI, functionName: "disputeWindow" }),
      serverPublicClient.readContract({ address: cleanPool, abi: WAGER_POOL_ABI, functionName: "claimed" })
    ]);
    return {
      status,
      winner,
      players,
      buyIn: buyIn.toString(),
      proposalTime: Number(proposalTime),
      disputeWindow: Number(disputeWindow),
      claimed
    };
  } catch (err) {
    return { error: err?.message || "Failed to read pool" };
  }
}
async function serverMintMockUsdc(recipientAddress, amountDollars = 50) {
  try {
    const cleanRecipient = recipientAddress.trim();
    const keeperWallet = getServerKeeperWallet();
    if (!keeperWallet) {
      return {
        success: false,
        error: "KEEPER_PRIVATE_KEY is not configured on the server. Please mint directly using your connected Web3 wallet."
      };
    }
    const mockUsdcAddress = process.env.VITE_MOCK_USDC_ADDRESS || process.env.MOCK_USDC_ADDRESS || "0x6482c263a6F3f651Ab292443DC60B378482E5e17";
    const amountWei = BigInt(Math.round(amountDollars * 1e6));
    console.log(`[Server Faucet] Minting ${amountDollars} MockUSDC to ${cleanRecipient}...`);
    const txHash = await keeperWallet.walletClient.writeContract({
      address: mockUsdcAddress,
      abi: parseAbi(["function mint(address to, uint256 amount)"]),
      functionName: "mint",
      args: [cleanRecipient, amountWei],
      account: keeperWallet.account,
      chain: baseSepolia
    });
    console.log(`[Server Faucet] Mint tx submitted: ${txHash}. Waiting for receipt...`);
    await serverPublicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`[Server Faucet] Mint tx confirmed: ${txHash}`);
    return { success: true, txHash };
  } catch (err) {
    console.error("[Server Faucet] Error minting MockUSDC:", err);
    return { success: false, error: err?.message || "Failed to mint MockUSDC from server" };
  }
}

// src/server/app.ts
dotenv.config();
var app = express();
var PORT = process.env.K_SERVICE || process.env.K_REVISION ? process.env.PORT ? parseInt(process.env.PORT, 10) : 8080 : 3e3;
var stripeClient = null;
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.trim() === "" || key === "sk_test_..." || key === "sk_live_...") {
    return null;
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}
var sandboxSessions = /* @__PURE__ */ new Map();
app.use(express.json());
app.use((req, _res, next) => {
  const forwardedUri = req.headers["x-forwarded-uri"] || req.headers["x-original-url"];
  const matchedPath = req.headers["x-matched-path"] || req.headers["x-invoke-path"];
  if (forwardedUri && (forwardedUri.startsWith("/api") || forwardedUri.startsWith("/rooms"))) {
    req.url = forwardedUri;
  } else if (matchedPath && matchedPath.startsWith("/api") && matchedPath !== "/api") {
    req.url = matchedPath;
  }
  next();
});
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  next();
});
var bannedEmailsSet = /* @__PURE__ */ new Set();
var bannedIdsSet = /* @__PURE__ */ new Set();
var serverRooms = /* @__PURE__ */ new Map();
var defaultRooms = [
  {
    code: "inu17",
    name: "High Stakes NYC Arena",
    hostId: "usr_host_inu",
    maxPlayers: 4,
    betAmount: 100,
    turnTimeSeconds: 15,
    boardTheme: "classic",
    isPrivate: false,
    initialCash: 1500,
    status: "playing",
    players: [
      { id: "usr_host_inu", name: "Host", avatar: "orange", color: "#ff7700", cash: 1400, netWorth: 1850, position: 12, inJail: false, jailTurns: 0, isBankrupt: false, isAi: false, properties: [] },
      { id: "usr_player_sahitya", name: "Sahitya", avatar: "purple", color: "#38bdf8", cash: 1650, netWorth: 2100, position: 6, inJail: false, jailTurns: 0, isBankrupt: false, isAi: false, properties: [] },
      { id: "bot_alex", name: "Alex_Venture", avatar: "green", color: "#10b981", cash: 1200, netWorth: 1500, position: 3, inJail: false, jailTurns: 0, isBankrupt: false, isAi: true, properties: [] },
      { id: "bot_marcus", name: "Marcus_Realty", avatar: "blue", color: "#6366f1", cash: 900, netWorth: 1350, position: 18, inJail: false, jailTurns: 0, isBankrupt: false, isAi: true, properties: [] }
    ],
    properties: [],
    currentTurnIndex: 1,
    turnStartedAt: Date.now(),
    dice: [3, 4],
    logs: [
      { id: "l_1", text: "High Stakes NYC Arena initialized with $100 buy-in", type: "system", timestamp: Date.now() - 6e4 },
      { id: "l_2", text: "Sahitya collected $200 passing GO!", type: "rent", timestamp: Date.now() - 3e4 }
    ],
    chatMessages: [],
    version: 1,
    createdAt: Date.now() - 3e5,
    updatedAt: Date.now(),
    isCustom: true
  },
  {
    code: "tokyo88",
    name: "Tokyo Fast 2x Blitz",
    hostId: "bot_yuki",
    maxPlayers: 4,
    betAmount: 0,
    turnTimeSeconds: 10,
    boardTheme: "cyber",
    isPrivate: false,
    initialCash: 1500,
    status: "waiting",
    players: [
      { id: "bot_yuki", name: "Yuki_Speed", avatar: "pink", color: "#ec4899", cash: 1500, netWorth: 1500, position: 0, inJail: false, jailTurns: 0, isBankrupt: false, isAi: true, properties: [] },
      { id: "bot_ryo", name: "Ryo_Cyber", avatar: "cyber", color: "#06b6d4", cash: 1500, netWorth: 1500, position: 0, inJail: false, jailTurns: 0, isBankrupt: false, isAi: true, properties: [] }
    ],
    properties: [],
    currentTurnIndex: 0,
    turnStartedAt: Date.now(),
    dice: [1, 1],
    logs: [],
    chatMessages: [],
    version: 1,
    createdAt: Date.now() - 18e4,
    updatedAt: Date.now(),
    isCustom: true
  },
  {
    code: "whale50",
    name: "Grandmaster Diamond Table",
    hostId: "bot_elena",
    maxPlayers: 4,
    betAmount: 500,
    turnTimeSeconds: 20,
    boardTheme: "worldwide",
    isPrivate: false,
    initialCash: 2500,
    status: "waiting",
    players: [
      { id: "bot_elena", name: "Elena_Tycoon", avatar: "red", color: "#ef4444", cash: 2500, netWorth: 2500, position: 0, inJail: false, jailTurns: 0, isBankrupt: false, isAi: true, properties: [] },
      { id: "bot_chen", name: "Chen_Empire", avatar: "cyan", color: "#0ea5e9", cash: 2500, netWorth: 2500, position: 0, inJail: false, jailTurns: 0, isBankrupt: false, isAi: true, properties: [] }
    ],
    properties: [],
    currentTurnIndex: 0,
    turnStartedAt: Date.now(),
    dice: [5, 2],
    logs: [],
    chatMessages: [],
    version: 1,
    createdAt: Date.now() - 12e4,
    updatedAt: Date.now(),
    isCustom: true
  }
];
defaultRooms.forEach((r) => serverRooms.set(r.code.toLowerCase(), r));
var TMP_ROOMS_FILE = path.join(os.tmpdir(), "proprush_server_rooms.json");
function loadPersistedRooms() {
  try {
    if (fs.existsSync(TMP_ROOMS_FILE)) {
      const content = fs.readFileSync(TMP_ROOMS_FILE, "utf-8");
      const list = JSON.parse(content);
      if (Array.isArray(list)) {
        list.forEach((r) => {
          if (r && r.code) {
            serverRooms.set(r.code.toLowerCase(), r);
          }
        });
      }
    }
  } catch (err) {
  }
}
function savePersistedRooms() {
  try {
    const list = Array.from(serverRooms.values());
    fs.writeFileSync(TMP_ROOMS_FILE, JSON.stringify(list), "utf-8");
  } catch (err) {
  }
}
function pruneStaleRooms() {
  const now = Date.now();
  let prunedCount = 0;
  for (const [code, room] of serverRooms.entries()) {
    if (code === "room1" || code === "room2") continue;
    const updatedAt = room.updatedAt || room.createdAt || now;
    const ageMs = now - updatedAt;
    const players = Array.isArray(room.players) ? room.players : [];
    let shouldPrune = false;
    if (room.status === "finished" || room.status === "gameover") {
      if (ageMs > 5 * 60 * 1e3) shouldPrune = true;
    } else if (room.status === "waiting") {
      if (players.length === 0 || ageMs > 30 * 60 * 1e3) shouldPrune = true;
    } else if (room.status === "playing") {
      const activeConnected = players.filter((p) => !p.isBankrupt && !p.isDisconnected);
      if (activeConnected.length === 0 && ageMs > 5 * 60 * 1e3) {
        shouldPrune = true;
      } else if (ageMs > 25 * 60 * 1e3) {
        shouldPrune = true;
      }
    }
    if (shouldPrune) {
      serverRooms.delete(code);
      deleteDbRoom(code).catch(() => {
      });
      prunedCount++;
    }
  }
  if (prunedCount > 0) {
    savePersistedRooms();
    console.log(`[Cleanup] Pruned ${prunedCount} stale/inactive room(s) from memory and database.`);
  }
  pruneStaleDbRooms().catch(() => {
  });
  return prunedCount;
}
loadPersistedRooms();
pruneStaleRooms();
setInterval(pruneStaleRooms, 2 * 60 * 1e3);
initDatabase().then(async (connected) => {
  if (connected) {
    console.log("[DB] Neon PostgreSQL is connected and ready.");
    try {
      const dbRooms = await getDbRooms();
      if (Array.isArray(dbRooms) && dbRooms.length > 0) {
        dbRooms.forEach((r) => {
          if (r && r.code) {
            serverRooms.set(r.code.toLowerCase(), r);
          }
        });
        console.log(`[DB] Restored ${dbRooms.length} room(s) from Neon PostgreSQL.`);
      }
    } catch (err) {
      console.warn("[DB] Non-fatal: unable to read rooms from DB:", err.message);
    }
  } else {
    console.log("[DB] PropRush is running with local/memory store. Set DATABASE_URL to enable Neon PostgreSQL.");
  }
}).catch((err) => {
  console.warn("[DB] Database initialization error (non-fatal):", err.message);
});
var platformUsersMap = /* @__PURE__ */ new Map();
var serverReferralsList = [];
var TMP_REFERRALS_FILE = path.join(os.tmpdir(), "proprush_server_referrals.json");
function loadPersistedReferrals() {
  try {
    if (fs.existsSync(TMP_REFERRALS_FILE)) {
      const content = fs.readFileSync(TMP_REFERRALS_FILE, "utf-8");
      const list = JSON.parse(content);
      if (Array.isArray(list)) {
        serverReferralsList.length = 0;
        serverReferralsList.push(...list);
      }
    }
  } catch {
  }
}
function savePersistedReferrals() {
  try {
    fs.writeFileSync(TMP_REFERRALS_FILE, JSON.stringify(serverReferralsList), "utf-8");
  } catch {
  }
}
loadPersistedReferrals();
function findPlatformUser(id, email, walletAddress) {
  if (id && platformUsersMap.has(id)) {
    return platformUsersMap.get(id);
  }
  const cleanEmail = email ? email.trim().toLowerCase() : "";
  const cleanWallet = walletAddress ? walletAddress.trim().toLowerCase() : "";
  for (const u of platformUsersMap.values()) {
    if (cleanWallet && u.walletAddress && u.walletAddress.toLowerCase() === cleanWallet) {
      return u;
    }
    if (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail) {
      return u;
    }
  }
  return void 0;
}
function findUserByReferralCode(code) {
  const cleanCode = (code || "").trim().toLowerCase();
  if (!cleanCode) return void 0;
  for (const u of platformUsersMap.values()) {
    if (String(u.username || "").toLowerCase() === cleanCode) return u;
    if (String(u.id || "").toLowerCase() === cleanCode) return u;
    if (u.walletAddress && u.walletAddress.toLowerCase() === cleanCode) return u;
    if (u.referralCode && u.referralCode.toLowerCase() === cleanCode) return u;
  }
  return void 0;
}
var api = express.Router();
api.post("/referrals/process", (req, res) => {
  try {
    const { referrerCode, refereeId, refereeUsername, refereeWallet, refereeEmail } = req.body || {};
    const code = (referrerCode || "").trim();
    if (!code) {
      res.status(400).json({ error: "Referral code or username required" });
      return;
    }
    const cleanRefId = (refereeId || "").trim();
    const cleanRefName = (refereeUsername || "").trim();
    const cleanRefWallet = (refereeWallet || "").trim().toLowerCase();
    const cleanRefEmail = (refereeEmail || "").trim().toLowerCase();
    const codeLower = code.toLowerCase();
    if (cleanRefName && cleanRefName.toLowerCase() === codeLower || cleanRefId && cleanRefId.toLowerCase() === codeLower || cleanRefWallet && cleanRefWallet === codeLower) {
      res.status(400).json({ error: "You cannot use your own referral code." });
      return;
    }
    loadPersistedReferrals();
    const existingReferral = serverReferralsList.find(
      (r) => cleanRefId && r.refereeId === cleanRefId || cleanRefWallet && r.refereeWallet && r.refereeWallet.toLowerCase() === cleanRefWallet || cleanRefEmail && r.refereeEmail && r.refereeEmail.toLowerCase() === cleanRefEmail
    );
    if (existingReferral) {
      res.status(409).json({
        error: "Referral bonus has already been claimed for this account.",
        alreadyClaimed: true,
        referrerUsername: existingReferral.referrerUsername || existingReferral.referrerCode
      });
      return;
    }
    const referrerUser = findUserByReferralCode(code);
    const resolvedReferrerUsername = referrerUser?.username || code;
    if (referrerUser) {
      referrerUser.coins = (referrerUser.coins || 0) + 250;
      referrerUser.leaguePoints = (referrerUser.leaguePoints || 0) + 100;
      referrerUser.referralPoints = (referrerUser.referralPoints || 0) + 250;
      referrerUser.friendsReferred = (referrerUser.friendsReferred || 0) + 1;
      platformUsersMap.set(referrerUser.id, referrerUser);
    }
    const refereeUser = findPlatformUser(cleanRefId, cleanRefEmail, cleanRefWallet);
    if (refereeUser) {
      refereeUser.coins = (refereeUser.coins || 0) + 100;
      refereeUser.leaguePoints = (refereeUser.leaguePoints || 0) + 50;
      refereeUser.referredBy = resolvedReferrerUsername;
      platformUsersMap.set(refereeUser.id, refereeUser);
    }
    const newRecord = {
      id: "ref_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      referrerCode: code,
      referrerUsername: resolvedReferrerUsername,
      referrerUserId: referrerUser?.id,
      refereeId: cleanRefId || "usr_" + Date.now(),
      refereeUsername: cleanRefName || "PropRush Friend",
      refereeWallet: cleanRefWallet,
      refereeEmail: cleanRefEmail,
      pointsAwarded: 250,
      lpAwarded: 100,
      refereeBonusCoins: 100,
      refereeBonusLp: 50,
      timestamp: Date.now(),
      date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      status: "completed"
    };
    serverReferralsList.unshift(newRecord);
    savePersistedReferrals();
    res.json({
      success: true,
      message: `\u{1F389} Referral bonus successfully applied! You joined via @${resolvedReferrerUsername}.`,
      referrerUsername: resolvedReferrerUsername,
      referrerPointsAwarded: 250,
      refereeBonusCoins: 100,
      refereeBonusLp: 50,
      referral: newRecord
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to process referral" });
  }
});
api.get("/referrals/stats/:codeOrUsername", (req, res) => {
  try {
    const rawCode = (req.params.codeOrUsername || "").trim();
    if (!rawCode) {
      res.status(400).json({ error: "Code or username parameter required" });
      return;
    }
    loadPersistedReferrals();
    const targetUser = findUserByReferralCode(rawCode);
    const codeLower = rawCode.toLowerCase();
    const userIdLower = targetUser?.id?.toLowerCase();
    const usernameLower = targetUser?.username?.toLowerCase();
    const walletLower = targetUser?.walletAddress?.toLowerCase();
    const userReferrals = serverReferralsList.filter((r) => {
      const rCode = r.referrerCode.toLowerCase();
      const rUser = r.referrerUsername?.toLowerCase();
      const rId = r.referrerUserId?.toLowerCase();
      return rCode === codeLower || usernameLower && (rCode === usernameLower || rUser === usernameLower) || userIdLower && rId === userIdLower || walletLower && rCode === walletLower;
    });
    const friendsJoined = Math.max(userReferrals.length, targetUser?.friendsReferred || 0);
    const totalPointsEarned = userReferrals.reduce((sum, r) => sum + (r.pointsAwarded || 250), 0) || (targetUser?.referralPoints || friendsJoined * 250);
    const earningsUsd = targetUser?.referralEarningsUsd || 0;
    res.json({
      code: rawCode,
      username: targetUser?.username || rawCode,
      friendsJoined,
      totalPointsEarned,
      earningsUsd,
      referrals: userReferrals.map((r) => ({
        id: r.id,
        refereeUsername: r.refereeUsername,
        refereeWallet: r.refereeWallet ? `${r.refereeWallet.slice(0, 6)}...${r.refereeWallet.slice(-4)}` : void 0,
        pointsEarned: r.pointsAwarded,
        date: r.date,
        status: r.status
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch referral stats" });
  }
});
api.get("/banned-users", (_req, res) => {
  try {
    res.json({
      bannedEmails: Array.from(bannedEmailsSet),
      bannedIds: Array.from(bannedIdsSet)
    });
  } catch {
    res.json({ bannedEmails: [], bannedIds: [] });
  }
});
api.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});
api.get("/health/db", async (_req, res) => {
  const pool2 = getDbPool();
  if (!pool2) {
    res.json({
      connected: false,
      status: "unconfigured",
      provider: "Neon PostgreSQL",
      message: "DATABASE_URL is not configured yet. PropRush is currently using in-memory and local fallback."
    });
    return;
  }
  try {
    await initDatabase();
    const [dbInfo, tablesRes] = await Promise.all([
      pool2.query("SELECT NOW() as current_time, current_database() as database_name, version();"),
      pool2.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;")
    ]);
    const existingTables = tablesRes.rows.map((r) => r.table_name);
    const counts = {};
    for (const table of existingTables) {
      if (["users", "rooms", "matches", "transactions"].includes(table)) {
        try {
          const countRes = await pool2.query(`SELECT COUNT(*)::int as c FROM "${table}"`);
          counts[table] = countRes.rows[0]?.c ?? 0;
        } catch {
          counts[table] = 0;
        }
      }
    }
    res.json({
      connected: true,
      status: "connected",
      provider: "Neon PostgreSQL",
      database: dbInfo.rows[0]?.database_name,
      serverTime: dbInfo.rows[0]?.current_time,
      tables: existingTables,
      expectedTables: ["users", "rooms", "matches", "transactions"],
      allTablesPresent: ["users", "rooms", "matches", "transactions"].every((t) => existingTables.includes(t)),
      tableCounts: counts,
      version: dbInfo.rows[0]?.version
    });
  } catch (err) {
    res.status(500).json({
      connected: false,
      status: "error",
      provider: "Neon PostgreSQL",
      error: err.message
    });
  }
});
api.get("/stripe/status", (_req, res) => {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const isKeyConfigured = Boolean(
      secretKey && secretKey.trim() !== "" && secretKey !== "sk_test_..." && secretKey !== "sk_live_..."
    );
    const mode = isKeyConfigured ? secretKey?.startsWith("sk_live_") ? "live" : "test" : "sandbox_ready";
    res.json({
      configured: isKeyConfigured,
      mode,
      publishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY || null,
      message: isKeyConfigured ? `Stripe is active in ${mode.toUpperCase()} mode.` : "Stripe is ready. Add STRIPE_SECRET_KEY in Settings for real card processing, or use built-in instant test checkout."
    });
  } catch (err) {
    res.json({
      configured: false,
      mode: "sandbox_ready",
      publishableKey: null,
      message: "Stripe status check handled safely."
    });
  }
});
api.post("/stripe/create-checkout-session", async (req, res) => {
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
    const baseUrl = rawBase.replace(/\/+$/, "");
    if (userEmail && (bannedEmailsSet.has(userEmail.toLowerCase().trim()) || userId && bannedIdsSet.has(userId.trim()))) {
      res.status(403).json({
        error: "Access Denied: Your account has been suspended by PropRush administration. Deposits and wagers are disabled."
      });
      return;
    }
    const stripe = getStripe();
    if (stripe) {
      try {
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
                  ]
                },
                unit_amount: Math.round(parsedAmount * 100)
              },
              quantity: 1
            }
          ],
          mode: "payment",
          client_reference_id: userId || "guest_player",
          customer_email: userEmail && userEmail.includes("@") ? userEmail : void 0,
          metadata: {
            userId: userId || "guest_player",
            username: username || "Player",
            depositAmount: parsedAmount.toString(),
            app: "PropRush"
          },
          success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}&deposit_success=true&amount=${parsedAmount}`,
          cancel_url: `${baseUrl}/?deposit_canceled=true`
        });
        res.json({
          success: true,
          sessionId: session.id,
          url: session.url,
          mode: "stripe"
        });
        return;
      } catch (stripeErr) {
        console.warn("\u26A0\uFE0F Stripe SDK checkout call failed, falling back to sandbox mode:", stripeErr.message);
      }
    }
    const simulatedSessionId = `cs_sandbox_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sandboxSessions.set(simulatedSessionId, {
      id: simulatedSessionId,
      amount: parsedAmount,
      paid: true,
      userId: userId || "guest_player",
      userEmail: userEmail || "player@example.com",
      createdAt: Date.now()
    });
    res.json({
      success: true,
      sessionId: simulatedSessionId,
      url: `${baseUrl}/?session_id=${simulatedSessionId}&deposit_success=true&amount=${parsedAmount}&mode=sandbox`,
      mode: "sandbox",
      message: "Sandbox test session created. Add STRIPE_SECRET_KEY to Settings for live Stripe cards."
    });
  } catch (error) {
    console.error("Error creating Stripe checkout session:", error);
    res.status(500).json({
      error: error.message || "Failed to create Stripe checkout session"
    });
  }
});
api.get("/stripe/verify-session", async (req, res) => {
  try {
    const sessionId = req.query.sessionId;
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
          mode: "sandbox"
        });
        return;
      }
    }
    const stripe = getStripe();
    if (!stripe) {
      res.json({
        success: true,
        paid: true,
        amount: parseFloat(req.query.amount) || 20,
        currency: "usd",
        mode: "sandbox_unverified"
      });
      return;
    }
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const isPaid = session.payment_status === "paid" || session.status === "complete";
    const amountTotal = session.amount_total ? session.amount_total / 100 : 0;
    res.json({
      success: true,
      paid: isPaid,
      amount: amountTotal,
      currency: session.currency || "usd",
      customerEmail: session.customer_details?.email || session.customer_email,
      metadata: session.metadata,
      mode: "stripe"
    });
  } catch (error) {
    console.error("Error verifying Stripe session:", error);
    res.status(500).json({
      error: error.message || "Failed to verify Stripe checkout session"
    });
  }
});
api.get("/rooms", async (_req, res) => {
  try {
    loadPersistedRooms();
    try {
      const dbRooms = await getDbRooms();
      if (Array.isArray(dbRooms) && dbRooms.length > 0) {
        dbRooms.forEach((r) => {
          if (r && r.code && !serverRooms.has(r.code.toLowerCase())) {
            serverRooms.set(r.code.toLowerCase(), r);
          }
        });
      }
    } catch {
    }
    const list = Array.from(serverRooms.values()).map((r) => {
      const players = Array.isArray(r.players) ? r.players : [];
      const hostPlayer = players.find((p) => p && p.id === r.hostId) || players[0];
      return {
        code: r.code,
        name: r.name || `Room ${r.code.toUpperCase()}`,
        host: hostPlayer?.name || "Host",
        hostAvatar: hostPlayer?.avatar || "orange",
        players: players.length,
        max: r.maxPlayers || 4,
        bet: typeof r.betAmount === "number" ? r.betAmount : 0,
        turnTime: r.turnTimeSeconds || 15,
        map: (r.boardTheme || "").toLowerCase().includes("cyber") ? "Cyber Neon" : (r.boardTheme || "").toLowerCase().includes("world") ? "Worldwide" : "Classic",
        status: r.status || "waiting",
        createdAt: r.createdAt || Date.now(),
        initialCash: r.initialCash || 1500,
        isCustom: r.isCustom ?? true
      };
    });
    res.json({ rooms: list });
  } catch (err) {
    console.error("Error in GET /rooms:", err);
    res.json({ rooms: [] });
  }
});
function findRoomByCode(code) {
  if (!code) return void 0;
  const clean = code.trim().toLowerCase();
  let r = serverRooms.get(clean);
  if (r) return r;
  if (clean.startsWith("custom_")) {
    r = serverRooms.get(clean.replace("custom_", ""));
    if (r) return r;
  } else {
    r = serverRooms.get("custom_" + clean);
    if (r) return r;
  }
  for (const room of serverRooms.values()) {
    if (!room) continue;
    if (room.code && room.code.toLowerCase() === clean) return room;
    if (room.name && room.name.toLowerCase().trim() === clean) return room;
    const nameSlug = (room.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (nameSlug && nameSlug === clean) return room;
  }
  return void 0;
}
api.get("/rooms/:code", (req, res) => {
  try {
    const code = (req.params.code || "").trim().toLowerCase();
    loadPersistedRooms();
    let room = findRoomByCode(code);
    if (!room) {
      res.status(404).json({ exists: false, error: `Room ${code} not found` });
      return;
    }
    res.json({ exists: true, room });
  } catch (err) {
    res.status(500).json({ exists: false, error: err.message || "Server error" });
  }
});
api.post("/rooms/:code/disband", (req, res) => {
  try {
    const code = (req.params.code || "").trim().toLowerCase();
    loadPersistedRooms();
    const room = findRoomByCode(code);
    if (!room) {
      res.json({ success: true, message: "Room already closed or removed" });
      return;
    }
    const realCode = (room.code || "").toLowerCase();
    serverRooms.delete(realCode);
    serverRooms.delete(code);
    serverRooms.delete("custom_" + realCode);
    serverRooms.delete("custom_" + code);
    savePersistedRooms();
    deleteDbRoom(realCode).catch(() => {
    });
    deleteDbRoom(code).catch(() => {
    });
    res.json({ success: true, message: `Room ${code} disbanded successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to disband room" });
  }
});
api.post("/rooms", (req, res) => {
  try {
    const raw = req.body || {};
    const hostEmail = (raw.hostEmail || raw.email || raw.players && raw.players[0]?.email || "").toLowerCase().trim();
    const hostId = (raw.hostId || raw.players && raw.players[0]?.id || "").trim();
    if (hostEmail && bannedEmailsSet.has(hostEmail) || hostId && bannedIdsSet.has(hostId)) {
      res.status(403).json({
        error: "Access Denied: Your account has been suspended by PropRush administration. You cannot create game tables."
      });
      return;
    }
    const code = (raw.code || raw.roomCode || "room_" + Math.random().toString(36).substring(2, 7)).trim().toLowerCase();
    loadPersistedRooms();
    const existing = findRoomByCode(code);
    const now = Date.now();
    if (existing && existing.status !== "finished") {
      if (hostId && (!existing.hostId || existing.hostId.startsWith("host_") || existing.hostId === hostId)) {
        existing.hostId = hostId;
      }
      if (Array.isArray(raw.players) && raw.players.length > 0) {
        const hostPlayer = raw.players[0];
        if (hostPlayer && hostPlayer.id) {
          if (!Array.isArray(existing.players)) existing.players = [];
          const hostIdx = existing.players.findIndex((p) => p && (p.id === hostPlayer.id || p.id === existing.hostId || p.isHost));
          if (hostIdx >= 0) {
            existing.players[hostIdx] = {
              ...existing.players[hostIdx],
              ...hostPlayer,
              id: existing.players[hostIdx].id || hostPlayer.id,
              isHost: true
            };
          } else {
            existing.players.unshift({ ...hostPlayer, isHost: true });
          }
        }
      }
      existing.updatedAt = now;
      existing.version = (existing.version || 0) + 1;
      serverRooms.set(code, existing);
      savePersistedRooms();
      upsertDbRoom(existing).catch(() => {
      });
      res.json({ success: true, room: existing });
      return;
    }
    const effectiveHostId = hostId || raw.players && raw.players[0]?.id || "host_" + now;
    const initialPlayers = Array.isArray(raw.players) ? raw.players.map((p, idx) => ({
      ...p,
      isHost: Boolean(effectiveHostId && p.id === effectiveHostId || idx === 0 && !p.isBot)
    })) : [];
    const newRoom = {
      code,
      name: raw.name || raw.roomName || `Room ${code.toUpperCase()}`,
      hostId: effectiveHostId,
      isPrivate: Boolean(raw.isPrivate),
      maxPlayers: raw.maxPlayers || raw.max || 4,
      betAmount: typeof raw.betAmount === "number" ? raw.betAmount : typeof raw.bet === "number" ? raw.bet : 0,
      initialCash: raw.initialCash || 1500,
      turnTimeSeconds: raw.turnTimeSeconds || raw.turnTime || 15,
      boardTheme: raw.boardTheme || raw.map || "classic",
      fillWithBots: Boolean(raw.fillWithBots),
      status: raw.status || "waiting",
      players: initialPlayers,
      currentTurnPlayerId: raw.currentTurnPlayerId || initialPlayers[0]?.id || "",
      currentTurnIndex: raw.currentTurnIndex || 0,
      turnPhase: raw.turnPhase || "roll",
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
        { id: "l_" + now, timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), text: `Room ${code} created. Waiting for players...`, type: "info" }
      ],
      chatMessages: Array.isArray(raw.chatMessages) ? raw.chatMessages : [
        { id: "c_" + now, sender: "System", avatar: "navy", text: `Welcome to room ${code}!`, time: (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
      ],
      version: 1,
      createdAt: now,
      updatedAt: now,
      isCustom: true
    };
    serverRooms.set(code, newRoom);
    savePersistedRooms();
    upsertDbRoom(newRoom).catch(() => {
    });
    res.json({ success: true, room: newRoom });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to create room" });
  }
});
api.post("/rooms/:code/join", (req, res) => {
  try {
    const code = (req.params.code || "").trim().toLowerCase();
    const body = req.body || {};
    const player = body.player || body;
    if (!player || !player.id && !player.name) {
      res.status(400).json({ error: "Player data is required" });
      return;
    }
    if (!player.id) {
      player.id = "usr_" + Math.random().toString(36).substring(2, 8);
    }
    const playerEmail = (player.email || "").toLowerCase().trim();
    const playerId = (player.id || "").trim();
    if (playerEmail && bannedEmailsSet.has(playerEmail) || playerId && bannedIdsSet.has(playerId)) {
      res.status(403).json({
        error: "Access Denied: Your account has been suspended by PropRush administration. You cannot enter game tables."
      });
      return;
    }
    loadPersistedRooms();
    let room = findRoomByCode(code);
    const now = Date.now();
    const isCreatorRequest = Boolean(player.isHost || body.isCreator);
    if (!room) {
      const isDefault = code === "tokyo88" || code === "whale50" || code === "inu17";
      if (!isDefault && !isCreatorRequest) {
        res.status(404).json({
          error: `Room "${code.toUpperCase()}" does not exist or has already finished. Please verify your room code or ask the host to send an active invite link.`
        });
        return;
      }
      room = {
        code,
        name: `Room ${code.toUpperCase()}`,
        hostId: isCreatorRequest ? player.id : "",
        isPrivate: false,
        maxPlayers: 4,
        betAmount: 0,
        initialCash: 1500,
        turnTimeSeconds: 15,
        boardTheme: "classic",
        fillWithBots: false,
        status: "waiting",
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
    if (!Array.isArray(room.kickedPlayerIds)) room.kickedPlayerIds = [];
    room.kickedPlayerIds = room.kickedPlayerIds.filter(
      (id) => typeof id === "string" && id.trim() !== "" && id !== "Guest Player" && id !== "Player"
    );
    if (player.id && room.kickedPlayerIds.includes(player.id)) {
      res.status(403).json({ error: "You have been removed from this room by the host." });
      return;
    }
    let existingPlayerIndex = room.players.findIndex((p) => p && p.id === player.id);
    if (existingPlayerIndex >= 0) {
      const existingP = room.players[existingPlayerIndex];
      const isExistingHost = Boolean(existingP?.isHost || room.hostId && room.hostId === existingP?.id);
      if (isExistingHost && !isCreatorRequest && !player.isHost) {
        player.id = "usr_" + Math.random().toString(36).substring(2, 8) + "_" + Date.now().toString(36).slice(-4);
        existingPlayerIndex = -1;
      }
    }
    if (existingPlayerIndex >= 0) {
      const isPlayerTheHost = Boolean(
        room.hostId && room.hostId === player.id || isCreatorRequest || room.players[existingPlayerIndex].isHost
      );
      if (isPlayerTheHost && !room.hostId) {
        room.hostId = player.id;
      }
      const wasDisconnected = Boolean(room.players[existingPlayerIndex].isDisconnected);
      room.players[existingPlayerIndex] = {
        ...room.players[existingPlayerIndex],
        ...player,
        name: player.name || room.players[existingPlayerIndex].name,
        username: player.username || room.players[existingPlayerIndex].username,
        firstName: player.firstName || room.players[existingPlayerIndex].firstName,
        lastName: player.lastName || room.players[existingPlayerIndex].lastName,
        walletAddress: player.walletAddress || room.players[existingPlayerIndex].walletAddress,
        isHost: isPlayerTheHost,
        isDisconnected: false,
        disconnectedAt: void 0
      };
      if (wasDisconnected) {
        if (!Array.isArray(room.logs)) room.logs = [];
        room.logs.unshift({
          id: "l_rejoin_" + Date.now(),
          timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `\u{1F504} ${room.players[existingPlayerIndex].name} reconnected to the match!`,
          type: "info"
        });
      }
    } else {
      if (room.players.length >= room.maxPlayers) {
        res.status(400).json({ error: `Room is full (${room.players.length}/${room.maxPlayers} players).` });
        return;
      }
      const playerColors = ["#3b82f6", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];
      const assignedColor = player.color || playerColors[room.players.length % playerColors.length];
      let displayName = player.username || player.name || "Player";
      const sameNameCount = room.players.filter((p) => p && (p.name === displayName || String(p.name || "").startsWith(displayName + " "))).length;
      if (sameNameCount > 0) {
        displayName = `${displayName} (${sameNameCount + 1})`;
      }
      const isPlayerTheHost = Boolean(
        room.hostId && room.hostId === player.id || !room.hostId && isCreatorRequest
      );
      if (isPlayerTheHost && !room.hostId) {
        room.hostId = player.id;
      }
      const newPlayer = {
        id: player.id,
        name: displayName,
        username: player.username || displayName,
        firstName: player.firstName,
        lastName: player.lastName,
        walletAddress: player.walletAddress,
        avatar: player.avatar || (room.players.length % 2 === 1 ? "purple" : "orange"),
        avatarFrame: player.avatarFrame,
        diceSkin: player.diceSkin || "dice_golden",
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
        isHost: isPlayerTheHost
      };
      room.players.push(newPlayer);
      if (!newPlayer.isBot && newPlayer.name) {
        const emailVal = player.email || `${newPlayer.name.toLowerCase().replace(/[^a-z0-9]/g, "")}@player.proprush.com`;
        const existingP = findPlatformUser(newPlayer.id, emailVal);
        if (!existingP) {
          platformUsersMap.set(newPlayer.id, {
            id: newPlayer.id,
            username: newPlayer.name,
            email: emailVal,
            avatar: newPlayer.avatar || "orange",
            avatarFrame: newPlayer.avatarFrame,
            walletBalance: 100,
            coins: 50,
            leaguePoints: 300,
            leagueTier: "Silver",
            level: 1,
            stats: {
              gamesPlayed: 1,
              gamesWon: 0,
              winStreak: 0,
              bestWinStreak: 0,
              totalEarningsUsd: 0,
              totalCoinsEarned: 50
            },
            role: "player",
            isBanned: false,
            country: "Global",
            city: "Online",
            joinedDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
            title: "Active Competitor",
            lastActive: now
          });
        }
      }
      room.logs.unshift({
        id: "l_" + now,
        timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: `\u{1F44B} ${newPlayer.name} joined the room! (${room.players.length}/${room.maxPlayers})`,
        type: "info"
      });
    }
    room.version = (room.version || 0) + 1;
    room.updatedAt = now;
    serverRooms.set(code, room);
    savePersistedRooms();
    res.json({ success: true, room });
  } catch (err) {
    console.error("Error in /rooms/:code/join:", err);
    res.status(500).json({ error: err.message || "Failed to join room" });
  }
});
api.post("/rooms/:code/state", (req, res) => {
  try {
    const code = (req.params.code || "").trim().toLowerCase();
    const body = req.body || {};
    const updatedRoom = body.room || body;
    if (!updatedRoom) {
      res.status(400).json({ error: "Room state required" });
      return;
    }
    loadPersistedRooms();
    let existing = findRoomByCode(code);
    const now = Date.now();
    const targetCode = existing?.code || code;
    const authoritativeHostId = existing && existing.hostId ? existing.hostId : updatedRoom.hostId || "";
    let targetStatus = updatedRoom.status || (existing ? existing.status : "waiting");
    if (existing && existing.status === "waiting" && targetStatus === "playing") {
      const callerId2 = (body.playerId || body.hostId || updatedRoom.hostId || "").trim();
      if (authoritativeHostId && callerId2 && callerId2 !== authoritativeHostId) {
        targetStatus = "waiting";
      }
    }
    const kickedSet = new Set(
      (existing?.kickedPlayerIds || []).filter((id) => id && id !== "Guest Player" && id !== "Player")
    );
    if (Array.isArray(updatedRoom.kickedPlayerIds)) {
      updatedRoom.kickedPlayerIds.forEach((id) => {
        if (id && id !== "Guest Player" && id !== "Player") kickedSet.add(id);
      });
    }
    const callerId = (body.playerId || body.hostId || updatedRoom.hostId || "").trim();
    const callerUserId = (body.userId || "").trim();
    const incomingList = Array.isArray(updatedRoom.players) ? updatedRoom.players : [];
    const isHostCaller = Boolean(
      authoritativeHostId && (callerId === authoritativeHostId || callerUserId === authoritativeHostId) || incomingList.some((p) => p && p.isHost && (p.id === callerId || p.id === callerUserId))
    );
    let sanitizedPlayers = [];
    if (targetStatus === "waiting") {
      const filteredIncoming = incomingList.filter(
        (p) => p && p.id && !kickedSet.has(p.id)
      );
      if (isHostCaller) {
        const hostPlayerIds = new Set(filteredIncoming.map((p) => p.id));
        const newlyJoinedOnServer = (existing?.players || []).filter(
          (ep) => ep && ep.id && !hostPlayerIds.has(ep.id) && !kickedSet.has(ep.id) && !ep.isBot
        );
        sanitizedPlayers = [...filteredIncoming, ...newlyJoinedOnServer];
      } else {
        const basePlayers = (existing?.players || filteredIncoming).filter(
          (p) => p && p.id && !kickedSet.has(p.id)
        );
        const myUpdate = filteredIncoming.find((p) => p && (p.id === callerId || p.id === callerUserId));
        if (myUpdate) {
          sanitizedPlayers = basePlayers.map((p) => p.id === callerId || p.id === callerUserId ? { ...p, ...myUpdate } : p);
          if (!sanitizedPlayers.some((p) => p.id === callerId || p.id === callerUserId) && !kickedSet.has(callerId)) {
            sanitizedPlayers.push(myUpdate);
          }
        } else {
          sanitizedPlayers = basePlayers;
        }
      }
      sanitizedPlayers = sanitizedPlayers.map((p, idx) => ({
        ...p,
        isHost: Boolean(authoritativeHostId ? p.id === authoritativeHostId : idx === 0)
      }));
    } else {
      const existingPlayersMap = /* @__PURE__ */ new Map();
      (existing?.players || []).forEach((ep) => {
        if (ep && ep.id) existingPlayersMap.set(ep.id, ep);
      });
      const incomingPlayersMap = /* @__PURE__ */ new Map();
      incomingList.forEach((ip) => {
        if (ip && ip.id) incomingPlayersMap.set(ip.id, ip);
      });
      const allPlayerIds = Array.from(/* @__PURE__ */ new Set([...existingPlayersMap.keys(), ...incomingPlayersMap.keys()])).filter((id) => id && !kickedSet.has(id));
      sanitizedPlayers = allPlayerIds.map((id, idx) => {
        const ep = existingPlayersMap.get(id);
        const ip = incomingPlayersMap.get(id);
        if (!ep) {
          return {
            ...ip,
            properties: Array.isArray(ip.properties) ? ip.properties.map(Number) : [],
            isHost: Boolean(authoritativeHostId ? id === authoritativeHostId : idx === 0)
          };
        }
        if (!ip) {
          return {
            ...ep,
            properties: Array.isArray(ep.properties) ? ep.properties.map(Number) : [],
            isHost: Boolean(authoritativeHostId ? id === authoritativeHostId : idx === 0)
          };
        }
        const isThisCaller = Boolean(
          callerId && id === callerId || callerUserId && id === callerUserId
        );
        let mergedProps = [];
        if (ip.isBankrupt || ep.isBankrupt) {
          mergedProps = [];
        } else {
          const epProps = Array.isArray(ep.properties) ? ep.properties.map(Number) : [];
          const ipProps = Array.isArray(ip.properties) ? ip.properties.map(Number) : [];
          mergedProps = Array.from(/* @__PURE__ */ new Set([...epProps, ...ipProps]));
        }
        const epMort = Array.isArray(ep.mortgaged) ? ep.mortgaged.map(Number) : [];
        const ipMort = Array.isArray(ip.mortgaged) ? ip.mortgaged.map(Number) : [];
        const mergedMort = Array.from(/* @__PURE__ */ new Set([...epMort, ...ipMort])).filter((pid) => mergedProps.includes(pid));
        const epHouses = ep.houses || {};
        const ipHouses = ip.houses || {};
        const mergedHouses = { ...epHouses, ...ipHouses };
        const base = isThisCaller ? { ...ep, ...ip } : { ...ip, ...ep, isBankrupt: Boolean(ep.isBankrupt || ip.isBankrupt) };
        return {
          ...base,
          id,
          properties: mergedProps,
          mortgaged: mergedMort,
          houses: mergedHouses,
          isHost: Boolean(authoritativeHostId ? id === authoritativeHostId : idx === 0)
        };
      });
      const claimedTiles = /* @__PURE__ */ new Set();
      for (const p of sanitizedPlayers) {
        if (Array.isArray(p.properties)) {
          p.properties = p.properties.filter((tileId) => {
            if (claimedTiles.has(tileId)) return false;
            claimedTiles.add(tileId);
            return true;
          });
        }
      }
    }
    const merged = {
      ...existing || {},
      ...updatedRoom,
      code: targetCode,
      hostId: authoritativeHostId,
      status: targetStatus,
      players: sanitizedPlayers,
      kickedPlayerIds: Array.from(kickedSet),
      version: (existing ? existing.version || 0 : 0) + 1,
      updatedAt: now
    };
    serverRooms.set(targetCode, merged);
    if (targetCode !== code) {
      serverRooms.set(code, merged);
    }
    savePersistedRooms();
    upsertDbRoom(merged).catch(() => {
    });
    if ((merged.status === "gameover" || merged.status === "finished") && merged.winner) {
      if (merged.wagerMode === "crypto" && merged.wagerContractAddress) {
        const winnerObj = typeof merged.winner === "object" && merged.winner !== null ? merged.winner : (merged.players || []).find((p) => p.name === merged.winner || p.id === merged.winner?.id);
        const winnerWallet = winnerObj?.walletAddress;
        if (winnerWallet && merged.wagerStatus !== "Proposed" && merged.wagerStatus !== "Settled") {
          keeperProposeResult(merged.wagerContractAddress, winnerWallet).then((res2) => {
            if (res2.success) {
              merged.wagerStatus = "Proposed";
              merged.wagerWinnerAddress = winnerWallet;
              merged.wagerProposalTxHash = res2.txHash;
              merged.wagerProposalTime = Math.floor(Date.now() / 1e3);
              savePersistedRooms();
            }
          }).catch(() => {
          });
        }
      }
      recordDbMatch({
        id: "m_" + (merged.code || "") + "_" + now,
        roomCode: merged.code,
        roomName: merged.name,
        winnerId: merged.winner?.id,
        winnerName: merged.winner?.name,
        prizePool: (merged.betAmount || 0) * (merged.players?.length || 1),
        betAmount: merged.betAmount || 0,
        playersSummary: merged.players?.map((p) => ({ id: p.id, name: p.name, netWorth: p.netWorth, cash: p.cash })),
        finalStats: { winner: merged.winner, duration: now - (merged.createdAt || now) }
      }).catch(() => {
      });
    }
    res.json({ success: true, version: merged.version });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to update state" });
  }
});
api.post("/rooms/:code/start", (req, res) => {
  try {
    const code = (req.params.code || "").trim().toLowerCase();
    const { hostId, playerId } = req.body || {};
    const callerId = (hostId || playerId || "").trim();
    loadPersistedRooms();
    const room = findRoomByCode(code);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    if (room.hostId && callerId && callerId !== room.hostId) {
      res.status(403).json({ error: "Only the room creator / host can start the match." });
      return;
    }
    if (room.players.length < 2) {
      res.status(400).json({ error: "At least 2 players are required to start." });
      return;
    }
    room.status = "playing";
    room.currentTurnPlayerId = room.players[0]?.id || "";
    room.currentTurnIndex = 0;
    room.turnPhase = "roll";
    room.turnTimer = room.turnTimeSeconds || 15;
    room.version = (room.version || 0) + 1;
    room.updatedAt = Date.now();
    serverRooms.set(room.code, room);
    if (room.code !== code) serverRooms.set(code, room);
    savePersistedRooms();
    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to start match" });
  }
});
api.post("/rooms/:code/kick", (req, res) => {
  try {
    const code = (req.params.code || "").trim().toLowerCase();
    const { hostId, userId, playerIdToKick, username } = req.body || {};
    const callerId = (hostId || "").trim();
    const callerUserId = (userId || "").trim();
    loadPersistedRooms();
    const room = findRoomByCode(code);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    const isCallerHost = Boolean(
      room.hostId && (callerId === room.hostId || callerUserId === room.hostId) || room.players.some((p) => (p.id === callerId || p.id === callerUserId) && p.isHost)
    );
    if (!isCallerHost && room.hostId && callerId && callerId !== room.hostId) {
      res.status(403).json({ error: "Only the room creator / host can kick players." });
      return;
    }
    if (!Array.isArray(room.kickedPlayerIds)) {
      room.kickedPlayerIds = [];
    }
    const kickedPlayer = room.players.find((p) => p.id === playerIdToKick);
    const targetId = (kickedPlayer ? kickedPlayer.id : playerIdToKick || "").trim();
    const targetName = kickedPlayer?.name || username || "A player";
    if (targetId && !room.kickedPlayerIds.includes(targetId)) {
      room.kickedPlayerIds.push(targetId);
    }
    room.kickedPlayerIds = room.kickedPlayerIds.filter(
      (id) => typeof id === "string" && id.trim() !== "" && id !== "Guest Player" && id !== "Player"
    );
    room.players = room.players.filter((p) => p && p.id !== targetId && p.id !== playerIdToKick);
    if (!Array.isArray(room.logs)) room.logs = [];
    room.logs.unshift({
      id: "l_kick_" + Date.now(),
      timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: `\u{1F462} ${targetName} was removed from the room by the host.`,
      type: "info"
    });
    room.version = (room.version || 0) + 1;
    room.updatedAt = Date.now();
    serverRooms.set(room.code, room);
    if (room.code !== code) serverRooms.set(code, room);
    savePersistedRooms();
    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to kick player" });
  }
});
api.post("/rooms/:code/leave", (req, res) => {
  try {
    const code = (req.params.code || "").trim().toLowerCase();
    const { playerId, username, reason } = req.body || {};
    loadPersistedRooms();
    const room = findRoomByCode(code);
    if (!room) {
      res.json({ success: true, message: "Room not found" });
      return;
    }
    const leavingPlayerIndex = room.players.findIndex(
      (p) => p && (p.id === playerId || username && p.name === username)
    );
    if (leavingPlayerIndex >= 0) {
      const leavingPlayer = room.players[leavingPlayerIndex];
      const displayName = leavingPlayer?.name || username || "A player";
      if (room.status === "waiting") {
        const isHost = leavingPlayer.isHost || room.hostId === leavingPlayer.id;
        const otherPlayers = room.players.filter((_, idx) => idx !== leavingPlayerIndex);
        if (req.body?.isDisband && isHost) {
          serverRooms.delete(room.code.toLowerCase());
          serverRooms.delete(code.toLowerCase());
          savePersistedRooms();
          res.json({ success: true, message: "Room disbanded", disbanded: true });
          return;
        }
        if (otherPlayers.length > 0) {
          room.players.splice(leavingPlayerIndex, 1);
          if (isHost) {
            const nextHost = otherPlayers.find((p) => !p.isBot) || otherPlayers[0];
            nextHost.isHost = true;
            room.hostId = nextHost.id;
          }
        } else if (!isHost) {
          room.players.splice(leavingPlayerIndex, 1);
        } else {
          leavingPlayer.isDisconnected = true;
          leavingPlayer.disconnectedAt = Date.now();
        }
        if (!Array.isArray(room.logs)) room.logs = [];
        room.logs.unshift({
          id: "l_leave_" + Date.now(),
          timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: `\u{1F6AA} ${displayName} left the lobby.`,
          type: "info"
        });
      } else if (room.status === "playing") {
        const isDisconnect = reason === "disconnect";
        if (isDisconnect) {
          leavingPlayer.isDisconnected = true;
          leavingPlayer.disconnectedAt = Date.now();
          if (!Array.isArray(room.logs)) room.logs = [];
          room.logs.unshift({
            id: "l_dc_" + Date.now(),
            timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            text: `\u26A0\uFE0F ${displayName} disconnected. They have 2 minutes to reconnect.`,
            type: "info"
          });
          if (room.currentTurnPlayerId === leavingPlayer.id) {
            const activeEligible = room.players.filter((p) => !p.isBankrupt);
            const nextIdx = (room.currentTurnIndex + 1) % room.players.length;
            const nextPlayer = room.players[nextIdx];
            room.currentTurnIndex = nextIdx;
            room.currentTurnPlayerId = nextPlayer?.id || activeEligible[0]?.id || "";
            room.turnPhase = "roll";
            room.turnTimer = room.turnTimeSeconds || 15;
          }
        } else {
          leavingPlayer.isBankrupt = true;
          leavingPlayer.isDisconnected = false;
          leavingPlayer.cash = 0;
          leavingPlayer.properties = [];
          leavingPlayer.houses = {};
          leavingPlayer.mortgaged = [];
          if (!Array.isArray(room.logs)) room.logs = [];
          room.logs.unshift({
            id: "l_leave_" + Date.now(),
            timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            text: `\u{1F6A9} ${displayName} surrendered and left the match.`,
            type: "info"
          });
          const activePlayers = room.players.filter((p) => !p.isBankrupt);
          if (activePlayers.length <= 1) {
            room.status = "finished";
            room.winner = activePlayers[0] || room.players[0];
          } else if (room.currentTurnPlayerId === leavingPlayer.id) {
            const nextIdx = (room.currentTurnIndex + 1) % room.players.length;
            const nextPlayer = room.players[nextIdx];
            room.currentTurnIndex = nextIdx;
            room.currentTurnPlayerId = nextPlayer?.id || activePlayers[0]?.id || "";
            room.turnPhase = "roll";
            room.turnTimer = room.turnTimeSeconds || 15;
          }
        }
      }
      room.version = (room.version || 0) + 1;
      room.updatedAt = Date.now();
      serverRooms.set(room.code, room);
      if (room.code !== code) serverRooms.set(code, room);
      savePersistedRooms();
      upsertDbRoom(room).catch(() => {
      });
    }
    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to leave room" });
  }
});
api.post("/rooms/:code/chat", (req, res) => {
  try {
    const code = (req.params.code || "").trim().toLowerCase();
    const body = req.body || {};
    const message = body.message || body;
    if (!message || !message.text) {
      res.status(400).json({ error: "Valid chat message required" });
      return;
    }
    loadPersistedRooms();
    let room = findRoomByCode(code);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    const chatEntry = {
      id: message.id || "c_" + Date.now(),
      sender: message.sender || "Player",
      avatar: message.avatar || "orange",
      text: message.text,
      time: message.time || (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    room.chatMessages = [...(room.chatMessages || []).slice(-40), chatEntry];
    room.version = (room.version || 0) + 1;
    room.updatedAt = Date.now();
    serverRooms.set(room.code, room);
    if (room.code !== code) serverRooms.set(code, room);
    savePersistedRooms();
    res.json({ success: true, message: chatEntry, chatMessages: room.chatMessages });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to send chat" });
  }
});
api.get("/users", (req, res) => {
  try {
    const query = (req.query.q || "").toLowerCase().trim();
    const seenIds = /* @__PURE__ */ new Set();
    const seenEmails = /* @__PURE__ */ new Set();
    let list = [];
    for (const u of platformUsersMap.values()) {
      if (u.email && u.email.endsWith("@proprush.player") && String(u.username || "").toLowerCase() === "sahitya") {
        u.email = "sahityagroovy@gmail.com";
      }
      const cleanEmail = (u.email || "").toLowerCase().trim();
      if (seenIds.has(u.id)) continue;
      if (cleanEmail && seenEmails.has(cleanEmail)) continue;
      seenIds.add(u.id);
      if (cleanEmail) seenEmails.add(cleanEmail);
      list.push(u);
    }
    if (query) {
      list = list.filter(
        (u) => String(u.username || "").toLowerCase().includes(query) || String(u.email || "").toLowerCase().includes(query) || String(u.city || "").toLowerCase().includes(query) || String(u.country || "").toLowerCase().includes(query) || String(u.title || "").toLowerCase().includes(query)
      );
    }
    res.json({ users: list, total: list.length });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to list users", users: [], total: 0 });
  }
});
api.post("/users/sync", (req, res) => {
  try {
    const { user } = req.body || {};
    if (!user) {
      res.status(400).json({ error: "Missing user profile data" });
      return;
    }
    const rawId = (user.id || user.dynamicUserId || "").trim();
    const rawWallet = (user.walletAddress || "").trim();
    const rawEmail = (user.email || "").trim();
    const rawUsername = (user.username || "").trim();
    let existing = findPlatformUser(rawId, rawEmail, rawWallet);
    const resolvedId = existing?.id || rawId || (rawWallet ? `usr_${rawWallet.slice(2, 10)}` : "usr_" + Date.now());
    const resolvedEmail = rawEmail || existing?.email || "";
    const resolvedWallet = rawWallet || existing?.walletAddress || "";
    const isAdmin = resolvedEmail.toLowerCase() === "sahityanijhawan@gmail.com" || existing?.role === "admin" || user.role === "admin";
    const updatedUser = {
      id: resolvedId,
      username: rawUsername || existing?.username || (resolvedWallet ? `${resolvedWallet.slice(0, 6)}...${resolvedWallet.slice(-4)}` : resolvedEmail ? resolvedEmail.split("@")[0] : "Player"),
      email: resolvedEmail,
      walletAddress: resolvedWallet,
      avatar: user.avatar || existing?.avatar || "orange",
      avatarFrame: user.avatarFrame || existing?.avatarFrame,
      profilePictureUrl: user.profilePictureUrl || existing?.profilePictureUrl,
      walletBalance: typeof user.walletBalance === "number" ? user.walletBalance : existing?.walletBalance ?? 0,
      coins: typeof user.coins === "number" ? user.coins : existing?.coins ?? 0,
      leaguePoints: typeof user.leaguePoints === "number" ? user.leaguePoints : existing?.leaguePoints ?? 0,
      leagueTier: user.leagueTier || existing?.leagueTier || "Bronze",
      level: user.level || existing?.level || 1,
      stats: {
        gamesPlayed: typeof user.stats?.gamesPlayed === "number" ? user.stats.gamesPlayed : existing?.stats?.gamesPlayed || 0,
        gamesWon: typeof user.stats?.gamesWon === "number" ? user.stats.gamesWon : existing?.stats?.gamesWon || 0,
        winStreak: typeof user.stats?.winStreak === "number" ? user.stats.winStreak : existing?.stats?.winStreak || 0,
        bestWinStreak: typeof user.stats?.bestWinStreak === "number" ? user.stats.bestWinStreak : existing?.stats?.bestWinStreak || 0,
        totalEarningsUsd: typeof user.stats?.totalEarningsUsd === "number" ? user.stats.totalEarningsUsd : existing?.stats?.totalEarningsUsd || 0,
        totalCoinsEarned: typeof user.stats?.totalCoinsEarned === "number" ? user.stats.totalCoinsEarned : existing?.stats?.totalCoinsEarned || 0
      },
      role: isAdmin ? "admin" : existing?.role || "player",
      isBanned: existing?.isBanned || Boolean(resolvedEmail) && bannedEmailsSet.has(resolvedEmail.toLowerCase()) || bannedIdsSet.has(resolvedId),
      country: existing?.country || "United States",
      city: existing?.city || "San Francisco",
      joinedDate: existing?.joinedDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      title: existing?.title || (isAdmin ? "Platform Administrator" : "Competitive Player"),
      lastActive: Date.now()
    };
    for (const [key, val] of platformUsersMap.entries()) {
      if (resolvedEmail && val.email && val.email.toLowerCase() === resolvedEmail.toLowerCase() || resolvedWallet && val.walletAddress && val.walletAddress.toLowerCase() === resolvedWallet.toLowerCase() || key === resolvedId) {
        platformUsersMap.delete(key);
      }
    }
    platformUsersMap.set(resolvedId, updatedUser);
    upsertDbUser(updatedUser).catch(() => {
    });
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to sync user" });
  }
});
api.get("/rankings", async (req, res) => {
  try {
    const timeframe = (req.query.timeframe || "season").toLowerCase();
    const search = (req.query.search || "").toLowerCase().trim();
    const currentEmail = (req.query.currentEmail || "").toLowerCase().trim();
    const pool2 = getDbPool();
    if (pool2) {
      try {
        const dbRanked = await getDbRankings(timeframe, search, 100);
        if (Array.isArray(dbRanked) && dbRanked.length > 0) {
          const rankedList2 = dbRanked.map((item, index) => {
            const rank = index + 1;
            let prize = "+10 \u{1FA99}";
            if (rank === 1) prize = "\u{1F947} +60 \u{1FA99} & Diamond Badge";
            else if (rank === 2) prize = "\u{1F948} +40 \u{1FA99}";
            else if (rank === 3) prize = "\u{1F949} +25 \u{1FA99}";
            return {
              ...item,
              rank,
              isCurrentUser: Boolean(currentEmail && item.email && item.email.toLowerCase() === currentEmail),
              weeklyProjectedPrize: prize
            };
          });
          res.json({
            timeframe,
            rankings: rankedList2,
            total: rankedList2.length,
            source: "neon_postgres"
          });
          return;
        }
      } catch (dbErr) {
        console.warn("[DB Rankings Fallback]:", dbErr.message);
      }
    }
    const seenEmails = /* @__PURE__ */ new Set();
    const seenIds = /* @__PURE__ */ new Set();
    const seenNames = /* @__PURE__ */ new Set();
    const uniqueUsers = [];
    for (const u of platformUsersMap.values()) {
      const cleanEmail = (u.email || "").toLowerCase().trim();
      const cleanName = String(u.username || "").toLowerCase().trim();
      if (seenIds.has(u.id)) continue;
      if (cleanEmail && seenEmails.has(cleanEmail)) continue;
      if (cleanName && seenNames.has(cleanName)) continue;
      seenIds.add(u.id);
      if (cleanEmail) seenEmails.add(cleanEmail);
      if (cleanName) seenNames.add(cleanName);
      uniqueUsers.push(u);
    }
    let list = uniqueUsers.map((u) => {
      const isCurrent = Boolean(
        currentEmail && u.email && u.email.toLowerCase() === currentEmail
      );
      const stats = u.stats || { gamesPlayed: 0, gamesWon: 0, winStreak: 0, bestWinStreak: 0, totalEarningsUsd: 0, totalCoinsEarned: 0 };
      const winRate = stats.gamesPlayed > 0 ? Number((stats.gamesWon / stats.gamesPlayed * 100).toFixed(1)) : 0;
      const weeklyWins = Math.max(0, Math.min(stats.gamesWon, Math.round(stats.gamesWon * 0.22) || (stats.gamesWon > 0 ? 1 : 0)));
      const weeklyGames = Math.max(weeklyWins, Math.min(stats.gamesPlayed, Math.round(stats.gamesPlayed * 0.22) || (stats.gamesPlayed > 0 ? 1 : 0)));
      const weeklyEarnings = Number((stats.totalEarningsUsd * 0.2).toFixed(2));
      const weeklyStreak = Math.min(stats.winStreak, weeklyWins);
      const weeklyPoints = Math.round(weeklyWins * 45 + weeklyStreak * 15 + (u.leaguePoints || 0) * 0.08);
      const weeklyWinRate = weeklyGames > 0 ? Number((weeklyWins / weeklyGames * 100).toFixed(1)) : 0;
      return {
        id: u.id,
        name: u.username || "Player",
        email: u.email || "",
        avatar: u.avatar || "orange",
        frame: u.avatarFrame,
        profilePictureUrl: u.profilePictureUrl,
        tier: u.leagueTier || "Bronze",
        lp: u.leaguePoints || 0,
        earningsUsd: stats.totalEarningsUsd || 0,
        wins: stats.gamesWon || 0,
        gamesPlayed: stats.gamesPlayed || 0,
        winRate,
        winStreak: stats.winStreak || 0,
        favoriteMap: u.avatar === "cyber" ? "Cyber Neon Metropolis" : u.avatar === "gold" ? "Worldwide Grand Tour" : "Classic RichUp Grid",
        title: u.title || "Player",
        country: u.country || "Global",
        city: u.city || "Online",
        joinedDate: u.joinedDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        isCurrentUser: isCurrent,
        weeklyPoints,
        weeklyEarningsUsd: weeklyEarnings,
        weeklyWins,
        weeklyGamesPlayed: weeklyGames,
        weeklyWinRate,
        weeklyStreak,
        weeklyProjectedPrize: "",
        allTimeEarningsUsd: stats.totalEarningsUsd || 0,
        allTimeWins: stats.gamesWon || 0,
        allTimeGamesPlayed: stats.gamesPlayed || 0,
        allTimeWinRate: winRate,
        allTimeBestStreak: stats.bestWinStreak || stats.winStreak || 0,
        allTimeCoins: stats.totalCoinsEarned || u.coins || 0
      };
    });
    if (search) {
      list = list.filter(
        (p) => String(p.name || "").toLowerCase().includes(search) || String(p.title || "").toLowerCase().includes(search) || String(p.city || "").toLowerCase().includes(search) || String(p.country || "").toLowerCase().includes(search) || String(p.tier || "").toLowerCase().includes(search)
      );
    }
    if (timeframe === "weekly") {
      list.sort((a, b) => {
        if (b.weeklyPoints !== a.weeklyPoints) return b.weeklyPoints - a.weeklyPoints;
        return b.weeklyEarningsUsd - a.weeklyEarningsUsd;
      });
    } else if (timeframe === "all_time") {
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
      let prize = "+10 \u{1FA99}";
      if (rank === 1) prize = "\u{1F947} +60 \u{1FA99} & Diamond Badge";
      else if (rank === 2) prize = "\u{1F948} +40 \u{1FA99}";
      else if (rank === 3) prize = "\u{1F949} +25 \u{1FA99}";
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
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to get rankings", rankings: [], total: 0 });
  }
});
api.post("/admin/users/action", (req, res) => {
  try {
    const { email, id, action, value } = req.body || {};
    if (!email && !id) {
      res.status(400).json({ error: "User email or ID required" });
      return;
    }
    let target = findPlatformUser(id, email);
    if (!target) {
      const userEmail = (email || "").toLowerCase().trim();
      const userId = id || "usr_" + Date.now();
      target = {
        id: userId,
        username: userEmail ? userEmail.split("@")[0] : "Player",
        email: userEmail || `${userId}@proprush.player`,
        avatar: "orange",
        walletBalance: 0,
        coins: 0,
        leaguePoints: 0,
        leagueTier: "Bronze",
        level: 1,
        stats: {
          gamesPlayed: 0,
          gamesWon: 0,
          winStreak: 0,
          bestWinStreak: 0,
          totalEarningsUsd: 0,
          totalCoinsEarned: 0
        },
        role: "player",
        isBanned: false,
        country: "Global",
        city: "Online",
        joinedDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        title: "Player",
        lastActive: Date.now()
      };
      platformUsersMap.set(target.id, target);
    }
    const emailKey = target.email ? target.email.toLowerCase().trim() : "";
    if (action === "credit") {
      const amount = parseFloat(value);
      if (!isNaN(amount) && amount > 0) {
        target.walletBalance = Math.round((target.walletBalance + amount) * 100) / 100;
      }
    } else if (action === "toggleBan") {
      target.isBanned = !target.isBanned;
      if (target.isBanned) {
        if (emailKey) bannedEmailsSet.add(emailKey);
        if (target.id) bannedIdsSet.add(target.id);
      } else {
        if (emailKey) bannedEmailsSet.delete(emailKey);
        if (target.id) bannedIdsSet.delete(target.id);
      }
    } else if (action === "ban") {
      target.isBanned = true;
      if (emailKey) bannedEmailsSet.add(emailKey);
      if (target.id) bannedIdsSet.add(target.id);
    } else if (action === "unban") {
      target.isBanned = false;
      if (emailKey) bannedEmailsSet.delete(emailKey);
      if (target.id) bannedIdsSet.delete(target.id);
    } else if (action === "delete") {
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
    } else if (action === "role") {
      target.role = value === "admin" ? "admin" : "player";
    }
    platformUsersMap.set(target.id, target);
    res.json({ success: true, user: target });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed action" });
  }
});
api.get("/wager/config", (_req, res) => {
  res.json({
    factoryAddress: "0xb6Ed4A314112f0f771E34d0099E3eEd471683DFD",
    mockUsdcAddress: "0x6482c263a6F3f651Ab292443DC60B378482E5e17",
    defaultKeeperAddress: "0xCaE1F9b142908090aE806ae344C4A3a9c31ae69D",
    chainId: 84532,
    chainName: "Base Sepolia",
    hasKeeperConfigured: Boolean(process.env.KEEPER_PRIVATE_KEY)
  });
});
api.post("/wager/propose-result", async (req, res) => {
  try {
    const { poolAddress, winnerAddress, roomCode } = req.body || {};
    if (!poolAddress || !winnerAddress) {
      res.status(400).json({ error: "poolAddress and winnerAddress are required" });
      return;
    }
    const result = await keeperProposeResult(poolAddress, winnerAddress);
    if (result.success && roomCode) {
      loadPersistedRooms();
      const room = findRoomByCode(roomCode);
      if (room) {
        room.wagerStatus = "Proposed";
        room.wagerWinnerAddress = winnerAddress;
        room.wagerProposalTxHash = result.txHash;
        room.wagerProposalTime = Math.floor(Date.now() / 1e3);
        savePersistedRooms();
      }
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to propose result" });
  }
});
api.get("/wager/pool/:address", async (req, res) => {
  try {
    const address = req.params.address;
    const status = await getServerPoolStatus(address);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to get pool status" });
  }
});
api.post("/faucet/mint", async (req, res) => {
  try {
    const { address, amount } = req.body || {};
    if (!address || typeof address !== "string" || !address.startsWith("0x")) {
      res.status(400).json({ error: "Valid recipient Ethereum address (0x...) is required" });
      return;
    }
    const tokenAmount = Number(amount) > 0 ? Math.min(Number(amount), 1e3) : 50;
    const result = await serverMintMockUsdc(address, tokenAmount);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to mint test tokens" });
  }
});
app.use("/api", api);
app.use("/", api);
app.use((err, _req, res, _next) => {
  console.error("Unhandled API error:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
});
var app_default = app;
export {
  app_default as default,
  pruneStaleRooms
};
