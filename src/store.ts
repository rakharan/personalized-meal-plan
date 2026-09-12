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
        meals_json     JSONB,
        cuisine        TEXT,
        calories_total INTEGER,
        protein_total  INTEGER,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_meal_plan_history_user ON meal_plan_history(user_id);');

    // Add meals_json column if missing (existing DBs)
    const historyCols = new Set(
      (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'meal_plan_history'")).rows
        .map((r: any) => r.column_name)
    );
    if (!historyCols.has('meals_json')) {
      await pool.query('ALTER TABLE meal_plan_history ADD COLUMN meals_json JSONB');
    }
    if (!historyCols.has('cooked_at')) {
      await pool.query('ALTER TABLE meal_plan_history ADD COLUMN cooked_at TIMESTAMPTZ');
    }
    await pool.query('CREATE INDEX IF NOT EXISTS idx_meal_plan_history_cooked ON meal_plan_history(user_id, cooked_at);');

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
    ['tier', "TEXT NOT NULL DEFAULT 'free'"],
    ['kid_friendly', 'INTEGER DEFAULT 0'],
    ['quick_meals', 'INTEGER DEFAULT 0'],
    ['budget_weekly', 'INTEGER'],
  ];
  for (const [col, def] of profileMigrations) {
    if (!profileCols.has(col)) {
      await pool.query(`ALTER TABLE user_profiles ADD COLUMN ${col} ${def};`);
    }
  }

  // ── Plan feedback (per-plan ratings from users) ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plan_feedback (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      plan_id     INTEGER REFERENCES meal_plan_history(id) ON DELETE CASCADE,
      chat_id     BIGINT,
      rating      INTEGER NOT NULL,
      feedback    TEXT,
      cuisine     TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_plan_feedback_user ON plan_feedback(user_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_plan_feedback_created ON plan_feedback(created_at);');

  // ── Bot plan history — generated plans per TG chat ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_plan_history (
      id          SERIAL PRIMARY KEY,
      chat_id     BIGINT NOT NULL,
      plan_text   TEXT NOT NULL,
      cuisine     TEXT,
      meals_json  JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_bot_plan_history_chat ON bot_plan_history(chat_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_bot_plan_history_date ON bot_plan_history(created_at);');

  // ── Push delivery log ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_log (
      id          SERIAL PRIMARY KEY,
      chat_id     BIGINT NOT NULL,
      user_id     INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
      status      TEXT NOT NULL DEFAULT 'pending',
      error       TEXT,
      cuisine     TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_push_log_created ON push_log(created_at);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_push_log_status ON push_log(status);');

  // ── Recipe library — global reusable meals, assembled without LLM ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recipes (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      cuisine       TEXT,
      meal_type     TEXT NOT NULL,        -- sarapan | snack | makan siang | makan malam
      items         JSONB NOT NULL,       -- ["nasi 200g", "ayam 150g"]
      kcal          INTEGER NOT NULL DEFAULT 0,
      protein       INTEGER NOT NULL DEFAULT 0,
      carbs         INTEGER NOT NULL DEFAULT 0,
      fat           INTEGER NOT NULL DEFAULT 0,
      kid_friendly  INTEGER NOT NULL DEFAULT 0,
      quick         INTEGER NOT NULL DEFAULT 0,   -- <30 min
      budget_tier   TEXT,                  -- cheap | moderate | premium
      tags          TEXT[] NOT NULL DEFAULT '{}',  -- halal, no-peanut, goreng, bakar, etc.
      steps         TEXT,                  -- cached cooking steps
      source        TEXT NOT NULL DEFAULT 'llm-new',  -- llm-backfill | llm-new | user | curated
      times_used    INTEGER NOT NULL DEFAULT 0,
      last_used_at  TIMESTAMPTZ,
      rating_sum    INTEGER NOT NULL DEFAULT 0,
      rating_count  INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (name, cuisine, meal_type)
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_recipes_cuisine ON recipes(cuisine, meal_type);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_recipes_usage ON recipes(times_used, last_used_at);');

  // recipes.image_signature column
  const recipeCols = new Set(
    (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'recipes'")).rows
      .map((r: any) => r.column_name)
  );
  if (!recipeCols.has('image_signature')) {
    await pool.query('ALTER TABLE recipes ADD COLUMN image_signature TEXT');
  }

  // ── Recipe images — signature → generated photo (shared cache) ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recipe_images (
      signature   TEXT PRIMARY KEY,
      prompt      TEXT NOT NULL,
      image_path  TEXT NOT NULL,        -- local path served by Express: /images/recipes/<sig>.jpg
      style       TEXT NOT NULL DEFAULT 'seedream-v5-lite',
      cost_usd    REAL NOT NULL DEFAULT 0.035,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  const imgCols = new Set(
    (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'recipe_images'")).rows
      .map((r: any) => r.column_name)
  );
  if (!imgCols.has('cost_usd')) {
    await pool.query('ALTER TABLE recipe_images ADD COLUMN cost_usd REAL NOT NULL DEFAULT 0.035');
  }

  // ── Cached LLM outputs per plan (grocery list, cooking steps) ──
  const mphCols = new Set(
    (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'meal_plan_history'")).rows
      .map((r: any) => r.column_name)
  );
  if (!mphCols.has('grocery_list')) {
    await pool.query('ALTER TABLE meal_plan_history ADD COLUMN grocery_list TEXT');
  }
  if (!mphCols.has('cooking_steps')) {
    await pool.query('ALTER TABLE meal_plan_history ADD COLUMN cooking_steps TEXT');
  }
  if (!mphCols.has('meal_steps')) {
    await pool.query("ALTER TABLE meal_plan_history ADD COLUMN meal_steps JSONB NOT NULL DEFAULT '{}'::jsonb");
  }
}

export async function getMealStep(planId: number, mealName: string): Promise<string | null> {
  const { rows } = await pool.query('SELECT meal_steps ->> $2 AS steps FROM meal_plan_history WHERE id = $1', [planId, mealName]);
  return rows[0]?.steps ?? null;
}

export async function setMealStep(planId: number, mealName: string, steps: string): Promise<void> {
  await pool.query(
    `UPDATE meal_plan_history SET meal_steps = meal_steps || jsonb_build_object($2::text, $3::text) WHERE id = $1`,
    [planId, mealName, steps]
  );
}

export async function getPlanCache(planId: number): Promise<{ grocery_list: string | null; cooking_steps: string | null } | null> {
  const { rows } = await pool.query('SELECT grocery_list, cooking_steps FROM meal_plan_history WHERE id = $1', [planId]);
  return rows[0] ?? null;
}

export async function setPlanCache(planId: number, field: 'grocery_list' | 'cooking_steps', value: string): Promise<void> {
  await pool.query(`UPDATE meal_plan_history SET ${field} = $2 WHERE id = $1`, [planId, value]);
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
// Bot plan history — stores generated plan text per chat_id
// ────────────────────────────────────────────────────────────────────────────
export async function saveBotPlan(chatId: number, planText: string, cuisine: string | null, mealsJson: string): Promise<number> {
  const { rows } = await pool.query(
    'INSERT INTO bot_plan_history (chat_id, plan_text, cuisine, meals_json) VALUES ($1, $2, $3, $4) RETURNING id',
    [chatId, planText, cuisine, mealsJson]
  );
  // Mirror to meal_plan_history when chat is TG-linked to a web user
  const { rows: linked } = await pool.query(
    'SELECT id FROM user_profiles WHERE telegram_chat_id = $1',
    [chatId]
  );
  if (linked.length) {
    const userId = linked[0].id;
    const { rows: prof } = await pool.query(
      'SELECT target_calories, target_protein FROM user_profiles WHERE id = $1',
      [userId]
    );
    const meals = mealsJson ? JSON.parse(mealsJson) : [];
    const totKcal = meals.reduce((s: number, m: any) => s + (m.kcal || 0), 0);
    const totProtein = meals.reduce((s: number, m: any) => s + (m.protein || 0), 0);
    await pool.query(
      'INSERT INTO meal_plan_history (user_id, plan_text, meals_json, cuisine, calories_total, protein_total) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, planText, mealsJson, cuisine, totKcal || prof[0]?.target_calories || null, totProtein || prof[0]?.target_protein || null]
    );
  }
  return rows[0].id;
}

export async function getBotPlanHistory(chatId: number, limit = 10): Promise<any[]> {
  const { rows } = await pool.query(
    'SELECT id, plan_text, cuisine, meals_json, created_at FROM bot_plan_history WHERE chat_id = $1 ORDER BY created_at DESC LIMIT $2',
    [chatId, limit]
  );
  return rows.map((r: any) => ({
    id: r.id,
    planText: r.plan_text,
    cuisine: r.cuisine,
    meals: Array.isArray(r.meals_json) ? r.meals_json : (r.meals_json ? JSON.parse(r.meals_json) : null),
    created: r.created_at.toISOString(),
  }));
}

export async function getBotPlanByDate(chatId: number, dateStr: string): Promise<any | null> {
  const { rows } = await pool.query(
    "SELECT id, plan_text, cuisine, meals_json, created_at FROM bot_plan_history WHERE chat_id = $1 AND DATE(created_at) = $2 ORDER BY created_at DESC LIMIT 1",
    [chatId, dateStr]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id,
    planText: r.plan_text,
    cuisine: r.cuisine,
    meals: Array.isArray(r.meals_json) ? r.meals_json : (r.meals_json ? JSON.parse(r.meals_json) : null),
    created: r.created_at.toISOString(),
  };
}

export async function updateBotPlanMeals(planId: number, planText: string, mealsJson: string): Promise<void> {
  await pool.query(
    'UPDATE bot_plan_history SET plan_text = $1, meals_json = $2 WHERE id = $3',
    [planText, mealsJson, planId]
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Push log — track delivery status
// ────────────────────────────────────────────────────────────────────────────
export async function logPush(chatId: number, status: string, cuisine: string | null, error: string | null = null): Promise<void> {
  await pool.query(
    'INSERT INTO push_log (chat_id, status, cuisine, error) VALUES ($1, $2, $3, $4)',
    [chatId, status, cuisine, error]
  );
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
  tier: string;
  kid_friendly: boolean;
  quick_meals: boolean;
  budget_weekly: number | null;
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
  tier: string;
  kid_friendly: number;
  quick_meals: number;
  budget_weekly: number | null;
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
    tier: row.tier || 'free',
    kid_friendly: !!row.kid_friendly,
    quick_meals: !!row.quick_meals,
    budget_weekly: row.budget_weekly,
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
    'kid_friendly', 'quick_meals', 'budget_weekly',
  ];
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;
  for (const [key, val] of Object.entries(fields)) {
    if (!allowed.includes(key)) continue;
    if (key === 'has_children' || key === 'kid_friendly' || key === 'quick_meals') {
      updates.push(`${key} = $${idx}`);
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

export async function setUserTier(userId: number, tier: 'free' | 'premium'): Promise<void> {
  await pool.query('UPDATE user_profiles SET tier = $1, updated_at = NOW() WHERE id = $2', [tier, userId]);
}

// ── Weekly grocery list — last 7 days of plan text for LLM consolidation ──
export async function getWeekPlanTexts(userId: number): Promise<{ week: string; planTexts: string[]; planIds: number[] }> {
  const { rows } = await pool.query(
    `SELECT id, plan_text FROM meal_plan_history
     WHERE user_id = $1
       AND (created_at AT TIME ZONE 'Asia/Jakarta')::date >=
           ((NOW() AT TIME ZONE 'Asia/Jakarta')::date - 6)
     ORDER BY created_at DESC`,
    [userId]
  );
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const week = `${weekStart.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} — ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`;
  return { week, planTexts: rows.map((r: any) => r.plan_text), planIds: rows.map((r: any) => r.id) };
}

// ── Leftover remix — yesterday's plan for LLM remix ──
export async function getYesterdayPlanText(userId: number): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT plan_text FROM meal_plan_history
     WHERE user_id = $1
       AND (created_at AT TIME ZONE 'Asia/Jakarta')::date =
           ((NOW() AT TIME ZONE 'Asia/Jakarta')::date - 1)
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  return rows[0]?.plan_text ?? null;
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

export interface ParsedMeal {
  name: string;
  body: string;
  macros?: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  items: string[];
}

// Server-side meal parser — shared between generate, regenerate, and history
export function parsePlanMeals(text: string): ParsedMeal[] {
  if (!text) return [];
  const clean = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
  const mealNames = 'Sarapan|Breakfast|Makan\\s+siang|Lunch|Makan\\s+malam|Dinner|Snack|Camilan|Brunch';
  const mealRegex = new RegExp(`((?:${mealNames}))`, 'gi');
  const splits: { name: string; start: number }[] = [];
  let match;
  while ((match = mealRegex.exec(clean)) !== null) {
    splits.push({ name: match[1].trim(), start: match.index });
  }
  if (splits.length === 0) return [];
  const result: ParsedMeal[] = [];
  for (let i = 0; i < splits.length; i++) {
    const start = splits[i].start;
    const end = i + 1 < splits.length ? splits[i + 1].start : clean.length;
    const chunk = clean.slice(start, end).trim();
    const macroMatch = chunk.match(/(~?\d+\s*(?:kal|kcal|kkal|cal)[^\n]*)/i);
    const macros = macroMatch ? macroMatch[1].replace(/^\(+|\)+$/g, '').trim() : '';
    const body = chunk.replace(mealRegex, '').trim();
    // Extract kcal — matches "740 kkal", "~740 kal", "740kcal"
    const kcalMatch = (macros || chunk).match(/~?(\d+)\s*(?:kal|kcal|kkal|cal)/i);
    // Extract protein — matches "Protein: ~37g" OR "37g protein" OR "protein 37g"
    const proteinMatch = (macros || chunk).match(/protein[^\d,]*~?(\d+)\s*g/i) || (macros || chunk).match(/(\d+)\s*g[^\d,]*protein/i);
    // Extract carbs — matches "90g karbo" OR "karbo: 90g" OR "90g carbs" OR "carbs 90g"
    const carbsMatch = (macros || chunk).match(/(?:karbo|carb[s]?)[^\d,]*~?(\d+)\s*g/i) || (macros || chunk).match(/(\d+)\s*g[^\d,]*(?:karbo|carb[s]?)/i);
    // Extract fat — matches "25g lemak" OR "lemak: 25g" OR "25g fat" OR "fat 25g"
    const fatMatch = (macros || chunk).match(/(?:lemak|fat)[^\d,]*~?(\d+)\s*g/i) || (macros || chunk).match(/(\d+)\s*g[^\d,]*(?:lemak|fat)/i);
    // Extract food items — lines that aren't macros/labels
    const macroLineRegex = /^~?\d+\s*(kal|kcal|kkal|cal)/i;
    const proteinLineRegex = /^protein/i;
    const kaloriLineRegex = /^kalori\s*:/i;
    const items = (body || chunk)
      .split('\n')
      .map(l => l.replace(/^[•\-*\u2022]\s*/, '').trim())
      .filter(l => l.length > 0
        && !macroLineRegex.test(l)
        && !proteinLineRegex.test(l)
        && !kaloriLineRegex.test(l)
        && !/^\(.*kal.*protein/i.test(l)  // skip "(~740 kkal, 37g protein)"
        && !/^\d+\s*g\s*protein/i.test(l) // skip "37g protein"
        && !/^[A-ZÀ-Ý\s]+\s*\(.*kal/i.test(l) // skip leftover header tail "SIANG (~730 kkal, ...)"
        && !/^~?\d+\s*(kal|kcal|kkal|cal).*\)$/i.test(l) // skip stray macro line ending in ")"
        && !/^catatan\s*:/i.test(l)       // skip notes header "Catatan:"
        && !/^(semua bahan|hindari|alergi|masak simple|note|tips)\b/i.test(l) // skip note lines
      );
    result.push({
      name: splits[i].name,
      body: body || chunk,
      macros,
      kcal: kcalMatch ? parseInt(kcalMatch[1], 10) : 0,
      protein: proteinMatch ? parseInt(proteinMatch[1], 10) : 0,
      carbs: carbsMatch ? parseInt(carbsMatch[1], 10) : 0,
      fat: fatMatch ? parseInt(fatMatch[1], 10) : 0,
      items,
    });
  }
  return result;
}

export async function savePlanHistory(userId: number, planText: string, cuisine: string | null, calories: number | null, protein: number | null): Promise<number> {
  const meals = parsePlanMeals(planText);
  const mealsJson = JSON.stringify(meals);
  const { rows } = await pool.query(
    'INSERT INTO meal_plan_history (user_id, plan_text, meals_json, cuisine, calories_total, protein_total) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [userId, planText, mealsJson, cuisine, calories, protein]
  );
  // Mirror to bot_plan_history when web user is TG-linked (keeps bot /today in sync)
  const { rows: prof } = await pool.query(
    'SELECT telegram_chat_id FROM user_profiles WHERE id = $1',
    [userId]
  );
  if (prof[0]?.telegram_chat_id) {
    await pool.query(
      'INSERT INTO bot_plan_history (chat_id, plan_text, cuisine, meals_json) VALUES ($1, $2, $3, $4)',
      [prof[0].telegram_chat_id, planText, cuisine, mealsJson]
    );
  }
  return rows[0].id;
}

export async function getPlanHistory(userId: number, limit = 30): Promise<any[]> {
  const { rows } = await pool.query(
    'SELECT id, plan_text, meals_json, cuisine, calories_total, protein_total, cooked_at, created_at FROM meal_plan_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]
  );
  return rows.map((r: any) => ({
    id: r.id,
    planText: r.plan_text,
    meals: Array.isArray(r.meals_json) ? r.meals_json : (r.meals_json ? JSON.parse(r.meals_json) : null),
    cuisine: r.cuisine,
    calories: r.calories_total,
    protein: r.protein_total,
    cookedAt: r.cooked_at ? new Date(r.cooked_at).toISOString() : null,
    created: r.created_at.toISOString(),
  }));
}

// Mark today's (or given) plan as cooked. Only allows one cooked plan per day
// (newer cook overwrites older). Returns the cooked plan id or null if no plan.
export async function markCooked(userId: number, planId: number | null): Promise<number | null> {
  // If no planId given, use the user's latest plan
  const id = planId ?? (
    await pool.query(
      'SELECT id FROM meal_plan_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    )
  ).rows[0]?.id ?? null;
  if (!id) return null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  // Un-cook any earlier plan cooked today (keeps one per day)
  await pool.query(
    'UPDATE meal_plan_history SET cooked_at = NULL WHERE user_id = $1 AND cooked_at >= $2 AND id <> $3',
    [userId, todayStart, id]
  );
  await pool.query(
    'UPDATE meal_plan_history SET cooked_at = NOW() WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return id;
}

// Current streak for a web user: consecutive days ending today with a cooked plan
export async function getWebUserStreak(userId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT DISTINCT (cooked_at AT TIME ZONE 'Asia/Jakarta')::date AS d
     FROM meal_plan_history
     WHERE user_id = $1 AND cooked_at IS NOT NULL
     ORDER BY d DESC`,
    [userId]
  );
  const days: string[] = rows.map((r: any) => r.d instanceof Date ? r.d.toISOString().slice(0, 10) : String(r.d));
  const today = (await pool.query(`SELECT (NOW() AT TIME ZONE 'Asia/Jakarta')::date AS d`)).rows[0].d;
  const todayStr = today instanceof Date ? today.toISOString().slice(0, 10) : String(today);
  if (!days.includes(todayStr)) return 0;
  let streak = 0;
  const cur = new Date(todayStr + 'T00:00:00Z');
  for (let i = 0; i < 365; i++) {
    const d = new Date(cur.getTime() - i * 86400000);
    const dStr = d.toISOString().slice(0, 10);
    if (days.includes(dStr)) streak++;
      else break;
    }
    return streak;
    }

    // ── Phase 2: Calendar + Badges (web users) ──

    export interface CalendarDay {
    date: string;          // YYYY-MM-DD (WIB)
    dayName: string;       // Sen, Sel, ...
    dayNum: number;
    status: 'cooked' | 'skipped' | 'today' | 'future';
    cuisine: string | null;
    planId: number | null;
    }

    export async function getWeekCalendar(userId: number, weekOffset = 0): Promise<CalendarDay[]> {
    const { rows } = await pool.query(
      `SELECT
         d::date::text AS date,
         to_char(d::date, 'Dy') AS dow,
         EXTRACT(DAY FROM d)::int AS day_num,
         p.id AS plan_id,
         p.cuisine,
         p.cooked_at,
         (NOW() AT TIME ZONE 'Asia/Jakarta')::date::text AS today
       FROM generate_series(
         ((NOW() AT TIME ZONE 'Asia/Jakarta')::date - ((EXTRACT(ISODOW FROM NOW() AT TIME ZONE 'Asia/Jakarta'))::int - 1)) + ($2 * 7),
         ((NOW() AT TIME ZONE 'Asia/Jakarta')::date - ((EXTRACT(ISODOW FROM NOW() AT TIME ZONE 'Asia/Jakarta'))::int - 1)) + ($2 * 7) + 6,
         '1 day'
       ) d
       LEFT JOIN LATERAL (
         SELECT id, cuisine, cooked_at FROM meal_plan_history
         WHERE user_id = $1
           AND (created_at AT TIME ZONE 'Asia/Jakarta')::date = d::date
         ORDER BY created_at DESC LIMIT 1
       ) p ON true
       ORDER BY d`,
      [userId, weekOffset]
    );
    const dayNames: Record<string, string> = { Mon: 'Sen', Tue: 'Sel', Wed: 'Rab', Thu: 'Kam', Fri: 'Jum', Sat: 'Sab', Sun: 'Min' };
    return rows.map((r: any) => ({
      date: r.date,
      dayName: dayNames[r.dow] || r.dow,
      dayNum: r.day_num,
      status: r.cooked_at ? 'cooked'
        : r.date === r.today ? 'today'
        : r.date < r.today ? 'skipped'
        : 'future',
      cuisine: r.cuisine,
      planId: r.plan_id,
    }));
    }

    export interface Badge {
    key: string;
    name: string;
    desc: string;
    emoji: string;
    unlocked: boolean;
    progress: number;   // 0-1
    }

    export async function getBadges(userId: number): Promise<{ badges: Badge[]; weekCooked: number; weekTarget: number }> {
    const [streak, cuisines, proteinDays, week] = await Promise.all([
      getWebUserStreak(userId),
      pool.query(
        `SELECT COUNT(DISTINCT cuisine)::int AS cnt FROM meal_plan_history WHERE user_id = $1 AND cooked_at IS NOT NULL`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS cnt FROM (
           SELECT DISTINCT (cooked_at AT TIME ZONE 'Asia/Jakarta')::date AS d
           FROM meal_plan_history
           WHERE user_id = $1 AND cooked_at IS NOT NULL
             AND protein_total >= (SELECT COALESCE(target_protein, 100) FROM user_profiles WHERE id = $1)
         ) t`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS cnt FROM meal_plan_history
         WHERE user_id = $1 AND cooked_at IS NOT NULL
           AND (cooked_at AT TIME ZONE 'Asia/Jakarta')::date >=
               ((NOW() AT TIME ZONE 'Asia/Jakarta')::date - ((EXTRACT(ISODOW FROM NOW() AT TIME ZONE 'Asia/Jakarta'))::int - 1))`,
        [userId]
      ),
    ]);
    const cuisineCount = cuisines.rows[0]?.cnt ?? 0;
    const proteinCount = proteinDays.rows[0]?.cnt ?? 0;
    const weekCooked = week.rows[0]?.cnt ?? 0;
    const badges: Badge[] = [
      { key: 'chef_pemula', name: 'Chef Pemula', desc: 'Masak 3 hari berturut', emoji: '🍳', unlocked: streak >= 3, progress: Math.min(streak / 3, 1) },
      { key: 'food_explorer', name: 'Food Explorer', desc: 'Coba 5 masakan berbeda', emoji: '🌏', unlocked: cuisineCount >= 5, progress: Math.min(cuisineCount / 5, 1) },
      { key: 'protein_master', name: 'Protein Master', desc: 'Capai target protein 7 hari', emoji: '💪', unlocked: proteinCount >= 7, progress: Math.min(proteinCount / 7, 1) },
      { key: 'saji_legend', name: 'Saji Legend', desc: '30 hari streak', emoji: '👑', unlocked: streak >= 30, progress: Math.min(streak / 30, 1) },
    ];
    return { badges, weekCooked, weekTarget: 7 };
    }


    // ────────────────────────────────────────────────────────────────────────────
// Recipe library — global reusable meals
// ────────────────────────────────────────────────────────────────────────────
export interface Recipe {
  id: number;
  name: string;
  cuisine: string | null;
  meal_type: string;
  items: string[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  kid_friendly: boolean;
  quick: boolean;
  budget_tier: string | null;
  tags: string[];
  steps: string | null;
  source: string;
  times_used: number;
  last_used_at: Date | null;
  rating_sum: number;
  rating_count: number;
}

// Normalize meal name to slot type
function mealTypeOf(mealName: string): string {
  const k = mealName.toLowerCase();
  if (k.includes('sarapan') || k.includes('breakfast') || k.includes('brunch')) return 'sarapan';
  if (k.includes('siang') || k.includes('lunch')) return 'makan siang';
  if (k.includes('malam') || k.includes('dinner')) return 'makan malam';
  return 'snack';
}

// Extract tags from recipe text (allergy-relevant keywords + cooking method)
const TAG_PATTERNS: [RegExp, string][] = [
  [/kacang|peanut/i, 'peanut'],
  [/udang|cumi|kerang|kepiting|seafood/i, 'shellfish'],
  [/susu|keju|yogurt|dairy|santan/i, 'dairy'],
  [/babi|pork|bacon|ham/i, 'pork'],
  [/goreng/i, 'goreng'],
  [/bakar|panggang/i, 'bakar'],
  [/rebus|kukus|pepes/i, 'rebus'],
  [/tumis/i, 'tumis'],
  [/pedas|cabai|cabe|sambal/i, 'pedas'],
];

function tagsOf(name: string, items: string[]): string[] {
  const hay = (name + ' ' + items.join(' ')).toLowerCase();
  const tags = new Set<string>();
  for (const [re, tag] of TAG_PATTERNS) {
    if (re.test(hay)) tags.add(tag);
  }
  if (!tags.has('pork')) tags.add('halal-ok'); // default assumption: no pork = halal-ok
  return [...tags];
}

function kidFriendlyOf(name: string, items: string[]): boolean {
  const hay = (name + ' ' + items.join(' ')).toLowerCase();
  return !/pedas|cabai|cabe|sambal|lada hitam/i.test(hay);
}

function quickOf(name: string, items: string[]): boolean {
  const hay = (name + ' ' + items.join(' ')).toLowerCase();
  return !/rendang|bakso|soto betawi|gulai|opor|rawon|marinasi semalam/i.test(hay);
}

export async function upsertRecipe(r: {
  name: string; cuisine: string | null; mealName: string;
  items: string[]; kcal: number; protein: number; carbs: number; fat: number;
  source?: string;
}): Promise<number> {
  const mealType = mealTypeOf(r.mealName);
  const tags = tagsOf(r.name, r.items);
  const { rows } = await pool.query(
    `INSERT INTO recipes (name, cuisine, meal_type, items, kcal, protein, carbs, fat,
                          kid_friendly, quick, tags, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (name, cuisine, meal_type)
     DO UPDATE SET items=$4, kcal=$5, protein=$6, carbs=$7, fat=$8, tags=$11
     RETURNING id`,
    [r.name, r.cuisine, mealType, JSON.stringify(r.items), r.kcal, r.protein, r.carbs, r.fat,
     kidFriendlyOf(r.name, r.items) ? 1 : 0, quickOf(r.name, r.items) ? 1 : 0,
     tags, r.source || 'llm-new']
  );
  return rows[0].id;
}

export interface RecipeQuery {
  cuisine?: string | null;
  mealTypes: string[];
  avoidAllergens?: string[];   // e.g. ['peanut','shellfish','dairy']
  kidFriendly?: boolean;
  quick?: boolean;
  maxPerType?: number;
  excludeRecipeIds?: number[];
}

export async function queryRecipes(q: RecipeQuery): Promise<Recipe[]> {
  const conditions: string[] = ["meal_type = ANY($1)"];
  const params: any[] = [q.mealTypes];
  let idx = 2;
  if (q.cuisine) {
    conditions.push(`(cuisine ILIKE $${idx} OR cuisine IS NULL)`);
    params.push(`%${q.cuisine}%`);
    idx++;
  }
  if (q.avoidAllergens?.length) {
    conditions.push(`NOT (tags && $${idx})`);
    params.push(q.avoidAllergens);
    idx++;
  }
  if (q.kidFriendly) { conditions.push('kid_friendly = 1'); }
  if (q.quick) { conditions.push('quick = 1'); }
  if (q.excludeRecipeIds?.length) {
    conditions.push(`NOT (id = ANY($${idx}))`);
    params.push(q.excludeRecipeIds);
    idx++;
  }
  const { rows } = await pool.query(
    `SELECT * FROM recipes WHERE ${conditions.join(' AND ')}
     ORDER BY
       CASE WHEN rating_count >= 3 AND rating_sum::float / rating_count < 0 THEN 1 ELSE 0 END ASC,
       times_used ASC,
       last_used_at ASC NULLS FIRST,
       rating_sum DESC
     LIMIT 100`,
    params
  );
  return rows.map((r: any) => ({
    ...r,
    items: Array.isArray(r.items) ? r.items : JSON.parse(r.items),
    kid_friendly: !!r.kid_friendly,
    quick: !!r.quick,
  }));
}

export async function markRecipesUsed(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await pool.query(
    'UPDATE recipes SET times_used = times_used + 1, last_used_at = NOW() WHERE id = ANY($1)',
    [ids]
  );
}

export async function rateRecipes(ids: number[], good: boolean): Promise<void> {
  if (!ids.length) return;
  await pool.query(
    `UPDATE recipes SET rating_sum = rating_sum + $1, rating_count = rating_count + 1 WHERE id = ANY($2)`,
    [good ? 1 : -1, ids]
  );
}

// Match recipes in a plan text back to recipe rows (same naming as seedRecipesFromPlan)
export async function getRecipeIdsFromPlan(planText: string): Promise<number[]> {
  const meals = parsePlanMeals(planText);
  const names: string[] = [];
  for (const m of meals) {
    const firstItem = (m.items[0] || '').split(':')[0].slice(0, 60);
    names.push(firstItem ? `${m.name} — ${firstItem}` : m.name);
  }
  if (!names.length) return [];
  const { rows } = await pool.query('SELECT id FROM recipes WHERE name = ANY($1)', [names]);
  return rows.map((r: any) => r.id);
}

// ── Recipe images (signature cache) ──
export async function getRecipeImage(signature: string): Promise<string | null> {
  const { rows } = await pool.query('SELECT image_path FROM recipe_images WHERE signature = $1', [signature]);
  return rows[0]?.image_path ?? null;
}

export async function saveRecipeImage(signature: string, prompt: string, imagePath: string, costUsd = 0.035): Promise<void> {
  await pool.query(
    `INSERT INTO recipe_images (signature, prompt, image_path, cost_usd) VALUES ($1, $2, $3, $4)
     ON CONFLICT (signature) DO UPDATE SET image_path = $3, prompt = $2`,
    [signature, prompt, imagePath, costUsd]
  );
}

// fal spend report — total, this month, per-day trend
export async function getImageSpend(): Promise<{ total: number; count: number; thisMonth: number; monthCount: number }> {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*)::int AS count,
      COALESCE(SUM(cost_usd), 0)::float AS total,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW()))::int AS month_count,
      COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= date_trunc('month', NOW())), 0)::float AS this_month
    FROM recipe_images
  `);
  return { total: rows[0].total, count: rows[0].count, thisMonth: rows[0].this_month, monthCount: rows[0].month_count };
}

export async function setRecipeSignature(recipeId: number, signature: string): Promise<void> {
  await pool.query('UPDATE recipes SET image_signature = $1 WHERE id = $2', [signature, recipeId]);
}

export async function getRecipesWithoutSignature(limit = 200): Promise<{ id: number; name: string; cuisine: string | null; meal_type: string; items: string[] }[]> {
  const { rows } = await pool.query(
    'SELECT id, name, cuisine, meal_type, items FROM recipes WHERE image_signature IS NULL ORDER BY times_used DESC LIMIT $1',
    [limit]
  );
  return rows.map((r: any) => ({
    ...r,
    items: Array.isArray(r.items) ? r.items : JSON.parse(r.items),
  }));
}

export async function getSignaturesWithoutImage(limit = 100): Promise<{ signature: string; name: string; items: string[]; cuisine: string | null }[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT r.image_signature AS signature,
            (SELECT name FROM recipes r2 WHERE r2.image_signature = r.image_signature ORDER BY times_used DESC LIMIT 1) AS name,
            (SELECT items FROM recipes r2 WHERE r2.image_signature = r.image_signature ORDER BY times_used DESC LIMIT 1) AS items,
            (SELECT cuisine FROM recipes r2 WHERE r2.image_signature = r.image_signature ORDER BY times_used DESC LIMIT 1) AS cuisine
     FROM recipes r
     WHERE r.image_signature IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM recipe_images ri WHERE ri.signature = r.image_signature)
     LIMIT $1`,
    [limit]
  );
  return rows.map((r: any) => ({
    ...r,
    items: Array.isArray(r.items) ? r.items : (r.items ? JSON.parse(r.items) : []),
  }));
}

// Attach image paths to meals from a plan (for API responses)
export async function attachMealImages(meals: any[]): Promise<any[]> {
  if (!meals.length) return meals;
  const names = meals.map(m => {
    const firstItem = (m.items?.[0] || '').split(':')[0].slice(0, 60);
    return firstItem ? `${m.name} — ${firstItem}` : m.name;
  });
  const { rows } = await pool.query(
    `SELECT r.name, r.image_signature, ri.image_path
     FROM recipes r
     LEFT JOIN recipe_images ri ON ri.signature = r.image_signature
     WHERE r.name = ANY($1)`,
    [names]
  );
  const byName = new Map(rows.map((r: any) => [r.name, r]));
  return meals.map((m, i) => {
    const rec = byName.get(names[i]);
    return { ...m, imageSignature: rec?.image_signature ?? null, imagePath: rec?.image_path ?? null };
  });
}

// Seed from a parsed plan (all meals → recipe rows)
export async function seedRecipesFromPlan(planText: string, cuisine: string | null, source: string): Promise<number> {
  const meals = parsePlanMeals(planText);
  let n = 0;
  for (const m of meals) {
    if (!m.kcal && !m.items.length) continue;
    // Recipe name = meal name + first item (disambiguates generic "SARAPAN")
    const firstItem = (m.items[0] || '').split(':')[0].slice(0, 60);
    const recipeName = firstItem ? `${m.name} — ${firstItem}` : m.name;
    await upsertRecipe({
      name: recipeName, cuisine, mealName: m.name,
      items: m.items, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat,
      source,
    });
    n++;
  }
  return n;
}

// Assemble a day plan from library. Returns plan text + coverage (0-1).
export async function assemblePlanFromLibrary(opts: {
  cuisine: string | null;
  mealsPerDay: number;
  targetKcal: number | null;
  targetProtein: number | null;
  avoidAllergens: string[];
  kidFriendly: boolean;
  quick: boolean;
  recentRecipeIds: number[];   // user's last 7 days — avoid repeats
  locale: 'en' | 'id';
}): Promise<{ planText: string; recipes: Recipe[]; coverage: number } | null> {
  const slotOrder = ['sarapan', 'snack', 'makan siang', 'makan malam'];
  const slots = slotOrder.slice(0, Math.min(Math.max(opts.mealsPerDay, 3), 4));
  if (opts.mealsPerDay === 3) slots.splice(1, 1); // drop snack for 3-meal plans

  const candidates = await queryRecipes({
    cuisine: opts.cuisine,
    mealTypes: slots,
    avoidAllergens: opts.avoidAllergens,
    kidFriendly: opts.kidFriendly,
    quick: opts.quick,
    excludeRecipeIds: opts.recentRecipeIds,
  });
  if (!candidates.length) return null;

  // Greedy pick per slot, tracking macro totals
  const picked: Recipe[] = [];
  const usedIds = new Set<number>();
  let totKcal = 0;
  const targetKcal = opts.targetKcal || 0;
  for (const slot of slots) {
    const poolForSlot = candidates.filter(c => c.meal_type === slot && !usedIds.has(c.id));
    if (!poolForSlot.length) continue;
    // Pick best macro fit: prefer recipes that keep us near target pace
    const remaining = slots.length - picked.length;
    const idealKcal = targetKcal ? (targetKcal - totKcal) / remaining : 0;
    poolForSlot.sort((a, b) => {
      const da = idealKcal ? Math.abs(a.kcal - idealKcal) : 0;
      const db = idealKcal ? Math.abs(b.kcal - idealKcal) : 0;
      return da - db;
    });
    const pick = poolForSlot[0];
    picked.push(pick);
    usedIds.add(pick.id);
    totKcal += pick.kcal;
  }

  // ── Refinement pass: if under 85% kcal target, swap lightest slot for heavier option ──
  if (targetKcal && totKcal < targetKcal * 0.85 && picked.length > 0) {
    for (let attempt = 0; attempt < 2 && totKcal < targetKcal * 0.85; attempt++) {
      // Lightest picked slot
      let lightIdx = 0;
      for (let i = 1; i < picked.length; i++) {
        if (picked[i].kcal < picked[lightIdx].kcal) lightIdx = i;
      }
      const slot = picked[lightIdx].meal_type;
      const alternatives = candidates
        .filter(c => c.meal_type === slot && !usedIds.has(c.id) && c.kcal > picked[lightIdx].kcal)
        .sort((a, b) => b.kcal - a.kcal);
      if (!alternatives.length) break;
      const upgrade = alternatives[0];
      totKcal += upgrade.kcal - picked[lightIdx].kcal;
      usedIds.delete(picked[lightIdx].id);
      usedIds.add(upgrade.id);
      picked[lightIdx] = upgrade;
    }
  }

  const coverage = picked.length / slots.length;
  if (picked.length === 0) return null;

  // Render plan text in same format as LLM output (parser-compatible)
  const id = opts.locale === 'id';
  const header = `${id ? 'Hari ini' : 'Today'}: ${opts.cuisine || (id ? 'Campuran' : 'Mixed')}`;
  const totProtein = picked.reduce((s, r) => s + r.protein, 0);
  const totCarbs = picked.reduce((s, r) => s + r.carbs, 0);
  const totFat = picked.reduce((s, r) => s + r.fat, 0);
  const targetLine = opts.targetKcal
    ? `${id ? 'Target' : 'Target'}: ${opts.targetKcal} kkal, ${opts.targetProtein || 0}g protein. Plan: ~${totKcal} kkal, ${totProtein}g protein.`
    : `Plan: ~${totKcal} kkal, ${totProtein}g protein.`;
  const mealBlocks = picked.map(r => {
    const name = r.meal_type === 'sarapan' ? (id ? 'SARAPAN' : 'BREAKFAST')
      : r.meal_type === 'makan siang' ? (id ? 'MAKAN SIANG' : 'LUNCH')
      : r.meal_type === 'makan malam' ? (id ? 'MAKAN MALAM' : 'DINNER')
      : 'SNACK';
    const title = r.name.includes(' — ') ? r.name.split(' — ')[1] : r.name;
    const lines = [
      `${name} (~${r.kcal} kkal, ${r.protein}g protein, ${r.carbs}g karbo, ${r.fat}g lemak)`,
      `- ${title}`,
      ...r.items.slice(1).map(i => `- ${i}`),
    ];
    return lines.join('\n');
  });
  const planText = [header, '', targetLine, '', ...mealBlocks].join('\n\n');
  return { planText, recipes: picked, coverage };
}

// Recent recipe ids used by a user (last N days) — for no-repeat rule
export async function getRecentRecipeIds(userId: number, days = 7): Promise<number[]> {
  const { rows } = await pool.query(
    `SELECT meals_json FROM meal_plan_history
     WHERE user_id = $1
       AND (created_at AT TIME ZONE 'Asia/Jakarta')::date >=
           ((NOW() AT TIME ZONE 'Asia/Jakarta')::date - $2)`,
    [userId, days]
  );
  const names: string[] = [];
  for (const r of rows) {
    const meals = Array.isArray(r.meals_json) ? r.meals_json : (r.meals_json ? JSON.parse(r.meals_json) : []);
    for (const m of meals) {
      const firstItem = (m.items?.[0] || '').split(':')[0].slice(0, 60);
      if (firstItem) names.push(`${m.name} — ${firstItem}`);
    }
  }
  if (!names.length) return [];
  const { rows: recRows } = await pool.query(
    'SELECT id FROM recipes WHERE name = ANY($1)',
    [names]
  );
  return recRows.map((r: any) => r.id);
}

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

// ════════════════════════════════════════════════════════════════════════════
// New actionable metrics
// ════════════════════════════════════════════════════════════════════════════

// Health score — 0-100 combining DAU trend, churn, conversion, retention
export async function getHealthScore(): Promise<{ score: number; components: Record<string, number>[]; label: string }> {
  const [dauData, churnData, convData, retentionData] = await Promise.all([
    getDAU(7),
    getChurnRate(),
    getConversion(),
    getRetention(),
  ]);

  // DAU trend: compare last 3 days avg vs first 3 days avg
  const recent3 = dauData.slice(-3).reduce((s, d) => s + d.dau, 0) / 3;
  const first3 = dauData.slice(0, 3).reduce((s, d) => s + d.dau, 0) / 3;
  const dauTrendPct = first3 > 0 ? Math.round(((recent3 - first3) / first3) * 100) : 0;
  const dauScore = Math.max(0, Math.min(100, 50 + dauTrendPct * 2));

  // Churn: lower is better. 0% = 100, 50%+ = 0
  const churnScore = Math.max(0, 100 - churnData.rate * 2);

  // Conversion: higher is better. 0% = 0, 50%+ = 100
  const convScore = Math.min(100, convData.rate * 2);

  // Retention: average D1 across cohorts
  const avgD1 = retentionData.length > 0
    ? retentionData.reduce((s, r) => s + r.d1, 0) / retentionData.length
    : 0;
  const retScore = Math.min(100, avgD1);

  const score = Math.round(dauScore * 0.3 + churnScore * 0.3 + convScore * 0.2 + retScore * 0.2);
  const label = score >= 75 ? 'healthy' : score >= 50 ? 'fair' : score >= 30 ? 'warning' : 'critical';

  return {
    score,
    components: [
      { dauTrend: dauTrendPct },
      { churn: churnData.rate },
      { conversion: convData.rate },
      { retention: Math.round(avgD1) },
    ],
    label,
  };
}

// Smart alerts — threshold-based notifications
export async function getAlerts(): Promise<{ severity: string; message: string }[]> {
  const [dauData, churnData, convData, retentionData, tokenEcon] = await Promise.all([
    getDAU(7),
    getChurnRate(),
    getConversion(),
    getRetention(),
    getTokenEconomics(7),
  ]);

  const alerts: { severity: string; message: string }[] = [];

  // No new users in 3 days
  const recentNew = dauData.slice(-3).reduce((s, d) => s + d.new_users, 0);
  if (recentNew === 0) {
    alerts.push({ severity: 'warning', message: 'Tidak ada user baru dalam 3 hari terakhir' });
  }

  // Churn > 20%
  if (churnData.rate > 20) {
    alerts.push({ severity: 'danger', message: `Churn ${churnData.rate}% — di atas threshold 20%` });
  }

  // D1 retention < 30%
  if (retentionData.length > 0) {
    const avgD1 = retentionData.reduce((s, r) => s + r.d1, 0) / retentionData.length;
    if (avgD1 < 30) {
      alerts.push({ severity: 'warning', message: `D1 retention ${Math.round(avgD1)}% — di bawah 30%` });
    }
  }

  // Token cost spike — compare last 7d per user vs total per user
  if (tokenEcon.perUser > 50000) {
    alerts.push({ severity: 'info', message: `Token/user ${tokenEcon.perUser.toLocaleString()} minggu ini — cek penggunaan` });
  }

  // Conversion = 0 but have users
  if (convData.total > 0 && convData.premium === 0) {
    alerts.push({ severity: 'info', message: `${convData.total} user, 0 premium — belum ada konversi` });
  }

  // DAU declining
  const recent3 = dauData.slice(-3).reduce((s, d) => s + d.dau, 0) / 3;
  const first3 = dauData.slice(0, 3).reduce((s, d) => s + d.dau, 0) / 3;
  if (first3 > 0 && recent3 < first3 * 0.7) {
    alerts.push({ severity: 'danger', message: `DAU turun ${Math.round((1 - recent3 / first3) * 100)}% minggu ini` });
  }

  // Cook rate — web users planned but didn't cook
  const { rows: cookRows } = await pool.query(`
    SELECT
      COUNT(*)::int AS planned,
      COUNT(cooked_at)::int AS cooked
    FROM meal_plan_history
    WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  `);
  const planned = cookRows[0]?.planned ?? 0;
  const cooked = cookRows[0]?.cooked ?? 0;
  if (planned > 10 && cooked / planned < 0.3) {
    alerts.push({ severity: 'warning', message: `Cook rate ${Math.round((cooked / planned) * 100)}% minggu ini — user generate tapi nggak masak` });
  }

  // No alerts = all good
  if (alerts.length === 0) {
    alerts.push({ severity: 'ok', message: 'Semua metrik dalam batas normal' });
  }

  return alerts;
}

// Today snapshot — real-time numbers for today
export async function getTodaySnapshot(): Promise<{ plansToday: number; activeToday: number; pushesSent: number; pushesFailed: number; newUsersToday: number; cookedToday: number; plannedTodayWeb: number }> {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM usage_log WHERE feature = 'mealplan' AND created >= CURRENT_DATE) AS plans_today,
      (SELECT COUNT(DISTINCT chat_id)::int FROM usage_log WHERE created >= CURRENT_DATE) AS active_today,
      (SELECT COUNT(*)::int FROM push_log WHERE status = 'sent' AND created_at >= CURRENT_DATE) AS pushes_sent,
      (SELECT COUNT(*)::int FROM push_log WHERE status = 'failed' AND created_at >= CURRENT_DATE) AS pushes_failed,
      (SELECT COUNT(*)::int FROM subscribers WHERE created_at >= CURRENT_DATE) AS new_users_today,
      (SELECT COUNT(*)::int FROM meal_plan_history WHERE (cooked_at AT TIME ZONE 'Asia/Jakarta')::date = (NOW() AT TIME ZONE 'Asia/Jakarta')::date) AS cooked_today,
      (SELECT COUNT(*)::int FROM meal_plan_history WHERE (created_at AT TIME ZONE 'Asia/Jakarta')::date = (NOW() AT TIME ZONE 'Asia/Jakarta')::date) AS planned_today_web
  `);
  const r = rows[0];
  return {
    plansToday: r.plans_today,
    activeToday: r.active_today,
    pushesSent: r.pushes_sent,
    pushesFailed: r.pushes_failed,
    newUsersToday: r.new_users_today,
    cookedToday: r.cooked_today,
    plannedTodayWeb: r.planned_today_web,
  };
}

// Recent users — last N signups
export async function getRecentUsers(limit = 10): Promise<{ chat_id: string; tier: string; streak: number; created_at: string; last_active: string | null }[]> {
  const { rows } = await pool.query(`
    SELECT
      s.chat_id::text,
      s.tier,
      s.streak,
      s.created_at,
      MAX(u.created)::text AS last_active
    FROM subscribers s
    LEFT JOIN usage_log u ON u.chat_id = s.chat_id
    GROUP BY s.chat_id, s.tier, s.streak, s.created_at
    ORDER BY s.created_at DESC
    LIMIT $1
  `, [limit]);
  return rows;
}

// Power users — most active by plan count
export async function getPowerUsers(limit = 5): Promise<{ chat_id: string; tier: string; streak: number; plan_count: number; last_active: string }[]> {
  const { rows } = await pool.query(`
    SELECT
      s.chat_id::text,
      s.tier,
      s.streak,
      COUNT(u.id)::int AS plan_count,
      MAX(u.created)::text AS last_active
    FROM subscribers s
    JOIN usage_log u ON u.chat_id = s.chat_id
    WHERE u.feature = 'mealplan' AND u.created >= NOW() - INTERVAL '30 days'
    GROUP BY s.chat_id, s.tier, s.streak
    ORDER BY plan_count DESC
    LIMIT $1
  `, [limit]);
  return rows;
}

// At-risk users — active 5-7 days ago, not since
export async function getAtRiskUsers(limit = 10): Promise<{ chat_id: string; tier: string; streak: number; last_active: string; days_inactive: number }[]> {
  const { rows } = await pool.query(`
    WITH last_active AS (
      SELECT chat_id, MAX(created) AS last_seen
      FROM usage_log
      GROUP BY chat_id
    )
    SELECT
      s.chat_id::text,
      s.tier,
      s.streak,
      la.last_seen::text AS last_active,
      EXTRACT(DAY FROM NOW() - la.last_seen)::int AS days_inactive
    FROM subscribers s
    JOIN last_active la ON la.chat_id = s.chat_id
    WHERE la.last_seen >= NOW() - INTERVAL '7 days'
      AND la.last_seen < NOW() - INTERVAL '4 days'
    ORDER BY la.last_seen ASC
    LIMIT $1
  `, [limit]);
  return rows;
}

// Feedback wall — latest user feedback
export async function getFeedbackWall(limit = 10): Promise<{ id: number; rating: number; feedback: string | null; cuisine: string | null; chat_id: string | null; created_at: string }[]> {
  const { rows } = await pool.query(`
    SELECT id, rating, feedback, cuisine, chat_id::text, created_at::text
    FROM plan_feedback
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);
  return rows;
}

// Plan quality — avg rating, best/worst cuisines
export async function getPlanQuality(): Promise<{ avgRating: number; totalFeedback: number; bestCuisines: { cuisine: string; avgRating: number; count: number }[]; worstCuisines: { cuisine: string; avgRating: number; count: number }[] }> {
  const { rows: ratingRows } = await pool.query(`
    SELECT COALESCE(AVG(rating), 0)::float AS avg_rating, COUNT(*)::int AS total
    FROM plan_feedback
    WHERE created_at >= NOW() - INTERVAL '30 days'
  `);

  const { rows: cuisineRows } = await pool.query(`
    SELECT cuisine, AVG(rating)::float AS avg_rating, COUNT(*)::int AS count
    FROM plan_feedback
    WHERE cuisine IS NOT NULL AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY cuisine
    HAVING COUNT(*) >= 1
    ORDER BY avg_rating DESC
  `);

  return {
    avgRating: Math.round((ratingRows[0].avg_rating || 0) * 10) / 10,
    totalFeedback: ratingRows[0].total || 0,
    bestCuisines: cuisineRows.slice(0, 3).map((r: any) => ({ cuisine: r.cuisine, avgRating: Math.round(r.avg_rating * 10) / 10, count: r.count })),
    worstCuisines: [...cuisineRows].sort((a: any, b: any) => a.avg_rating - b.avg_rating).slice(0, 3).map((r: any) => ({ cuisine: r.cuisine, avgRating: Math.round(r.avg_rating * 10) / 10, count: r.count })),
  };
}

// Push delivery status — today's push log
export async function getPushStatus(): Promise<{ total: number; sent: number; failed: number; pending: number; recent: { id: number; chat_id: string; status: string; error: string | null; cuisine: string | null; created_at: string }[] }> {
  const { rows: summaryRows } = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
    FROM push_log
    WHERE created_at >= CURRENT_DATE
  `);

  const { rows: recentRows } = await pool.query(`
    SELECT id, chat_id::text, status, error, cuisine, created_at::text
    FROM push_log
    ORDER BY created_at DESC
    LIMIT 10
  `);

  return {
    total: summaryRows[0].total || 0,
    sent: summaryRows[0].sent || 0,
    failed: summaryRows[0].failed || 0,
    pending: summaryRows[0].pending || 0,
    recent: recentRows,
  };
}
