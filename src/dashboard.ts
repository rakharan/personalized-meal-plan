import 'dotenv/config';
import express from 'express';
import { pool, migrateSchema } from './store.js';
import type { Request, Response } from 'express';

const PORT = Number(process.env.DASHBOARD_PORT ?? 3000);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme';

const app = express();
app.use(express.urlencoded({ extended: true }));

// Parse cookies for auth middleware
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
// Auth middleware
// ────────────────────────────────────────────────────────────────────────────
function authCheck(req: Request, res: Response, next: any): void {
  const cookies = parseCookies(req);
  const token = cookies.admin_token || req.query.token || req.headers.authorization?.replace('Bearer ', '');
  if (token === ADMIN_TOKEN) { next(); return; }
  res.redirect('/login');
}

// ────────────────────────────────────────────────────────────────────────────
// Login page
// ────────────────────────────────────────────────────────────────────────────
app.get('/login', (_req: Request, res: Response) => {
  res.send(renderPage('Login', `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-icon">🔐</div>
        <h1 style="font-size:1.5rem;margin-bottom:4px">Admin Login</h1>
        <p class="login-sub">Enter your admin token to continue</p>
        <form method="POST" action="/login">
          <input type="password" name="token" placeholder="Admin token" autofocus />
          <button type="submit">Login →</button>
        </form>
      </div>
    </div>
  `));
});

app.post('/login', (req: Request, res: Response) => {
  const { token } = req.body;
  if (token === ADMIN_TOKEN) {
    res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; SameSite=Strict`);
    res.redirect('/');
  } else {
    res.send(renderPage('Login', '<p style="color:var(--red);margin-top:12px;font-size:13px">Invalid token. <a href="/login">Try again</a></p>'));
  }
});

app.get('/logout', (_req: Request, res: Response) => {
  res.setHeader('Set-Cookie', 'admin_token=; Path=/; Max-Age=0');
  res.redirect('/login');
});

// ────────────────────────────────────────────────────────────────────────────
// Dashboard overview
// ────────────────────────────────────────────────────────────────────────────
app.get('/', authCheck, async (_req: Request, res: Response) => {
  try {
    const [totalUsers, activeSubs, todayPushed, avgStreak, maxStreak, feedback, localeDist, pushDist, retention7d, plansCount, tierDist, referralCount, usageToday] = await Promise.all([
      pool.query('SELECT COUNT(*)::int FROM subscribers'),
      pool.query("SELECT COUNT(*)::int FROM subscribers WHERE subscribed = 1"),
      pool.query("SELECT COUNT(*)::int FROM subscribers WHERE last_pushed = to_char(CURRENT_DATE, 'YYYY-MM-DD')"),
      pool.query('SELECT COALESCE(AVG(streak),0)::float AS count FROM subscribers'),
      pool.query('SELECT COALESCE(MAX(streak),0)::int AS count FROM subscribers'),
      pool.query("SELECT last_feedback, COUNT(*)::int FROM subscribers WHERE last_feedback IS NOT NULL GROUP BY last_feedback"),
      pool.query('SELECT locale, COUNT(*)::int FROM subscribers GROUP BY locale'),
      pool.query('SELECT push_hour, push_min, COUNT(*)::int FROM subscribers WHERE push_hour IS NOT NULL GROUP BY push_hour, push_min ORDER BY push_hour'),
      pool.query("SELECT COUNT(*)::int FROM subscribers WHERE last_pushed >= to_char(NOW() - INTERVAL '7 days', 'YYYY-MM-DD')"),
      pool.query('SELECT COUNT(*)::int FROM plans'),
      pool.query("SELECT tier, COUNT(*)::int FROM subscribers GROUP BY tier"),
      pool.query('SELECT COUNT(*)::int FROM referrals'),
      pool.query("SELECT COALESCE(SUM(tokens),0)::int AS count FROM usage_log WHERE created >= CURRENT_DATE"),
    ]);

    const stats = {
      totalUsers: totalUsers.rows[0].count,
      activeSubs: activeSubs.rows[0].count,
      todayPushed: todayPushed.rows[0].count,
      avgStreak: Math.round(avgStreak.rows[0].count * 10) / 10,
      maxStreak: maxStreak.rows[0].count,
      feedback: feedback.rows,
      locale: localeDist.rows,
      pushDist: pushDist.rows,
      retention7d: retention7d.rows[0].count,
      plansCount: plansCount.rows[0].count,
      tiers: tierDist.rows,
      referrals: referralCount.rows[0].count,
      tokensToday: usageToday.rows[0].count,
    };

    res.send(renderPage('Dashboard', `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-num">${stats.totalUsers}</div><div class="stat-label">Total Users</div></div>
        <div class="stat-card"><div class="stat-num">${stats.activeSubs}</div><div class="stat-label">Active Subs</div></div>
        <div class="stat-card"><div class="stat-num">${stats.todayPushed}</div><div class="stat-label">Pushed Today</div></div>
        <div class="stat-card"><div class="stat-num">${stats.retention7d}</div><div class="stat-label">7d Retention</div></div>
        <div class="stat-card"><div class="stat-num">${stats.avgStreak}</div><div class="stat-label">Avg Streak</div></div>
        <div class="stat-card"><div class="stat-num">${stats.maxStreak}</div><div class="stat-label">Longest Streak</div></div>
        <div class="stat-card"><div class="stat-num">${stats.plansCount}</div><div class="stat-label">Saved Plans</div></div>
        <div class="stat-card"><div class="stat-num">${stats.referrals}</div><div class="stat-label">Referrals</div></div>
        <div class="stat-card"><div class="stat-num">${stats.tokensToday}</div><div class="stat-label">Tokens Today</div></div>
      </div>

      <div class="charts">
        <div class="chart-card">
          <h3>Tier Distribution</h3>
          <div class="bars">${stats.tiers.map((t: any) => `<div class="bar-row"><span class="lbl">${t.tier}</span><span class="val">${t.count}</span></div>`).join('')}</div>
        </div>
        <div class="chart-card">
          <h3>Feedback Ratio</h3>
          ${stats.feedback.length ? `<div class="bars">${stats.feedback.map((f: any) => `<div class="bar-row"><span class="lbl">${f.last_feedback}</span><span class="val">${f.count}</span></div>`).join('')}</div>` : '<p style="color:var(--fg4)">No feedback yet</p>'}
        </div>
        <div class="chart-card">
          <h3>Locale Distribution</h3>
          <div class="bars">${stats.locale.map((l: any) => `<div class="bar-row"><span class="lbl">${l.locale}</span><span class="val">${l.count}</span></div>`).join('')}</div>
        </div>
        <div class="chart-card">
          <h3>Push Time Distribution</h3>
          ${stats.pushDist.length ? `<div class="bars">${stats.pushDist.map((p: any) => `<div class="bar-row"><span class="lbl">${String(p.push_hour).padStart(2,'0')}:${String(p.push_min).padStart(2,'0')}</span><span class="val">${p.count}</span></div>`).join('')}</div>` : '<p style="color:var(--fg4)">No custom push times set</p>'}
        </div>
      </div>
    `));
  } catch (err) {
    res.send(renderPage('Error', `<p style="color:var(--red);padding:20px;background:var(--surface);border-radius:8px;box-shadow:var(--shadow)">${(err as Error).message}</p>`));
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Users table
// ────────────────────────────────────────────────────────────────────────────
app.get('/users', authCheck, async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const [result, countResult] = await Promise.all([
    pool.query('SELECT chat_id, locale, subscribed, streak, last_pushed, push_hour, push_min, last_feedback FROM subscribers ORDER BY chat_id DESC LIMIT $1 OFFSET $2', [limit, offset]),
    pool.query('SELECT COUNT(*)::int FROM subscribers'),
  ]);

  const totalPages = Math.ceil(countResult.rows[0].count / limit);
  const rows = result.rows.map((r: any) => `
    <tr>
      <td>${r.chat_id}</td>
      <td>${r.locale}</td>
      <td>${r.subscribed ? '✅' : '❌'}</td>
      <td>${r.streak}</td>
      <td>${r.last_pushed || '—'}</td>
      <td>${r.push_hour !== null ? String(r.push_hour).padStart(2,'0') + ':' + String(r.push_min).padStart(2,'0') : 'default'}</td>
      <td>${r.last_feedback || '—'}</td>
    </tr>
  `).join('');

  res.send(renderPage('Users', `
    <div class="table-wrap"><table><thead><tr><th>Chat ID</th><th>Locale</th><th>Subscribed</th><th>Streak</th><th>Last Pushed</th><th>Push Time</th><th>Feedback</th></tr></thead>
    <tbody>${rows}</tbody></table></div>
    <div class="pagination">
      ${page > 1 ? `<a href="/users?page=${page-1}">← Prev</a>` : ''}
      <span>Page ${page} of ${totalPages}</span>
      ${page < totalPages ? `<a href="/users?page=${page+1}">Next →</a>` : ''}
    </div>
  `));
});

// ────────────────────────────────────────────────────────────────────────────
// Plans table
// ────────────────────────────────────────────────────────────────────────────
app.get('/plans', authCheck, async (_req: Request, res: Response) => {
  const result = await pool.query(`
    SELECT p.id, p.chat_id, p.name, p.created,
           s.locale
    FROM plans p
    LEFT JOIN subscribers s ON s.chat_id = p.chat_id
    ORDER BY p.created DESC
    LIMIT 200
  `);

  const rows = result.rows.map((r: any) => `
    <tr>
      <td>${r.id}</td>
      <td>${r.chat_id}</td>
      <td>${r.name}</td>
      <td>${r.locale || '—'}</td>
      <td>${new Date(r.created).toLocaleString()}</td>
    </tr>
  `).join('');

  res.send(renderPage('Saved Plans', `
    <div class="table-wrap"><table><thead><tr><th>ID</th><th>Chat ID</th><th>Name</th><th>Locale</th><th>Created</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" class="empty-row">No saved plans</td></tr>'}</tbody></table></div>
  `));
});

// ────────────────────────────────────────────────────────────────────────────
// Feedback table
// ────────────────────────────────────────────────────────────────────────────
app.get('/feedback', authCheck, async (_req: Request, res: Response) => {
  const result = await pool.query(`
    SELECT chat_id, locale, last_feedback, streak, last_pushed
    FROM subscribers
    WHERE last_feedback IS NOT NULL
    ORDER BY last_pushed DESC
    LIMIT 200
  `);

  const good = result.rows.filter((r: any) => r.last_feedback === 'good').length;
  const bad = result.rows.filter((r: any) => r.last_feedback === 'bad').length;
  const ratio = good + bad > 0 ? Math.round((good / (good + bad)) * 100) : 0;

  const rows = result.rows.map((r: any) => `
    <tr>
      <td>${r.chat_id}</td>
      <td>${r.locale}</td>
      <td>${r.last_feedback === 'good' ? '👍 Good' : '👎 Bad'}</td>
      <td>${r.streak}</td>
      <td>${r.last_pushed || '—'}</td>
    </tr>
  `).join('');

  res.send(renderPage('Feedback', `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-num">${good}</div><div class="stat-label">👍 Good</div></div>
      <div class="stat-card"><div class="stat-num">${bad}</div><div class="stat-label">👎 Bad</div></div>
      <div class="stat-card"><div class="stat-num">${ratio}%</div><div class="stat-label">Good Ratio</div></div>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Chat ID</th><th>Locale</th><th>Feedback</th><th>Streak</th><th>Last Pushed</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" class="empty-row">No feedback yet</td></tr>'}</tbody></table></div>
  `));
});

// ────────────────────────────────────────────────────────────────────────────
// Usage table
// ────────────────────────────────────────────────────────────────────────────
app.get('/usage', authCheck, async (_req: Request, res: Response) => {
  const result = await pool.query(`
    SELECT u.chat_id, u.tokens, u.feature, u.created,
           s.locale, s.tier
    FROM usage_log u
    LEFT JOIN subscribers s ON s.chat_id = u.chat_id
    ORDER BY u.created DESC
    LIMIT 200
  `);

  const totalTokens = result.rows.reduce((sum: number, r: any) => sum + Number(r.tokens), 0);
  const rows = result.rows.map((r: any) => `
    <tr>
      <td>${r.chat_id}</td>
      <td>${r.tier || '—'}</td>
      <td>${r.feature}</td>
      <td>${r.tokens}</td>
      <td>${new Date(r.created).toLocaleString()}</td>
    </tr>
  `).join('');

  res.send(renderPage('Usage', `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-num">${totalTokens}</div><div class="stat-label">Total Tokens (200 rows)</div></div>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Chat ID</th><th>Tier</th><th>Feature</th><th>Tokens</th><th>Created</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" class="empty-row">No usage yet</td></tr>'}</tbody></table></div>
  `));
});

// ────────────────────────────────────────────────────────────────────────────
// Referrals table
// ────────────────────────────────────────────────────────────────────────────
app.get('/referrals', authCheck, async (_req: Request, res: Response) => {
  const result = await pool.query(`
    SELECT r.referred_id, r.created,
           s_ref.locale AS ref_locale,
           (SELECT COUNT(*) FROM referrals r2 WHERE r2.referrer_id = r.referred_id) AS their_referrals
    FROM referrals r
    LEFT JOIN subscribers s_ref ON s_ref.chat_id = r.referred_id
    ORDER BY r.created DESC
    LIMIT 200
  `);

  const rows = result.rows.map((r: any) => `
    <tr>
      <td>${r.referred_id}</td>
      <td>${r.ref_locale || '—'}</td>
      <td>${r.their_referrals}</td>
      <td>${new Date(r.created).toLocaleString()}</td>
    </tr>
  `).join('');

  res.send(renderPage('Referrals', `
    <div class="table-wrap"><table><thead><tr><th>Referred Chat ID</th><th>Locale</th><th>Their Referrals</th><th>Joined</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4" class="empty-row">No referrals yet</td></tr>'}</tbody></table></div>
  `));
});

// ────────────────────────────────────────────────────────────────────────────
// JSON stats API
// ────────────────────────────────────────────────────────────────────────────
app.get('/api/stats', authCheck, async (_req: Request, res: Response) => {
  const [total, subs] = await Promise.all([
    pool.query('SELECT COUNT(*)::int FROM subscribers'),
    pool.query("SELECT COUNT(*)::int FROM subscribers WHERE subscribed = 1"),
  ]);
  res.json({ totalUsers: total.rows[0].count, activeSubs: subs.rows[0].count });
});

// ────────────────────────────────────────────────────────────────────────────
// HTML template
// ────────────────────────────────────────────────────────────────────────────
function renderPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="60">
  <title>${title} — Meal Plan Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    /* ── Dark theme (default) — Warm Kitchen ── */
    :root {
      --bg: #1a1612;
      --surface: #241F1B;
      --surface2: #2D2823;
      --surface3: #3A342E;
      --fg: #E8E0D5;
      --fg2: #C4B8A8;
      --fg3: #8A7E72;
      --fg4: #5C5248;
      --primary: #52B788;
      --accent: #F59E0B;
      --accent-soft: rgba(245,158,11,0.10);
      --primary-soft: rgba(82,183,136,0.12);
      --border: rgba(255,255,255,0.06);
      --border2: rgba(255,255,255,0.09);
      --green: #52B788;
      --red: #E5484D;
      --shadow: 0 0 0 1px var(--border);
      --shadow-lg: 0 0 0 1px var(--border2), 0 4px 12px rgba(0,0,0,0.3);
      --radius: 8px;
      --radius-sm: 6px;
      --radius-lg: 12px;
    }
    /* ── Light theme (auto) ── */
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #FDF8F3;
        --surface: #FFFFFF;
        --surface2: #F5F0E8;
        --surface3: #EDE5D8;
        --fg: #2D2A26;
        --fg2: #4A4540;
        --fg3: #7A7268;
        --fg4: #A09890;
        --primary: #2D6A4F;
        --accent: #E07856;
        --accent-soft: rgba(224,120,86,0.10);
        --primary-soft: rgba(45,106,79,0.08);
        --border: rgba(0,0,0,0.07);
        --border2: rgba(0,0,0,0.10);
        --green: #2D6A4F;
        --red: #C62828;
        --shadow: 0 0 0 1px var(--border);
        --shadow-lg: 0 0 0 1px var(--border2), 0 4px 16px rgba(0,0,0,0.06);
      }
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
      font-size:14px; line-height:1.5;
      background:var(--bg); color:var(--fg);
      padding:0;
      -webkit-font-smoothing:antialiased;
      -moz-osx-font-smoothing:grayscale;
    }
    /* ── Layout shell ── */
    .shell { display:flex; min-height:100vh; }
    .sidebar {
      width:220px; flex-shrink:0;
      background:var(--surface); border-right:1px solid var(--border);
      padding:20px 0; position:fixed; height:100vh; overflow-y:auto;
      display:flex; flex-direction:column;
    }
    .sidebar-brand {
      padding:0 20px 24px; font-size:15px; font-weight:600;
      letter-spacing:-0.01em; color:var(--fg);
    }
    .sidebar-brand span { color:var(--primary); }
    .nav { flex:1; }
    .nav a {
      display:flex; align-items:center; gap:10px;
      padding:7px 20px; font-size:13px; font-weight:500;
      color:var(--fg3); text-decoration:none; border-left:2px solid transparent;
      transition:color .15s, background .15s;
    }
    .nav a:hover { color:var(--fg2); background:var(--surface2); }
    .nav a.active { color:var(--fg); background:var(--primary-soft); border-left-color:var(--primary); }
    .nav a .icon { font-size:15px; width:20px; text-align:center; }
    .main { flex:1; margin-left:220px; padding:32px 40px; max-width:1200px; }
    /* ── Headings ── */
    h1 { font-size:1.5rem; font-weight:600; letter-spacing:-0.02em; margin-bottom:24px; }
    h3 { font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:var(--fg3); margin-bottom:14px; }
    /* ── Stats grid ── */
    .stats-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:12px; margin-bottom:28px; }
    .stat-card {
      background:var(--surface); border-radius:var(--radius); padding:18px 20px;
      box-shadow:var(--shadow); transition:box-shadow .2s, transform .12s;
    }
    .stat-card:hover { box-shadow:var(--shadow-lg); }
    .stat-card:active { transform:scale(0.98); }
    .stat-num { font-size:1.75rem; font-weight:600; letter-spacing:-0.03em; color:var(--fg); font-variant-numeric:tabular-nums; }
    .stat-label { font-size:12px; color:var(--fg3); margin-top:2px; }
    /* ── Chart cards ── */
    .charts { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:12px; margin-bottom:28px; }
    .chart-card { background:var(--surface); border-radius:var(--radius); padding:20px; box-shadow:var(--shadow); }
    .bars { display:flex; flex-direction:column; gap:6px; }
    .bar-row { display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border); font-size:13px; }
    .bar-row:last-child { border-bottom:none; }
    .bar-row .val { font-weight:600; color:var(--fg); font-variant-numeric:tabular-nums; }
    .bar-row .lbl { color:var(--fg3); text-transform:capitalize; }
    /* ── Tables ── */
    .table-wrap { background:var(--surface); border-radius:var(--radius); box-shadow:var(--shadow); overflow:hidden; margin-bottom:20px; }
    table { width:100%; border-collapse:collapse; }
    th,td { padding:10px 16px; text-align:left; }
    th { font-size:12px; font-weight:500; text-transform:uppercase; letter-spacing:0.04em; color:var(--fg3); border-bottom:1px solid var(--border); background:var(--surface2); }
    td { font-size:13px; color:var(--fg2); border-bottom:1px solid var(--border); }
    tbody tr:last-child td { border-bottom:none; }
    tbody tr { transition:background .12s; }
    tbody tr:hover { background:var(--surface2); }
    .empty-row { text-align:center; color:var(--fg4); padding:24px; }
    /* ── Pagination ── */
    .pagination { display:flex; gap:12px; align-items:center; justify-content:center; margin:16px 0; font-size:13px; }
    .pagination a { color:var(--primary); text-decoration:none; padding:6px 12px; border-radius:var(--radius-sm); transition:background .12s; }
    .pagination a:hover { background:var(--primary-soft); }
    .pagination span { color:var(--fg3); }
    /* ── Back link ── */
    .back-link { margin:20px 0; font-size:13px; }
    .back-link a { color:var(--fg3); text-decoration:none; transition:color .12s; }
    .back-link a:hover { color:var(--fg2); }
    /* ── Login ── */
    .login-wrap { display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .login-card {
      background:var(--surface); border-radius:var(--radius-lg); padding:40px;
      box-shadow:var(--shadow-lg); width:380px; text-align:center;
    }
    .login-icon { font-size:2.5rem; margin-bottom:12px; }
    .login-sub { color:var(--fg3); font-size:13px; margin-bottom:24px; }
    .login-card input {
      width:100%; padding:10px 14px; border-radius:var(--radius-sm);
      background:var(--surface2); border:1px solid var(--border);
      color:var(--fg); font-size:14px; font-family:inherit; margin-bottom:12px;
      transition:border-color .15s, transform .12s;
    }
    .login-card input:focus { outline:none; border-color:var(--primary); }
    .login-card button {
      width:100%; padding:10px 16px; border-radius:var(--radius-sm);
      background:var(--primary); color:#fff; border:none; font-size:14px;
      font-weight:500; font-family:inherit; cursor:pointer; transition:background .15s, transform .12s;
    }
    .login-card button:hover { filter:brightness(1.1); }
    .login-card button:active { transform:scale(0.96); }
    /* ── Misc ── */
    a { color:var(--primary); }
    ::selection { background:var(--accent-soft); }
    @media (max-width:768px) {
      .sidebar { display:none; }
      .main { margin-left:0; padding:20px; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation:none !important; transition:none !important; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <nav class="sidebar">
      <div class="sidebar-brand">🍱 Meal<span>Plan</span></div>
      <div class="nav">
        <a href="/" class="${title === 'Dashboard' ? 'active' : ''}"><span class="icon">📊</span> Dashboard</a>
        <a href="/users" class="${title === 'Users' ? 'active' : ''}"><span class="icon">👥</span> Users</a>
        <a href="/plans" class="${title === 'Saved Plans' ? 'active' : ''}"><span class="icon">📋</span> Plans</a>
        <a href="/feedback" class="${title === 'Feedback' ? 'active' : ''}"><span class="icon">👍</span> Feedback</a>
        <a href="/usage" class="${title === 'Usage' ? 'active' : ''}"><span class="icon">📈</span> Usage</a>
        <a href="/referrals" class="${title === 'Referrals' ? 'active' : ''}"><span class="icon">🔗</span> Referrals</a>
      </div>
      <div class="nav" style="margin-top:auto">
        <a href="/logout"><span class="icon">🚪</span> Logout</a>
      </div>
    </nav>
    <main class="main">
      <h1>${title}</h1>
      ${body}
      <div class="back-link"><a href="/">← Dashboard</a></div>
    </main>
  </div>
</body>
</html>`;
}

// ────────────────────────────────────────────────────────────────────────────
// Startup
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  await migrateSchema();
  app.listen(PORT, () => {
    console.log(`Dashboard running at http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Dashboard startup failed:', err);
  process.exit(1);
});
