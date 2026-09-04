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
      <div class="streak-num">${user.streak}</div>
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
  if (!Array.isArray(meals)) return '<p class="empty reveal">\U0001F371 No meals data yet \u2014 generate a plan via the bot to see your meals here.</p>';
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
          ${cal ? `<span class="pill">\U0001F525 ${escapeHtml(String(cal))} cal</span>` : ''}
          ${protein ? `<span class="pill">\U0001F969 ${escapeHtml(String(protein))}</span>` : ''}
        </div>
      </div>
      <div class="meal-title">${escapeHtml(title)}</div>
      ${itemsHtml ? `<ul class="meal-items">${itemsHtml}</ul>` : ''}
    </div>`;
  }).join('');
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// HTML template \u2014 Warm Kitchen theme, mobile-first monitor surface
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function renderPage(title: string, body: string, user?: User | null): string {
  const uid = user?.chatId;
  const nav = user ? `
    <nav class="tabbar">
      <a href="/meals?uid=${uid}" class="${title === 'Meals' ? 'active' : ''}"><span class="icon">\U0001F374</span><span class="tab-label">Meals</span></a>
      <a href="/streak?uid=${uid}" class="${title === 'Streak' ? 'active' : ''}"><span class="icon">\U0001F525</span><span class="tab-label">Streak</span></a>
      <a href="/settings?uid=${uid}" class="${title === 'Settings' ? 'active' : ''}"><span class="icon">\u2699\uFE0F</span><span class="tab-label">Settings</span></a>
      <a href="/profile?uid=${uid}" class="${title === 'Profile' ? 'active' : ''}"><span class="icon">\U0001F464</span><span class="tab-label">Profile</span></a>
    </nav>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#1a1612" media="(prefers-color-scheme: dark)">
  <meta name="theme-color" content="#FDF8F3" media="(prefers-color-scheme: light)">
  <title>${title} \u2014 MealPlan</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    @layer reset, tokens, base, components, motion;
    @layer reset {
      *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
      html { -webkit-text-size-adjust: 100%; }
    }
    @layer tokens {
      :root {
        --bg: #1a1612;
        --surface: #241F1B;
        --surface2: #2D2823;
        --surface3: #3A342E;
        --primary: #52B788;
        --accent: #F59E0B;
        --text: #E8E0D5;
        --text2: #C4B8A8;
        --text3: #8A7E72;
        --text4: #5C5248;
        --border: rgba(255,255,255,0.06);
        --border2: rgba(255,255,255,0.09);
        --red: #E5484D;
        --c-breakfast: #F59E0B;
        --c-lunch: #52B788;
        --c-dinner: #E07856;
        --c-snack: #52B788;
        --primary-soft: color-mix(in oklab, var(--primary) 14%, transparent);
        --accent-soft: color-mix(in oklab, var(--accent) 14%, transparent);
        --radius: 14px;
        --radius-sm: 10px;
        --space: clamp(16px, 4vw, 22px);
        --max-w: 480px;
        --shadow: 0 0 0 1px var(--border);
        --shadow-lg: 0 0 0 1px var(--border2), 0 6px 20px rgba(0,0,0,0.35);
        --lift: 0 0 0 1px var(--border2), 0 8px 24px rgba(0,0,0,0.28);
      }
      @media (prefers-color-scheme: light) {
        :root {
          --bg: #FDF8F3;
          --surface: #FFFFFF;
          --surface2: #F5F0E8;
          --surface3: #EDE5D8;
          --primary: #2D6A4F;
          --accent: #E07856;
          --text: #2D2A26;
          --text2: #4A4540;
          --text3: #7A7268;
          --text4: #A09890;
          --border: rgba(0,0,0,0.07);
          --border2: rgba(0,0,0,0.10);
          --red: #C62828;
          --c-breakfast: #D97706;
          --c-lunch: #2D6A4F;
          --c-dinner: #C44A2E;
          --c-snack: #2D6A4F;
          --primary-soft: color-mix(in oklab, var(--primary) 10%, transparent);
          --accent-soft: color-mix(in oklab, var(--accent) 12%, transparent);
          --shadow-lg: 0 0 0 1px var(--border2), 0 6px 20px rgba(0,0,0,0.06);
          --lift: 0 0 0 1px var(--border2), 0 8px 24px rgba(0,0,0,0.08);
        }
      }
    }
    @layer base {
      body {
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 16px;
        line-height: 1.5;
        background: var(--bg);
        color: var(--text);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-wrap: pretty;
        padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
      }
      h1 { font-size: 1.25rem; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 16px; }
      h3 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text3); margin: 22px 0 10px; }
      a { color: var(--primary); text-decoration: none; }
      ::selection { background: var(--accent-soft); }
      input, select, textarea, button { font-size: 16px; font-family: inherit; }
    }
    @layer components {
      .app { max-width: var(--max-w); margin: 0 auto; padding: var(--space); min-height: 100dvh; }

      /* Stats */
      .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 20px; }
      .stat-card { background: var(--surface); border-radius: var(--radius-sm); padding: 12px; box-shadow: var(--shadow); text-align: center; }
      .stat-num { font-size: 1.25rem; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--text); line-height: 1.2; }
      .stat-label { font-size: 10px; color: var(--text3); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.04em; }

      /* Date strip */
      .date-strip { display: flex; gap: 6px; overflow-x: auto; scroll-snap-type: x mandatory; margin-bottom: 18px; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 2px; }
      .date-strip::-webkit-scrollbar { display: none; }
      .date-chip { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 0 0 44px; height: 56px; border-radius: var(--radius-sm); background: var(--surface); border: 1px solid var(--border); scroll-snap-align: start; cursor: pointer; transition: background .15s, border-color .15s, transform .12s; }
      .date-chip:active { transform: scale(0.96); }
      .date-chip.active { background: var(--primary); border-color: var(--primary); }
      .date-chip .day-name { font-size: 10px; color: var(--text3); font-weight: 500; }
      .date-chip .day-num { font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
      .date-chip.active .day-name { color: rgba(255,255,255,0.85); }
      .date-chip.active .day-num { color: #fff; }

      /* Meals */
      .meals { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
      .meal { background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--meal-c, var(--accent)); border-radius: var(--radius-sm); padding: 14px 16px; transition: transform .12s, box-shadow .2s, border-color .15s; }
      .meal:hover { box-shadow: var(--lift); }
      .meal:active { transform: scale(0.98); }
      .meal-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; }
      .meal-type { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--meal-c, var(--accent)); }
      .meal-badges { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
      .pill { font-size: 11px; font-weight: 500; color: var(--text2); background: var(--surface2); padding: 2px 8px; border-radius: 999px; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .meal-title { font-size: 15px; font-weight: 500; color: var(--text); margin-bottom: 6px; }
      .meal-items { list-style: none; padding: 0; margin: 0; }
      .meal-items li { font-size: 13px; color: var(--text2); padding: 2px 0; position: relative; padding-left: 14px; }
      .meal-items li::before { content: ''; position: absolute; left: 2px; top: 9px; width: 4px; height: 4px; border-radius: 50%; background: var(--text4); }

      /* Plan list */
      .plan-list { display: flex; flex-direction: column; gap: 8px; }
      .plan-item { display: flex; justify-content: space-between; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 16px; transition: transform .12s, background .15s, box-shadow .2s; }
      .plan-item:hover { background: var(--surface2); box-shadow: var(--lift); }
      .plan-item:active { transform: scale(0.98); }
      .plan-name { font-weight: 500; color: var(--text); font-size: 14px; }
      .plan-date { font-size: 12px; color: var(--text3); font-variant-numeric: tabular-nums; }
      .plan-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
      .plan-meta span { font-size: 12px; color: var(--text2); background: var(--surface2); padding: 4px 10px; border-radius: 999px; }
      .section-head h3 { margin-top: 28px; }

      /* Streak hero + progress ring (conic-gradient masked to ring, JS sets --ring-deg) */
      .streak-hero { text-align: center; padding: 28px 0 24px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); margin-bottom: 20px; }
      .streak-num {
        --ring-deg: 0;
        position: relative;
        width: 168px; height: 168px;
        margin: 0 auto 10px;
        display: grid; place-items: center;
        font-size: clamp(2.5rem, 2rem + 2vw, 3.5rem);
        font-weight: 600; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; line-height: 1; color: var(--text);
      }
      .streak-num::before {
        content: ''; position: absolute; inset: 0; border-radius: 50%;
        background: conic-gradient(var(--primary) calc(var(--ring-deg) * 1deg), var(--surface3) 0);
        -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 11px), #000 calc(100% - 11px));
                mask: radial-gradient(farthest-side, transparent calc(100% - 11px), #000 calc(100% - 11px));
        z-index: 0;
      }
      .streak-label { font-size: 13px; color: var(--text3); margin-top: 6px; }

      /* Bars */
      .bars { display: flex; flex-direction: column; gap: 0; margin-bottom: 20px; }
      .bar-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
      .bar-row:last-child { border-bottom: none; }
      .bar-row .lbl { color: var(--text3); font-size: 12px; min-width: 86px; font-variant-numeric: tabular-nums; }
      .bar-track { flex: 1; height: 6px; background: var(--surface3); border-radius: 3px; overflow: hidden; }
      .bar-fill { height: 100%; background: var(--primary); border-radius: 3px; transition: width .3s cubic-bezier(0.2,0,0,1); }
      .bar-row .val { font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; min-width: 44px; text-align: right; }

      /* Settings */
      .settings-list { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow); overflow: hidden; margin-bottom: 16px; }
      .setting-row { display: flex; justify-content: space-between; align-items: center; padding: 13px 16px; border-bottom: 1px solid var(--border); font-size: 14px; }
      .setting-row:last-child { border-bottom: none; }
      .setting-row .lbl { color: var(--text2); }
      .setting-row .val { color: var(--text); font-weight: 500; max-width: 60%; text-align: right; font-variant-numeric: tabular-nums; }
      .hint { font-size: 13px; color: var(--text4); text-align: center; margin-top: 10px; }

      /* Profile */
      .profile-head { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
      .avatar { width: 56px; height: 56px; border-radius: 50%; background: var(--primary-soft); display: flex; align-items: center; justify-content: center; font-weight: 600; color: var(--primary); font-size: 16px; letter-spacing: 0.02em; }
      .profile-info { display: flex; flex-direction: column; gap: 2px; }
      .profile-name { font-weight: 600; font-size: 16px; color: var(--text); }
      .profile-tier { font-size: 13px; color: var(--text3); }
      .ref-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; text-align: center; box-shadow: var(--shadow); margin-bottom: 20px; }
      .ref-card .stat-num { font-size: 2.5rem; color: var(--primary); }
      .ref-card .stat-label { font-size: 11px; }
      .ref-link-wrap { display: flex; gap: 8px; margin-top: 16px; }
      .ref-link { flex: 1; min-width: 0; padding: 10px 14px; border-radius: var(--radius-sm); background: var(--surface2); border: 1px solid var(--border); color: var(--text2); font-size: 13px; font-family: inherit; transition: border-color .15s; }
      .ref-link:focus { outline: none; border-color: var(--primary); }
      .ref-link-wrap button { padding: 10px 16px; border-radius: var(--radius-sm); background: var(--primary); color: #fff; border: none; font-size: 13px; font-weight: 500; font-family: inherit; cursor: pointer; transition: background .15s, transform .12s; }
      .ref-link-wrap button:hover { background: color-mix(in oklab, var(--primary) 88%, #000); }
      .ref-link-wrap button:active { transform: scale(0.96); }

      /* Empty state */
      .empty { text-align: center; color: var(--text4); padding: 32px 16px; font-size: 14px; line-height: 1.5; }

      /* Login */
      .login-wrap { display: flex; align-items: center; justify-content: center; min-height: 100dvh; padding: 0 16px; }
      .login-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 36px 28px; box-shadow: var(--shadow-lg); width: 100%; max-width: 360px; text-align: center; }
      .login-icon { font-size: 2.5rem; margin-bottom: 10px; }
      .login-sub { color: var(--text3); font-size: 13px; margin-bottom: 22px; }
      .login-card input { width: 100%; padding: 12px 14px; border-radius: var(--radius-sm); background: var(--surface2); border: 1px solid var(--border); color: var(--text); font-size: 16px; font-family: inherit; margin-bottom: 12px; transition: border-color .15s; }
      .login-card input:focus { outline: none; border-color: var(--primary); }
      .login-card button { width: 100%; padding: 12px 16px; border-radius: var(--radius-sm); background: var(--primary); color: #fff; border: none; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; transition: background .15s, transform .12s; }
      .login-card button:hover { background: color-mix(in oklab, var(--primary) 88%, #000); }
      .login-card button:active { transform: scale(0.96); }

      /* Bottom tab bar */
      .tabbar {
        position: fixed; bottom: 0; left: 0; right: 0;
        height: calc(56px + env(safe-area-inset-bottom, 0px));
        background: color-mix(in oklab, var(--surface) 80%, transparent);
        backdrop-filter: blur(14px) saturate(150%);
        -webkit-backdrop-filter: blur(14px) saturate(150%);
        border-top: 1px solid var(--border);
        display: flex;
        z-index: 100;
        max-width: var(--max-w);
        margin: 0 auto;
        padding-bottom: env(safe-area-inset-bottom, 0px);
      }
      .tabbar a {
        flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 2px; font-size: 10px; font-weight: 500; color: var(--text4);
        text-decoration: none; transition: color .15s;
        min-height: 48px;
      }
      .tabbar a .icon { font-size: 18px; }
      .tabbar a.active { color: var(--primary); }
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
        .tabbar a.active { background: var(--primary-soft); border-left-color: var(--primary); }
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
    var sn = document.querySelector('.streak-num');
    if (sn) {
      var n = parseInt(sn.textContent, 10) || 0;
      var pct = Math.max(0, Math.min(1, n / 7));
      sn.style.setProperty('--ring-deg', String(Math.round(pct * 360)));
    }
  })();
  </script>
</body>
</html>`;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Startup
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
