import { Pool } from 'pg';

let pool: Pool | null = null;
let isInitialized = false;

/**
 * Returns the active PostgreSQL connection pool, or null if DATABASE_URL is not set.
 */
export function getDbPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || connectionString.trim() === '') {
    return null;
  }

  if (!pool) {
    try {
      const isSsl = connectionString.includes('sslmode=require') || connectionString.includes('neon.tech') || process.env.NODE_ENV === 'production';
      pool = new Pool({
        connectionString,
        ssl: isSsl ? { rejectUnauthorized: false } : undefined,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      pool.on('error', (err) => {
        console.error('[Neon DB Pool Error]:', err.message);
      });
    } catch (err: any) {
      console.error('[Neon DB Init Error]:', err.message);
      pool = null;
    }
  }

  return pool;
}

/**
 * Initializes tables and indexes in Neon PostgreSQL if connected.
 */
export async function initDatabase(): Promise<boolean> {
  const p = getDbPool();
  if (!p) {
    console.log('[Neon DB] No DATABASE_URL configured. PropRush is operating with memory/local store.');
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
      console.log('[Neon DB] Successfully connected and schema verified.');
      return true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[Neon DB Init Schema Error]:', err.message);
    return false;
  }
}

/**
 * Upserts a user in Neon PostgreSQL.
 */
export async function upsertDbUser(user: any): Promise<boolean> {
  const p = getDbPool();
  if (!p) return false;

  try {
    const id = user.id;
    const email = user.email || null;
    const username = user.username || 'Player';
    const walletBalance = typeof user.walletBalance === 'number' ? user.walletBalance : 0;
    const lp = typeof user.leaguePoints === 'number' ? user.leaguePoints : (user.stats?.leaguePoints || 0);
    const allTimeEarnings = typeof user.allTimeEarningsUsd === 'number' ? user.allTimeEarningsUsd : (user.stats?.totalEarningsUsd || 0);
    const weeklyPoints = typeof user.weeklyCupPoints === 'number' ? user.weeklyCupPoints : 0;
    const wins = typeof user.stats?.wins === 'number' ? user.stats.wins : 0;
    const streak = typeof user.stats?.currentStreak === 'number' ? user.stats.currentStreak : 0;
    const avatar = user.avatar || 'orange';
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
        metadata,
      ]
    );
    return true;
  } catch (err: any) {
    console.error('[Neon DB upsertUser Error]:', err.message);
    return false;
  }
}

/**
 * Fetches users ordered for rankings from Neon PostgreSQL.
 */
export async function getDbRankings(timeframe: string = 'season', searchQuery: string = '', limit: number = 100): Promise<any[] | null> {
  const p = getDbPool();
  if (!p) return null;

  try {
    let orderBy = 'league_points DESC, all_time_earnings DESC';
    if (timeframe === 'weekly') {
      orderBy = 'weekly_points DESC, league_points DESC';
    } else if (timeframe === 'all_time') {
      orderBy = 'all_time_earnings DESC, wins DESC';
    }

    let query = `
      SELECT id, email, username, wallet_balance, league_points, all_time_earnings,
             weekly_points, wins, current_streak, avatar, avatar_frame, dice_skin,
             is_banned, metadata, updated_at
      FROM users
      WHERE is_banned = FALSE
    `;

    const params: any[] = [];
    if (searchQuery && searchQuery.trim() !== '') {
      params.push(`%${searchQuery.trim().toLowerCase()}%`);
      query += ` AND (LOWER(username) LIKE $${params.length} OR LOWER(COALESCE(email, '')) LIKE $${params.length})`;
    }

    query += ` ORDER BY ${orderBy} LIMIT $${params.length + 1}`;
    params.push(limit);

    const res = await p.query(query, params);
    return res.rows.map((r, idx) => {
      const meta = typeof r.metadata === 'object' && r.metadata !== null ? r.metadata : {};
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
        rank: idx + 1,
      };
    });
  } catch (err: any) {
    console.error('[Neon DB getDbRankings Error]:', err.message);
    return null;
  }
}

/**
 * Upserts a live room in Neon PostgreSQL.
 */
export async function upsertDbRoom(room: any): Promise<boolean> {
  const p = getDbPool();
  if (!p) return false;

  try {
    const code = room.code.toLowerCase();
    const name = room.name || code.toUpperCase();
    const hostId = room.hostId || null;
    const status = room.status || 'waiting';
    const betAmount = room.betAmount || 0;
    const maxPlayers = room.maxPlayers || 4;
    const boardTheme = room.boardTheme || 'classic';
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
        roomData,
      ]
    );
    return true;
  } catch (err: any) {
    console.error('[Neon DB upsertDbRoom Error]:', err.message);
    return false;
  }
}

/**
 * Removes a room from Neon PostgreSQL (e.g. on disband or finish).
 */
export async function deleteDbRoom(code: string): Promise<boolean> {
  const p = getDbPool();
  if (!p) return false;

  try {
    await p.query(`DELETE FROM rooms WHERE code = $1`, [code.toLowerCase()]);
    return true;
  } catch (err: any) {
    console.error('[Neon DB deleteDbRoom Error]:', err.message);
    return false;
  }
}

/**
 * Prunes stale, abandoned, or finished rooms from Neon PostgreSQL.
 * Frees up database storage and keeps active rooms query blazing fast.
 */
export async function pruneStaleDbRooms(): Promise<number> {
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
  } catch (err: any) {
    console.error('[Neon DB pruneStaleDbRooms Error]:', err.message);
    return 0;
  }
}

/**
 * Fetches all active rooms from Neon PostgreSQL.
 */
export async function getDbRooms(): Promise<any[] | null> {
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
      const data = typeof r.room_data === 'object' && r.room_data !== null ? r.room_data : {};
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
        isCustom: r.is_custom,
      };
    });
  } catch (err: any) {
    console.error('[Neon DB getDbRooms Error]:', err.message);
    return null;
  }
}

/**
 * Records a completed match in Neon PostgreSQL for match history & audits.
 */
export async function recordDbMatch(match: {
  id: string;
  roomCode: string;
  roomName?: string;
  winnerId?: string;
  winnerName?: string;
  prizePool?: number;
  platformFee?: number;
  betAmount?: number;
  durationSeconds?: number;
  playersSummary?: any[];
  finalStats?: any;
}): Promise<boolean> {
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
        JSON.stringify(match.finalStats || {}),
      ]
    );
    return true;
  } catch (err: any) {
    console.error('[Neon DB recordDbMatch Error]:', err.message);
    return false;
  }
}

/**
 * Records a financial transaction log in Neon PostgreSQL.
 */
export async function recordDbTransaction(tx: {
  id: string;
  userId: string;
  type: string;
  amount: number;
  balanceAfter?: number;
  description?: string;
}): Promise<boolean> {
  const p = getDbPool();
  if (!p) return false;

  try {
    await p.query(
      `
      INSERT INTO transactions (id, user_id, type, amount, balance_after, description, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (id) DO NOTHING;
      `,
      [
        tx.id,
        tx.userId,
        tx.type,
        tx.amount,
        tx.balanceAfter || null,
        tx.description || null,
      ]
    );
    return true;
  } catch (err: any) {
    console.error('[Neon DB recordDbTransaction Error]:', err.message);
    return false;
  }
}
