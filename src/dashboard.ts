import 'dotenv/config';
import express from 'express';
import { pool, migrateSchema } from './store.js';
import type { Request, Response } from 'express';

const PORT = Number(process.env.DASHBOARD_PORT ?? 3000);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme';

const app = express();
app.use(express.urlencoded({ extended: true }));

// ────────────────────────────────────────────────────────────────────────────
// Auth middleware
// ────────────────────────────────────────────────────────────────────────────
function authCheck(req: Request, res: Response, next: any): void {
  const token = req.cookies?.admin_token || req.query.token || req.headers.authorization?.replace('Bearer ', '');
  if (token === ADMIN_TOKEN) { next(); return; }
  res.redirect('/login');
}

// ────────────────────────────────────────────────────────────────────────────
// Login page
// ────────────────────────────────────────────────────────────────────────────
app.get('/login', (_req: Request, res: Response) => {
  res.send(renderPage('Login', `
    <div style="max-width:400px;margin:80px auto;text-align:center">
      <h1>🔐 Admin Login</h1>
      <form method="POST" action="/login">
        <input type="password" name="token" placeholder="Admin token"
          style="width:100%;padding:12px;margin:8px 0;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--foreground)" />
        <button type="submit" style="padding:12px 24px;border:none;border-radius:8px;background:var(--accent);color:#fff;cursor:pointer">Login</button>
      </form>
    </div>
  `));
});

app.post('/login', (req: Request, res: Response) => {
  const { token } = req.body;
  if (token === ADMIN_TOKEN) {
    res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; SameSite=Strict`);
    res.redirect('/');
  } else {
    res.send(renderPage('Login', '<p style="color:red">Invalid token. <a href="/login">Try again</a></p>'));
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
      pool.query('SELECT COALESCE(AVG(streak),0)::float FROM subscribers'),
      pool.query('SELECT COALESCE(MAX(streak),0)::int FROM subscribers'),
      pool.query("SELECT last_feedback, COUNT(*)::int FROM subscribers WHERE last_feedback IS NOT NULL GROUP BY last_feedback"),
      pool.query('SELECT locale, COUNT(*)::int FROM subscribers GROUP BY locale'),
      pool.query('SELECT push_hour, push_min, COUNT(*)::int FROM subscribers WHERE push_hour IS NOT NULL GROUP BY push_hour, push_min ORDER BY push_hour'),
      pool.query("SELECT COUNT(*)::int FROM subscribers WHERE last_pushed >= to_char(NOW() - INTERVAL '7 days', 'YYYY-MM-DD')"),
      pool.query('SELECT COUNT(*)::int FROM plans'),
      pool.query("SELECT tier, COUNT(*)::int FROM subscribers GROUP BY tier"),
      pool.query('SELECT COUNT(*)::int FROM referrals'),
      pool.query("SELECT COALESCE(SUM(tokens),0)::int FROM usage_log WHERE created >= CURRENT_DATE"),
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
          <div class="bars">${stats.tiers.map((t: any) => `<div class="bar-row"><span>${t.tier}</span><span>${t.count}</span></div>`).join('')}</div>
        </div>
        <div class="chart-card">
          <h3>Feedback Ratio</h3>
          ${stats.feedback.length ? `<div class="bars">${stats.feedback.map((f: any) => `<div class="bar-row"><span>${f.last_feedback}</span><span>${f.count}</span></div>`).join('')}</div>` : '<p>No feedback yet</p>'}
        </div>
        <div class="chart-card">
          <h3>Locale Distribution</h3>
          <div class="bars">${stats.locale.map((l: any) => `<div class="bar-row"><span>${l.locale}</span><span>${l.count}</span></div>`).join('')}</div>
        </div>
        <div class="chart-card">
          <h3>Push Time Distribution</h3>
          ${stats.pushDist.length ? `<div class="bars">${stats.pushDist.map((p: any) => `<div class="bar-row"><span>${String(p.push_hour).padStart(2,'0')}:${String(p.push_min).padStart(2,'0')}</span><span>${p.count}</span></div>`).join('')}</div>` : '<p>No custom push times set</p>'}
        </div>
      </div>

      <div class="nav-links">
        <a href="/users">👥 Users</a> · <a href="/plans">📋 Plans</a> · <a href="/feedback">👍 Feedback</a> · <a href="/usage">📊 Usage</a> · <a href="/referrals">🔗 Referrals</a> · <a href="/logout">🚪 Logout</a>
      </div>
    `));
  } catch (err) {
    res.send(renderPage('Error', `<p style="color:red">${(err as Error).message}</p>`));
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
    <table><thead><tr><th>Chat ID</th><th>Locale</th><th>Subscribed</th><th>Streak</th><th>Last Pushed</th><th>Push Time</th><th>Feedback</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="pagination">
      ${page > 1 ? `<a href="/users?page=${page-1}">← Prev</a>` : ''}
      <span>Page ${page} of ${totalPages}</span>
      ${page < totalPages ? `<a href="/users?page=${page+1}">Next →</a>` : ''}
    </div>
    <div class="nav-links"><a href="/">← Back to Dashboard</a></div>
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
    <table><thead><tr><th>ID</th><th>Chat ID</th><th>Name</th><th>Locale</th><th>Created</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" style="text-align:center">No saved plans</td></tr>'}</tbody></table>
    <div class="nav-links"><a href="/">← Back to Dashboard</a></div>
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
    <table><thead><tr><th>Chat ID</th><th>Locale</th><th>Feedback</th><th>Streak</th><th>Last Pushed</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" style="text-align:center">No feedback yet</td></tr>'}</tbody></table>
    <div class="nav-links"><a href="/">← Back to Dashboard</a></div>
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
    <table><thead><tr><th>Chat ID</th><th>Tier</th><th>Feature</th><th>Tokens</th><th>Created</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" style="text-align:center">No usage yet</td></tr>'}</tbody></table>
    <div class="nav-links"><a href="/">← Back to Dashboard</a></div>
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
    <table><thead><tr><th>Referred Chat ID</th><th>Locale</th><th>Their Referrals</th><th>Joined</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4" style="text-align:center">No referrals yet</td></tr>'}</tbody></table>
    <div class="nav-links"><a href="/">← Back to Dashboard</a></div>
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
  <style>
    :root { --bg:#1a1a2e; --card:#16213e; --fg:#e0e0e0; --muted:#8892b0; --accent:#0f3460; --border:#233; --accent2:#e94560; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:var(--bg); color:var(--fg); padding:20px; }
    h1 { font-size:1.8rem; margin-bottom:20px; }
    h3 { font-size:1rem; margin-bottom:12px; color:var(--muted); }
    .stats-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:16px; margin-bottom:32px; }
    .stat-card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:20px; text-align:center; }
    .stat-num { font-size:2rem; font-weight:700; color:var(--accent2); }
    .stat-label { font-size:0.8rem; color:var(--muted); margin-top:4px; }
    .charts { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:16px; margin-bottom:32px; }
    .chart-card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:20px; }
    .bars { display:flex; flex-direction:column; gap:8px; }
    .bar-row { display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--border); }
    table { width:100%; border-collapse:collapse; margin-bottom:20px; }
    th,td { padding:10px 14px; text-align:left; border-bottom:1px solid var(--border); }
    th { color:var(--muted); font-size:0.85rem; text-transform:uppercase; }
    tbody tr:hover { background:var(--card); }
    .nav-links { margin:20px 0; font-size:0.95rem; }
    .nav-links a { color:var(--accent2); text-decoration:none; }
    .nav-links a:hover { text-decoration:underline; }
    .pagination { display:flex; gap:16px; align-items:center; justify-content:center; margin:16px 0; }
    .pagination a { color:var(--accent2); text-decoration:none; }
  </style>
</head>
<body>
  <h1>📊 ${title}</h1>
  ${body}
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
