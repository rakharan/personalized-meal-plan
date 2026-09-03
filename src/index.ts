import 'dotenv/config';
import { Telegraf, session, Markup } from 'telegraf';
import {
    generateMealPlan, generateShoppingList, generateMacros, parseCuisine,
    generateWeeklyPlan,
} from './llmClient.js';
import {
    saveUser, getUser, ensureUser, setSubscribed, getSubscribedUsers,
    setLastPushed, setLocale, bumpStreak, resetStreak,
    setLastAnswers, setLastCuisines, setLastFeedback, setPushTime,
    savePlan, getPlans, getPlan, deletePlan, closePool, migrateSchema,
    pgSessionStore, checkRateLimit, incrementPlanCount,
    createReferral, getReferralCount,
} from './store.js';
import type { Answers, User } from './store.js';
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
        en: (name: string) => `Hey${name ? ` ${name}` : ''}! I'll build you a daily meal plan with a local LLM. Tap a button below to get started.`,
        id: (name: string) => `Halo${name ? ` ${name}` : ''}! Aku akan membuatkan rencana makan harian dengan LLM lokal. Ketuk tombol di bawah untuk mulai.`,
    },
    start_plan: { en: '🍱 Start /mealplan', id: '🍱 Mulai /mealplan' },
    start_lang: { en: '🌐 Set language', id: '🌐 Ganti bahasa' },
    start_help: { en: '❓ How it works', id: '❓ Cara kerja' },

    help: {
        en: 'How it works:\n1. /mealplan — answer a few questions (tap buttons)\n2. Preview your answers, then Generate\n3. Get a meal plan with calories + protein\n4. 🛒 Shopping list or 📊 Macros buttons\n5. 🎲 Regenerate for a different plan\n6. /subscribe to get a fresh plan daily',
        id: 'Cara kerja:\n1. /mealplan — jawab beberapa pertanyaan (ketuk tombol)\n2. Pratinjau jawabanmu, lalu Generate\n3. Dapat rencana makan + kalori + protein\n4. Tombol 🛒 Daftar belanja atau 📊 Makro\n5. 🎲 Regenerasi untuk rencana berbeda\n6. /subscribe untuk rencana harian otomatis',
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
    done: { en: "Got it — generating your meal plan, hang on...", id: "Sip — sedang membuat rencana makan, tunggu sebentar..." },
    back: { en: '◀️ Back', id: '◀️ Kembali' },
    other: { en: '✏️ Other (type)', id: '✏️ Lain (ketik)' },
    skip: { en: '⏭ Skip', id: '⏭ Skip' },
    none: { en: 'None', id: 'Tidak ada' },

    preview: { en: '📋 Here are your answers. Generate?', id: '📋 Ini jawabanmu. Buat rencana?' },
    confirm_generate: { en: '✅ Generate', id: '✅ Buat' },
    confirm_edit: { en: '✏️ Edit', id: '✏️ Ubah' },
    confirm_cancel: { en: '❌ Cancel', id: '❌ Batal' },

    reroll: { en: '🎲 Regenerate', id: '🎲 Regenerasi' },
    shop: { en: '🛒 Shopping list', id: '🛒 Daftar belanja' },
    macros: { en: '📊 Macros', id: '📊 Makro' },
    good: { en: '👍 Good', id: '👍 Bagus' },
    bad: { en: '👎 Try again', id: '👎 Ulangi' },

    subscribed: {
        en: (h: string, m: string) => `Subscribed! A fresh plan will be pushed daily at ${h}:${m}. /settime to change, /unsubscribe to stop.`,
        id: (h: string, m: string) => `Berlangganan! Rencana baru dikirim harian pukul ${h}:${m}. /settime ubah, /unsubscribe berhenti.`,
    },
    unsubscribed: { en: 'Unsubscribed. /subscribe to resume.', id: 'Berhenti berlangganan. /subscribe lanjut.' },
    not_subscribed: { en: 'Not subscribed', id: 'Tidak berlangganan' },
    subscribed_state: { en: 'Subscribed', id: 'Berlangganan' },
    need_mealplan: {
        en: "You haven't completed /mealplan yet. Do that first.",
        id: "Kamu belum menyelesaikan /mealplan. Selesaikan dulu.",
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
    shopping_done: { en: 'Generating shopping list...', id: 'Membuat daftar belanja...' },
    macros_done: { en: 'Computing macros...', id: 'Menghitung makro...' },
    err: {
        en: (m: string) => `Couldn't generate: ${m}. Try /mealplan again.`,
        id: (m: string) => `Gagal membuat: ${m}. Coba /mealplan lagi.`,
    },
    streak_msg: {
        en: (n: number) => n > 0 ? `🔥 Day ${n} streak!` : '',
        id: (n: number) => n > 0 ? `🔥 Hari ke-${n} beruntun!` : '',
    },
    missed: {
        en: 'Missed yesterday? /mealplan to restart your streak.',
        id: 'Ketinggalan kemarin? /mealplan untuk mulai lagi.',
    },
    rate_limited: {
        en: (limit: number) => `Daily limit reached (${limit} plans/day). Resets tomorrow.`,
        id: (limit: number) => `Batas harian tercapai (${limit} rencana/hari). Reset besok.`,
    },
    weekly_done: { en: 'Generating weekly plan...', id: 'Membuat rencana mingguan...' },
    invite_msg: {
        en: (link: string) => `Invite friends:\n${link}`,
        id: (link: string) => `Ajak teman:\n${link}`,
    },
    invite_count: {
        en: (n: number) => `You've invited ${n} friend(s).`,
        id: (n: number) => `Kamu telah mengajak ${n} teman.`,
    },
    onboarding: {
        en: 'Welcome! I make daily meal plans from your preferences — calories, protein, cuisine. Takes 30 seconds. Tap Start below.',
        id: 'Selamat datang! Aku buat rencana makan harian dari preferensimu — kalori, protein, masakan. 30 detik. Ketuk Mulai.',
    },
    invalid_input: {
        en: 'Invalid input. Try again.',
        id: 'Input tidak valid. Coba lagi.',
    },
    invalid_calories: {
        en: 'Calories must be 800–5000. Try again.',
        id: 'Kalori harus 800–5000. Coba lagi.',
    },
    invalid_protein: {
        en: 'Protein must be 20–500g. Try again.',
        id: 'Protein harus 20–500g. Coba lagi.',
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
            { text: t(locale, 'reroll'), callback_data: 'action_reroll' },
            { text: t(locale, 'edit_plan'), callback_data: 'action_edit' },
            { text: t(locale, 'save_plan'), callback_data: 'action_save' },
        ],
        [
            { text: t(locale, 'shop'), callback_data: 'action_shop' },
            { text: t(locale, 'macros'), callback_data: 'action_macros' },
        ],
        [
            { text: t(locale, 'good'), callback_data: 'action_good' },
            { text: t(locale, 'bad'), callback_data: 'action_bad' },
        ],
    ]);
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
    if (chatId) {
        const rl = await checkRateLimit(chatId, user?.tier || 'free');
        if (!rl.allowed) {
            await ctx.reply(t(locale, 'rate_limited', rl.limit));
            return;
        }
    }

    try {
        const plan = await generateMealPlan(answers as Answers, {
            locale, avoidCuisines, regenerate: opts.regenerate,
        });
        await sendLong((txt) => ctx.reply(txt), plan);

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
            const c = parseCuisine(plan);
            if (c) {
                const cuisines = [...avoidCuisines, c].slice(-5);
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
    const user = await ensureUser(ctx.chat.id, locale);
    ctx.session = freshSession();
    ctx.session.locale = user.locale || locale;

    // Parse referral param: /start ref_<referrerChatId>
    const payload = ctx.message?.text?.split(' ')[1] || '';
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
        });
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

bot.command('help', async (ctx: any) => {
    const locale = getLocale(ctx);
    const lines = locale === 'id' ? [
        '📚 Perintah tersedia:',
        '',
        '/mealplan — buat rencana makan baru (jawab pertanyaan)',
        '/subscribe — langganan rencana harian otomatis',
        '/unsubscribe — berhenti langganan',
        '/settime — ubah jam kirim harian',
        '/status — cek status langganan',
        '/lang — ganti bahasa (EN/ID)',
        '/cancel — batalkan sesi /mealplan',
        '/plans — lihat rencana tersimpan',
        '/save <nama> — simpan rencana saat ini',
        '/weekly — buat rencana 7 hari',
        '/invite — link referral teman',
        '/help — tampilkan bantuan ini',
        '',
        '💡 Setelah rencana dibuat, ada tombol: 🎲 Regenerasi, ✏️ Ubah, 💾 Simpan, 🛒 Daftar belanja, 📊 Makro, 👍/👎',
    ] : [
        '📚 Available commands:',
        '',
        '/mealplan — build a new meal plan (answer questions)',
        '/subscribe — get a fresh plan pushed daily',
        '/unsubscribe — stop daily push',
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
        '💡 After a plan is generated, buttons appear: 🎲 Regenerate, ✏️ Edit, 💾 Save, 🛒 Shopping list, 📊 Macros, 👍/👎',
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
            await ctx.reply(locale === 'id' ? '👍 Terima kasih!' : '👍 Thanks!');
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
        if (action === 'shop' || action === 'macros') {
            const last = user?.lastAnswers;
            if (!last) {
                await ctx.reply(t(locale, 'need_mealplan'));
                return;
            }
            const waitMsg = action === 'shop' ? t(locale, 'shopping_done') : t(locale, 'macros_done');
            await ctx.reply(waitMsg);
            try {
                const plan = await generateMealPlan(last, { locale, avoidCuisines: user?.lastCuisines || [] });
                if (action === 'shop') {
                    const shop = await generateShoppingList(plan, locale);
                    await sendLong((txt) => ctx.reply(txt), shop);
                } else {
                    const macros = await generateMacros(plan, locale);
                    await sendLong((txt) => ctx.reply(txt), macros);
                }
            } catch (err: any) {
                console.error('Post-plan action failed:', err);
                await ctx.reply(t(locale, 'err', err.message));
            }
            return;
        }
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
            });
            await deliverPlan(deliveryAdapters, sub.chatId, plan);
            await bumpStreak(sub.chatId);
            await setLastPushed(sub.chatId, today);
            await setLastAnswers(sub.chatId, sub.answers);
            const updated = await getUser(sub.chatId);
            const streak = updated?.streak || 0;
            if (streak > 0) {
                await bot.telegram.sendMessage(sub.chatId, t(sub.locale, 'streak_msg', streak));
            }
            const c = parseCuisine(plan);
            if (c) {
                const cuisines = [...(sub.lastCuisines || []), c].slice(-5);
                await setLastCuisines(sub.chatId, cuisines);
            }
            console.log(`Pushed daily plan to ${sub.chatId}`);
        } catch (err) {
            console.error(`Daily push failed for ${sub.chatId}:`, err);
        }
    }
}

setInterval(() => { pushDailyPlans(); }, 60_000);

// ────────────────────────────────────────────────────────────────────────────
// Startup
// ────────────────────────────────────────────────────────────────────────────
async function main() {
    await migrateSchema();

    await bot.telegram.setMyCommands([
        { command: 'mealplan', description: 'Build a new meal plan' },
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
