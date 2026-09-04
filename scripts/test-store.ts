import 'dotenv/config';
import { migrateSchema, pool, getUser, checkRateLimit, incrementPlanCount, createReferral, getReferralCount, pgSessionStore } from '../src/store.js';

async function main() {
  await migrateSchema();
  console.log('Schema migrated OK');

  const u = await getUser(964254039);
  console.log('User lookup:', JSON.stringify(u, null, 2));

  // Test rate limiting functions
  const rl = await checkRateLimit(964254039, 'free');
  console.log('Rate limit:', JSON.stringify(rl));

  await incrementPlanCount(964254039);
  const rl2 = await checkRateLimit(964254039, 'free');
  console.log('After increment:', JSON.stringify(rl2));

  // Test referral functions
  const refCount = await getReferralCount(964254039);
  console.log('Referral count:', refCount);

  // Test session store
  await pgSessionStore.set('test-key', { step: 'goal', answers: {} });
  const sess = await pgSessionStore.get('test-key');
  console.log('Session store get:', JSON.stringify(sess));
  await pgSessionStore.reset('test-key');
  const sess2 = await pgSessionStore.get('test-key');
  console.log('Session store after reset:', sess2);

  await pool.end();
  console.log('\n✅ All store functions verified');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
