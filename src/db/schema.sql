-- PropRush Neon PostgreSQL Schema
-- Run this schema directly in your Neon Console (SQL Editor) or allow PropRush to auto-apply it.

-- 1. Users & Global Standings Table
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

-- 2. Live & Active Game Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
  code VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  host_id VARCHAR(128),
  status VARCHAR(32) DEFAULT 'waiting', -- 'waiting' | 'playing' | 'finished'
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

-- 3. Match History & Completed Results Table
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

-- 4. Financial Transactions & Wager Auditing
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  type VARCHAR(64) NOT NULL, -- 'deposit' | 'withdrawal' | 'room_buyin' | 'room_payout' | 'room_refund'
  amount NUMERIC(12, 2) NOT NULL,
  balance_after NUMERIC(12, 2),
  description VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, created_at DESC);
