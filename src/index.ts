import 'dotenv/config';
import { Telegraf, session, Markup } from 'telegraf';
import {
    generateMealPlan, generateShoppingList, generateMacros, parseCuisine,
    generateWeeklyPlan, generateCookingSteps, setUsageCallback, regenerateMeal,
    generateLeftoverRemix,
} from './llmClient.js';
import {
    saveUser, getUser, ensureUser, setSubscribed, getSubscribedUsers,
    setLastPushed, setLocale, bumpStreak, resetStreak,
    setLastAnswers, setLastCuisines, setLastFeedback, setPushTime,
    savePlan, getPlans, getPlan, deletePlan, closePool, migrateSchema,
    pgSessionStore, checkRateLimit, incrementPlanCount, logUsage,
    createReferral, getReferralCount,
    getUserByTelegramChatId,
    saveBotPlan, getBotPlanHistory, getBotPlanByDate, updateBotPlanMeals,
    logPush, parsePlanMeals,
    markCooked, getWebUserStreak, getYesterdayPlanText,
} from './store.js';
import type { Answers, User, ParsedMeal } from './store.js';
import {
    sanitizeText, validateCalories, validateProtein, validateTimeFormat,
    validatePlanName,
} from './validate.js';
import { createDeliveryManager, deliverPlan } from './delivery.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error('Missing TELEGRAM_BOT_TOKEN in .env');
    process.exit(1);
}

const DAILY_PUSH_HOUR = Number(process.env.DAILY_PUSH_HOUR ?? 8);
const DAILY_PUSH_MIN = Number(process.env.DAILY_PUSH_MIN ?? 0);

type Locale = 'en' | 'id';
type StepKey = 'goal' | 'restrictions' | 'allergies' | 'calories' | 'mealsPerDay' | 'protein' | 'cuisine' | 'preview';

interface SessionState {
    step: string;
    answers: Record<string, string | null>;
    history: string[];
    locale: Locale;
    awaitingFreeText?: string;
    awaitingTime?: boolean;
    awaitingPlanName?: boolean;
    editingField?: string;
    lastPlanText?: string;
    lastBotPlanId?: number;
}

const bot = new Telegraf(BOT_TOKEN);
// PG-backed session store — Telegraf AsyncSessionStore expects get/set/delete,
// pgSessionStore has get/set/reset. Wrap to map delete→reset.
const asyncStore = {
    get: (key: string) => pgSessionStore.get(key),
    set: (key: string, val: any) => pgSessionStore.set(key, val),
    delete: (key: string) => pgSessionStore.reset(key),
};
bot.use(session({ store: asyncStore as any }));

// Delivery adapters — created once at startup. Email/WhatsApp auto-activate
// if their env vars are set.
const deliveryAdapters = createDeliveryManager(bot.telegram);

// ────────────────────────────────────────────────────────────────────────────
// i18n — all user-facing strings, keyed by locale ('en' | 'id')
// ────────────────────────────────────────────────────────────────────────────
const I18N: Record<string, Record<Locale, string | ((...args: any[]) => string)>> = {
    start: {
        en: (name: string) => `Hey${name ? ` ${name}` : ''}! I'm Saji 🍽️. I'll help you eat well every day with ingredients you can actually find. Tap below to start.`,
        id: (name: string) => `Halo${name ? ` ${name}` : ''}! Aku Saji 🍽️. Bakal bantu kamu makan enak + sehat setiap hari, pakai bahan yang gampang cari di Indonesia. Ketuk di bawah untuk mulai.`,
    },
    start_plan: { en: '🍱 Start /mealplan', id: '🍱 Mulai /mealplan' },
    start_lang: { en: '🌐 Set language', id: '🌐 Ganti bahasa' },
    start_help: { en: '❓ How it works', id: '❓ Cara kerja' },

    help: {
        en: 'How it works:\n1. /mealplan — answer a few questions (tap buttons)\n2. Preview, then Generate\n3. Get a meal plan with calories + protein\n4. 🛒 Shopping list or 📊 Macros\n5. 🎲 Regenerate for a different plan\n6. /subscribe for a fresh plan daily',
        id: 'Cara kerja:\n1. /mealplan — jawab beberapa pertanyaan (ketuk tombol)\n2. Pratinjau, lalu Buat\n3. Dapat rencana makan + kalori + protein\n4. Tombol 🛒 Daftar belanja atau 📊 Makro\n5. 🎲 Regenerasi untuk rencana berbeda\n6. /subscribe untuk rencana harian otomatis',
    },

    goal: { en: "What's your main goal?", id: 'Apa tujuan utama kamu?' },
    restrictions: { en: 'Any dietary restrictions?', id: 'Pantangan diet?' },
    allergies: { en: 'Any allergies or ingredients to avoid?', id: 'Alergi atau bahan yang harus dihindari?' },
    calories: { en: 'Target daily calories?', id: 'Target kalori harian?' },
    mealsPerDay: { en: 'How many meals per day?', id: 'Berapa kali makan per hari?' },
    protein: { en: 'Target daily protein (grams)?', id: 'Target protein harian (gram)?' },
    cuisine: {
        en: 'Cuisine preference? (rotate daily, or pick one — ingredients available in Indonesia)',
        id: 'Preferensi masakan? (putar harian, atau pilih satu — bahan tersedia di Indonesia)',
    },
    done: { en: "Sip — generating your meal plan, hang on...", id: "Sip — sedang bikin rencana makan kamu, tunggu sebentar..." },
    back: { en: '◀️ Back', id: '◀️ Kembali' },
    other: { en: '✏️ Other (type)', id: '✏️ Lain (ketik)' },
    skip: { en: '⏭ Skip', id: '⏭ Skip' },
    none: { en: 'None', id: 'Tidak ada' },

    preview: { en: '📋 Here are your answers. Generate?', id: '📋 Ini jawabanmu. Buat rencana?' },
    confirm_generate: { en: '✅ Generate', id: '✅ Buat dong!' },
    confirm_edit: { en: '✏️ Edit', id: '✏️ Ubah' },
    confirm_cancel: { en: '❌ Cancel', id: '❌ Batal' },

    reroll: { en: '🎲 Regenerate', id: '🎲 Regenerasi' },
    shop: { en: '🛒 Shopping list', id: '🛒 Daftar belanja' },
    macros: { en: '📊 Macros', id: '📊 Makro' },
    cook: { en: '🍳 Cook', id: '🍳 Masak' },
    good: { en: '👍 Good', id: '👍 Bagus' },
    bad: { en: '👎 Try again', id: '👎 Ulangi' },

    subscribed: {
        en: (h: string, m: string) => `You're in! A fresh plan will arrive daily at ${h}:${m}. /settime to change, /unsubscribe to stop.`,
        id: (h: string, m: string) => `Mantap, kamu langganan! Rencana baru dikirim harian pukul ${h}:${m}. /settime ubah, /unsubscribe berhenti.`,
    },
    unsubscribed: { en: 'Paused. /subscribe to resume anytime.', id: 'Berhenti langganan. /subscribe untuk lanjut kapan saja.' },
    not_subscribed: { en: 'Not subscribed', id: 'Belum langganan' },
    subscribed_state: { en: 'Subscribed', id: 'Berlangganan' },
    need_mealplan: {
        en: "You haven't done /mealplan yet. Let's fix that first!",
        id: "Kamu belum selesai /mealplan. Yuk selesaikan dulu!",
    },
    settime_pick: {
        en: 'Pick your daily push time (tap a slot):',
        id: 'Pilih jam kirim harian (ketuk):',
    },
    settime_set: {
        en: (h: string, m: string) => `Push time set to ${h}:${m} daily.`,
        id: (h: string, m: string) => `Jam kirim diatur ke ${h}:${m} harian.`,
    },
    settime_custom: {
        en: 'Send the time as HH:MM (24h, e.g. 07:30).',
        id: 'Kirim waktu dalam format HH:MM (24 jam, mis. 07:30).',
    },
    edit_plan: { en: '✏️ Edit', id: '✏️ Ubah' },
    save_plan: { en: '💾 Save', id: '💾 Simpan' },
    plans_list: { en: '📋 Your saved plans:', id: '📋 Rencana tersimpan:' },
    no_plans: { en: 'No saved plans yet. Send /save <name> after generating a plan.', id: 'Belum ada rencana tersimpan. Ketik /save <nama> setelah buat rencana.' },
    save_prompt: {
        en: 'Send the plan name (e.g. "bulking"). Reply with a name to save current answers.',
        id: 'Kirim nama rencana (mis. "bulking"). Balas dengan nama untuk simpan jawaban saat ini.',
    },
    save_done: {
        en: (n: string) => `Saved plan "${n}". Use /plans to load it later.`,
        id: (n: string) => `Rencana "${n}" disimpan. Ketik /plans untuk muat nanti.`,
    },
    save_empty: {
        en: 'No answers to save yet. Run /mealplan first.',
        id: 'Belum ada jawaban untuk disimpan. Jalankan /mealplan dulu.',
    },
    plan_load: {
        en: (n: string) => `Loaded "${n}". Preview below — edit or generate.`,
        id: (n: string) => `Dimuat "${n}". Pratinjau di bawah — ubah atau buat.`,
    },
    plan_delete: { en: '🗑 Delete', id: '🗑 Hapus' },
    plan_generate: { en: '✅ Generate', id: '✅ Buat' },
    plan_deleted: { en: 'Plan deleted.', id: 'Rencana dihapus.' },
    plans_none_to_show: { en: 'No saved plans.', id: 'Tidak ada rencana tersimpan.' },
    lang_set: { en: 'Language set to English.', id: 'Bahasa diatur ke Bahasa Indonesia.' },
    pick_lang: { en: 'Pick your language:', id: 'Pilih bahasa:' },
    cancelled: { en: 'Cancelled. /mealplan to start again.', id: 'Dibatalkan. /mealplan mulai lagi.' },
    idle: { en: 'Send /mealplan to build a new plan.', id: 'Ketik /mealplan untuk buat rencana baru.' },
    edit_pick: { en: 'Which answer to edit?', id: 'Ubah jawaban mana?' },
    generating: { en: 'Generating...', id: 'Membuat...' },
    cooking_done: { en: 'Cooking up instructions...', id: 'Bikin panduan masak...' },
    shopping_done: { en: 'Generating shopping list...', id: 'Membuat daftar belanja...' },
    macros_done: { en: 'Computing macros...', id: 'Menghitung makro...' },
    err: {
        en: (m: string) => `Couldn't generate: ${m}. Try /mealplan again.`,
        id: (m: string) => `Gagal membuat: ${m}. Coba /mealplan lagi.`,
    },
    streak_msg: {
        en: (n: number) => n > 0 ? `🔥 Day ${n} streak! Keep it up!` : '',
        id: (n: number) => n > 0 ? `🔥 Hari ke-${n} kamu konsisten! Mantap!` : '',
    },
    missed: {
        en: 'Missed yesterday? No worries. /mealplan to restart your streak.',
        id: 'Ketinggalan kemarin? Nggak masalah. /mealplan untuk mulai lagi.',
    },
    rate_limited: {
        en: (limit: number) => `Daily limit reached (${limit} plans/day). Resets tomorrow. Gas lagi besok!`,
        id: (limit: number) => `Batas harian tercapai (${limit} rencana/hari). Reset besok. Gas lagi besok ya!`,
    },
    weekly_done: { en: 'Cooking up your 7-day plan...', id: 'Bikin rencana 7 hari nih...' },
    invite_msg: {
        en: (link: string) => `Share Saji with friends:\n${link}`,
        id: (link: string) => `Ajak teman pakai Saji:\n${link}`,
    },
    invite_count: {
        en: (n: number) => `You've invited ${n} friend(s).`,
        id: (n: number) => `Kamu udah ajak ${n} teman.`,
    },
    onboarding: {
        en: 'Welcome! I make daily meal plans from your preferences — calories, protein, cuisine. Takes 30 seconds. Tap Start below.',
        id: 'Selamat datang! Aku bikin rencana makan harian dari preferensimu — kalori, protein, masakan. Cuma 30 detik. Ketuk Mulai di bawah.',
    },
    invalid_input: {
        en: "Hmm, that doesn't look right. Try again?",
        id: 'Hmm, kayaknya nggak tepat. Coba lagi?',
    },
    invalid_calories: {
        en: 'Calories must be 800–5000. Try again?',
        id: 'Kalori harus 800–5000. Coba lagi?',
    },
    invalid_protein: {
        en: 'Protein must be 20–500g. Try again?',
        id: 'Protein harus 20–500g. Coba lagi?',
    },
    today_none: {
        en: 'No plan today yet. /mealplan to make one.',
        id: 'Belum ada rencana hari ini. /mealplan untuk buat.',
    },
    yesterday_none: {
        en: 'No plan from yesterday.',
        id: 'Nggak ada rencana kemarin.',
    },
    summary_title: { en: '📊 This Week', id: '📊 Minggu Ini' },
    summary_plans: {
        en: (n: number) => `${n} plans generated`,
        id: (n: number) => `${n} rencana dibuat`,
    },
    summary_streak: {
        en: (n: number) => `🔥 ${n} day streak`,
        id: (n: number) => `🔥 ${n} hari beruntun`,
    },
    summary_cuisine: { en: 'Top cuisine', id: 'Masakan teratas' },
    summary_avg_cal: { en: 'Avg calories', id: 'Rata-rata kalori' },
    nudge_msg: {
        en: 'Hey! No plan yet today. Want me to make one?',
        id: 'Hai! Belum ada rencana makan hari ini. Mau aku bikinin?',
    },
    nudge_btn: { en: '✅ Yes please', id: '✅ Gas!' },
    regen_pick: { en: 'Which meal to replace?', id: 'Mau ganti yang mana?' },
    rate_remaining: {
        en: (n: number) => `(${n} left today)`,
        id: (n: number) => `(sisa ${n} hari ini)`,
    },
    nl_detect: {
        en: (pref: string) => `Got it — making a plan with: ${pref}...`,
        id: (pref: string) => `Oke — bikin rencana dengan: ${pref}...`,
    },
};

const STEP_ORDER: StepKey[] = ['goal', 'restrictions', 'allergies', 'calories', 'mealsPerDay', 'protein', 'cuisine', 'preview'];

const KEYBOARDS: Record<string, { text: string; callback_data: string }[][]> = {
    goal: [
        [{ text: 'Weight loss', callback_data: 'ans_goal_Weight loss' }, { text: 'Muscle gain', callback_data: 'ans_goal_Muscle gain' }],
        [{ text: 'Maintenance', callback_data: 'ans_goal_Maintenance' }, { text: 'General health', callback_data: 'ans_goal_General health' }],
    ],
    restrictions: [
        [{ text: 'Halal', callback_data: 'ans_restrictions_Halal' }, { text: 'Vegetarian', callback_data: 'ans_restrictions_Vegetarian' }],
        [{ text: 'Vegan', callback_data: 'ans_restrictions_Vegan' }, { text: 'None', callback_data: 'ans_restrictions_None' }],
        [{ text: '✏️ Other', callback_data: 'ans_restrictions_other' }],
    ],
    allergies: [
        [{ text: 'Peanuts', callback_data: 'ans_allergies_Peanuts' }, { text: 'Shellfish', callback_data: 'ans_allergies_Shellfish' }],
        [{ text: 'Dairy', callback_data: 'ans_allergies_Dairy' }, { text: 'None', callback_data: 'ans_allergies_None' }],
        [{ text: '✏️ Other', callback_data: 'ans_allergies_other' }],
    ],
    calories: [
        [{ text: '1500', callback_data: 'ans_calories_1500' }, { text: '2000', callback_data: 'ans_calories_2000' }],
        [{ text: '2500', callback_data: 'ans_calories_2500' }, { text: 'Skip', callback_data: 'ans_calories_skip' }],
        [{ text: '✏️ Other', callback_data: 'ans_calories_other' }],
    ],
    mealsPerDay: [
        [{ text: '3', callback_data: 'ans_mealsPerDay_3' }, { text: '4', callback_data: 'ans_mealsPerDay_4' }],
        [{ text: '5', callback_data: 'ans_mealsPerDay_5' }, { text: '6', callback_data: 'ans_mealsPerDay_6' }],
    ],
    protein: [
        [{ text: '100g', callback_data: 'ans_protein_100' }, { text: '150g', callback_data: 'ans_protein_150' }],
        [{ text: '200g', callback_data: 'ans_protein_200' }, { text: 'Skip', callback_data: 'ans_protein_skip' }],
        [{ text: '✏️ Other', callback_data: 'ans_protein_other' }],
    ],
    cuisine: [
        [{ text: '🔄 Rotate daily', callback_data: 'ans_cuisine_Rotate daily' }, { text: 'Indonesian', callback_data: 'ans_cuisine_Indonesian' }],
        [{ text: 'Japanese', callback_data: 'ans_cuisine_Japanese' }, { text: 'Korean', callback_data: 'ans_cuisine_Korean' }],
        [{ text: 'Mediterranean', callback_data: 'ans_cuisine_Mediterranean' }, { text: '✏️ Other', callback_data: 'ans_cuisine_other' }],
    ],
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
function pad2(n: number): string { return String(n).padStart(2, '0'); }

function t(locale: string, key: string, ...args: any[]): string {
    const entry = I18N[key]?.[locale as Locale] || I18N[key]?.en;
    if (!entry) return key;
    return typeof entry === 'function' ? entry(...args) : entry;
}

function getLocale(ctx: any): Locale {
    return ctx.session?.locale || 'en';
}

function freshSession(): SessionState {
    return { step: 'idle', answers: {}, history: [], locale: 'en' };
}

async function sendLong(reply: (text: string) => Promise<any>, text: string): Promise<void> {
    const TG_MAX = 4096;
    if (text.length <= TG_MAX) { await reply(text); return; }
    const lines = text.split('\n');
    let chunk = '';
    for (const line of lines) {
        if ((chunk ? chunk + '\n' + line : line).length > TG_MAX) {
            await reply(chunk);
            chunk = line;
        } else {
            chunk = chunk ? chunk + '\n' + line : line;
        }
    }
    if (chunk) await reply(chunk);
}

function stepKeyboard(step: string, locale: string) {
    const rows = [...(KEYBOARDS[step] || [])];
    const stepIdx = STEP_ORDER.indexOf(step as StepKey);
    if (stepIdx > 0) {
        rows.push([{ text: t(locale, 'back'), callback_data: 'back' }]);
    }
    return Markup.inlineKeyboard(rows);
}

function answersSummary(answers: Record<string, string | null>, locale: string): string {
    const labels: Record<string, string> = {
        goal: t(locale, 'goal').replace('?', ''),
        restrictions: t(locale, 'restrictions').replace('?', ''),
        allergies: t(locale, 'allergies').replace('?', ''),
        calories: t(locale, 'calories').replace('?', ''),
        mealsPerDay: t(locale, 'mealsPerDay').replace('?', ''),
        protein: t(locale, 'protein').replace('?', ''),
        cuisine: t(locale, 'cuisine').split('(')[0].trim(),
    };
    return Object.entries(labels)
        .map(([k, label]) => `${label}: ${answers[k] || '—'}`)
        .join('\n');
}

function editKeyboard(locale: string, answers: Record<string, string | null>) {
    const fields = ['goal', 'restrictions', 'allergies', 'calories', 'mealsPerDay', 'protein', 'cuisine'];
    const rows = fields.map((f) => [{
        text: `${f}: ${answers[f] || '—'}`,
        callback_data: `edit_${f}`,
    }]);
    rows.push([{ text: t(locale, 'confirm_cancel'), callback_data: 'cancel_edit' }]);
    return Markup.inlineKeyboard(rows);
}

function planActionKeyboard(locale: string) {
    return Markup.inlineKeyboard([
        [
            { text: locale === 'id' ? '✓ Sudah masak' : '✓ Cooked', callback_data: 'action_cooked' },
            { text: t(locale, 'shop'), callback_data: 'action_shop' },
            { text: locale === 'id' ? '♻️ Sisa Kemarin' : '♻️ Leftovers', callback_data: 'action_remix' },
        ],
        [
            { text: t(locale, 'reroll'), callback_data: 'action_reroll' },
            { text: t(locale, 'macros'), callback_data: 'action_macros' },
            { text: t(locale, 'cook'), callback_data: 'action_cook' },
        ],
        [
            { text: t(locale, 'edit_plan'), callback_data: 'action_edit' },
            { text: t(locale, 'save_plan'), callback_data: 'action_save' },
            { text: '🔄 ' + (locale === 'id' ? 'Ganti 1 meal' : 'Replace meal'), callback_data: 'action_regen' },
        ],
        [
            { text: t(locale, 'good'), callback_data: 'action_good' },
            { text: t(locale, 'bad'), callback_data: 'action_bad' },
        ],
    ]);
}

// ────────────────────────────────────────────────────────────────────────────
// HTML formatting helpers
// ────────────────────────────────────────────────────────────────────────────
function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatPlanHTML(planText: string, meals: ParsedMeal[], locale: string): string {
    if (meals && meals.length > 0) {
        const blocks = meals.map((m) => {
            const items = (m.items && m.items.length > 0)
                ? m.items.map((i) => `• ${escapeHtml(i)}`).join('\n')
                : escapeHtml(m.body || '');
            const macroLine = m.macros ? `<code>${escapeHtml(m.macros)}</code>` : '';
            return `<b>🍳 ${escapeHtml(m.name)}</b>${m.kcal ? ` (~${m.kcal} kkal, ${m.protein}g protein)` : ''}\n${items}${macroLine ? '\n' + macroLine : ''}`;
        });
        const totKcal = meals.reduce((s, m) => s + (m.kcal || 0), 0);
        const totPro = meals.reduce((s, m) => s + (m.protein || 0), 0);
        const totCarb = meals.reduce((s, m) => s + (m.carbs || 0), 0);
        const totFat = meals.reduce((s, m) => s + (m.fat || 0), 0);
        const totalLine = `\n<b>Total: ${totKcal} kal · ${totPro}g protein · ${totCarb}g karbo · ${totFat}g lemak</b>`;
        return blocks.join('\n\n') + '\n' + totalLine;
    }
    // Fallback: plain text, escaped
    return escapeHtml(planText);
}

function formatMacrosFromPlan(meals: ParsedMeal[], locale: string): string {
    if (!meals || meals.length === 0) return '';
    const lines = meals.map((m) =>
        `📊 ${m.name}: ${m.kcal || 0} kal, ${m.protein || 0}g protein, ${m.carbs || 0}g karbo, ${m.fat || 0}g lemak`,
    );
    const totKcal = meals.reduce((s, m) => s + (m.kcal || 0), 0);
    const totPro = meals.reduce((s, m) => s + (m.protein || 0), 0);
    const totCarb = meals.reduce((s, m) => s + (m.carbs || 0), 0);
    const totFat = meals.reduce((s, m) => s + (m.fat || 0), 0);
    lines.push(`\n📊 Total: ${totKcal} kal, ${totPro}g protein, ${totCarb}g karbo, ${totFat}g lemak`);
    return lines.join('\n');
}

// Replace a single meal chunk in planText — mirrors api.ts logic.
function replaceMealInPlan(planText: string, mealName: string, newMealText: string): string {
    const cleanText = planText.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
    const mealNames = 'Sarapan|Breakfast|Makan\\s+siang|Lunch|Makan\\s+malam|Dinner|Snack|Camilan|Brunch';
    const mealRegex = new RegExp(`((?:${mealNames}))`, 'gi');
    const splits: { name: string; start: number; end: number }[] = [];
    let match;
    while ((match = mealRegex.exec(cleanText)) !== null) {
        splits.push({ name: match[1].trim(), start: match.index, end: 0 });
    }
    for (let i = 0; i < splits.length; i++) {
        splits[i].end = i + 1 < splits.length ? splits[i + 1].start : cleanText.length;
    }
    const target = splits.find((s) => s.name.toLowerCase().includes(mealName.toLowerCase()));
    if (target) {
        const before = cleanText.slice(0, target.start);
        const after = cleanText.slice(target.end);
        return before + newMealText.trim() + '\n' + after;
    }
    return cleanText + '\n' + newMealText.trim();
}

// ────────────────────────────────────────────────────────────────────────────
// Step rendering
// ────────────────────────────────────────────────────────────────────────────
async function renderStep(ctx: any, step: string): Promise<void> {
    const locale = getLocale(ctx);
    ctx.session.step = step;
    if (step === 'preview') {
        const summary = `${t(locale, 'preview')}\n\n${answersSummary(ctx.session.answers, locale)}`;
        await ctx.reply(summary, Markup.inlineKeyboard([
            [
                { text: t(locale, 'confirm_generate'), callback_data: 'confirm_generate' },
                { text: t(locale, 'confirm_edit'), callback_data: 'confirm_edit' },
            ],
            [{ text: t(locale, 'confirm_cancel'), callback_data: 'confirm_cancel' }],
        ]));
    } else {
        await ctx.reply(t(locale, step), stepKeyboard(step, locale));
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Generate a plan, send it with action buttons, persist state.
// ────────────────────────────────────────────────────────────────────────────
async function generateAndSend(ctx: any, answers: Record<string, any>, opts: { regenerate?: boolean } = {}): Promise<void> {
    const locale = getLocale(ctx);
    const chatId: number | undefined = ctx.chat?.id ?? ctx.callbackQuery?.message?.chat?.id;
    const user: User | null = chatId ? await getUser(chatId) : null;
    const avoidCuisines = user?.lastCuisines || [];

    // Rate limit check — free tier: 3/day, premium: 50/day
    let rl: { allowed: boolean; limit: number; remaining: number } | null = null;
    if (chatId) {
        rl = await checkRateLimit(chatId, user?.tier || 'free');
        if (!rl.allowed) {
            await ctx.reply(t(locale, 'rate_limited', rl.limit));
            return;
        }
    }

    try {
        const plan = await generateMealPlan(answers as Answers, {
            locale, avoidCuisines, regenerate: opts.regenerate,
        }, chatId);
        // Store plan text in session so shop/macros/cook can reuse it — no second LLM call
        if (ctx.session) ctx.session.lastPlanText = plan;

        // Parse meals for HTML formatting + bot plan history — no extra LLM call
        const meals = parsePlanMeals(plan);
        const cuisine = parseCuisine(plan);
        if (chatId) {
            const planId = await saveBotPlan(chatId, plan, cuisine, JSON.stringify(meals));
            if (ctx.session) ctx.session.lastBotPlanId = planId;
        }
        const html = formatPlanHTML(plan, meals, locale);
        await sendLong((txt) => ctx.reply(txt, { parse_mode: 'HTML' }), html);

        // Rate limit display — show remaining if low
        if (rl && rl.remaining <= 2) {
            await ctx.reply(t(locale, 'rate_remaining', rl.remaining));
        }

        if (chatId) {
            const today = new Date().toISOString().slice(0, 10);
            const u = await getUser(chatId);
            if (u) {
                if (u.lastPushed !== today) {
                    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
                    if (u.lastPushed !== yesterday) {
                        await resetStreak(chatId);
                    }
                    await bumpStreak(chatId);
                }
            }
            await setLastAnswers(chatId, answers as Answers);
            await incrementPlanCount(chatId);
            const updated = await getUser(chatId);
            const streak = updated?.streak || 0;
            if (streak > 0) {
                await ctx.reply(t(locale, 'streak_msg', streak));
            }
            if (cuisine) {
                const cuisines = [...avoidCuisines, cuisine].slice(-5);
                await setLastCuisines(chatId, cuisines);
            }
        }

        await ctx.reply(t(locale, 'done'), planActionKeyboard(locale));
    } catch (err: any) {
        console.error('LLM generation failed:', err);
        await ctx.reply(t(locale, 'err', err.message));
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Commands
// ────────────────────────────────────────────────────────────────────────────
bot.start(async (ctx: any) => {
    const locale: Locale = ctx.from?.language_code === 'id' ? 'id' : 'en';
    const payload = ctx.message?.text?.split(' ')[1] || '';

    // ── Link account: /start link_<token> ──
    const linkMatch = payload.match(/^link_(.+)$/);
    if (linkMatch) {
        const token = linkMatch[1];
        const apiToken = process.env.ADMIN_TOKEN || 'changeme';
        try {
            const res = await fetch(`http://localhost:${process.env.DASHBOARD_PORT || 3000}/api/bot/consume-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
                body: JSON.stringify({ token, chat_id: ctx.chat.id }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.linked && data.user) {
                    await ensureUser(ctx.chat.id, locale);
                    ctx.session = freshSession();
                    ctx.session.locale = locale;
                    const name = data.user.full_name || ctx.from?.first_name || '';
                    await ctx.reply(
                        `✅ Akun terhubung, ${name}! Aku udah punya profilmu.\n\n` +
                        `Goal: ${data.user.goal || '—'}\n` +
                        `Mau langsung generate rencana pertama?`,
                        Markup.inlineKeyboard([
                            [{ text: '✅ Gas! Buat rencana', callback_data: 'linked_generate' }],
                        ])
                    );
                    return;
                }
            }
        } catch (e) {
            console.error('Link token consume failed:', e);
        }
        await ctx.reply('Hmm, link udah kedaluwarsa atau nggak valid. Coba hubungkan ulang dari Pengaturan web ya.');
        return;
    }

    // ── Check if chat_id is linked to a web profile ──
    const webProfile = await getUserByTelegramChatId(ctx.chat.id);
    if (webProfile) {
        // Linked user — skip questions, generate from profile
        const user = await ensureUser(ctx.chat.id, locale);
        ctx.session = freshSession();
        ctx.session.locale = webProfile.locale as Locale || locale;

        // Sync answers from web profile
        const answers: Answers = {
            goal: webProfile.goal || 'General health',
            restrictions: webProfile.dietary_restrictions || '',
            allergies: webProfile.allergies || '',
            calories: webProfile.target_calories ? String(webProfile.target_calories) : '',
            protein: webProfile.target_protein ? String(webProfile.target_protein) : '',
            mealsPerDay: String(webProfile.meals_per_day || 3),
            cuisine: webProfile.cuisine_rotation || 'Rotate daily',
        };
        await setLastAnswers(ctx.chat.id, answers);
        ctx.session.answers = answers;

        const name = webProfile.full_name || ctx.from?.first_name || '';
        await ctx.reply(
            `Halo ${name}! Aku Saji 🍽️\n` +
            `Profilmu udah tersinkron dari web.\n` +
            `Goal: ${answers.goal} · ${answers.calories || '—'} kal · ${answers.protein || '—'}g protein\n\n` +
            `Mau generate rencana makan?`,
            Markup.inlineKeyboard([
                [{ text: '✅ Gas! Buat rencana', callback_data: 'linked_generate' }],
                [{ text: '📊 Lihat profil', callback_data: 'cmd_help' }],
            ])
        );
        return;
    }

    // ── Referral: /start ref_<referrerChatId> ──
    const user = await ensureUser(ctx.chat.id, locale);
    ctx.session = freshSession();
    ctx.session.locale = user.locale || locale;

    const refMatch = payload.match(/^ref_(\d+)$/);
    if (refMatch) {
        const referrerId = Number(refMatch[1]);
        if (referrerId && referrerId !== ctx.chat.id) {
            await createReferral(referrerId, ctx.chat.id);
        }
    }

    // First-time user (no lastAnswers) → onboarding message
    const isFirstTime = !user.lastAnswers;
    const msg = isFirstTime ? t(getLocale(ctx), 'onboarding') : t(getLocale(ctx), 'start', ctx.from?.first_name);
    await ctx.reply(
        msg,
        Markup.inlineKeyboard([
            [{ text: t(getLocale(ctx), 'start_plan'), callback_data: 'cmd_mealplan' }],
            [
                { text: t(getLocale(ctx), 'start_lang'), callback_data: 'cmd_lang' },
                { text: t(getLocale(ctx), 'start_help'), callback_data: 'cmd_help' },
            ],
        ])
    );
});

bot.command('mealplan', async (ctx: any) => {
    const user = await ensureUser(ctx.chat.id, getLocale(ctx));
    ctx.session = { step: 'goal', answers: {}, history: [], locale: user.locale };
    await renderStep(ctx, 'goal');
});

bot.command('cancel', async (ctx: any) => {
    ctx.session = freshSession();
    ctx.session.locale = (await ensureUser(ctx.chat.id)).locale;
    await ctx.reply(t(getLocale(ctx), 'cancelled'), Markup.removeKeyboard());
});

bot.command('subscribe', async (ctx: any) => {
    const locale = getLocale(ctx);
    const sub = await getUser(ctx.chat.id);
    if (!sub?.lastAnswers) {
        await ctx.reply(t(locale, 'need_mealplan'));
        return;
    }
    await setSubscribed(ctx.chat.id, true);
    const h = pad2(sub.pushHour ?? DAILY_PUSH_HOUR);
    const m = pad2(sub.pushMin ?? DAILY_PUSH_MIN);
    await ctx.reply(t(locale, 'subscribed', h, m));
});

bot.command('unsubscribe', async (ctx: any) => {
    await setSubscribed(ctx.chat.id, false);
    await ctx.reply(t(getLocale(ctx), 'unsubscribed'));
});

bot.command('status', async (ctx: any) => {
    const sub = await getUser(ctx.chat.id);
    const state = sub?.subscribed ? t(getLocale(ctx), 'subscribed_state') : t(getLocale(ctx), 'not_subscribed');
    await ctx.reply(state);
});

bot.command('lang', async (ctx: any) => {
    await ctx.reply(t(getLocale(ctx), 'pick_lang'), Markup.inlineKeyboard([
        [{ text: 'English', callback_data: 'lang_en' }, { text: 'Bahasa Indonesia', callback_data: 'lang_id' }],
    ]));
});

bot.command('settime', async (ctx: any) => {
    const locale = getLocale(ctx);
    const slots = ['06:00', '07:00', '08:00', '09:00', '12:00', '18:00', '19:00', '20:00'];
    const rows: { text: string; callback_data: string }[][] = [];
    for (let i = 0; i < slots.length; i += 3) {
        rows.push(slots.slice(i, i + 3).map((s) => ({
            text: s, callback_data: `settime_${s}`,
        })));
    }
    rows.push([{ text: '✏️ ' + t(locale, 'other'), callback_data: 'settime_custom' }]);
    await ctx.reply(t(locale, 'settime_pick'), Markup.inlineKeyboard(rows));
});

bot.command('plans', async (ctx: any) => {
    const locale = getLocale(ctx);
    const plans = await getPlans(ctx.chat.id);
    if (!plans.length) {
        await ctx.reply(t(locale, 'no_plans'));
        return;
    }
    const rows = plans.map((p) => [
        { text: p.name, callback_data: `plan_load_${p.id}` },
        { text: '🗑', callback_data: `plan_del_${p.id}` },
    ]);
    await ctx.reply(t(locale, 'plans_list'), Markup.inlineKeyboard(rows as any));
});

bot.command('save', async (ctx: any) => {
    const locale = getLocale(ctx);
    const nameArg = ctx.message.text.split(' ').slice(1).join(' ').trim();
    const user = await getUser(ctx.chat.id);
    const answers = user?.lastAnswers;
    if (!answers) {
        await ctx.reply(t(locale, 'save_empty'));
        return;
    }
    if (nameArg) {
        await savePlan(ctx.chat.id, nameArg, answers);
        await ctx.reply(t(locale, 'save_done', nameArg));
        return;
    }
    ctx.session.awaitingPlanName = true;
    await ctx.reply(t(locale, 'save_prompt'));
});

bot.command('weekly', async (ctx: any) => {
    const locale = getLocale(ctx);
    const user = await getUser(ctx.chat.id);
    if (!user?.lastAnswers) {
        await ctx.reply(t(locale, 'need_mealplan'));
        return;
    }
    await ctx.reply(t(locale, 'weekly_done'));
    try {
        const plan = await generateWeeklyPlan(user.lastAnswers, {
            locale, avoidCuisines: user.lastCuisines || [],
        }, ctx.chat.id);
        await sendLong((txt) => ctx.reply(txt), plan);
    } catch (err: any) {
        console.error('Weekly plan failed:', err);
        await ctx.reply(t(locale, 'err', err.message));
    }
});

bot.command('invite', async (ctx: any) => {
    const locale = getLocale(ctx);
    const botInfo = await bot.telegram.getMe();
    const botUsername = botInfo.username;
    const refLink = `https://t.me/${botUsername}?start=ref_${ctx.chat.id}`;
    const count = await getReferralCount(ctx.chat.id);
    await ctx.reply(`${t(locale, 'invite_msg', refLink)}\n${t(locale, 'invite_count', count)}`);
});

bot.command('today', async (ctx: any) => {
    const locale = getLocale(ctx);
    const today = new Date().toISOString().slice(0, 10);
    const plan = await getBotPlanByDate(ctx.chat.id, today);
    if (!plan) {
        await ctx.reply(t(locale, 'today_none'));
        return;
    }
    const meals = plan.meals_json ? JSON.parse(plan.meals_json) : parsePlanMeals(plan.plan_text);
    const html = formatPlanHTML(plan.plan_text, meals, locale);
    await sendLong((txt) => ctx.reply(txt, { parse_mode: 'HTML' }), html);
    if (ctx.session) ctx.session.lastPlanText = plan.plan_text;
    ctx.session.lastBotPlanId = plan.id;
    await ctx.reply(t(locale, 'done'), planActionKeyboard(locale));
});

bot.command('yesterday', async (ctx: any) => {
    const locale = getLocale(ctx);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const plan = await getBotPlanByDate(ctx.chat.id, yesterday);
    if (!plan) {
        await ctx.reply(t(locale, 'yesterday_none'));
        return;
    }
    const meals = plan.meals_json ? JSON.parse(plan.meals_json) : parsePlanMeals(plan.plan_text);
    const html = formatPlanHTML(plan.plan_text, meals, locale);
    await sendLong((txt) => ctx.reply(txt, { parse_mode: 'HTML' }), html);
});

bot.command('summary', async (ctx: any) => {
    const locale = getLocale(ctx);
    const history = await getBotPlanHistory(ctx.chat.id, 30);
    // Filter last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const recent = history.filter((h) => {
        const d = new Date(h.created_at).toISOString().slice(0, 10);
        return d >= sevenDaysAgo;
    });
    if (recent.length === 0) {
        await ctx.reply(locale === 'id' ? 'Belum ada rencana minggu ini.' : 'No plans this week yet.');
        return;
    }
    // Stats
    const plans = recent.length;
    // Streak: count consecutive days with a plan ending today
    const today = new Date().toISOString().slice(0, 10);
    let streak = 0;
    for (let i = 0; i < 7; i++) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        if (recent.some((h) => new Date(h.created_at).toISOString().slice(0, 10) === d)) {
            streak++;
        } else {
            if (d !== today) break;
        }
    }
    // Top cuisine
    const cuisineCount: Record<string, number> = {};
    for (const h of recent) {
        const c = h.cuisine || 'unknown';
        cuisineCount[c] = (cuisineCount[c] || 0) + 1;
    }
    const topCuisine = Object.entries(cuisineCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    // Avg calories
    let totalKcal = 0;
    let kcalCount = 0;
    for (const h of recent) {
        const meals = h.meals_json ? JSON.parse(h.meals_json) : [];
        const sum = meals.reduce((s: number, m: any) => s + (m.kcal || 0), 0);
        if (sum > 0) { totalKcal += sum; kcalCount++; }
    }
    const avgCal = kcalCount > 0 ? Math.round(totalKcal / kcalCount) : 0;
    const lines = [
        t(locale, 'summary_title'),
        '',
        t(locale, 'summary_plans', plans),
        t(locale, 'summary_streak', streak),
        `${t(locale, 'summary_cuisine')}: ${topCuisine}`,
        `${t(locale, 'summary_avg_cal')}: ${avgCal} kal`,
    ];
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
});

bot.command('regen', async (ctx: any) => {
    const locale = getLocale(ctx);
    const nameArg = ctx.message?.text?.split(' ').slice(1).join(' ').trim();
    const planText = ctx.session?.lastPlanText;
    if (!planText) {
        await ctx.reply(t(locale, 'need_mealplan'));
        return;
    }
    const meals = parsePlanMeals(planText);
    if (meals.length === 0) {
        await ctx.reply(t(locale, 'err', 'no meals parsed'));
        return;
    }
    if (nameArg) {
        // Direct regen of named meal
        const user = await getUser(ctx.chat.id);
        const answers = user?.lastAnswers || ctx.session?.answers || {};
        await ctx.reply(t(locale, 'generating'));
        try {
            const newMealText = await regenerateMeal(planText, nameArg, locale, answers, ctx.chat.id);
            const updatedPlan = replaceMealInPlan(planText, nameArg, newMealText);
            ctx.session.lastPlanText = updatedPlan;
            const updatedMeals = parsePlanMeals(updatedPlan);
            const cuisine = parseCuisine(updatedPlan);
            const planId = ctx.session?.lastBotPlanId;
            if (planId) {
                await updateBotPlanMeals(planId, updatedPlan, JSON.stringify(updatedMeals));
            } else {
                const newId = await saveBotPlan(ctx.chat.id, updatedPlan, cuisine, JSON.stringify(updatedMeals));
                ctx.session.lastBotPlanId = newId;
            }
            const html = formatPlanHTML(updatedPlan, updatedMeals, locale);
            await sendLong((txt) => ctx.reply(txt, { parse_mode: 'HTML' }), html);
            await ctx.reply(t(locale, 'done'), planActionKeyboard(locale));
        } catch (err: any) {
            console.error('Per-meal regen failed:', err);
            await ctx.reply(t(locale, 'err', err.message));
        }
        return;
    }
    // No arg: show meal picker
    const rows = meals.map((m) => [{
        text: m.name,
        callback_data: `regenmeal_${m.name}`,
    }]);
    await ctx.reply(t(locale, 'regen_pick'), Markup.inlineKeyboard(rows as any));
});

bot.command('help', async (ctx: any) => {
    const locale = getLocale(ctx);
    const lines = locale === 'id' ? [
        '🍽️ Saji — Asisten Makan Harian',
        '',
        '📚 Perintah tersedia:',
        '',
        '/mealplan — buat rencana makan baru',
        '/today — lihat rencana hari ini',
        '/yesterday — lihat rencana kemarin',
        '/summary — ringkasan minggu ini',
        '/regen <meal> — regenerasi 1 meal saja',
        '/subscribe — langganan rencana harian otomatis',
        '/unsubscribe — berhenti langganan',
        '/settime — ubah jam kirim harian',
        '/status — cek status langganan',
        '/lang — ganti bahasa (EN/ID)',
        '/cancel — batalkan sesi /mealplan',
        '/plans — lihat rencana tersimpan',
        '/save <nama> — simpan rencana saat ini',
        '/weekly — buat rencana 7 hari',
        '/invite — link ajak teman',
        '/help — tampilkan bantuan ini',
        '',
        '💡 Setelah rencana dibuat, ada tombol: 🎲 Regenerasi, ✏️ Ubah, 💾 Simpan, 🛒 Belanja, 📊 Makro, 👍/👎, 🔄 Ganti 1 meal',
        '💬 Atau ketik langsung preferensimu (mis. "ayam pedas") untuk bikin rencana otomatis.',
    ] : [
        '🍽️ Saji — Daily Meal Plan Assistant',
        '',
        '📚 Available commands:',
        '',
        '/mealplan — build a new meal plan',
        '/today — view today\'s plan',
        '/yesterday — view yesterday\'s plan',
        '/summary — weekly digest',
        '/regen <meal> — regenerate a single meal',
        '/subscribe — get a fresh plan daily',
        '/unsubscribe — pause daily push',
        '/settime — change your daily push time',
        '/status — check subscription status',
        '/lang — switch language (EN/ID)',
        '/cancel — cancel current /mealplan session',
        '/plans — view your saved plans',
        '/save <name> — save current plan as a preset',
        '/weekly — generate a 7-day plan',
        '/invite — get your referral link',
        '/help — show this help',
        '',
        '💡 After a plan is generated, buttons appear: 🎲 Regenerate, ✏️ Edit, 💾 Save, 🛒 Shopping list, 📊 Macros, 👍/👎, 🔄 Replace meal',
        '💬 Or just type your preference (e.g. "spicy chicken") to auto-generate a plan.',
    ];
    await ctx.reply(lines.join('\n'));
});

// ────────────────────────────────────────────────────────────────────────────
// Callback query handler
// ────────────────────────────────────────────────────────────────────────────
bot.on('callback_query', async (ctx: any) => {
    const data: string = ctx.callbackQuery.data;
    if (!ctx.session) {
        const user = await ensureUser(ctx.chat.id);
        ctx.session = freshSession();
        ctx.session.locale = user?.locale || 'en';
    }
    const locale = getLocale(ctx);
    await ctx.answerCbQuery().catch(() => {});

    // ── Language toggle ──
    if (data === 'lang_en' || data === 'lang_id') {
        const newLocale = data.slice(5) as Locale;
        ctx.session.locale = newLocale;
        await setLocale(ctx.chat.id, newLocale);
        await ctx.reply(t(newLocale, 'lang_set'));
        return;
    }

    // ── Set push time ──
    if (data.startsWith('settime_')) {
        const rest = data.slice(8);
        if (rest === 'custom') {
            ctx.session.awaitingTime = true;
            await ctx.reply(t(locale, 'settime_custom'));
            return;
        }
        const [h, m] = rest.split(':').map(Number);
        if (Number.isFinite(h) && Number.isFinite(m)) {
            await ensureUser(ctx.chat.id, locale);
            await setPushTime(ctx.chat.id, h, m);
            await ctx.reply(t(locale, 'settime_set', pad2(h), pad2(m)));
        }
        return;
    }

    // ── Start menu shortcuts ──
    if (data === 'linked_generate') {
        // Linked web user — generate from profile, skip questions
        const webProfile = await getUserByTelegramChatId(ctx.chat.id);
        if (!webProfile) {
            await ctx.reply('Hmm, profil web kamu nggak ketemu. Coba hubungkan ulang dari Pengaturan web ya.');
            return;
        }
        const answers: Answers = {
            goal: webProfile.goal || 'General health',
            restrictions: webProfile.dietary_restrictions || '',
            allergies: webProfile.allergies || '',
            calories: webProfile.target_calories ? String(webProfile.target_calories) : '',
            protein: webProfile.target_protein ? String(webProfile.target_protein) : '',
            mealsPerDay: String(webProfile.meals_per_day || 3),
            cuisine: webProfile.cuisine_rotation || 'Rotate daily',
        };
        await setLastAnswers(ctx.chat.id, answers);
        ctx.session.answers = answers;
        ctx.session.step = 'idle';
        await ctx.reply(t(locale, 'done'));
        await generateAndSend(ctx, answers);
        return;
    }

    if (data === 'cmd_mealplan') {
        const user = await ensureUser(ctx.chat.id, getLocale(ctx));
        ctx.session = { step: 'goal', answers: {}, history: [], locale: user.locale };
        await renderStep(ctx, 'goal');
        return;
    }
    if (data === 'cmd_lang') {
        await ctx.reply(t(locale, 'pick_lang'), Markup.inlineKeyboard([
            [{ text: 'English', callback_data: 'lang_en' }, { text: 'Bahasa Indonesia', callback_data: 'lang_id' }],
        ]));
        return;
    }
    if (data === 'cmd_help') {
        await ctx.reply(t(locale, 'help'));
        return;
    }

    // ── Q&A answer buttons ──
    if (data.startsWith('ans_')) {
        const [, step, ...rest] = data.split('_');
        const value = rest.join('_');

        if (value === 'other') {
            ctx.session.awaitingFreeText = step;
            await ctx.reply(t(locale, 'other'));
            return;
        }

        const normalized = value === 'skip' ? null
            : value === 'None' ? (step === 'allergies' ? 'none' : value)
            : value;
        ctx.session.answers[step] = normalized;
        ctx.session.history.push(step);

        const nextIdx = STEP_ORDER.indexOf(step as StepKey) + 1;
        if (nextIdx < STEP_ORDER.length) {
            await renderStep(ctx, STEP_ORDER[nextIdx]);
        }
        return;
    }

    // ── Back button ──
    if (data === 'back') {
        const prev = ctx.session.history?.pop();
        if (prev) await renderStep(ctx, prev);
        return;
    }

    // ── Preview confirm / edit / cancel ──
    if (data === 'confirm_generate') {
        await ctx.reply(t(locale, 'done'));
        await generateAndSend(ctx, ctx.session.answers);
        ctx.session.step = 'idle';
        return;
    }
    if (data === 'confirm_edit') {
        await ctx.reply(t(locale, 'edit_pick'), editKeyboard(locale, ctx.session.answers));
        return;
    }
    if (data === 'cancel_edit') {
        await renderStep(ctx, 'preview');
        return;
    }
    if (data === 'confirm_cancel') {
        ctx.session = freshSession();
        ctx.session.locale = (await ensureUser(ctx.chat.id)).locale;
        await ctx.reply(t(locale, 'cancelled'));
        return;
    }

    // ── Edit a specific field ──
    if (data.startsWith('edit_')) {
        const field = data.slice(5);
        ctx.session.editingField = field;
        await renderStep(ctx, field);
        return;
    }

    // ── Post-plan actions ──
    if (data.startsWith('action_')) {
        const action = data.slice(7);
        const chatId: number = ctx.chat.id;
        const user = await getUser(chatId);

        if (action === 'edit') {
            const last = user?.lastAnswers;
            if (!last) {
                await ctx.reply(t(locale, 'need_mealplan'));
                return;
            }
            ctx.session.answers = { ...last };
            ctx.session.history = [];
            ctx.session.step = 'preview';
            await renderStep(ctx, 'preview');
            return;
        }
        if (action === 'save') {
            const last = user?.lastAnswers;
            if (!last) {
                await ctx.reply(t(locale, 'save_empty'));
                return;
            }
            ctx.session.awaitingPlanName = true;
            await ctx.reply(t(locale, 'save_prompt'));
            return;
        }
        if (action === 'reroll') {
            const last = user?.lastAnswers;
            if (!last) {
                await ctx.reply(t(locale, 'need_mealplan'));
                return;
            }
            await ctx.reply(t(locale, 'generating'));
            await generateAndSend(ctx, last, { regenerate: true });
            return;
        }
        if (action === 'good') {
            await setLastFeedback(chatId, 'good');
            await ctx.reply(locale === 'id' ? '👍 Makasih! Senang kamu suka!' : '👍 Thanks! Glad you liked it!');
            return;
        }
        if (action === 'bad') {
            await setLastFeedback(chatId, 'bad');
            const last = user?.lastAnswers;
            if (!last) {
                await ctx.reply(t(locale, 'need_mealplan'));
                return;
            }
            await ctx.reply(t(locale, 'generating'));
            await generateAndSend(ctx, last, { regenerate: true });
            return;
        }
        if (action === 'cooked') {
            // Mark today's plan cooked — syncs with web via linked account
            const webProfile = await getUserByTelegramChatId(chatId);
            if (!webProfile) {
                await ctx.reply(locale === 'id'
                    ? 'Hubungkan akun web dulu ya (Pengaturan di web) biar check-in kesinkron.'
                    : 'Link your web account first (web Settings) so check-ins sync.');
                return;
            }
            try {
                const cooked = await markCooked(webProfile.id, null);
                if (!cooked) {
                    await ctx.reply(t(locale, 'need_mealplan'));
                    return;
                }
                // Bump bot streak once/day (same rule as web cook endpoint)
                const today = new Date().toISOString().slice(0, 10);
                if (user?.lastPushed !== today) {
                    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
                    if (user?.lastPushed !== yesterday) await resetStreak(chatId);
                    await bumpStreak(chatId);
                    await setLastPushed(chatId, today);
                }
                const webStreak = await getWebUserStreak(webProfile.id);
                const updated = await getUser(chatId);
                const streak = Math.max(updated?.streak || 0, webStreak);
                await ctx.reply(locale === 'id'
                    ? `✓ Mantap! Sudah masak tercatat.${streak > 0 ? ` 🔥 Day ${streak} streak!` : ''}`
                    : `✓ Nice! Cooked checked in.${streak > 0 ? ` 🔥 Day ${streak} streak!` : ''}`);
            } catch (err: any) {
                console.error('Cooked action failed:', err);
                await ctx.reply(t(locale, 'err', err.message));
            }
            return;
        }
        if (action === 'remix') {
            // Leftover remix — premium only (via linked web profile tier)
            const webProfile = await getUserByTelegramChatId(chatId);
            if (!webProfile) {
                await ctx.reply(locale === 'id'
                    ? 'Hubungkan akun web dulu ya.'
                    : 'Link your web account first.');
                return;
            }
            if (webProfile.tier !== 'premium') {
                await ctx.reply(locale === 'id'
                    ? 'Fitur Pro nih! Upgrade di web (menu Pro) buat remix sisa kemarin.'
                    : 'Pro feature! Upgrade on the web (Pro menu) for leftover remix.');
                return;
            }
            await ctx.reply(locale === 'id' ? '♻️ Lagi mikirin remix dari sisa kemarin...' : '♻️ Thinking up remixes from yesterday...');
            try {
                const yesterday = await getYesterdayPlanText(webProfile.id);
                if (!yesterday) {
                    await ctx.reply(locale === 'id'
                        ? 'Kemarin nggak ada rencana. Masak dulu hari ini, besok baru bisa remix.'
                        : 'No plan yesterday. Cook today first, remix tomorrow.');
                    return;
                }
                const remix = await generateLeftoverRemix(yesterday, locale, chatId);
                await sendLong((txt) => ctx.reply(txt), remix);
            } catch (err: any) {
                console.error('Remix action failed:', err);
                await ctx.reply(t(locale, 'err', err.message));
            }
            return;
        }
        if (action === 'shop' || action === 'macros' || action === 'cook') {
            const last = user?.lastAnswers;
            if (!last) {
                await ctx.reply(t(locale, 'need_mealplan'));
                return;
            }
            const waitMsg = action === 'shop' ? t(locale, 'shopping_done')
                : action === 'cook' ? t(locale, 'cooking_done')
                : t(locale, 'macros_done');
            await ctx.reply(waitMsg);
            try {
                if (action === 'macros') {
                    // No LLM call — derive from parsed plan meals
                    const planText = ctx.session?.lastPlanText
                        ?? (await getBotPlanByDate(chatId, new Date().toISOString().slice(0, 10)))?.plan_text
                        ?? await generateMealPlan(last, { locale, avoidCuisines: user?.lastCuisines || [] }, chatId);
                    const meals = parsePlanMeals(planText);
                    const macros = formatMacrosFromPlan(meals, locale);
                    if (macros) {
                        await sendLong((txt) => ctx.reply(txt, { parse_mode: 'HTML' }), macros);
                    } else {
                        await ctx.reply(t(locale, 'err', 'no meals parsed'));
                    }
                } else {
                    // Reuse plan from session or today's pushed plan — avoids a second LLM call
                    const plan = ctx.session?.lastPlanText
                        ?? (await getBotPlanByDate(chatId, new Date().toISOString().slice(0, 10)))?.plan_text
                        ?? await generateMealPlan(last, { locale, avoidCuisines: user?.lastCuisines || [] }, chatId);
                    if (action === 'shop') {
                        const shop = await generateShoppingList(plan, locale, chatId);
                        await sendLong((txt) => ctx.reply(txt), shop);
                    } else if (action === 'cook') {
                        const steps = await generateCookingSteps(plan, locale, chatId);
                        await sendLong((txt) => ctx.reply(txt), steps);
                    }
                }
            } catch (err: any) {
                console.error('Post-plan action failed:', err);
                await ctx.reply(t(locale, 'err', err.message));
            }
            return;
        }
        if (action === 'regen') {
            // Show inline keyboard with meal names from current plan
            const planText = ctx.session?.lastPlanText
                ?? (await getBotPlanByDate(chatId, new Date().toISOString().slice(0, 10)))?.plan_text;
            if (!planText) {
                await ctx.reply(t(locale, 'need_mealplan'));
                return;
            }
            const meals = parsePlanMeals(planText);
            if (meals.length === 0) {
                await ctx.reply(t(locale, 'err', 'no meals parsed'));
                return;
            }
            const rows = meals.map((m) => [{
                text: m.name,
                callback_data: `regenmeal_${m.name}`,
            }]);
            await ctx.reply(t(locale, 'regen_pick'), Markup.inlineKeyboard(rows as any));
            return;
        }
    }

    // ── Per-meal regen ──
    if (data.startsWith('regenmeal_')) {
            const mealName = data.slice(11);
            const planText = ctx.session?.lastPlanText
                ?? (await getBotPlanByDate(ctx.chat.id, new Date().toISOString().slice(0, 10)))?.plan_text;
            if (!planText) {
                await ctx.reply(t(locale, 'need_mealplan'));
                return;
            }
        const user = await getUser(ctx.chat.id);
        const answers = user?.lastAnswers || ctx.session?.answers || {};
        await ctx.reply(t(locale, 'generating'));
        try {
            const newMealText = await regenerateMeal(planText, mealName, locale, answers, ctx.chat.id);
            const updatedPlan = replaceMealInPlan(planText, mealName, newMealText);
            ctx.session.lastPlanText = updatedPlan;
            const meals = parsePlanMeals(updatedPlan);
            const cuisine = parseCuisine(updatedPlan);
            const planId = ctx.session?.lastBotPlanId;
            if (planId) {
                await updateBotPlanMeals(planId, updatedPlan, JSON.stringify(meals));
            } else if (ctx.chat?.id) {
                const newId = await saveBotPlan(ctx.chat.id, updatedPlan, cuisine, JSON.stringify(meals));
                ctx.session.lastBotPlanId = newId;
            }
            if (cuisine) {
                const cuisines = [...(user?.lastCuisines || []), cuisine].slice(-5);
                await setLastCuisines(ctx.chat.id, cuisines);
            }
            const html = formatPlanHTML(updatedPlan, meals, locale);
            await sendLong((txt) => ctx.reply(txt, { parse_mode: 'HTML' }), html);
            await ctx.reply(t(locale, 'done'), planActionKeyboard(locale));
        } catch (err: any) {
            console.error('Per-meal regen failed:', err);
            await ctx.reply(t(locale, 'err', err.message));
        }
        return;
    }

    // ── Load / delete saved plans ──
    if (data.startsWith('plan_load_')) {
        const planId = Number(data.slice(11));
        const p = await getPlan(planId);
        if (!p || p.chatId !== ctx.chat.id) return;
        ctx.session.answers = { ...p.answers };
        ctx.session.history = [];
        ctx.session.step = 'preview';
        await ctx.reply(t(locale, 'plan_load', p.name));
        await renderStep(ctx, 'preview');
        return;
    }
    if (data.startsWith('plan_del_')) {
        const planId = Number(data.slice(9));
        await deletePlan(ctx.chat.id, planId);
        await ctx.reply(t(locale, 'plan_deleted'));
        return;
    }
});

// ────────────────────────────────────────────────────────────────────────────
// Free-text input
// ────────────────────────────────────────────────────────────────────────────
bot.on('text', async (ctx: any) => {
    const session: SessionState = ctx.session || freshSession();
    const locale = getLocale(ctx);

    // ── Awaiting custom push time (HH:MM) ──
    if (session.awaitingTime) {
        const parsed = validateTimeFormat(ctx.message.text);
        if (!parsed) {
            await ctx.reply(t(locale, 'settime_custom'));
            ctx.session = session;
            return;
        }
        const { h, min } = parsed;
        await ensureUser(ctx.chat.id, locale);
        await setPushTime(ctx.chat.id, h, min);
        delete session.awaitingTime;
        session.step = 'idle';
        await ctx.reply(t(locale, 'settime_set', pad2(h), pad2(min)));
        ctx.session = session;
        return;
    }

    // ── Awaiting plan save name ──
    if (session.awaitingPlanName) {
        const name = validatePlanName(ctx.message.text);
        if (!name) {
            await ctx.reply(t(locale, 'invalid_input'));
            ctx.session = session;
            return;
        }
        const user = await getUser(ctx.chat.id);
        const answers = user?.lastAnswers;
        if (!answers) {
            await ctx.reply(t(locale, 'save_empty'));
            delete session.awaitingPlanName;
            ctx.session = session;
            return;
        }
        await savePlan(ctx.chat.id, name, answers);
        delete session.awaitingPlanName;
        await ctx.reply(t(locale, 'save_done', name));
        ctx.session = session;
        return;
    }

    // ── Awaiting free-text for a step ──
    if (session.awaitingFreeText) {
        const step = session.awaitingFreeText;

        // Validate field-specific constraints
        if (step === 'calories') {
            const v = validateCalories(ctx.message.text);
            if (!v) {
                await ctx.reply(t(locale, 'invalid_calories'));
                ctx.session = session;
                return;
            }
            session.answers[step] = v;
        } else if (step === 'protein') {
            const v = validateProtein(ctx.message.text);
            if (!v) {
                await ctx.reply(t(locale, 'invalid_protein'));
                ctx.session = session;
                return;
            }
            session.answers[step] = v;
        } else {
            const v = sanitizeText(ctx.message.text);
            if (!v) {
                await ctx.reply(t(locale, 'invalid_input'));
                ctx.session = session;
                return;
            }
            session.answers[step] = v;
        }

        session.history.push(step);
        delete session.awaitingFreeText;

        const nextIdx = STEP_ORDER.indexOf(step as StepKey) + 1;
        if (nextIdx < STEP_ORDER.length) {
            await renderStep(ctx, STEP_ORDER[nextIdx]);
        }
        ctx.session = session;
        return;
    }

    // ── Editing a specific field ──
    if (session.editingField) {
        const field = session.editingField;
        let v: string | null;
        if (field === 'calories') {
            v = validateCalories(ctx.message.text);
            if (!v) {
                await ctx.reply(t(locale, 'invalid_calories'));
                ctx.session = session;
                return;
            }
        } else if (field === 'protein') {
            v = validateProtein(ctx.message.text);
            if (!v) {
                await ctx.reply(t(locale, 'invalid_protein'));
                ctx.session = session;
                return;
            }
        } else {
            v = sanitizeText(ctx.message.text);
            if (!v) {
                await ctx.reply(t(locale, 'invalid_input'));
                ctx.session = session;
                return;
            }
        }
        session.answers[field] = v;
        delete session.editingField;
        await renderStep(ctx, 'preview');
        ctx.session = session;
        return;
    }

    // ── Idle: detect raw HH:MM ──
    if (session.step === 'idle') {
        const parsed = validateTimeFormat(ctx.message.text);
        if (parsed) {
            const { h, min } = parsed;
            await ensureUser(ctx.chat.id, locale);
            await setPushTime(ctx.chat.id, h, min);
            await ctx.reply(t(locale, 'settime_set', pad2(h), pad2(min)));
            ctx.session = session;
            return;
        }

        // ── Natural language input — detect food preferences ──
        const text = ctx.message.text.trim();
        const FOOD_KEYWORDS = [
            'pedas', 'ayam', 'sayur', 'ringan', 'berat', 'vegetarian', 'halal',
            'beef', 'sapi', 'ikan', 'chicken', 'spicy', 'rice', 'nasi', 'mie',
            'soup', 'sup', 'salad', 'egg', 'telur', 'tofu', 'tahu', 'tempe',
            'kambing', 'domba', 'babi', 'kentang', 'pasta', 'pizza', 'burger',
            'sehat', 'healthy', 'diet', 'cut', 'bulk', 'lean', 'high protein',
            'rendah', 'karbo', 'low carb', 'keto', 'gluten', 'susu', 'keju',
            'japanese', 'korean', 'chinese', 'indonesian', 'western', 'thai',
            'mediterranean', 'indian', 'vietnam', 'medan', 'padang', 'sunda',
            'betawi', 'bali', 'seafood', 'bakar', 'goreng', 'rebus', 'panggang',
        ];
        const lowerText = text.toLowerCase();
        const looksLikeFood = text.length > 3
            && !text.startsWith('/')
            && FOOD_KEYWORDS.some((kw) => lowerText.includes(kw));
        if (looksLikeFood) {
            const user = await getUser(ctx.chat.id);
            const answers = user?.lastAnswers || {};
            answers.cuisine = text;
            ctx.session.answers = answers;
            ctx.session.step = 'idle';
            await ctx.reply(t(locale, 'nl_detect', text));
            await generateAndSend(ctx, answers);
            ctx.session = session;
            return;
        }
    }

    await ctx.reply(t(getLocale(ctx), 'idle'));
    ctx.session = session;
});

bot.catch((err: any, ctx: any) => {
    console.error(`Unhandled error for ${ctx.updateType}:`, err);
});

// ────────────────────────────────────────────────────────────────────────────
// Daily scheduler
// ────────────────────────────────────────────────────────────────────────────
function userPushDue(user: User, now = new Date()): boolean {
    const h = user.pushHour ?? DAILY_PUSH_HOUR;
    const m = user.pushMin ?? DAILY_PUSH_MIN;
    return now.getHours() === h && now.getMinutes() === m && now.getSeconds() < 60;
}

async function pushDailyPlans(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const subs = await getSubscribedUsers();
    for (const sub of subs) {
        if (!userPushDue(sub)) continue;
        if (sub.lastPushed === today) continue;
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        if (sub.lastPushed !== yesterday) await resetStreak(sub.chatId);
        try {
            const plan = await generateMealPlan(sub.answers, {
                locale: sub.locale,
                avoidCuisines: sub.lastCuisines,
            }, sub.chatId);
            await deliverPlan(deliveryAdapters, sub.chatId, plan);
            const cuisine = parseCuisine(plan);
            await logPush(sub.chatId, 'sent', cuisine);
            await saveBotPlan(sub.chatId, plan, cuisine, JSON.stringify(parsePlanMeals(plan)));
            await bumpStreak(sub.chatId);
            await setLastPushed(sub.chatId, today);
            await setLastAnswers(sub.chatId, sub.answers);
            // Action keyboard — cooked check-in, grocery, remix, etc.
            try {
                await bot.telegram.sendMessage(
                    sub.chatId,
                    sub.locale === 'id' ? 'Aksi cepat buat plan hari ini:' : 'Quick actions for today\'s plan:',
                    { reply_markup: planActionKeyboard(sub.locale).reply_markup }
                );
            } catch (kbErr) {
                console.error(`Keyboard send failed for ${sub.chatId}:`, kbErr);
            }
            const updated = await getUser(sub.chatId);
            const streak = updated?.streak || 0;
            if (streak > 0) {
                await bot.telegram.sendMessage(sub.chatId, t(sub.locale, 'streak_msg', streak));
            }
            if (cuisine) {
                const cuisines = [...(sub.lastCuisines || []), cuisine].slice(-5);
                await setLastCuisines(sub.chatId, cuisines);
            }
            console.log(`Pushed daily plan to ${sub.chatId}`);
        } catch (err: any) {
            console.error(`Daily push failed for ${sub.chatId}:`, err);
            await logPush(sub.chatId, 'failed', null, err.message);
        }
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Smart nudge — remind subscribed users without today's plan at 11am WIB (UTC+7)
// ────────────────────────────────────────────────────────────────────────────
async function smartNudge(): Promise<void> {
    const now = new Date();
    // WIB = UTC+7 — check if current UTC time is 04:00 (11:00 WIB)
    const utcHour = now.getUTCHours();
    if (utcHour !== 4) return;
    const today = new Date().toISOString().slice(0, 10);
    const subs = await getSubscribedUsers();
    for (const sub of subs) {
        // Skip users who already have today's plan
        if (sub.lastPushed === today) continue;
        try {
            const existing = await getBotPlanByDate(sub.chatId, today);
            if (existing) continue;
            await bot.telegram.sendMessage(
                sub.chatId,
                t(sub.locale, 'nudge_msg'),
                Markup.inlineKeyboard([
                    [{ text: t(sub.locale, 'nudge_btn'), callback_data: 'cmd_mealplan' }],
                ]),
            );
        } catch (err: any) {
            console.error(`Nudge failed for ${sub.chatId}:`, err);
        }
    }
}

setInterval(() => { pushDailyPlans(); }, 60_000);
setInterval(() => { smartNudge(); }, 60_000);

// ────────────────────────────────────────────────────────────────────────────
// Startup
// ────────────────────────────────────────────────────────────────────────────
async function main() {
    await migrateSchema();
    setUsageCallback(logUsage);

    await bot.telegram.setMyCommands([
        { command: 'mealplan', description: 'Build a new meal plan' },
        { command: 'today', description: 'View today\'s plan' },
        { command: 'yesterday', description: 'View yesterday\'s plan' },
        { command: 'summary', description: 'Weekly digest' },
        { command: 'regen', description: 'Regenerate a single meal' },
        { command: 'subscribe', description: 'Get a fresh plan pushed daily' },
        { command: 'unsubscribe', description: 'Stop daily push' },
        { command: 'settime', description: 'Change your daily push time' },
        { command: 'status', description: 'Check subscription status' },
        { command: 'plans', description: 'View your saved plans' },
        { command: 'save', description: 'Save current plan as a preset' },
        { command: 'weekly', description: 'Generate a 7-day plan' },
        { command: 'invite', description: 'Get your referral link' },
        { command: 'lang', description: 'Switch language (EN/ID)' },
        { command: 'cancel', description: 'Cancel current /mealplan session' },
        { command: 'help', description: 'Show available commands' },
    ]).catch((err: any) => console.error('setMyCommands failed:', err.message));

    bot.launch();
    console.log('Bot is running. Press Ctrl+C to stop.');
}

main().catch((err) => {
    console.error('Startup failed:', err);
    process.exit(1);
});

// ────────────────────────────────────────────────────────────────────────────
// Graceful shutdown
// ────────────────────────────────────────────────────────────────────────────
async function shutdown(signal: string) {
    console.log(`Received ${signal}, shutting down...`);
    bot.stop(signal);
    await closePool();
    process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
