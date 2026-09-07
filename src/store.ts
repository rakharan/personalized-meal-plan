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

    // ── User profiles (web accounts) ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id                  SERIAL PRIMARY KEY,
        email               TEXT UNIQUE NOT NULL,
        password_hash       TEXT NOT NULL,
        full_name           TEXT NOT NULL,
        age                 INTEGER,
        gender              TEXT,
        height_cm           INTEGER,
        weight_kg           REAL,
        activity_level      TEXT DEFAULT 'moderate',
        cooking_skill       TEXT DEFAULT 'beginner',
        household_size      INTEGER DEFAULT 1,
        has_children        INTEGER DEFAULT 0,
        budget_tier         TEXT DEFAULT 'moderate',
        health_conditions   TEXT,
        allergies           TEXT,
        dietary_restrictions TEXT,
        goal                TEXT,
        target_calories     INTEGER,
        target_protein      INTEGER,
        cuisine_rotation    TEXT DEFAULT 'rotate',
        meals_per_day       INTEGER DEFAULT 3,
        disliked_ingredients TEXT,
        delivery_channel    TEXT DEFAULT 'telegram',
        telegram_chat_id    BIGINT,
        whatsapp_phone      TEXT,
        whatsapp_verified   INTEGER DEFAULT 0,
        locale              TEXT DEFAULT 'id',
        push_hour           INTEGER,
        push_min            INTEGER,
        subscribed          INTEGER DEFAULT 0,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_profiles_tg ON user_profiles(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;');

    // ── Meal plan history (generated plans stored for web users) ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meal_plan_history (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
        plan_text      TEXT NOT NULL,
        cuisine        TEXT,
        calories_total INTEGER,
        protein_total  INTEGER,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_meal_plan_history_user ON meal_plan_history(user_id);');

    // ── Telegram link tokens (temporary, for connecting bot to web account) ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS telegram_link_tokens (
        token       TEXT PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        used_at     TIMESTAMPTZ
      );
    `);

    // ── WhatsApp OTP codes ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_otps (
        id          SERIAL PRIMARY KEY,
        phone       TEXT NOT NULL,
        code        TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        verified    INTEGER DEFAULT 0,
        attempts    INTEGER DEFAULT 0
      );
    `);
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_otps_phone ON whatsapp_otps(phone);');

  // Add new columns to user_profiles if missing (for existing tables)
  const profileCols = new Set(
    (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'user_profiles'")).rows
      .map((r: any) => r.column_name)
  );
  const profileMigrations: [string, string][] = [
    ['push_hour', 'INTEGER'],
    ['push_min', 'INTEGER'],
    ['subscribed', 'INTEGER DEFAULT 0'],
  ];
  for (const [col, def] of profileMigrations) {
    if (!profileCols.has(col)) {
      await pool.query(`ALTER TABLE user_profiles ADD COLUMN ${col} ${def};`);
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

// ════════════════════════════════════════════════════════════════════════════
// User profiles (web accounts)
// ════════════════════════════════════════════════════════════════════════════
export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  age: number | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: string;
  cooking_skill: string;
  household_size: number;
  has_children: boolean;
  budget_tier: string;
  health_conditions: string | null;
  allergies: string | null;
  dietary_restrictions: string | null;
  goal: string | null;
  target_calories: number | null;
  target_protein: number | null;
  cuisine_rotation: string;
  meals_per_day: number;
  disliked_ingredients: string | null;
  delivery_channel: string;
  telegram_chat_id: number | null;
  whatsapp_phone: string | null;
  whatsapp_verified: boolean;
  locale: string;
  push_hour: number | null;
  push_min: number | null;
  subscribed: boolean;
  created_at: Date;
  updated_at: Date;
}

interface UserProfileRow {
  id: number;
  email: string;
  full_name: string;
  age: number | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: string;
  cooking_skill: string;
  household_size: number;
  has_children: number;
  budget_tier: string;
  health_conditions: string | null;
  allergies: string | null;
  dietary_restrictions: string | null;
  goal: string | null;
  target_calories: number | null;
  target_protein: number | null;
  cuisine_rotation: string;
  meals_per_day: number;
  disliked_ingredients: string | null;
  delivery_channel: string;
  telegram_chat_id: string | null;
  whatsapp_phone: string | null;
  whatsapp_verified: number;
  locale: string;
  push_hour: number | null;
  push_min: number | null;
  subscribed: number;
  created_at: Date;
  updated_at: Date;
}

function rowToProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    age: row.age,
    gender: row.gender,
    height_cm: row.height_cm,
    weight_kg: row.weight_kg,
    activity_level: row.activity_level,
    cooking_skill: row.cooking_skill,
    household_size: row.household_size,
    has_children: !!row.has_children,
    budget_tier: row.budget_tier,
    health_conditions: row.health_conditions,
    allergies: row.allergies,
    dietary_restrictions: row.dietary_restrictions,
    goal: row.goal,
    target_calories: row.target_calories,
    target_protein: row.target_protein,
    cuisine_rotation: row.cuisine_rotation,
    meals_per_day: row.meals_per_day,
    disliked_ingredients: row.disliked_ingredients,
    delivery_channel: row.delivery_channel,
    telegram_chat_id: row.telegram_chat_id ? Number(row.telegram_chat_id) : null,
    whatsapp_phone: row.whatsapp_phone,
    whatsapp_verified: !!row.whatsapp_verified,
    locale: row.locale,
    push_hour: row.push_hour,
    push_min: row.push_min,
    subscribed: !!row.subscribed,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function createUserProfile(data: {
  email: string;
  password_hash: string;
  full_name: string;
  locale?: string;
}): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO user_profiles (email, password_hash, full_name, locale)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [data.email, data.password_hash, data.full_name, data.locale || 'id']
  );
  return rows[0].id;
}

export async function getUserByEmail(email: string): Promise<UserProfile | null> {
  const { rows } = await pool.query('SELECT * FROM user_profiles WHERE email = $1', [email]);
  return rows.length ? rowToProfile(rows[0] as UserProfileRow) : null;
}

export async function getUserById(id: number): Promise<UserProfile | null> {
  const { rows } = await pool.query('SELECT * FROM user_profiles WHERE id = $1', [id]);
  return rows.length ? rowToProfile(rows[0] as UserProfileRow) : null;
}

export async function getUserByTelegramChatId(chatId: number): Promise<UserProfile | null> {
  const { rows } = await pool.query('SELECT * FROM user_profiles WHERE telegram_chat_id = $1', [chatId]);
  return rows.length ? rowToProfile(rows[0] as UserProfileRow) : null;
}

export async function getSubscribedWebUsers(): Promise<UserProfile[]> {
  const { rows } = await pool.query('SELECT * FROM user_profiles WHERE subscribed = 1');
  return rows.map((r: UserProfileRow) => rowToProfile(r));
}

export async function updateUserProfile(id: number, fields: Record<string, any>): Promise<void> {
  const allowed = [
    'full_name', 'age', 'gender', 'height_cm', 'weight_kg', 'activity_level',
    'cooking_skill', 'household_size', 'has_children', 'budget_tier',
    'health_conditions', 'allergies', 'dietary_restrictions', 'goal',
    'target_calories', 'target_protein', 'cuisine_rotation', 'meals_per_day',
    'disliked_ingredients', 'delivery_channel', 'whatsapp_phone',
    'whatsapp_verified', 'locale',
    'push_hour', 'push_min', 'subscribed',
  ];
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;
  for (const [key, val] of Object.entries(fields)) {
    if (!allowed.includes(key)) continue;
    if (key === 'has_children') {
      updates.push(`has_children = $${idx}`);
      values.push(val ? 1 : 0);
    } else if (key === 'whatsapp_verified' || key === 'subscribed') {
      updates.push(`${key} = $${idx}`);
      values.push(val ? 1 : 0);
    } else {
      updates.push(`${key} = $${idx}`);
      values.push(val);
    }
    idx++;
  }
  if (updates.length === 0) return;
  updates.push(`updated_at = NOW()`);
  values.push(id);
  await pool.query(`UPDATE user_profiles SET ${updates.join(', ')} WHERE id = $${idx}`, values);
}

export async function linkTelegramAccount(userId: number, chatId: number): Promise<void> {
  await pool.query('UPDATE user_profiles SET telegram_chat_id = $1, updated_at = NOW() WHERE id = $2', [chatId, userId]);
}

// ── Telegram link tokens ──
export async function createTelegramLinkToken(userId: number): Promise<string> {
  const token = crypto.randomUUID();
  await pool.query('INSERT INTO telegram_link_tokens (token, user_id) VALUES ($1, $2)', [token, userId]);
  return token;
}

export async function consumeTelegramLinkToken(token: string): Promise<number | null> {
  const { rows } = await pool.query(
    'SELECT user_id FROM telegram_link_tokens WHERE token = $1 AND used_at IS NULL AND created_at > NOW() - INTERVAL \'1 hour\'',
    [token]
  );
  if (!rows.length) return null;
  const userId = rows[0].user_id;
  await pool.query('UPDATE telegram_link_tokens SET used_at = NOW() WHERE token = $1', [token]);
  return userId;
}

// ── Meal plan history ──
export async function savePlanHistory(userId: number, planText: string, cuisine: string | null, calories: number | null, protein: number | null): Promise<number> {
  const { rows } = await pool.query(
    'INSERT INTO meal_plan_history (user_id, plan_text, cuisine, calories_total, protein_total) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [userId, planText, cuisine, calories, protein]
  );
  return rows[0].id;
}

export async function getPlanHistory(userId: number, limit = 30): Promise<any[]> {
  const { rows } = await pool.query(
    'SELECT id, plan_text, cuisine, calories_total, protein_total, created_at FROM meal_plan_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]
  );
  return rows.map((r: any) => ({
    id: r.id,
    planText: r.plan_text,
    cuisine: r.cuisine,
    calories: r.calories_total,
    protein: r.protein_total,
    created: r.created_at.toISOString(),
  }));
}

// ── WhatsApp OTP ──
export async function saveWhatsAppOTP(phone: string, code: string): Promise<void> {
  await pool.query(
    `INSERT INTO whatsapp_otps (phone, code) VALUES ($1, $2)
     ON CONFLICT (phone) DO UPDATE SET code = $2, created_at = NOW(), verified = 0, attempts = 0`,
    [phone, code]
  );
}

export async function verifyWhatsAppOTP(phone: string, code: string): Promise<boolean> {
  // Check attempts first — block after 5
  const { rows: attemptRows } = await pool.query(
    "SELECT attempts FROM whatsapp_otps WHERE phone = $1 AND verified = 0 AND created_at > NOW() - INTERVAL '10 minutes'",
    [phone]
  );
  if (attemptRows.length && attemptRows[0].attempts >= 5) return false;

  // Increment attempt counter
  await pool.query('UPDATE whatsapp_otps SET attempts = attempts + 1 WHERE phone = $1', [phone]);

  const { rows } = await pool.query(
    "SELECT * FROM whatsapp_otps WHERE phone = $1 AND code = $2 AND verified = 0 AND created_at > NOW() - INTERVAL '10 minutes'",
    [phone, code]
  );
  if (!rows.length) return false;
  await pool.query('UPDATE whatsapp_otps SET verified = 1 WHERE phone = $1 AND code = $2', [phone, code]);
  return true;
}

// ════════════════════════════════════════════════════════════════════════════
// Actionable admin metrics
// ════════════════════════════════════════════════════════════════════════════

// Daily Active Users — distinct users who generated plans or used LLM per day
export async function getDAU(days = 30): Promise<{ date: string; dau: number; new_users: number }[]> {
  const { rows } = await pool.query(`
    WITH date_series AS (
      SELECT generate_series(
        CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day',
        CURRENT_DATE,
        INTERVAL '1 day'
      )::date AS d
    ),
    active_users AS (
      SELECT DISTINCT chat_id, DATE(created) AS d
      FROM usage_log
      WHERE created >= CURRENT_DATE - $1 * INTERVAL '1 day'
      GROUP BY chat_id, DATE(created)
    ),
    new_users AS (
      SELECT DATE(created_at) AS d, COUNT(*)::int AS cnt
      FROM subscribers
      WHERE created_at >= CURRENT_DATE - $1 * INTERVAL '1 day'
      GROUP BY DATE(created_at)
    )
    SELECT
      ds.d::text AS date,
      COALESCE(COUNT(DISTINCT au.chat_id), 0)::int AS dau,
      COALESCE(MAX(nu.cnt), 0)::int AS new_users
    FROM date_series ds
    LEFT JOIN active_users au ON au.d = ds.d
    LEFT JOIN new_users nu ON nu.d = ds.d
    GROUP BY ds.d
    ORDER BY ds.d ASC
  `, [days]);
  return rows;
}

// MAU — monthly active users
export async function getMAU(): Promise<number> {
  const { rows } = await pool.query(
    "SELECT COUNT(DISTINCT chat_id)::int FROM usage_log WHERE created >= NOW() - INTERVAL '30 days'"
  );
  return rows[0].count;
}

// Conversion rate — premium / total
export async function getConversion(): Promise<{ total: number; premium: number; free: number; rate: number }> {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE tier = 'premium')::int AS premium, COUNT(*) FILTER (WHERE tier = 'free')::int AS free FROM subscribers"
  );
  const total = rows[0].total || 0;
  const premium = rows[0].premium || 0;
  return { total, premium, free: rows[0].free || 0, rate: total > 0 ? Math.round((premium / total) * 100) : 0 };
}

// Token cost per user — total tokens / active users
export async function getTokenEconomics(days = 30): Promise<{ totalTokens: number; totalCost: number; perUser: number; activeUsers: number }> {
  const { rows } = await pool.query(`
    SELECT
      COALESCE(SUM(tokens), 0)::int AS total_tokens,
      COUNT(DISTINCT chat_id)::int AS active_users
    FROM usage_log
    WHERE created >= NOW() - $1 * INTERVAL '1 day'
  `, [days]);
  const totalTokens = rows[0].total_tokens || 0;
  const activeUsers = rows[0].active_users || 0;
  // Rough cost: $0.50 per 1M tokens (adjust based on actual provider pricing)
  const totalCost = (totalTokens / 1_000_000) * 0.50;
  return {
    totalTokens,
    totalCost: Math.round(totalCost * 100) / 100,
    perUser: activeUsers > 0 ? Math.round(totalTokens / activeUsers) : 0,
    activeUsers,
  };
}

// Plan generation trend — daily counts last N days
export async function getPlanTrend(days = 14): Promise<{ date: string; count: number; cuisine: string }[]> {
  const { rows } = await pool.query(`
    WITH date_series AS (
      SELECT generate_series(
        CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day',
        CURRENT_DATE,
        INTERVAL '1 day'
      )::date AS d
    ),
    daily_plans AS (
      SELECT DATE(created) AS d, COUNT(*)::int AS cnt
      FROM usage_log
      WHERE feature = 'mealplan' AND created >= CURRENT_DATE - $1 * INTERVAL '1 day'
      GROUP BY DATE(created)
    )
    SELECT
      ds.d::text AS date,
      COALESCE(dp.cnt, 0)::int AS count,
      '' AS cuisine
    FROM date_series ds
    LEFT JOIN daily_plans dp ON dp.d = ds.d
    ORDER BY ds.d ASC
  `, [days]);
  return rows;
}

// Retention curve — cohort analysis (users who signed up on day N, % active on day N+1, N+7, N+30)
export async function getRetention(): Promise<{ cohort: string; size: number; d1: number; d7: number; d30: number }[]> {
  const { rows } = await pool.query(`
    WITH cohorts AS (
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') AS cohort,
        chat_id,
        DATE(created_at) AS signup_date
      FROM subscribers
      WHERE created_at >= NOW() - INTERVAL '90 days'
    ),
    active_days AS (
      SELECT DISTINCT chat_id, DATE(created) AS active_date
      FROM usage_log
      WHERE created >= NOW() - INTERVAL '90 days'
    )
    SELECT
      c.cohort,
      COUNT(DISTINCT c.chat_id)::int AS size,
      COALESCE(COUNT(DISTINCT c.chat_id) FILTER (
        WHERE EXISTS (SELECT 1 FROM active_days ad WHERE ad.chat_id = c.chat_id AND ad.active_date = c.signup_date + 1)
      ), 0)::int AS d1,
      COALESCE(COUNT(DISTINCT c.chat_id) FILTER (
        WHERE EXISTS (SELECT 1 FROM active_days ad WHERE ad.chat_id = c.chat_id AND ad.active_date <= c.signup_date + 7 AND ad.active_date > c.signup_date)
      ), 0)::int AS d7,
      COALESCE(COUNT(DISTINCT c.chat_id) FILTER (
        WHERE EXISTS (SELECT 1 FROM active_days ad WHERE ad.chat_id = c.chat_id AND ad.active_date <= c.signup_date + 30 AND ad.active_date > c.signup_date)
      ), 0)::int AS d30
    FROM cohorts c
    GROUP BY c.cohort
    ORDER BY c.cohort DESC
    LIMIT 6
  `);
  return rows.map((r: any) => ({
    cohort: r.cohort,
    size: r.size,
    d1: r.size > 0 ? Math.round((r.d1 / r.size) * 100) : 0,
    d7: r.size > 0 ? Math.round((r.d7 / r.size) * 100) : 0,
    d30: r.size > 0 ? Math.round((r.d30 / r.size) * 100) : 0,
  }));
}

// Feature usage breakdown — which features users actually use
export async function getFeatureUsage(days = 30): Promise<{ feature: string; calls: number; tokens: number }[]> {
  const { rows } = await pool.query(`
    SELECT feature, COUNT(*)::int AS calls, COALESCE(SUM(tokens), 0)::int AS tokens
    FROM usage_log
    WHERE created >= NOW() - $1 * INTERVAL '1 day'
    GROUP BY feature
    ORDER BY calls DESC
  `, [days]);
  return rows;
}

// Plan generation by hour — when users are active
export async function getActivityByHour(): Promise<{ hour: number; count: number }[]> {
  const { rows } = await pool.query(`
    SELECT EXTRACT(HOUR FROM created)::int AS hour, COUNT(*)::int AS count
    FROM usage_log
    WHERE created >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY EXTRACT(HOUR FROM created)
    ORDER BY hour ASC
  `);
  // Fill missing hours
  const result: { hour: number; count: number }[] = [];
  const map = new Map(rows.map((r: any) => [r.hour, r.count]));
  for (let h = 0; h < 24; h++) {
    result.push({ hour: h, count: map.get(h) || 0 });
  }
  return result;
}

// Cuisine popularity — from meal_plan_history
export async function getCuisinePopularity(): Promise<{ cuisine: string; count: number }[]> {
  const { rows } = await pool.query(`
    SELECT COALESCE(NULLIF(cuisine, ''), 'Unknown') AS cuisine, COUNT(*)::int AS count
    FROM meal_plan_history
    WHERE cuisine IS NOT NULL
    GROUP BY cuisine
    ORDER BY count DESC
    LIMIT 10
  `);
  return rows;
}

// Churn — users who stopped generating plans (last active > 7 days ago, was active before)
export async function getChurnRate(): Promise<{ totalActive: number; churned: number; rate: number }> {
  const { rows } = await pool.query(`
    WITH last_active AS (
      SELECT chat_id, MAX(created) AS last_seen
      FROM usage_log
      GROUP BY chat_id
    )
    SELECT
      COUNT(*)::int AS total_active,
      COUNT(*) FILTER (WHERE last_seen < NOW() - INTERVAL '7 days')::int AS churned
    FROM last_active
    WHERE last_seen >= NOW() - INTERVAL '30 days'
  `);
  const totalActive = rows[0].total_active || 0;
  const churned = rows[0].churned || 0;
  return { totalActive, churned, rate: totalActive > 0 ? Math.round((churned / totalActive) * 100) : 0 };
}
