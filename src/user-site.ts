import 'dotenv/config';
import express from 'express';
import { pool, migrateSchema, getUser, getPlans, getPlan } from './store.js';
import type { Request, Response } from 'express';
import type { User, Plan } from './store.js';

const PORT = Number(process.env.USER_SITE_PORT ?? 3001);

const app = express();
app.use(express.urlencoded({ extended: true }));

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const [k, ...v] = pair.trim().split('=');
    if (k) out[k] = decodeURIComponent(v.join('='));
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// User resolution — ?uid=<chat_id> or cookie
// ────────────────────────────────────────────────────────────────────────────
async function resolveUser(req: Request): Promise<User | null> {
  const uid = req.query.uid as string || parseCookies(req).uid;
  if (!uid) return null;
  return getUser(Number(uid));
}

// ────────────────────────────────────────────────────────────────────────────
// Landing — redirect to meals or show uid prompt
// ────────────────────────────────────────────────────────────────────────────
app.get('/', async (req: Request, res: Response) => {
  const user = await resolveUser(req);
  if (user) { res.redirect('/meals?uid=' + user.chatId); return; }
  res.send(renderPage('Welcome', `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-icon">🍱</div>
        <h1 style="font-size:1.5rem;margin-bottom:4px">MealPlan</h1>
        <p class="login-sub">Enter your chat ID to view your plans</p>
        <form method="GET" action="/meals">
          <input type="text" name="uid" placeholder="Your Chat ID" autofocus />
          <button type="submit">Continue →</button>
        </form>
      </div>
    </div>
  `));
});

// ────────────────────────────────────────────────────────────────────────────
// Meals — today's plan + saved plans
// ────────────────────────────────────────────────────────────────────────────
app.get('/meals', async (req: Request, res: Response) => {
  const user = await resolveUser(req);
  if (!user) { res.redirect('/'); return; }
  res.setHeader('Set-Cookie', `uid=${user.chatId}; Path=/; Max-Age=86400; SameSite=Lax`);

  const plans = await getPlans(user.chatId);
  const lastPlan = plans.length > 0 ? plans[0] : null;
  const lastAnswers = user.lastAnswers || user.answers;

  // Build meal cards from lastAnswers (stored plan content)
  const mealCards = lastAnswers && (lastAnswers as any).meals
    ? renderMealCards((lastAnswers as any).meals)
    : lastAnswers && (lastAnswers as any).plan
      ? `<div class="meal" style="white-space:pre-wrap;line-height:1.6">${escapeHtml((lastAnswers as any).plan)}</div>`
      : '<p class="empty">No meal plan generated yet. Use the bot to create one! 🍽️</p>';

  // 7-day date strip
  const today = new Date();
  const dateStrip = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - today.getDay() + i);
    const isToday = d.toDateString() === today.toDateString();
    const dayName = d.toLocaleDateString('en', { weekday: 'short' });
    const dayNum = d.getDate();
    return `<div class="date-chip ${isToday ? 'active' : ''}"><span class="day-name">${dayName}</span><span class="day-num">${dayNum}</span></div>`;
  }).join('');

  res.send(renderPage('Meals', `
    <div class="date-strip">${dateStrip}</div>
    <div class="meals">
      ${mealCards}
    </div>
    <div class="section-head">
      <h3>Saved Plans</h3>
    </div>
    ${plans.length > 0
      ? `<div class="plan-list">${plans.map((p: Plan) => `
          <a href="/plan/${p.id}?uid=${user.chatId}" class="plan-item">
            <span class="plan-name">${escapeHtml(p.name)}</span>
            <span class="plan-date">${new Date(p.created).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
          </a>`).join('')}</div>`
      : '<p class="empty">No saved plans yet</p>'
    }
  `, user));
});

// ────────────────────────────────────────────────────────────────────────────
// Plan detail
// ────────────────────────────────────────────────────────────────────────────
app.get('/plan/:id', async (req: Request, res: Response) => {
  const user = await resolveUser(req);
  if (!user) { res.redirect('/'); return; }

  const planId = Number(req.params.id);
  const plan = await getPlan(planId);
  if (!plan || plan.chatId !== user.chatId) {
    res.send(renderPage('Not Found', '<p class="empty">Plan not found</p>', user));
    return;
  }

  const answers = plan.answers as any;
  const content = answers.meals
    ? renderMealCards(answers.meals)
    : answers.plan
      ? `<div class="meal" style="white-space:pre-wrap;line-height:1.6">${escapeHtml(answers.plan)}</div>`
      : '<p class="empty">Empty plan</p>';

  res.send(renderPage(escapeHtml(plan.name), `
    <div class="meals">${content}</div>
    <div class="plan-meta">
      <span>📅 ${new Date(plan.created).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}</span>
      ${answers.goal ? `<span>🎯 ${escapeHtml(answers.goal)}</span>` : ''}
      ${answers.calories ? `<span>🔥 ${escapeHtml(answers.calories)} cal</span>` : ''}
      ${answers.cuisine ? `<span>🍜 ${escapeHtml(answers.cuisine)}</span>` : ''}
    </div>
  `, user));
});

// ────────────────────────────────────────────────────────────────────────────
// Streak
// ────────────────────────────────────────────────────────────────────────────
app.get('/streak', async (req: Request, res: Response) => {
  const user = await resolveUser(req);
  if (!user) { res.redirect('/'); return; }

  // Get usage history for last 7 days
  const usageRows = await pool.query(
    "SELECT date(created) as day, SUM(tokens)::int as tokens, COUNT(*)::int as calls FROM usage_log WHERE chat_id = $1 AND created >= NOW() - INTERVAL '7 days' GROUP BY date(created) ORDER BY day DESC",
    [user.chatId]
  );

  const usageBars = usageRows.rows.length > 0
    ? usageRows.rows.map((r: any) => {
        const max = Math.max(...usageRows.rows.map((x: any) => Number(x.tokens) || 0), 1);
        const pct = Math.round(((Number(r.tokens) || 0) / max) * 100);
        return `<div class="bar-row"><span class="lbl">${r.day}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><span class="val">${r.tokens || 0}</span></div>`;
      }).join('')
    : '<p class="empty">No usage this week</p>';

  res.send(renderPage('Streak', `
    <div class="streak-hero">
      <div class="streak-num" style="--ring-deg:${Math.round(Math.min(user.streak / 7, 1) * 360)}">${user.streak}</div>
      <div class="streak-label">🔥 Day Streak</div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-num">${user.lastPushed || '—'}</div><div class="stat-label">Last Pushed</div></div>
      <div class="stat-card"><div class="stat-num">${user.subscribed ? '✅' : '❌'}</div><div class="stat-label">Subscribed</div></div>
      <div class="stat-card"><div class="stat-num">${user.tier}</div><div class="stat-label">Tier</div></div>
    </div>
    <h3>This Week's Usage</h3>
    <div class="bars">${usageBars}</div>
  `, user));
});

// ────────────────────────────────────────────────────────────────────────────
// Settings
// ────────────────────────────────────────────────────────────────────────────
app.get('/settings', async (req: Request, res: Response) => {
  const user = await resolveUser(req);
  if (!user) { res.redirect('/'); return; }

  const a = user.answers;
  const pushTime = user.pushHour !== null
    ? `${String(user.pushHour).padStart(2, '0')}:${String(user.pushMin ?? 0).padStart(2, '0')}`
    : '08:00 (default)';

  res.send(renderPage('Settings', `
    <div class="settings-list">
      <div class="setting-row"><span class="lbl">🎯 Goal</span><span class="val">${a.goal || '—'}</span></div>
      <div class="setting-row"><span class="lbl">🥗 Restrictions</span><span class="val">${a.restrictions || 'None'}</span></div>
      <div class="setting-row"><span class="lbl">⚠️ Allergies</span><span class="val">${a.allergies || 'None'}</span></div>
      <div class="setting-row"><span class="lbl">🔥 Calories</span><span class="val">${a.calories || 'Auto'}</span></div>
      <div class="setting-row"><span class="lbl">🍽️ Meals/Day</span><span class="val">${a.mealsPerDay || '3'}</span></div>
      <div class="setting-row"><span class="lbl">🥩 Protein</span><span class="val">${a.protein || 'Auto'}</span></div>
      <div class="setting-row"><span class="lbl">🍜 Cuisine</span><span class="val">${a.cuisine || 'Rotate'}</span></div>
      <div class="setting-row"><span class="lbl">⏰ Push Time</span><span class="val">${pushTime}</span></div>
      <div class="setting-row"><span class="lbl">🌐 Language</span><span class="val">${user.locale === 'id' ? 'Bahasa Indonesia' : 'English'}</span></div>
      <div class="setting-row"><span class="lbl">📋 Plans Today</span><span class="val">${user.dailyPlanCount}</span></div>
      <div class="setting-row"><span class="lbl">📅 Joined</span><span class="val">${new Date(user.createdAt).toLocaleDateString('en', { dateStyle: 'medium' })}</span></div>
    </div>
    <p class="hint">💡 Update settings via the Telegram bot</p>
  `, user));
});

// ────────────────────────────────────────────────────────────────────────────
// Profile — referrals + account
// ────────────────────────────────────────────────────────────────────────────
app.get('/profile', async (req: Request, res: Response) => {
  const user = await resolveUser(req);
  if (!user) { res.redirect('/'); return; }

  const refCount = await pool.query('SELECT COUNT(*)::int FROM referrals WHERE referrer_id = $1', [user.chatId]);
  const totalRef = refCount.rows[0].count;

  const botUsername = process.env.BOT_USERNAME || 'mealplan_bot';
  const refLink = `https://t.me/${botUsername}?start=ref_${user.chatId}`;

  res.send(renderPage('Profile', `
    <div class="profile-head">
      <div class="avatar">${(user.locale === 'id' ? 'ID' : 'EN')}</div>
      <div class="profile-info">
        <div class="profile-name">User #${user.chatId}</div>
        <div class="profile-tier">${user.tier === 'premium' ? '⭐ Premium' : '🆓 Free'}</div>
      </div>
    </div>

    <h3>Referrals</h3>
    <div class="ref-card">
      <div class="stat-num">${totalRef}</div>
      <div class="stat-label">Friends Referred</div>
      <div class="ref-link-wrap">
        <input type="text" readonly value="${refLink}" class="ref-link" onclick="this.select()" />
        <button onclick="navigator.clipboard?.writeText('${refLink}'); this.textContent='✓'">Copy</button>
      </div>
    </div>

    <h3>Account</h3>
    <div class="settings-list">
      <div class="setting-row"><span class="lbl">💬 Chat ID</span><span class="val">${user.chatId}</span></div>
      <div class="setting-row"><span class="lbl">📅 Joined</span><span class="val">${new Date(user.createdAt).toLocaleDateString('en', { dateStyle: 'medium' })}</span></div>
      <div class="setting-row"><span class="lbl">🌐 Language</span><span class="val">${user.locale === 'id' ? 'Bahasa Indonesia' : 'English'}</span></div>
      ${user.referredBy ? `<div class="setting-row"><span class="lbl">👥 Referred by</span><span class="val">#${user.referredBy}</span></div>` : ''}
    </div>
  `, user));
});

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMealCards(meals: any): string {
  if (!Array.isArray(meals)) return '<p class="empty reveal">🍱 No meals data yet — generate a plan via the bot to see your meals here.</p>';
  const mealVar: Record<string, string> = {
    breakfast: 'var(--c-breakfast)',
    lunch: 'var(--c-lunch)',
    dinner: 'var(--c-dinner)',
    snack: 'var(--c-snack)',
  };
  return meals.map((m: any) => {
    const type = (m.type || m.mealType || '').toLowerCase();
    const color = mealVar[type] || 'var(--c-snack)';
    const typeLabel = escapeHtml(m.type || m.mealType || 'Meal');
    const title = m.title || m.name || m.meal || 'Meal';
    const cal = m.calories || m.cal || '';
    const protein = m.protein || '';
    const items = m.items || m.foods || m.ingredients || [];
    const itemsHtml = Array.isArray(items) && items.length
      ? items.map((i: any) => `<li>${typeof i === 'string' ? escapeHtml(i) : escapeHtml(i.name || i.item || '')}</li>`).join('')
      : '';
    return `<div class="meal reveal" style="--meal-c:${color}">
      <div class="meal-head">
        <span class="meal-type">${typeLabel}</span>
        <div class="meal-badges">
          ${cal ? `<span class="pill">🔥 ${escapeHtml(String(cal))} cal</span>` : ''}
          ${protein ? `<span class="pill">🥩 ${escapeHtml(String(protein))}</span>` : ''}
        </div>
      </div>
      <div class="meal-title">${escapeHtml(title)}</div>
      ${itemsHtml ? `<ul class="meal-items">${itemsHtml}</ul>` : ''}
    </div>`;
  }).join('');
}

// ────────────────────────────────────────────────────────────────────────────────
// HTML template — Warm Kitchen theme, mobile-first monitor surface
// ────────────────────────────────────────────────────────────────────────────────
function renderPage(title: string, body: string, user?: User | null): string {
  const uid = user?.chatId;
  const nav = user ? `
    <nav class="tabbar">
      <a href="/meals?uid=${uid}" class="${title === 'Meals' ? 'active' : ''}"><span class="icon">🍴</span><span class="tab-label">Meals</span></a>
      <a href="/streak?uid=${uid}" class="${title === 'Streak' ? 'active' : ''}"><span class="icon">🔥</span><span class="tab-label">Streak</span></a>
      <a href="/settings?uid=${uid}" class="${title === 'Settings' ? 'active' : ''}"><span class="icon">⚙️</span><span class="tab-label">Settings</span></a>
      <a href="/profile?uid=${uid}" class="${title === 'Profile' ? 'active' : ''}"><span class="icon">👤</span><span class="tab-label">Profile</span></a>
    </nav>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#1a1612" media="(prefers-color-scheme: dark)">
  <meta name="theme-color" content="#FDF8F3" media="(prefers-color-scheme: light)">
  <title>${title} — MealPlan</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;510;590;600&display=swap" rel="stylesheet">
  <style>
    @layer reset, tokens, base, components, motion;
    @layer reset {
      *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
      html { -webkit-text-size-adjust: 100%; }
    }
    @layer tokens {
      :root {
        --bg: #08090a;
        --surface: #0f1011;
        --surface2: #191a1b;
        --surface3: #28282c;
        --fg: #f7f8f8;
        --fg2: #d0d6e0;
        --fg3: #8a8f98;
        --fg4: #62666d;
        --accent: #5e6ad2;
        --accent-hi: #7170ff;
        --accent-hover: #828fff;
        --accent-soft: rgba(94,106,210,0.12);
        --green: #27a644;
        --red: #e5484d;
        --border: rgba(255,255,255,0.05);
        --border2: rgba(255,255,255,0.08);
        --c-breakfast: oklch(0.72 0.12 60);
        --c-lunch: oklch(0.70 0.13 145);
        --c-dinner: oklch(0.55 0.16 280);
        --c-snack: oklch(0.75 0.08 250);
        --radius: 8px;
        --radius-sm: 6px;
        --radius-lg: 12px;
        --space: clamp(16px, 4vw, 22px);
        --max-w: 480px;
        --shadow: 0 0 0 1px var(--border);
        --shadow-lg: 0 0 0 1px var(--border2), 0 4px 12px rgba(0,0,0,0.3);
        --lift: 0 0 0 1px var(--border2), 0 4px 12px rgba(0,0,0,0.2);
      }
      @media (prefers-color-scheme: light) {
        :root {
          --bg: #f7f8f8;
          --surface: #ffffff;
          --surface2: #f3f4f5;
          --surface3: #e6e6e6;
          --fg: #1a1a2e;
          --fg2: #3c4150;
          --fg3: #6b7280;
          --fg4: #9ca3af;
          --accent-hi: #4a55b8;
          --accent-soft: rgba(94,106,210,0.08);
          --border: rgba(0,0,0,0.06);
          --border2: rgba(0,0,0,0.10);
          --shadow-lg: 0 0 0 1px var(--border2), 0 4px 16px rgba(0,0,0,0.06);
          --lift: 0 0 0 1px var(--border2), 0 4px 16px rgba(0,0,0,0.04);
        }
      }
    }
    @layer base {
      body {
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 15px;
        line-height: 1.5;
        background: var(--bg);
        color: var(--fg);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-wrap: pretty;
        font-feature-settings: "cv01", "ss03";
        padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
      }
      h1 { font-size: 24px; font-weight: 510; letter-spacing: -0.288px; margin-bottom: 20px; }
      h3 { font-size: 13px; font-weight: 510; color: var(--fg3); letter-spacing: -0.13px; margin: 24px 0 12px; }
      a { color: var(--accent-hi); text-decoration: none; }
      ::selection { background: var(--accent-soft); }
      input, select, textarea, button { font-size: 16px; font-family: inherit; }
    }
    @layer components {
      .app { max-width: var(--max-w); margin: 0 auto; padding: var(--space); min-height: 100dvh; }

      /* Stats */
      .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; margin-bottom: 20px; }
      .stat-card { background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
      .stat-num { font-size: 24px; font-weight: 510; letter-spacing: -0.24px; font-variant-numeric: tabular-nums; color: var(--fg); line-height: 1.2; }
      .stat-label { font-size: 12px; font-weight: 510; color: var(--fg3); margin-top: 4px; }

      /* Date strip */
      .date-strip { display: flex; gap: 6px; overflow-x: auto; scroll-snap-type: x mandatory; margin-bottom: 24px; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 2px; }
      .date-strip::-webkit-scrollbar { display: none; }
      .date-chip { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 0 0 48px; height: 56px; border-radius: var(--radius-sm); background: rgba(255,255,255,0.02); border: 1px solid var(--border); scroll-snap-align: start; cursor: pointer; transition: background .15s, border-color .15s, transform .12s; }
      .date-chip:active { transform: scale(0.96); }
      .date-chip.active { background: var(--accent-soft); border-color: var(--accent); }
      .date-chip .day-name { font-size: 11px; font-weight: 510; color: var(--fg3); }
      .date-chip .day-num { font-size: 17px; font-weight: 510; font-variant-numeric: tabular-nums; letter-spacing: -0.165px; }
      .date-chip.active .day-name { color: var(--accent-hi); }
      .date-chip.active .day-num { color: var(--fg); }

      /* Meals */
      .meals { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
      .meal { background: rgba(255,255,255,0.02); border: 1px solid var(--border2); border-left: 3px solid var(--meal-c, var(--accent)); border-radius: var(--radius); padding: 14px 16px; transition: transform .15s, background .15s; }
      .meal:hover { background: rgba(255,255,255,0.04); }
      .meal:active { transform: scale(0.98); }
      .meal-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; }
      .meal-type { font-size: 11px; font-weight: 590; text-transform: uppercase; letter-spacing: 0.05em; color: var(--meal-c, var(--accent-hi)); }
      .meal-badges { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
      .pill { font-size: 11px; font-weight: 510; color: var(--fg2); background: rgba(255,255,255,0.04); padding: 2px 10px 2px 5px; border-radius: 9999px; border: 1px solid var(--border); font-variant-numeric: tabular-nums; white-space: nowrap; }
      .meal-title { font-size: 16px; font-weight: 510; color: var(--fg); letter-spacing: -0.165px; margin-bottom: 8px; }
      .meal-items { list-style: none; padding: 0; margin: 0; }
      .meal-items li { font-size: 14px; font-weight: 400; color: var(--fg2); padding: 3px 0; letter-spacing: -0.165px; }
      .meal-items li::before { content: '·'; margin-right: 6px; color: var(--fg4); }

      /* Plan list */
      .plan-list { display: flex; flex-direction: column; gap: 6px; }
      .plan-item { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 14px; transition: background .15s, transform .12s; }
      .plan-item:active { transform: scale(0.98); }
      .plan-item:hover { background: rgba(255,255,255,0.04); }
      .plan-name { font-size: 14px; font-weight: 510; color: var(--fg2); }
      .plan-date { font-size: 12px; font-weight: 400; color: var(--fg4); font-variant-numeric: tabular-nums; }
      .plan-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
      .plan-meta span { font-size: 12px; font-weight: 510; color: var(--fg2); background: rgba(255,255,255,0.04); padding: 2px 10px 2px 5px; border-radius: 9999px; border: 1px solid var(--border); }
      .section-head h3 { margin-top: 28px; }

      /* Streak hero */
      .streak-hero { text-align: center; padding: 28px 0 24px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); margin-bottom: 20px; }
      .streak-num {
        --ring-deg: 0;
        position: relative;
        width: 168px; height: 168px;
        margin: 0 auto 10px;
        display: grid; place-items: center;
        font-size: clamp(2.5rem, 2rem + 2vw, 3.5rem);
        font-weight: 510; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; line-height: 1; color: var(--fg);
      }
      .streak-num::before {
        content: ''; position: absolute; inset: 0; border-radius: 50%;
        background: conic-gradient(var(--accent) calc(var(--ring-deg) * 1deg), var(--surface3) 0);
        -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 11px), #000 calc(100% - 11px));
                mask: radial-gradient(farthest-side, transparent calc(100% - 11px), #000 calc(100% - 11px));
        z-index: 0;
      }
      .streak-label { font-size: 13px; font-weight: 510; color: var(--fg3); margin-top: 6px; }

      /* Bars */
      .bars { display: flex; flex-direction: column; gap: 0; margin-bottom: 20px; }
      .bar-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
      .bar-row:last-child { border-bottom: none; }
      .bar-row .lbl { color: var(--fg3); font-size: 12px; min-width: 86px; font-variant-numeric: tabular-nums; }
      .bar-track { flex: 1; height: 6px; background: var(--surface3); border-radius: 3px; overflow: hidden; }
      .bar-fill { height: 100%; background: var(--accent); border-radius: 3px; transition: width .3s cubic-bezier(0.2,0,0,1); }
      .bar-row .val { font-weight: 510; color: var(--fg); font-variant-numeric: tabular-nums; min-width: 44px; text-align: right; }

      /* Settings */
      .settings-list { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; margin-bottom: 16px; }
      .setting-row { display: flex; justify-content: space-between; align-items: center; padding: 13px 16px; border-bottom: 1px solid var(--border); font-size: 14px; }
      .setting-row:last-child { border-bottom: none; }
      .setting-row .lbl { color: var(--fg2); }
      .setting-row .val { color: var(--fg); font-weight: 510; max-width: 60%; text-align: right; font-variant-numeric: tabular-nums; }
      .hint { font-size: 13px; font-weight: 510; color: var(--fg4); text-align: center; margin-top: 10px; }

      /* Profile */
      .profile-head { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
      .avatar { width: 56px; height: 56px; border-radius: 50%; background: var(--accent-soft); display: flex; align-items: center; justify-content: center; font-weight: 590; color: var(--accent-hi); font-size: 16px; letter-spacing: 0.02em; }
      .profile-info { display: flex; flex-direction: column; gap: 2px; }
      .profile-name { font-weight: 510; font-size: 16px; color: var(--fg); letter-spacing: -0.165px; }
      .profile-tier { font-size: 13px; font-weight: 400; color: var(--fg3); }
      .ref-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px; text-align: center; margin-bottom: 20px; }
      .ref-card .stat-num { font-size: 2.5rem; color: var(--accent-hi); }
      .ref-card .stat-label { font-size: 11px; }
      .ref-link-wrap { display: flex; gap: 8px; margin-top: 16px; }
      .ref-link { flex: 1; min-width: 0; padding: 10px 14px; border-radius: var(--radius-sm); background: rgba(255,255,255,0.04); border: 1px solid var(--border2); color: var(--fg2); font-size: 13px; font-family: inherit; transition: border-color .15s; }
      .ref-link:focus { outline: none; border-color: var(--accent); }
      .ref-link-wrap button { padding: 10px 16px; border-radius: var(--radius-sm); background: var(--accent); color: #fff; border: none; font-size: 13px; font-weight: 510; font-family: inherit; cursor: pointer; transition: background .15s, transform .12s; }
      .ref-link-wrap button:hover { background: var(--accent-hover); }
      .ref-link-wrap button:active { transform: scale(0.96); }

      /* Empty state */
      .empty { text-align: center; color: var(--fg4); padding: 32px 16px; font-size: 14px; line-height: 1.5; }

      /* Login */
      .login-wrap { display: flex; align-items: center; justify-content: center; min-height: 100dvh; padding: 0 16px; }
      .login-card { background: var(--surface); border: 1px solid var(--border2); border-radius: var(--radius-lg); padding: 36px 28px; box-shadow: var(--shadow-lg); width: 100%; max-width: 360px; text-align: center; }
      .login-icon { font-size: 2.5rem; margin-bottom: 10px; }
      .login-sub { color: var(--fg3); font-size: 13px; margin-bottom: 22px; }
      .login-card input { width: 100%; padding: 12px 14px; border-radius: var(--radius-sm); background: rgba(255,255,255,0.04); border: 1px solid var(--border2); color: var(--fg); font-size: 16px; font-family: inherit; margin-bottom: 12px; transition: border-color .15s; }
      .login-card input:focus { outline: none; border-color: var(--accent); }
      .login-card button { width: 100%; padding: 12px 16px; border-radius: var(--radius-sm); background: var(--accent); color: #fff; border: none; font-size: 14px; font-weight: 510; font-family: inherit; cursor: pointer; transition: background .15s, transform .12s; }
      .login-card button:hover { background: var(--accent-hover); }
      .login-card button:active { transform: scale(0.96); }

      /* Bottom tab bar */
      .tabbar {
        position: fixed; bottom: 0; left: 0; right: 0;
        height: calc(56px + env(safe-area-inset-bottom, 0px));
        background: color-mix(in oklab, var(--surface) 88%, transparent);
        backdrop-filter: blur(12px) saturate(140%);
        -webkit-backdrop-filter: blur(12px) saturate(140%);
        border-top: 1px solid var(--border);
        display: flex;
        z-index: 100;
        max-width: var(--max-w);
        margin: 0 auto;
        padding-bottom: env(safe-area-inset-bottom, 0px);
      }
      .tabbar a {
        flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 3px; font-size: 10px; font-weight: 510; color: var(--fg4);
        text-decoration: none; transition: color .15s;
        min-height: 48px;
      }
      .tabbar a .icon { font-size: 18px; }
      .tabbar a.active { color: var(--accent-hi); }
      .tabbar a:active { transform: scale(0.95); }

      /* Desktop: sidebar */
      @media (min-width: 768px) {
        .tabbar {
          flex-direction: column;
          top: 0; bottom: 0;
          left: 0; right: auto;
          height: 100vh;
          width: 200px;
          border-top: none;
          border-right: 1px solid var(--border);
          padding: 24px 0;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
          background: var(--surface);
          max-width: 200px;
        }
        .tabbar a { flex-direction: row; justify-content: flex-start; gap: 12px; padding: 10px 20px; font-size: 14px; border-left: 2px solid transparent; min-height: 44px; }
        .tabbar a .icon { font-size: 16px; width: 20px; }
        .tabbar a.active { background: var(--accent-soft); border-left-color: var(--accent); color: var(--accent-hi); }
        .app { margin-left: 200px; padding: 36px 40px; max-width: 600px; }
        body { padding-bottom: 0; }
      }
    }
    @layer motion {
      .reveal { opacity: 0; transform: translateY(8px); transition: opacity .3s ease-out, transform .3s ease-out; }
      .reveal.in { opacity: 1; transform: none; }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; scroll-behavior: auto !important; }
        .reveal { opacity: 1; transform: none; }
      }
    }
  </style>
</head>
<body>
  <div class="app">
    ${user ? `<h1>${title}</h1>` : ''}
    ${body}
  </div>
  ${nav}
  <script>
  (function(){
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var reveals = document.querySelectorAll('.reveal');
    if (reduce || !('IntersectionObserver' in window)) {
      for (var i = 0; i < reveals.length; i++) reveals[i].classList.add('in');
    } else {
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { threshold: 0.08, rootMargin: '0px 0px -8px 0px' });
      reveals.forEach(function(el){ io.observe(el); });
    }
  })();
  </script>
</body>
</html>`;
}

// ────────────────────────────────────────────────────────────────────────────────
// Startup
// ────────────────────────────────────────────────────────────────────────────────
async function main() {
  await migrateSchema();
  app.listen(PORT, () => {
    console.log(`User site running at http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('User site startup failed:', err);
  process.exit(1);
});
