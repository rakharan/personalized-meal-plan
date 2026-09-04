# Production Upgrade Plan — Meal Plan Bot

## Language Recommendation

Current: Node.js (JavaScript, ESM). 1,209 lines across 3 files.

**Recommended: TypeScript.** Same ecosystem, same deps (Telegraf, pg, Express all have first-class TS types), same runtime, zero performance cost. Adds compile-time type safety — critical for production. Migration is mechanical: `.js` → `.ts`, add types, fix compiler errors. No rewrite, no new framework.

Rejected alternatives:
- **Python** (asyncync + FastAPI + python-telegram-bot) — good LLM ecosystem but full rewrite, user's expertise is Node.js
- **Go** (pgx + telebot) — fast + low memory but verbose, thin LLM ecosystem, full rewrite

If TypeScript approved, Phase 1 adds: `typescript`, `tsx` (dev runner), `@types/node`, `@types/express`, `tsconfig.json`. All store/LLM functions get typed interfaces. Bot runs via `tsx src/index.ts` (dev) or `tsc` + `node dist/index.js` (prod).

**Decision: TypeScript.** Adopted.

---

## Phase 0 — Prerequisites

- [x] Verify PostgreSQL installed + running (`psql` available, port 5432)
- [x] Create database + user:
  ```sql
  CREATE DATABASE mealplan;
  CREATE USER mealplan WITH PASSWORD '***';
  GRANT ALL ON DATABASE mealplan TO mealplan;
  ```
- [x] Add env vars to `.env`:
  - `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE`
  - `ADMIN_TOKEN` (dashboard auth)
  - `DASHBOARD_PORT=3000`

---

## Phase 1 — Dependency Swap + TypeScript Setup

- [x] Install deps: `npm install pg express`
- [x] If TypeScript: `npm install -D typescript tsx @types/node @types/express @types/pg`
- [x] Remove `better-sqlite3`: `npm uninstall better-sqlite3`
- [x] If TypeScript: create `tsconfig.json` (target ES2022, module NodeNext, strict)
- [x] Rename `*.js` → `*.ts` under `src/` directory
- [x] Update `package.json` scripts:
  - `"dev": "tsx src/index.ts"`
  - `"build": "tsc"`
  - `"start": "node dist/index.js"`
  - `"dashboard": "tsx src/dashboard.ts"`
- [x] Update `.env.example` — add PG vars, `ADMIN_TOKEN`, `DASHBOARD_PORT`; remove `MEALPLAN_DB_PATH`
- [x] Update `.gitignore` — remove `mealplan.db*`; add `dist/`

---

## Phase 2 — PostgreSQL Store Rewrite (`store.ts`)

- [x] Create PG connection pool (`pg.Pool`, 10 max connections, 30s idle timeout)
- [x] Pool error handler (log + process exit on fatal)
- [x] Auto-migrate schema on startup:
  - `subscribers` table (PG types: `BIGINT`, `TEXT`, `INTEGER`, `TIMESTAMPTZ`)
  - `plans` table
  - `CREATE TABLE IF NOT EXISTS` (idempotent)
  - `CREATE INDEX` on `subscribers(subscribed)`, `plans(chat_id)`
- [x] Rewrite all exports as async:

| Function | PG Query |
|----------|----------|
| `saveUser` | `INSERT ... ON CONFLICT (chat_id) DO UPDATE` |
| `getUser` | `SELECT ... WHERE chat_id = $1` |
| `ensureUser` | `INSERT ... ON CONFLICT DO NOTHING` + `SELECT` |
| `setSubscribed` | `UPDATE ... SET subscribed = $1` |
| `getSubscribedUsers` | `SELECT ... WHERE subscribed = true` |
| `setLastPushed` | `UPDATE ... SET last_pushed = $1` |
| `setLocale` | `UPDATE ... SET locale = $1` |
| `bumpStreak` | `UPDATE ... SET streak = streak + 1` |
| `resetStreak` | `UPDATE ... SET streak = 0` |
| `setLastAnswers` | `UPDATE ... SET last_answers = $1` |
| `setLastCuisines` | `UPDATE ... SET last_cuisines = $1` |
| `setLastFeedback` | `UPDATE ... SET last_feedback = $1` |
| `setPushTime` | `UPDATE ... SET push_hour = $1, push_min = $2` |
| `savePlan` | `INSERT ... ON CONFLICT (chat_id, name) DO UPDATE` |
| `getPlans` | `SELECT ... ORDER BY created DESC` |
| `getPlan` | `SELECT ... WHERE id = $1` |
| `deletePlan` | `DELETE ... WHERE id = $1 AND chat_id = $2` |

- [x] Add `closePool()` export (graceful shutdown)
- [x] If TypeScript: define `User`, `Plan`, `Answers` interfaces
- [x] **Bonus:** PG-backed session store (`pgSessionStore`), rate limiting (`checkRateLimit`, `incrementPlanCount`), usage tracking (`logUsage`, `getUsageStats`), tier management (`setTier`), referrals (`createReferral`, `getReferralCount`, `getReferrals`)

---

## Phase 3 — Bot Update (`index.ts`)

- [x] Update imports from new async store
- [x] Add `await` to every store call:
  - Command handlers (`/subscribe`, `/settime`, `/lang`, `/plans`, `/save`, etc.)
  - Callback query handlers (all `action_*`, `ans_*`, `plan_*`, `settime_*`, `lang_*`)
  - `generateAndSend`
  - `pushDailyPlans` scheduler
  - Text input handlers (`awaitingTime`, `awaitingPlanName`, `awaitingFreeText`, `editingField`)
- [x] Graceful shutdown: SIGINT/SIGTERM → `bot.stop()` + `closePool()`
- [x] If TypeScript: type `ctx.session`, `answers`, callback data union types
- [x] **Bonus — Feature wiring (Sep 2026):**
  - PG session store (async, `delete`→`reset` mapped)
  - Rate limiting (`checkRateLimit` + `incrementPlanCount` in `generateAndSend`)
  - Input validation (`sanitizeText`, `validateCalories`, `validateProtein`, `validateTimeFormat`, `validatePlanName`)
  - `/weekly` command (7-day plan via `generateWeeklyPlan`)
  - `/invite` command + `/start ref_` parsing (`createReferral`, `getReferralCount`)
  - Delivery adapters (`createDeliveryManager` at startup, `deliverPlan` in `pushDailyPlans`)
  - Onboarding polish (first-time detection in `bot.start`)
  - `setMyCommands` updated with `/weekly` + `/invite`
  - `setLastFeedback` bug fix (removed reset-on-generate)

---

## Phase 4 — Data Migration Script (`migrate-sqlite-to-pg.ts`)

- [x] Temporarily reinstall `better-sqlite3` (or use existing `mealplan.db` before uninstall)
- [x] Read existing `mealplan.db`:
  - All subscriber rows → PG INSERT
  - All plan rows → PG INSERT
- [x] Verify row counts match (SQLite count == PG count)
- [x] Print summary (subscribers migrated, plans migrated)
- [x] Run: `tsx src/migrate-sqlite-to-pg.ts`
- [x] Verify data in PG via `psql`

---

## Phase 5 — Admin Dashboard (`dashboard.ts`)

- [x] Express server on `DASHBOARD_PORT` (default 3000)
- [x] Auth middleware: bearer token via `ADMIN_TOKEN`, cookie-based session
- [x] Login page (`/login`) → token input form → set cookie
- [x] Logout (`/logout`) → clear cookie
- [x] Shared PG pool from `store.ts`
- [x] Routes:

| Route | Method | Content |
|-------|--------|---------|
| `/login` | GET/POST | Token input form, set cookie |
| `/logout` | GET | Clear cookie |
| `/` | GET | Overview stats dashboard |
| `/users` | GET | User table (id, locale, subscribed, streak, last active) |
| `/plans` | GET | Saved plan presets per user |
| `/feedback` | GET | Feedback log + good/bad ratio |
| `/api/stats` | GET | JSON stats for AJAX refresh |
| `/usage` | GET | Token usage log + totals |
| `/referrals` | GET | Referral table |

- [x] Stats queries:

| Stat | Query |
|------|-------|
| Total users | `SELECT COUNT(*) FROM subscribers` |
| Active subscribers | `SELECT COUNT(*) WHERE subscribed = true` |
| Plans pushed today | `SELECT COUNT(*) WHERE last_pushed = CURRENT_DATE` |
| Avg streak | `SELECT AVG(streak) FROM subscribers` |
| Longest streak | `SELECT MAX(streak) FROM subscribers` |
| Feedback ratio | `SELECT last_feedback, COUNT(*) GROUP BY` |
| Locale distribution | `SELECT locale, COUNT(*) GROUP BY` |
| Push time distribution | `SELECT push_hour, push_min, COUNT(*) GROUP BY` |
| 7d retention | `SELECT COUNT(*) WHERE last_pushed >= NOW() - INTERVAL '7 days'` |
| Saved plans count | `SELECT COUNT(*) FROM plans` |
| Tier distribution | `SELECT tier, COUNT(*) GROUP BY` |
| Referrals count | `SELECT COUNT(*) FROM referrals` |
| Tokens today | `SELECT COALESCE(SUM(tokens),0) FROM usage_log WHERE created >= CURRENT_DATE` |

- [x] UI: server-rendered HTML, dark theme (CSS variables), meta refresh 60s, responsive, no frontend framework

---

## Phase 6 — PM2 Config (`ecosystem.config.cjs`)

- [x] Two apps:
  - `hermes-mealplan-bot` — `tsx src/index.ts` (dev) or `node dist/index.js` (prod)
  - `hermes-mealplan-dashboard` — `tsx src/dashboard.ts` or `node dist/dashboard.js`
- [x] Both load `.env`
- [x] Auto-restart on crash

---

## Phase 7 — Testing + Verification

- [ ] Syntax check / type check: `tsc --noEmit` (TS) or `node --check` (JS)
- [ ] Test PG connection: query existing user from DB
- [ ] Run migration script, verify row counts
- [ ] Restart bot via PM2, verify both processes online
- [ ] Test bot end-to-end:
  - `/mealplan` → generate → verify data in PG
  - `/subscribe` → verify `subscribed = true`
  - `/settime` → verify `push_hour/min`
  - `/save` → verify plan in PG
  - `/plans` → verify load + delete
- [ ] Test dashboard:
  - Open `http://localhost:3000/login`
  - Enter `ADMIN_TOKEN`
  - Verify stats page loads
  - Verify user/plan/feedback tables show data
- [ ] Test graceful shutdown: `pm2 stop` → clean exit, no DB corruption → restart → data intact
- [ ] Test scheduled push fires at configured time

---

## Summary

| Phase | Items | Files | New? | Status |
|-------|-------|-------|------|--------|
| 0 — Prereqs | PostgreSQL install + DB creation | `.env` | No | ✅ Done |
| 1 — Deps + TS | Install pg/express, optional TS setup | `package.json`, `tsconfig.json`, `.env.example`, `.gitignore` | `tsconfig.json` new | ✅ Done |
| 2 — Store | Full rewrite SQLite → PG async | `src/store.ts` | Renamed | ✅ Done |
| 3 — Bot | `await` all store calls, graceful shutdown | `src/index.ts` | Renamed | ✅ Done |
| 4 — Migration | One-time data migration | `src/migrate-sqlite-to-pg.ts` | New | ✅ Done |
| 5 — Dashboard | Express admin server | `src/dashboard.ts` | New | ✅ Done |
| 6 — PM2 | Two-process config | `ecosystem.config.cjs` | No | ✅ Done |
| 7 — Test | Full end-to-end verification | — | — | 🔄 In progress |

**7 phases, 27 steps, 6 files touched, 3 new files.** Phases 0-6 complete. Phase 7 in progress.

---

## Open Decision

**Stay JavaScript or migrate to TypeScript?**

TypeScript adds ~15% time to Phase 1-3 but gives compile-time safety for production. Recommend TS for commercialization. If JS chosen, skip tsconfig/tsx, keep `.js` extensions, proceed same plan without type annotations.

**Decision: TypeScript.** Adopted.
