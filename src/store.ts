import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
export interface Answers {
  goal?: string;
  restrictions?: string;
  allergies?: string;
  calories?: string | null;
  mealsPerDay?: string;
  protein?: string | null;
  cuisine?: string;
  [key: string]: string | null | undefined;
}

export interface User {
  chatId: number;
  answers: Answers;
  locale: 'en' | 'id';
  subscribed: boolean;
  lastPushed: string | null;
  lastCuisines: string[];
  streak: number;
  lastAnswers: Answers | null;
  lastFeedback: 'good' | 'bad' | null;
  pushHour: number | null;
  pushMin: number | null;
  tier: 'free' | 'premium';
  referredBy: number | null;
  dailyPlanCount: number;
  dailyResetDate: string | null;
  createdAt: Date;
}

export interface Plan {
  id: number;
  chatId: number;
  name: string;
  answers: Answers;
  created: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Connection pool
// ────────────────────────────────────────────────────────────────────────────
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT || 5432),
  user: process.env.PG_USER || 'mealplan',
  password: process.env.PG_PASSWORD || '',
  database: process.env.PG_DATABASE || 'mealplan',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('PG pool fatal error:', err);
  process.exit(-1);
});

// ────────────────────────────────────────────────────────────────────────────
// Schema migration (idempotent)
// ────────────────────────────────────────────────────────────────────────────
export async function migrateSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscribers (
      chat_id       BIGINT PRIMARY KEY,
      answers       TEXT NOT NULL DEFAULT '{}',
      locale        TEXT NOT NULL DEFAULT 'en',
      subscribed    INTEGER NOT NULL DEFAULT 0,
      last_pushed   TEXT,
      last_cuisines TEXT DEFAULT '[]',
      streak        INTEGER NOT NULL DEFAULT 0,
      last_answers  TEXT,
      last_feedback TEXT,
      push_hour     INTEGER,
      push_min      INTEGER,
      tier          TEXT NOT NULL DEFAULT 'free',
      referred_by   BIGINT,
      daily_plan_count INTEGER NOT NULL DEFAULT 0,
      daily_reset_date TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plans (
      id        SERIAL PRIMARY KEY,
      chat_id   BIGINT NOT NULL,
      name      TEXT NOT NULL,
      answers   TEXT NOT NULL,
      created   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (chat_id, name)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_subscribers_subscribed ON subscribers(subscribed) WHERE subscribed = 1;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_plans_chat_id ON plans(chat_id);`);

  // Sessions for persistent Telegraf sessions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_sessions (
      key       TEXT PRIMARY KEY,
      session   TEXT NOT NULL,
      updated   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Usage tracking — one row per LLM call
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usage_log (
      id        SERIAL PRIMARY KEY,
      chat_id   BIGINT NOT NULL,
      tokens    INTEGER NOT NULL DEFAULT 0,
      feature   TEXT NOT NULL DEFAULT 'mealplan',
      created   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_usage_chat_id ON usage_log(chat_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_log(created);`);

  // Referrals tracking
  await pool.query(`
    CREATE TABLE IF NOT EXISTS referrals (
      id          SERIAL PRIMARY KEY,
      referrer_id BIGINT NOT NULL,
      referred_id BIGINT NOT NULL,
      created     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (referred_id)
    );
  `);

  // Add columns that may be missing on older DBs
  const cols = new Set(
    (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'subscribers'")).rows
      .map((r: any) => r.column_name)
  );
  const migrations: [string, string][] = [
    ['tier', "TEXT NOT NULL DEFAULT 'free'"],
    ['referred_by', 'BIGINT'],
    ['daily_plan_count', 'INTEGER NOT NULL DEFAULT 0'],
    ['daily_reset_date', 'TEXT'],
    ['created_at', "TIMESTAMPTZ NOT NULL DEFAULT NOW()"],
  ];
  for (const [col, def] of migrations) {
    if (!cols.has(col)) {
      await pool.query(`ALTER TABLE subscribers ADD COLUMN ${col} ${def};`);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Row mappers
// ────────────────────────────────────────────────────────────────────────────
interface SubscriberRow {
  chat_id: string;
  answers: string;
  locale: string;
  subscribed: number;
  last_pushed: string | null;
  last_cuisines: string | null;
  streak: number;
  last_answers: string | null;
  last_feedback: string | null;
  push_hour: number | null;
  push_min: number | null;
  tier: string;
  referred_by: string | null;
  daily_plan_count: number;
  daily_reset_date: string | null;
  created_at: Date;
}

interface PlanRow {
  id: number;
  chat_id: string;
  name: string;
  answers: string;
  created: Date;
}

function rowToUser(row: SubscriberRow): User {
  return {
    chatId: Number(row.chat_id),
    answers: JSON.parse(row.answers || '{}'),
    locale: (row.locale as 'en' | 'id') || 'en',
    subscribed: !!row.subscribed,
    lastPushed: row.last_pushed,
    lastCuisines: JSON.parse(row.last_cuisines || '[]'),
    streak: row.streak ?? 0,
    lastAnswers: row.last_answers ? JSON.parse(row.last_answers) : null,
    lastFeedback: (row.last_feedback as 'good' | 'bad' | null) ?? null,
    pushHour: row.push_hour,
    pushMin: row.push_min,
    tier: (row.tier as 'free' | 'premium') || 'free',
    referredBy: row.referred_by ? Number(row.referred_by) : null,
    dailyPlanCount: row.daily_plan_count ?? 0,
    dailyResetDate: row.daily_reset_date,
    createdAt: row.created_at,
  };
}

function rowToPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    chatId: Number(row.chat_id),
    name: row.name,
    answers: JSON.parse(row.answers),
    created: row.created.toISOString(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// User CRUD
// ────────────────────────────────────────────────────────────────────────────
export async function saveUser(chatId: number, answers: Answers, locale: 'en' | 'id' = 'en'): Promise<void> {
  await pool.query(
    `INSERT INTO subscribers (chat_id, answers, locale)
     VALUES ($1, $2, $3)
     ON CONFLICT (chat_id) DO UPDATE SET answers = $2, locale = $3`,
    [chatId, JSON.stringify(answers), locale]
  );
}

export async function getUser(chatId: number): Promise<User | null> {
  const { rows } = await pool.query('SELECT * FROM subscribers WHERE chat_id = $1', [chatId]);
  return rows.length ? rowToUser(rows[0] as SubscriberRow) : null;
}

export async function ensureUser(chatId: number, locale: 'en' | 'id' = 'en'): Promise<User> {
  await pool.query(
    `INSERT INTO subscribers (chat_id, answers, locale) VALUES ($1, '{}', $2)
     ON CONFLICT (chat_id) DO NOTHING`,
    [chatId, locale]
  );
  const u = await getUser(chatId);
  return u!;
}

export async function setSubscribed(chatId: number, subscribed: boolean): Promise<void> {
  await pool.query('UPDATE subscribers SET subscribed = $1 WHERE chat_id = $2', [subscribed ? 1 : 0, chatId]);
}

export async function getSubscribedUsers(): Promise<User[]> {
  const { rows } = await pool.query('SELECT * FROM subscribers WHERE subscribed = 1');
  return rows.map((r: SubscriberRow) => rowToUser(r));
}

export async function setLastPushed(chatId: number, dateStr: string): Promise<void> {
  await pool.query('UPDATE subscribers SET last_pushed = $1 WHERE chat_id = $2', [dateStr, chatId]);
}

export async function setLocale(chatId: number, locale: 'en' | 'id'): Promise<void> {
  await pool.query('UPDATE subscribers SET locale = $1 WHERE chat_id = $2', [locale, chatId]);
}

export async function bumpStreak(chatId: number): Promise<void> {
  await pool.query('UPDATE subscribers SET streak = streak + 1 WHERE chat_id = $1', [chatId]);
}

export async function resetStreak(chatId: number): Promise<void> {
  await pool.query('UPDATE subscribers SET streak = 0 WHERE chat_id = $1', [chatId]);
}

export async function setLastAnswers(chatId: number, answers: Answers): Promise<void> {
  await pool.query('UPDATE subscribers SET last_answers = $1 WHERE chat_id = $2', [JSON.stringify(answers), chatId]);
}

export async function setLastCuisines(chatId: number, cuisines: string[]): Promise<void> {
  await pool.query('UPDATE subscribers SET last_cuisines = $1 WHERE chat_id = $2', [JSON.stringify(cuisines), chatId]);
}

export async function setLastFeedback(chatId: number, feedback: 'good' | 'bad'): Promise<void> {
  await pool.query('UPDATE subscribers SET last_feedback = $1 WHERE chat_id = $2', [feedback, chatId]);
}

export async function setPushTime(chatId: number, hour: number, min: number): Promise<void> {
  await pool.query('UPDATE subscribers SET push_hour = $1, push_min = $2 WHERE chat_id = $3', [hour, min, chatId]);
}

// ────────────────────────────────────────────────────────────────────────────
// Plan presets CRUD
// ────────────────────────────────────────────────────────────────────────────
export async function savePlan(chatId: number, name: string, answers: Answers): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO plans (chat_id, name, answers) VALUES ($1, $2, $3)
     ON CONFLICT (chat_id, name) DO UPDATE SET answers = $3, created = NOW()
     RETURNING id`,
    [chatId, name, JSON.stringify(answers)]
  );
  return rows[0].id;
}

export async function getPlans(chatId: number): Promise<Plan[]> {
  const { rows } = await pool.query('SELECT * FROM plans WHERE chat_id = $1 ORDER BY created DESC', [chatId]);
  return rows.map((r: PlanRow) => rowToPlan(r));
}

export async function getPlan(planId: number): Promise<Plan | null> {
  const { rows } = await pool.query('SELECT * FROM plans WHERE id = $1', [planId]);
  return rows.length ? rowToPlan(rows[0] as PlanRow) : null;
}

export async function deletePlan(chatId: number, planId: number): Promise<number> {
  const { rowCount } = await pool.query('DELETE FROM plans WHERE id = $1 AND chat_id = $2', [planId, chatId]);
  return rowCount ?? 0;
}

// ────────────────────────────────────────────────────────────────────────────
// Graceful shutdown
// ────────────────────────────────────────────────────────────────────────────
export async function closePool(): Promise<void> {
  await pool.end();
}

// Export pool for dashboard use
export { pool };

// ════════════════════════════════════════════════════════════════════════════
// Persistent session store (PG-backed Telegraf sessions)
// ════════════════════════════════════════════════════════════════════════════
export const pgSessionStore = {
  async get(key: string): Promise<any> {
    const { rows } = await pool.query('SELECT session FROM bot_sessions WHERE key = $1', [key]);
    return rows.length ? JSON.parse(rows[0].session) : undefined;
  },
  async set(key: string, session: any): Promise<void> {
    await pool.query(
      `INSERT INTO bot_sessions (key, session, updated) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET session = $2, updated = NOW()`,
      [key, JSON.stringify(session)]
    );
  },
  async reset(key: string): Promise<void> {
    await pool.query('DELETE FROM bot_sessions WHERE key = $1', [key]);
  },
};

// ════════════════════════════════════════════════════════════════════════════
// Rate limiting — daily plan generation cap per user
// ════════════════════════════════════════════════════════════════════════════
export const TIER_LIMITS: Record<string, number> = {
  free: 3,      // 3 plans/day for free users
  premium: 50,  // 50 plans/day for premium
};

export async function checkRateLimit(chatId: number, tier: string = 'free'): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const { rows } = await pool.query(
    'SELECT daily_plan_count, daily_reset_date FROM subscribers WHERE chat_id = $1',
    [chatId]
  );
  if (!rows.length) return { allowed: true, remaining: TIER_LIMITS[tier] ?? TIER_LIMITS.free, limit: TIER_LIMITS[tier] ?? TIER_LIMITS.free };

  let count = Number(rows[0].daily_plan_count);
  const resetDate = rows[0].daily_reset_date;

  if (resetDate !== today) {
    // Reset daily counter
    await pool.query('UPDATE subscribers SET daily_plan_count = 0, daily_reset_date = $1 WHERE chat_id = $2', [today, chatId]);
    count = 0;
  }

  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  const remaining = Math.max(0, limit - count);
  return { allowed: count < limit, remaining, limit };
}

export async function incrementPlanCount(chatId: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await pool.query(
    `UPDATE subscribers SET daily_plan_count = daily_plan_count + 1, daily_reset_date = $1 WHERE chat_id = $2`,
    [today, chatId]
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Usage tracking
// ════════════════════════════════════════════════════════════════════════════
export async function logUsage(chatId: number, tokens: number, feature: string = 'mealplan'): Promise<void> {
  await pool.query(
    'INSERT INTO usage_log (chat_id, tokens, feature) VALUES ($1, $2, $3)',
    [chatId, tokens, feature]
  );
}

export async function getUsageStats(chatId: number, days = 30): Promise<{ totalTokens: number; totalCalls: number }> {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(tokens), 0)::int AS total_tokens, COUNT(*)::int AS total_calls
     FROM usage_log WHERE chat_id = $1 AND created >= NOW() - ($2 || ' days')::interval`,
    [chatId, String(days)]
  );
  return { totalTokens: rows[0].total_tokens, totalCalls: rows[0].total_calls };
}

// ════════════════════════════════════════════════════════════════════════════
// Tier management
// ════════════════════════════════════════════════════════════════════════════
export async function setTier(chatId: number, tier: 'free' | 'premium'): Promise<void> {
  await pool.query('UPDATE subscribers SET tier = $1 WHERE chat_id = $2', [tier, chatId]);
}

// ════════════════════════════════════════════════════════════════════════════
// Referrals
// ════════════════════════════════════════════════════════════════════════════
export async function createReferral(referrerId: number, referredId: number): Promise<void> {
  await pool.query(
    `INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2)
     ON CONFLICT (referred_id) DO NOTHING`,
    [referrerId, referredId]
  );
  await pool.query('UPDATE subscribers SET referred_by = $1 WHERE chat_id = $2', [referrerId, referredId]);
}

export async function getReferralCount(referrerId: number): Promise<number> {
  const { rows } = await pool.query('SELECT COUNT(*)::int FROM referrals WHERE referrer_id = $1', [referrerId]);
  return rows[0].count;
}

export async function getReferrals(referrerId: number): Promise<{ referredId: number; created: string }[]> {
  const { rows } = await pool.query('SELECT referred_id, created FROM referrals WHERE referrer_id = $1 ORDER BY created DESC', [referrerId]);
  return rows.map((r: any) => ({ referredId: Number(r.referred_id), created: r.created.toISOString() }));
}
