import 'dotenv/config';
import { migrateSchema, pool } from './store.js';

// We use dynamic import for better-sqlite3 since it's been uninstalled from the project.
// If the module isn't found, the script falls back to a raw SQLite file read via a minimal
// pure-node parser. For simplicity, we re-install better-sqlite3 temporarily.

async function loadSQLite(): Promise<any> {
  try {
    // @ts-ignore — better-sqlite3 uninstalled from project, temporarily reinstalled for migration
    return await import('better-sqlite3');
  } catch {
    console.error('better-sqlite3 not installed. Install it temporarily:');
    console.error('  npm install better-sqlite3');
    console.error('Then re-run: npm run migrate');
    process.exit(1);
  }
}

async function main() {
  const Database = (await loadSQLite()).default;
  const dbPath = process.env.MEALPLAN_DB_PATH || 'mealplan.db';

  console.log(`Migrating from ${dbPath} to PostgreSQL...`);

  const sqlite = new Database(dbPath, { readonly: true });

  // Migrate subscribers
  const subs = sqlite.prepare('SELECT * FROM subscribers').all();
  console.log(`Found ${subs.length} subscribers`);

  await migrateSchema();

  for (const s of subs) {
    const answers = s.answers || '{}';
    const locale = s.locale === 'bi' ? 'en' : (s.locale || 'en');
    const lastCuisines = s.last_cuisines || '[]';
    const lastAnswers = s.last_answers || null;
    const lastFeedback = s.last_feedback || null;

    await pool.query(
      `INSERT INTO subscribers (chat_id, answers, locale, subscribed, last_pushed, last_cuisines, streak, last_answers, last_feedback, push_hour, push_min)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (chat_id) DO UPDATE SET
         answers = EXCLUDED.answers,
         locale = EXCLUDED.locale,
         subscribed = EXCLUDED.subscribed,
         last_pushed = EXCLUDED.last_pushed,
         last_cuisines = EXCLUDED.last_cuisines,
         streak = EXCLUDED.streak,
         last_answers = EXCLUDED.last_answers,
         last_feedback = EXCLUDED.last_feedback,
         push_hour = EXCLUDED.push_hour,
         push_min = EXCLUDED.push_min`,
      [
        s.chat_id,
        answers,
        locale,
        s.subscribed ?? 0,
        s.last_pushed,
        lastCuisines,
        s.streak ?? 0,
        lastAnswers,
        lastFeedback,
        s.push_hour ?? null,
        s.push_min ?? null,
      ]
    );
    console.log(`  Migrated subscriber ${s.chat_id}`);
  }

  // Migrate plans
  let plansCount = 0;
  try {
    const plans = sqlite.prepare('SELECT * FROM plans').all();
    console.log(`Found ${plans.length} saved plans`);
    for (const p of plans) {
      await pool.query(
        `INSERT INTO plans (chat_id, name, answers, created)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (chat_id, name) DO UPDATE SET answers = EXCLUDED.answers, created = EXCLUDED.created`,
        [p.chat_id, p.name, p.answers, p.created || new Date().toISOString()]
      );
      plansCount++;
      console.log(`  Migrated plan "${p.name}" for chat_id ${p.chat_id}`);
    }
  } catch {
    console.log('No plans table found in SQLite (skipping)');
  }

  // Verify
  const pgSubs = await pool.query('SELECT COUNT(*) FROM subscribers');
  const pgPlans = await pool.query('SELECT COUNT(*) FROM plans');
  console.log('\n── Migration complete ──');
  console.log(`  Subscribers: SQLite=${subs.length} → PG=${pgSubs.rows[0].count}`);
  console.log(`  Plans:       SQLite=${plansCount} → PG=${pgPlans.rows[0].count}`);

  sqlite.close();
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
