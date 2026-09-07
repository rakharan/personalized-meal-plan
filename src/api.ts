// Saji API server — Express API-only (replaces dashboard.ts)
// Serves JSON API + static built SPA from web/dist/

import 'dotenv/config';
import express from 'express';
import { pool, migrateSchema } from './store.js';
import {
  createUserProfile, getUserByEmail, getUserById, getUserByTelegramChatId,
  getSubscribedWebUsers, updateUserProfile, linkTelegramAccount, createTelegramLinkToken,
  consumeTelegramLinkToken, savePlanHistory, getPlanHistory,
  saveWhatsAppOTP, verifyWhatsAppOTP,
  getDAU, getMAU, getConversion, getTokenEconomics, getPlanTrend, getRetention, getFeatureUsage, getActivityByHour, getCuisinePopularity, getChurnRate,
} from './store.js';
import { hashPassword, verifyPassword, signToken, userAuth, DUMMY_HASH } from './auth.js';
import {
  validateEmail, validatePassword, validateAge, validateHeight, validateWeight,
  validateCalories, validateProtein, validatePhone, sanitizeText, calcTDEE, suggestProtein,
} from './validate.js';
import { generateMealPlan, generateCookingSteps, regenerateMeal, parseCuisine } from './llmClient.js';
import { createDeliveryManager, deliverPlan } from './delivery.js';
import type { Request, Response } from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { randomBytes, randomInt } from 'node:crypto';
import { Telegraf } from 'telegraf';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.DASHBOARD_PORT ?? 3000);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme';
const BOT_USERNAME = process.env.BOT_USERNAME || 'personalized_meal_planner_bot';

const app = express();
app.use(express.json());

// ────────────────────────────────────────────────────────────────────────────
// Auth middleware
// ────────────────────────────────────────────────────────────────────────────
function authCheck(req: Request, res: Response, next: any): void {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (token === ADMIN_TOKEN) { next(); return; }
  res.status(401).json({ error: 'Unauthorized' });
}

// ────────────────────────────────────────────────────────────────────────────
// API routes
// ────────────────────────────────────────────────────────────────────────────
app.get('/api/stats', authCheck, async (_req, res) => {
  const [total, subs] = await Promise.all([
    pool.query('SELECT COUNT(*)::int FROM subscribers'),
    pool.query("SELECT COUNT(*)::int FROM subscribers WHERE subscribed = 1"),
  ]);
  res.json({ totalUsers: total.rows[0].count, activeSubs: subs.rows[0].count });
});

app.get('/api/overview', authCheck, async (_req, res) => {
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

    res.json({
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
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/users', authCheck, async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = 50;
  const offset = (page - 1) * limit;
  const [result, countResult] = await Promise.all([
    pool.query('SELECT chat_id, locale, subscribed, streak, last_pushed, push_hour, push_min, last_feedback, tier, created_at FROM subscribers ORDER BY chat_id DESC LIMIT $1 OFFSET $2', [limit, offset]),
    pool.query('SELECT COUNT(*)::int FROM subscribers'),
  ]);
  res.json({
    rows: result.rows.map((r: any) => ({
      chatId: r.chat_id,
      locale: r.locale,
      subscribed: !!r.subscribed,
      streak: r.streak,
      lastPushed: r.last_pushed,
      pushHour: r.push_hour,
      pushMin: r.push_min,
      lastFeedback: r.last_feedback,
      tier: r.tier,
      createdAt: r.created_at,
    })),
    total: countResult.rows[0].count,
    page,
    totalPages: Math.ceil(countResult.rows[0].count / limit),
  });
});

app.get('/api/plans', authCheck, async (_req, res) => {
  const result = await pool.query(`
    SELECT p.id, p.chat_id, p.name, p.created, s.locale
    FROM plans p LEFT JOIN subscribers s ON s.chat_id = p.chat_id
    ORDER BY p.created DESC LIMIT 200
  `);
  res.json({ rows: result.rows.map((r: any) => ({
    id: r.id, chatId: r.chat_id, name: r.name, locale: r.locale || '—',
    created: new Date(r.created).toISOString(),
  })) });
});

app.get('/api/feedback', authCheck, async (_req, res) => {
  const result = await pool.query(`
    SELECT chat_id, locale, last_feedback, streak, last_pushed
    FROM subscribers WHERE last_feedback IS NOT NULL
    ORDER BY last_pushed DESC LIMIT 200
  `);
  const rows = result.rows.map((r: any) => ({
    chatId: r.chat_id, locale: r.locale, feedback: r.last_feedback,
    streak: r.streak, lastPushed: r.last_pushed,
  }));
  const good = rows.filter(r => r.feedback === 'good').length;
  const bad = rows.filter(r => r.feedback === 'bad').length;
  const ratio = good + bad > 0 ? Math.round((good / (good + bad)) * 100) : 0;
  res.json({ rows, good, bad, ratio });
});

app.get('/api/usage', authCheck, async (_req, res) => {
  const result = await pool.query(`
    SELECT u.chat_id, u.tokens, u.feature, u.created, s.locale, s.tier
    FROM usage_log u LEFT JOIN subscribers s ON s.chat_id = u.chat_id
    ORDER BY u.created DESC LIMIT 200
  `);
  const rows = result.rows.map((r: any) => ({
    chatId: r.chat_id, tier: r.tier || '—', feature: r.feature,
    tokens: r.tokens, created: new Date(r.created).toISOString(),
  }));
  const totalTokens = rows.reduce((sum: number, r: any) => sum + Number(r.tokens), 0);
  res.json({ rows, totalTokens });
});

app.get('/api/referrals', authCheck, async (_req, res) => {
  const result = await pool.query(`
    SELECT r.referred_id, r.created, s_ref.locale AS ref_locale,
           (SELECT COUNT(*) FROM referrals r2 WHERE r2.referrer_id = r.referred_id) AS their_referrals
    FROM referrals r LEFT JOIN subscribers s_ref ON s_ref.chat_id = r.referred_id
    ORDER BY r.created DESC LIMIT 200
  `);
  res.json({ rows: result.rows.map((r: any) => ({
    referredId: r.referred_id, locale: r.ref_locale || '—',
    theirReferrals: r.their_referrals,
    created: new Date(r.created).toISOString(),
  })) });
});

// ────────────────────────────────────────────────────────────────────────────
// User auth — register, login, me
// ────────────────────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { email, password, full_name } = req.body;
  const validEmail = validateEmail(email || '');
  const validPw = validatePassword(password || '');
  const name = sanitizeText(full_name || '', 80);
  if (!validEmail) { res.status(400).json({ error: 'Email nggak valid' }); return; }
  if (!validPw) { res.status(400).json({ error: 'Password minimal 6 karakter' }); return; }
  if (!name) { res.status(400).json({ error: 'Nama nggak boleh kosong' }); return; }

  const existing = await getUserByEmail(validEmail);
  if (existing) { res.status(409).json({ error: 'Email udah terdaftar' }); return; }

  const hash = await hashPassword(validPw);
  const userId = await createUserProfile({ email: validEmail, password_hash: hash, full_name: name });
  const token = signToken(userId);
  res.json({ token, user: { id: userId, email: validEmail, full_name: name } });
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const validEmail = validateEmail(email || '');
  if (!validEmail) { res.status(400).json({ error: 'Email nggak valid' }); return; }

  const user = await getUserByEmail(validEmail);
  // Timing-attack safe: always run bcrypt even if user not found
  const { rows } = user
    ? await pool.query('SELECT password_hash FROM user_profiles WHERE email = $1', [validEmail])
    : { rows: [{ password_hash: DUMMY_HASH }] };
  const ok = await verifyPassword(password || '', rows[0]?.password_hash || DUMMY_HASH);

  if (!user || !ok) { res.status(401).json({ error: 'Email atau password salah' }); return; }

  const token = signToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name } });
});

app.get('/api/auth/me', userAuth, async (req: Request, res: Response) => {
  const user = await getUserById((req as any).userId);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  const { password_hash, ...safe } = user as any;
  res.json({ user: safe });
});

app.post('/api/auth/delete', userAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  await pool.query('DELETE FROM user_profiles WHERE id = $1', [userId]);
  res.json({ deleted: true });
});

// ────────────────────────────────────────────────────────────────────────────
// User profile — update, get
// ────────────────────────────────────────────────────────────────────────────
app.put('/api/profile', userAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const updates: Record<string, any> = {};

  const fields = [
    'full_name', 'age', 'gender', 'height_cm', 'weight_kg', 'activity_level',
    'cooking_skill', 'household_size', 'has_children', 'budget_tier',
    'health_conditions', 'allergies', 'dietary_restrictions', 'goal',
    'target_calories', 'target_protein', 'cuisine_rotation', 'meals_per_day',
    'disliked_ingredients', 'delivery_channel', 'locale',
  ];

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates[f] = req.body[f];
    }
  }

  // Validate numeric fields
  if (updates.age !== undefined) {
    const v = validateAge(updates.age);
    if (v === null) { res.status(400).json({ error: 'Umur harus 10-120' }); return; }
    updates.age = v;
  }
  if (updates.height_cm !== undefined) {
    const v = validateHeight(updates.height_cm);
    if (v === null) { res.status(400).json({ error: 'Tinggi harus 100-250 cm' }); return; }
    updates.height_cm = v;
  }
  if (updates.weight_kg !== undefined) {
    const v = validateWeight(updates.weight_kg);
    if (v === null) { res.status(400).json({ error: 'Berat harus 30-300 kg' }); return; }
    updates.weight_kg = v;
  }
  if (updates.target_calories !== undefined && updates.target_calories !== null) {
    const v = validateCalories(String(updates.target_calories));
    if (v === null) { res.status(400).json({ error: 'Kalori harus 800-5000' }); return; }
    updates.target_calories = Number(v);
  }
  if (updates.target_protein !== undefined && updates.target_protein !== null) {
    const v = validateProtein(String(updates.target_protein));
    if (v === null) { res.status(400).json({ error: 'Protein harus 20-500g' }); return; }
    updates.target_protein = Number(v);
  }

  await updateUserProfile(userId, updates);
  const updated = await getUserById(userId);
  const { password_hash, ...safe } = (updated as any) || {};
  res.json({ user: safe });
});

// Auto-calculate TDEE + suggest protein
app.post('/api/profile/calc-targets', userAuth, async (req: Request, res: Response) => {
  const { gender, weight_kg, height_cm, age, activity_level, goal } = req.body;
  if (!gender || !weight_kg || !height_cm || !age || !activity_level || !goal) {
    res.status(400).json({ error: 'Semua field diperlukan' });
    return;
  }
  const tdee = calcTDEE(gender, Number(weight_kg), Number(height_cm), Number(age), activity_level);
  const protein = suggestProtein(goal, Number(weight_kg));
  // Adjust calories based on goal
  let targetCalories = tdee;
  if (goal === 'weight_loss') targetCalories = Math.round(tdee * 0.85);
  if (goal === 'muscle_gain') targetCalories = Math.round(tdee * 1.1);
  res.json({ tdee, targetCalories, targetProtein: protein });
});

// ────────────────────────────────────────────────────────────────────────────
// Telegram account linking
// ────────────────────────────────────────────────────────────────────────────
app.post('/api/profile/connect-telegram', userAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const token = await createTelegramLinkToken(userId);
  const link = `https://t.me/${BOT_USERNAME}?start=link_${token}`;
  res.json({ link, token });
});

// ────────────────────────────────────────────────────────────────────────────
// WhatsApp linking (OTP)
// ────────────────────────────────────────────────────────────────────────────
app.post('/api/profile/connect-whatsapp', userAuth, async (req: Request, res: Response) => {
  const { phone } = req.body;
  const validPhone = validatePhone(phone || '');
  if (!validPhone) { res.status(400).json({ error: 'Nomor HP nggak valid. Format: 08xxx atau +628xxx' }); return; }

  // Generate 6-digit OTP using crypto.randomInt (not Math.random)
  const code = String(randomInt(100000, 1000000));
  await saveWhatsAppOTP(validPhone, code);

  const waToken = process.env.WHATSAPP_TOKEN;
  const waPhoneId = process.env.WHATSAPP_PHONE_ID;
  if (waToken && waPhoneId) {
    const waVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';
    try {
      await fetch(`https://graph.facebook.com/${waVersion}/${waPhoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: validPhone.replace('+', ''),
          type: 'text',
          text: { body: `Kode verifikasi Saji: ${code}` },
        }),
      });
    } catch (e) {
      console.error('WhatsApp OTP send failed:', e);
    }
  }

  // Never return OTP code in production. Dev mode only for local testing.
  const isDev = process.env.NODE_ENV !== 'production';
  res.json({ sent: true, devCode: (isDev && !waToken) ? code : undefined });
});

app.post('/api/profile/verify-whatsapp', userAuth, async (req: Request, res: Response) => {
  const { phone, code } = req.body;
  const validPhone = validatePhone(phone || '');
  if (!validPhone) { res.status(400).json({ error: 'Nomor HP nggak valid' }); return; }

  const ok = await verifyWhatsAppOTP(validPhone, String(code || ''));
  if (!ok) { res.status(400).json({ error: 'Kode salah atau kedaluwarsa' }); return; }

  const userId = (req as any).userId;
  await updateUserProfile(userId, { whatsapp_phone: validPhone, whatsapp_verified: true });
  res.json({ verified: true });
});

// ────────────────────────────────────────────────────────────────────────────
// Meal plan generation + history
// ────────────────────────────────────────────────────────────────────────────
app.post('/api/plans/generate', userAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const user = await getUserById(userId);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  try {
    // Build answers from user profile
    const answers: Record<string, any> = {
      goal: user.goal || 'general_health',
      restrictions: user.dietary_restrictions || '',
      allergies: user.allergies || '',
      calories: user.target_calories ? String(user.target_calories) : '',
      protein: user.target_protein ? String(user.target_protein) : '',
      mealsPerDay: String(user.meals_per_day || 3),
      cuisine: user.cuisine_rotation || 'rotate',
    };

    const plan = await generateMealPlan(answers, {
      locale: user.locale as 'en' | 'id',
      avoidCuisines: [],
      profileContext: {
        age: user.age, gender: user.gender, height_cm: user.height_cm,
        weight_kg: user.weight_kg, activity_level: user.activity_level,
        cooking_skill: user.cooking_skill, household_size: user.household_size,
        budget_tier: user.budget_tier, health_conditions: user.health_conditions,
        disliked_ingredients: user.disliked_ingredients,
      },
    });

    const cuisine = parseCuisine(plan);
    await savePlanHistory(userId, plan, cuisine, user.target_calories, user.target_protein);
    res.json({ plan, cuisine });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/plans/history', userAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const history = await getPlanHistory(userId);
  res.json({ plans: history });
});

app.post('/api/plans/cooking-steps', userAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const user = await getUserById(userId);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  // Get latest plan from history
  const history = await getPlanHistory(userId, 1);
  if (!history.length) { res.status(400).json({ error: 'Belum ada rencana makan. Generate dulu ya!' }); return; }

  try {
    const steps = await generateCookingSteps(history[0].planText, user.locale as 'en' | 'id');
    res.json({ steps });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/plans/regenerate-meal', userAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { mealName, planText } = req.body;
  if (!mealName || !planText) { res.status(400).json({ error: 'mealName dan planText diperlukan' }); return; }

  const user = await getUserById(userId);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  try {
    const answers: Record<string, any> = {
      goal: user.goal || 'general_health',
      restrictions: user.dietary_restrictions || '',
      allergies: user.allergies || '',
      calories: user.target_calories ? String(user.target_calories) : '',
      protein: user.target_protein ? String(user.target_protein) : '',
    };

    const newMeal = await regenerateMeal(planText, mealName, user.locale as 'en' | 'id', answers);
    res.json({ meal: newMeal });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Admin: telegram link consumption (called by bot)
// ────────────────────────────────────────────────────────────────────────────
app.post('/api/bot/consume-link', async (req: Request, res: Response) => {
  const { token, chat_id } = req.body;
  const adminTok = req.headers.authorization?.replace('Bearer ', '');
  if (adminTok !== ADMIN_TOKEN) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const userId = await consumeTelegramLinkToken(String(token || ''));
  if (!userId) { res.status(400).json({ error: 'Token invalid or expired' }); return; }

  await linkTelegramAccount(userId, Number(chat_id));
  const user = await getUserById(userId);
  res.json({ linked: true, user: user ? { id: user.id, full_name: user.full_name, goal: user.goal } : null });
});

// ────────────────────────────────────────────────────────────────────────────
// Daily scheduler for web users
// ────────────────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
let deliveryAdapters: any[] = [];

function userPushDue(user: any, now = new Date()): boolean {
  const h = user.push_hour ?? 8;
  const m = user.push_min ?? 0;
  return now.getHours() === h && now.getMinutes() === m && now.getSeconds() < 60;
}

async function pushDailyPlansWeb(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const subs = await getSubscribedWebUsers();
  for (const sub of subs) {
    if (!userPushDue(sub)) continue;

    // Skip if already pushed today
    const history = await getPlanHistory(sub.id, 1);
    if (history.length && new Date(history[0].created).toISOString().slice(0, 10) === today) continue;

    try {
      const answers: Record<string, any> = {
        goal: sub.goal || 'general_health',
        restrictions: sub.dietary_restrictions || '',
        allergies: sub.allergies || '',
        calories: sub.target_calories ? String(sub.target_calories) : '',
        protein: sub.target_protein ? String(sub.target_protein) : '',
        mealsPerDay: String(sub.meals_per_day || 3),
        cuisine: sub.cuisine_rotation || 'rotate',
      };

      const plan = await generateMealPlan(answers, {
        locale: sub.locale as 'en' | 'id',
        profileContext: {
          age: sub.age, gender: sub.gender, height_cm: sub.height_cm,
          weight_kg: sub.weight_kg, activity_level: sub.activity_level,
          cooking_skill: sub.cooking_skill, household_size: sub.household_size,
          budget_tier: sub.budget_tier, health_conditions: sub.health_conditions,
          disliked_ingredients: sub.disliked_ingredients,
        },
      });

      const cuisine = parseCuisine(plan);
      await savePlanHistory(sub.id, plan, cuisine, sub.target_calories, sub.target_protein);

      // Deliver via Telegram if linked
      if (sub.telegram_chat_id && deliveryAdapters.length) {
        await deliverPlan(deliveryAdapters, sub.telegram_chat_id, plan);
      }

      console.log(`Pushed daily plan to web user ${sub.id} (${sub.full_name})`);
    } catch (err) {
      console.error(`Daily push failed for web user ${sub.id}:`, err);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Admin: actionable metrics
// ────────────────────────────────────────────────────────────────────────────
app.get('/api/metrics', authCheck, async (_req: Request, res: Response) => {
  try {
    const [dau, mau, conversion, tokenEcon, planTrend, retention, featureUsage, activityByHourData, cuisinePop, churn] = await Promise.all([
      getDAU(30),
      getMAU(),
      getConversion(),
      getTokenEconomics(30),
      getPlanTrend(14),
      getRetention(),
      getFeatureUsage(30),
      getActivityByHour(),
      getCuisinePopularity(),
      getChurnRate(),
    ]);
    res.json({
      dau,
      mau,
      conversion,
      tokenEconomics: tokenEcon,
      planTrend,
      retention,
      featureUsage,
      activityByHour: activityByHourData,
      cuisinePopularity: cuisinePop,
      churn,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Static SPA serving (production)
// ────────────────────────────────────────────────────────────────────────────
const spaPath = join(__dirname, '..', 'web', 'dist');
if (existsSync(spaPath)) {
  app.use(express.static(spaPath));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(join(spaPath, 'index.html'));
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Startup
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  await migrateSchema();

  // Init Telegram delivery adapter for web user pushes
  if (BOT_TOKEN) {
    const bot = new Telegraf(BOT_TOKEN);
    deliveryAdapters = createDeliveryManager(bot.telegram);
  }

  app.listen(PORT, () => {
    console.log(`Saji API running at http://localhost:${PORT}`);
  });

  // Start daily push scheduler (checks every minute)
  setInterval(() => { pushDailyPlansWeb(); }, 60_000);
  console.log('Daily push scheduler started');
}

main().catch((err) => {
  console.error('API startup failed:', err);
  process.exit(1);
});
