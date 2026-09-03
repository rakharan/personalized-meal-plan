import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.MEALPLAN_DB_PATH || join(__dirname, 'mealplan.db');

// ponytail: single DB connection shared by the whole process. Fine for a
// single-user bot; if you ever run multiple bot processes, move to WAL +
// per-process connections or pool.
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS subscribers (
  chat_id       INTEGER PRIMARY KEY,
  answers       TEXT NOT NULL,          -- JSON blob of the Q&A answers
  locale        TEXT NOT NULL DEFAULT 'en',
  subscribed    INTEGER NOT NULL DEFAULT 0,
  last_pushed   TEXT,                   -- ISO date (YYYY-MM-DD) of last push
  last_cuisines TEXT DEFAULT '[]',       -- JSON array of recently used cuisines
  streak        INTEGER NOT NULL DEFAULT 0,
  last_answers  TEXT,                   -- JSON blob of the last-generated answers (for re-roll)
  last_feedback TEXT,                   -- 'good' | 'bad' | null
  push_hour     INTEGER,                 -- per-user push hour 0-23 (NULL = use global default)
  push_min      INTEGER                  -- per-user push minute 0-59 (NULL = use global default)
);
`);

// Idempotent migrations: add columns that may be missing on older DBs.
const existingCols = new Set(
  db.prepare("PRAGMA table_info(subscribers)").all().map((r) => r.name)
);
const migrations = [
  ['last_cuisines', "TEXT DEFAULT '[]'"],
  ['streak', 'INTEGER NOT NULL DEFAULT 0'],
  ['last_answers', 'TEXT'],
  ['last_feedback', 'TEXT'],
  ['push_hour', 'INTEGER'],
  ['push_min', 'INTEGER'],
];
for (const [col, def] of migrations) {
  if (!existingCols.has(col)) {
    db.exec(`ALTER TABLE subscribers ADD COLUMN ${col} ${def};`);
  }
}
// Normalize legacy 'bi' locale to 'en' (default language is English now).
db.prepare("UPDATE subscribers SET locale = 'en' WHERE locale = 'bi'").run();

// ────────────────────────────────────────────────────────────────────────────
// Saved plans (named presets) — lets users keep multiple answer sets.
// ────────────────────────────────────────────────────────────────────────────
db.exec(`
CREATE TABLE IF NOT EXISTS plans (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id   INTEGER NOT NULL,
  name      TEXT NOT NULL,
  answers   TEXT NOT NULL,            -- JSON blob
  created   TEXT NOT NULL,            -- ISO timestamp
  UNIQUE (chat_id, name)
);
`);

const planStmts = {
  insert: db.prepare(`INSERT INTO plans (chat_id, name, answers, created) VALUES (@chatId, @name, @answers, @created)`),
  list: db.prepare(`SELECT id, name, answers, created FROM plans WHERE chat_id = ? ORDER BY created DESC`),
  get: db.prepare(`SELECT id, chat_id, name, answers, created FROM plans WHERE id = ?`),
  delete: db.prepare(`DELETE FROM plans WHERE id = ? AND chat_id = ?`),
  count: db.prepare(`SELECT COUNT(*) c FROM plans WHERE chat_id = ? AND name = ?`),
};

const stmts = {
  upsert: db.prepare(`
    INSERT INTO subscribers (chat_id, answers, locale, subscribed, last_pushed, last_cuisines, streak, last_answers, last_feedback)
    VALUES (@chatId, @answers, @locale, @subscribed, NULL, '[]', 0, NULL, NULL)
    ON CONFLICT(chat_id) DO UPDATE SET
      answers = @answers,
      locale  = @locale
  `),
  setSubscribed: db.prepare(`UPDATE subscribers SET subscribed = @subscribed WHERE chat_id = @chatId`),
  setLastPushed: db.prepare(`UPDATE subscribers SET last_pushed = @lastPushed WHERE chat_id = @chatId`),
  setLocale: db.prepare(`UPDATE subscribers SET locale = @locale WHERE chat_id = @chatId`),
  bumpStreak: db.prepare(`UPDATE subscribers SET streak = streak + 1 WHERE chat_id = @chatId`),
  resetStreak: db.prepare(`UPDATE subscribers SET streak = 0 WHERE chat_id = @chatId`),
  setLastAnswers: db.prepare(`UPDATE subscribers SET last_answers = @lastAnswers WHERE chat_id = @chatId`),
  setLastCuisines: db.prepare(`UPDATE subscribers SET last_cuisines = @lastCuisines WHERE chat_id = @chatId`),
  setLastFeedback: db.prepare(`UPDATE subscribers SET last_feedback = @lastFeedback WHERE chat_id = @chatId`),
  setPushTime: db.prepare(`UPDATE subscribers SET push_hour = @hour, push_min = @min WHERE chat_id = @chatId`),
  get: db.prepare(`SELECT * FROM subscribers WHERE chat_id = ?`),
  all: db.prepare(`SELECT * FROM subscribers WHERE subscribed = 1`),
};

function rowToUser(row) {
  if (!row) return null;
  return {
    chatId: row.chat_id,
    answers: JSON.parse(row.answers),
    locale: row.locale,
    subscribed: !!row.subscribed,
    lastPushed: row.last_pushed,
    lastCuisines: JSON.parse(row.last_cuisines || '[]'),
    streak: row.streak ?? 0,
    lastAnswers: row.last_answers ? JSON.parse(row.last_answers) : null,
    lastFeedback: row.last_feedback,
    pushHour: row.push_hour,
    pushMin: row.push_min,
  };
}

export function saveUser(chatId, answers, locale = 'en') {
  stmts.upsert.run({
    chatId,
    answers: JSON.stringify(answers),
    locale,
    subscribed: 0,
  });
}

export function setSubscribed(chatId, subscribed) {
  return stmts.setSubscribed.run({ chatId, subscribed: subscribed ? 1 : 0 });
}

export function setLastPushed(chatId, dateStr) {
  return stmts.setLastPushed.run({ chatId, lastPushed: dateStr });
}

export function setLocale(chatId, locale) {
  return stmts.setLocale.run({ chatId, locale });
}

export function bumpStreak(chatId) {
  return stmts.bumpStreak.run({ chatId });
}

export function resetStreak(chatId) {
  return stmts.resetStreak.run({ chatId });
}

export function setLastAnswers(chatId, answers) {
  return stmts.setLastAnswers.run({ chatId, lastAnswers: JSON.stringify(answers) });
}

export function setLastCuisines(chatId, cuisines) {
  return stmts.setLastCuisines.run({ chatId, lastCuisines: JSON.stringify(cuisines) });
}

export function setLastFeedback(chatId, feedback) {
  return stmts.setLastFeedback.run({ chatId, lastFeedback: feedback });
}

export function setPushTime(chatId, hour, min) {
  return stmts.setPushTime.run({ chatId, hour, min });
}

export function getUser(chatId) {
  return rowToUser(stmts.get.get(chatId));
}

export function getSubscribedUsers() {
  return stmts.all.all().map(rowToUser);
}

// For onboarding when no row exists yet, create a stub so locale persists.
export function ensureUser(chatId, locale = 'en') {
  const existing = getUser(chatId);
  if (existing) return existing;
  db.prepare(`INSERT OR IGNORE INTO subscribers (chat_id, answers, locale) VALUES (?, ?, ?)`)
    .run(chatId, JSON.stringify({}), locale);
  return getUser(chatId);
}

// ────────────────────────────────────────────────────────────────────────────
// Saved plan presets
// ────────────────────────────────────────────────────────────────────────────
export function savePlan(chatId, name, answers) {
  const created = new Date().toISOString();
  const json = JSON.stringify(answers);
  // Upsert: if name exists for this user, replace answers.
  const existing = db.prepare(`SELECT id FROM plans WHERE chat_id = ? AND name = ?`).get(chatId, name);
  if (existing) {
    db.prepare(`UPDATE plans SET answers = ?, created = ? WHERE id = ?`).run(json, created, existing.id);
    return existing.id;
  }
  const r = planStmts.insert.run({ chatId, name, answers: json, created });
  return r.lastInsertRowid;
}

export function getPlans(chatId) {
  return planStmts.list.all(chatId).map((r) => ({
    id: r.id,
    name: r.name,
    answers: JSON.parse(r.answers),
    created: r.created,
  }));
}

export function getPlan(planId) {
  const r = planStmts.get.get(planId);
  if (!r) return null;
  return { id: r.id, name: r.name, answers: JSON.parse(r.answers), created: r.created, chatId: r.chat_id };
}

export function deletePlan(chatId, planId) {
  return planStmts.delete.run(planId, chatId).changes;
}
