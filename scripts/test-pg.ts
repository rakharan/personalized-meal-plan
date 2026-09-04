import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT || 5432),
  user: process.env.PG_USER || 'mealplan',
  password: process.env.PG_PASSWORD || '',
  database: process.env.PG_DATABASE || 'mealplan',
  connectionTimeoutMillis: 5000,
});

async function main() {
  const res = await pool.query('SELECT version()');
  console.log('PG connected:', res.rows[0].version);

  const tables = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  console.log('Tables:', tables.rows.map((r: any) => r.table_name).join(', '));

  for (const t of ['subscribers', 'plans', 'bot_sessions', 'usage_log', 'referrals']) {
    try {
      const count = await pool.query(`SELECT COUNT(*)::int FROM ${t}`);
      console.log(`${t}: ${count.rows[0].count} rows`);
    } catch (e: any) {
      console.log(`${t}: ${e.message}`);
    }
  }

  const users = await pool.query('SELECT chat_id, locale, subscribed, tier, streak, daily_plan_count FROM subscribers ORDER BY chat_id LIMIT 5');
  console.log('Sample users:', JSON.stringify(users.rows, null, 2));

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('PG connection failed:', err.message);
  process.exit(1);
});
