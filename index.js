import 'dotenv/config';
import { Telegraf, session, Markup } from 'telegraf';
import {
    generateMealPlan, generateShoppingList, generateMacros, parseCuisine,
} from './llmClient.js';
import {
    saveUser, getUser, ensureUser, setSubscribed, getSubscribedUsers,
    setLastPushed, setLocale, bumpStreak, resetStreak,
    setLastAnswers, setLastCuisines, setLastFeedback, setPushTime,
    savePlan, getPlans, getPlan, deletePlan,
} from './store.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error('Missing TELEGRAM_BOT_TOKEN in .env');
    process.exit(1);
}

const DAILY_PUSH_HOUR = Number(process.env.DAILY_PUSH_HOUR ?? 8);
const DAILY_PUSH_MIN = Number(process.env.DAILY_PUSH_MIN ?? 0);

const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// ────────────────────────────────────────────────────────────────────────────
// i18n — all user-facing strings, keyed by locale ('en' | 'id')
// ────────────────────────────────────────────────────────────────────────────
const I18N = {
    start: {
        en: (name) => `Hey${name ? ` ${name}` : ''}! I'll build you a daily meal plan with a local LLM. Tap a button below to get started.`,
        id: (name) => `Halo${name ? ` ${name}` : ''}! Aku akan membuatkan rencana makan harian dengan LLM lokal. Ketuk tombol di bawah untuk mulai.`,
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
        en: (h, m) => `Subscribed! A fresh plan will be pushed daily at ${h}:${m}. /settime to change, /unsubscribe to stop.`,
        id: (h, m) => `Berlangganan! Rencana baru dikirim harian pukul ${h}:${m}. /settime ubah, /unsubscribe berhenti.`,
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
        en: (h, m) => `Push time set to ${h}:${m} daily.`,
        id: (h, m) => `Jam kirim diatur ke ${h}:${m} harian.`,
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
        en: (n) => `Saved plan "${n}". Use /plans to load it later.`,
        id: (n) => `Rencana "${n}" disimpan. Ketik /plans untuk muat nanti.`,
    },
    save_empty: {
        en: 'No answers to save yet. Run /mealplan first.',
        id: 'Belum ada jawaban untuk disimpan. Jalankan /mealplan dulu.',
    },
    plan_load: {
        en: (n) => `Loaded "${n}". Preview below — edit or generate.`,
        id: (n) => `Dimuat "${n}". Pratinjau di bawah — ubah atau buat.`,
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
        en: (m) => `Couldn't generate: ${m}. Try /mealplan again.`,
        id: (m) => `Gagal membuat: ${m}. Coba /mealplan lagi.`,
    },
    streak_msg: {
        en: (n) => n > 0 ? `🔥 Day ${n} streak!` : '',
        id: (n) => n > 0 ? `🔥 Hari ke-${n} beruntun!` : '',
    },
    missed: {
        en: 'Missed yesterday? /mealplan to restart your streak.',
        id: 'Ketinggalan kemarin? /mealplan untuk mulai lagi.',
    },
};

// Order of Q&A steps. 'preview' is the confirm step before generation.
const STEP_ORDER = ['goal', 'restrictions', 'allergies', 'calories', 'mealsPerDay', 'protein', 'cuisine', 'preview'];

const KEYBOARDS = {
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
function pad2(n) { return String(n).padStart(2, '0'); }

function t(locale, key, ...args) {
    const entry = I18N[key]?.[locale] || I18N[key]?.en;
    if (!entry) return key;
    return typeof entry === 'function' ? entry(...args) : entry;
}

function getLocale(ctx) {
    return ctx.session?.locale || 'en';
}

function freshSession() {
    return { step: 'idle', answers: {}, history: [], locale: 'en' };
}

async function sendLong(reply, text) {
    const TG_MAX = 4096;
    if (text.length <= TG_MAX) return reply(text);
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

// Build the inline keyboard for a step, with a Back button if not first step.
function stepKeyboard(step, locale) {
    const rows = [...(KEYBOARDS[step] || [])];
    const stepIdx = STEP_ORDER.indexOf(step);
    if (stepIdx > 0) {
        rows.push([{ text: t(locale, 'back'), callback_data: 'back' }]);
    }
    return Markup.inlineKeyboard(rows);
}

// Build a summary of current answers for the preview / edit screen.
function answersSummary(answers, locale) {
    const labels = {
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

// Inline keyboard for the edit menu (one button per answer field).
function editKeyboard(locale, answers) {
    const fields = ['goal', 'restrictions', 'allergies', 'calories', 'mealsPerDay', 'protein', 'cuisine'];
    const rows = fields.map((f) => [{
        text: `${f}: ${answers[f] || '—'}`,
        callback_data: `edit_${f}`,
    }]);
    rows.push([{ text: t(locale, 'confirm_cancel'), callback_data: 'cancel_edit' }]);
    return Markup.inlineKeyboard(rows);
}

// After a plan is sent, attach action buttons (re-roll, edit, save, shop, macros, feedback).
function planActionKeyboard(locale) {
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
// Step rendering — shows the prompt + keyboard for the current step.
// ────────────────────────────────────────────────────────────────────────────
async function renderStep(ctx, step) {
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
async function generateAndSend(ctx, answers, opts = {}) {
    const locale = getLocale(ctx);
    const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
    const user = chatId ? getUser(chatId) : null;
    const avoidCuisines = user?.lastCuisines || [];

    try {
        const plan = await generateMealPlan(answers, {
            locale, avoidCuisines, regenerate: opts.regenerate,
        });
        await sendLong((txt) => ctx.reply(txt), plan);

        // Streak: bump on first plan of the day, reset if gap.
        // NOTE: manual gen does NOT set last_pushed — only the scheduler does,
        // so a manual plan earlier in the day won't block the scheduled push.
        if (chatId) {
            const today = new Date().toISOString().slice(0, 10);
            const u = getUser(chatId);
            if (u) {
                if (u.lastPushed !== today) {
                    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
                    if (u.lastPushed !== yesterday) {
                        resetStreak(chatId);
                    }
                    bumpStreak(chatId);
                }
            }
            setLastAnswers(chatId, answers);
            setLastFeedback(chatId, null);
            const streak = getUser(chatId)?.streak || 0;
            if (streak > 0) {
                await ctx.reply(t(locale, 'streak_msg', streak));
            }
            // Track cuisine for rotation.
            const c = parseCuisine(plan);
            if (c) {
                const updated = [...avoidCuisines, c].slice(-5); // keep last 5
                setLastCuisines(chatId, updated);
            }
        }

        await ctx.reply(t(locale, 'done'), planActionKeyboard(locale));
    } catch (err) {
        console.error('LLM generation failed:', err);
        await ctx.reply(t(locale, 'err', err.message));
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Commands
// ────────────────────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
    const locale = ctx.from?.language_code === 'id' ? 'id' : 'en';
    const user = ensureUser(ctx.chat.id, locale);
    ctx.session = freshSession();
    ctx.session.locale = user.locale || locale;
    await ctx.reply(
        t(getLocale(ctx), 'start', ctx.from?.first_name),
        Markup.inlineKeyboard([
            [{ text: t(getLocale(ctx), 'start_plan'), callback_data: 'cmd_mealplan' }],
            [
                { text: t(getLocale(ctx), 'start_lang'), callback_data: 'cmd_lang' },
                { text: t(getLocale(ctx), 'start_help'), callback_data: 'cmd_help' },
            ],
        ])
    );
});

bot.command('mealplan', async (ctx) => {
    const user = ensureUser(ctx.chat.id, getLocale(ctx));
    ctx.session = { step: 'goal', answers: {}, history: [], locale: user.locale };
    await renderStep(ctx, 'goal');
});

bot.command('cancel', async (ctx) => {
    ctx.session = freshSession();
    ctx.session.locale = ensureUser(ctx.chat.id).locale;
    await ctx.reply(t(getLocale(ctx), 'cancelled'), Markup.removeKeyboard());
});

bot.command('subscribe', async (ctx) => {
    const locale = getLocale(ctx);
    const sub = getUser(ctx.chat.id);
    if (!sub?.lastAnswers) {
        await ctx.reply(t(locale, 'need_mealplan'));
        return;
    }
    setSubscribed(ctx.chat.id, true);
    const h = pad2(sub.pushHour ?? DAILY_PUSH_HOUR);
    const m = pad2(sub.pushMin ?? DAILY_PUSH_MIN);
    await ctx.reply(t(locale, 'subscribed', h, m));
});

bot.command('unsubscribe', async (ctx) => {
    setSubscribed(ctx.chat.id, false);
    await ctx.reply(t(getLocale(ctx), 'unsubscribed'));
});

bot.command('status', async (ctx) => {
    const sub = getUser(ctx.chat.id);
    const state = sub?.subscribed ? t(getLocale(ctx), 'subscribed_state') : t(getLocale(ctx), 'not_subscribed');
    await ctx.reply(state);
});

bot.command('lang', async (ctx) => {
    await ctx.reply(t(getLocale(ctx), 'pick_lang'), Markup.inlineKeyboard([
        [{ text: 'English', callback_data: 'lang_en' }, { text: 'Bahasa Indonesia', callback_data: 'lang_id' }],
    ]));
});

bot.command('settime', async (ctx) => {
    const locale = getLocale(ctx);
    const slots = ['06:00', '07:00', '08:00', '09:00', '12:00', '18:00', '19:00', '20:00'];
    const rows = [];
    for (let i = 0; i < slots.length; i += 3) {
        rows.push(slots.slice(i, i + 3).map((s) => ({
            text: s, callback_data: `settime_${s}`,
        })));
    }
    rows.push([{ text: '✏️ ' + t(locale, 'other'), callback_data: 'settime_custom' }]);
    await ctx.reply(t(locale, 'settime_pick'), Markup.inlineKeyboard(rows));
});

bot.command('plans', async (ctx) => {
    const locale = getLocale(ctx);
    const plans = getPlans(ctx.chat.id);
    if (!plans.length) {
        await ctx.reply(t(locale, 'no_plans'));
        return;
    }
    const rows = plans.map((p) => [
        { text: p.name, callback_data: `plan_load_${p.id}` },
        { text: '🗑', callback_data: `plan_del_${p.id}` },
    ]);
    await ctx.reply(t(locale, 'plans_list'), Markup.inlineKeyboard(rows));
});

bot.command('save', async (ctx) => {
    const locale = getLocale(ctx);
    const nameArg = ctx.message.text.split(' ').slice(1).join(' ').trim();
    const user = getUser(ctx.chat.id);
    const answers = user?.lastAnswers;
    if (!answers) {
        await ctx.reply(t(locale, 'save_empty'));
        return;
    }
    if (nameArg) {
        savePlan(ctx.chat.id, nameArg, answers);
        await ctx.reply(t(locale, 'save_done', nameArg));
        return;
    }
    // No name given — prompt for one via session flag.
    ctx.session.awaitingPlanName = true;
    await ctx.reply(t(locale, 'save_prompt'));
});

bot.command('help', async (ctx) => {
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
        '/help — show this help',
        '',
        '💡 After a plan is generated, buttons appear: 🎲 Regenerate, ✏️ Edit, 💾 Save, 🛒 Shopping list, 📊 Macros, 👍/👎',
    ];
    await ctx.reply(lines.join('\n'));
});

// ────────────────────────────────────────────────────────────────────────────
// Callback query handler — central dispatcher for all inline buttons
// ────────────────────────────────────────────────────────────────────────────
bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    // Ensure session exists — callback queries can fire without a prior /start
    // in the same process lifetime, leaving ctx.session undefined.
    if (!ctx.session) {
        const user = ensureUser(ctx.chat.id);
        ctx.session = freshSession();
        ctx.session.locale = user?.locale || 'en';
    }
    const locale = getLocale(ctx);
    // Always acknowledge the callback so the button stops loading.
    await ctx.answerCbQuery().catch(() => {});

    // ── Language toggle ──
    if (data === 'lang_en' || data === 'lang_id') {
        const newLocale = data.slice(5);
        ctx.session.locale = newLocale;
        setLocale(ctx.chat.id, newLocale);
        await ctx.reply(t(newLocale, 'lang_set'));
        return;
    }

    // ── Set push time ──
    if (data.startsWith('settime_')) {
        const locale = getLocale(ctx);
        const rest = data.slice(8);
        if (rest === 'custom') {
            ctx.session.awaitingTime = true;
            await ctx.reply(t(locale, 'settime_custom'));
            return;
        }
        const [h, m] = rest.split(':').map(Number);
        if (Number.isFinite(h) && Number.isFinite(m)) {
            ensureUser(ctx.chat.id, locale);
            setPushTime(ctx.chat.id, h, m);
            await ctx.reply(t(locale, 'settime_set', pad2(h), pad2(m)));
        }
        return;
    }

    // ── Start menu shortcuts ──
    if (data === 'cmd_mealplan') {
        const user = ensureUser(ctx.chat.id, getLocale(ctx));
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

    // ── Q&A answer buttons (prefix ans_<step>_<value>) ──
    if (data.startsWith('ans_')) {
        const [, step, ...rest] = data.split('_');
        const value = rest.join('_');

        // "other" means switch to free-text input for this step.
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

        const nextIdx = STEP_ORDER.indexOf(step) + 1;
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
        ctx.session.locale = ensureUser(ctx.chat.id).locale;
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
        const chatId = ctx.chat.id;
        const user = getUser(chatId);

        if (action === 'edit') {
            // Load last answers into session and show preview for editing.
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
            setLastFeedback(chatId, 'good');
            await ctx.reply(locale === 'id' ? '👍 Terima kasih!' : '👍 Thanks!');
            return;
        }
        if (action === 'bad') {
            setLastFeedback(chatId, 'bad');
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
            // We need the last plan text. Since we didn't store it, re-generate
            // is wasteful; instead, ask the LLM to build from last answers.
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
            } catch (err) {
                console.error('Post-plan action failed:', err);
                await ctx.reply(t(locale, 'err', err.message));
            }
            return;
        }
    }

    // ── Load / delete saved plans ──
    if (data.startsWith('plan_load_')) {
        const planId = Number(data.slice(11));
        const p = getPlan(planId);
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
        deletePlan(ctx.chat.id, planId);
        await ctx.reply(t(locale, 'plan_deleted'));
        return;
    }
});

// ────────────────────────────────────────────────────────────────────────────
// Free-text input — for "✏️ Other" answers or editing a field
// ────────────────────────────────────────────────────────────────────────────
bot.on('text', async (ctx) => {
    const session = ctx.session || freshSession();
    const locale = getLocale(ctx);

    // ── Awaiting custom push time (HH:MM) ──
    if (session.awaitingTime) {
        const m = ctx.message.text.trim().match(/^(\d{1,2}):(\d{2})$/);
        if (!m) {
            await ctx.reply(t(locale, 'settime_custom'));
            ctx.session = session;
            return;
        }
        const h = Number(m[1]), min = Number(m[2]);
        if (h > 23 || min > 59) {
            await ctx.reply(t(locale, 'settime_custom'));
            ctx.session = session;
            return;
        }
        ensureUser(ctx.chat.id, locale);
        setPushTime(ctx.chat.id, h, min);
        delete session.awaitingTime;
        session.step = 'idle';
        await ctx.reply(t(locale, 'settime_set', pad2(h), pad2(min)));
        ctx.session = session;
        return;
    }

    // ── Awaiting plan save name ──
    if (session.awaitingPlanName) {
        const name = ctx.message.text.trim().slice(0, 40);
        if (!name) {
            ctx.session = session;
            return;
        }
        const user = getUser(ctx.chat.id);
        const answers = user?.lastAnswers;
        if (!answers) {
            await ctx.reply(t(locale, 'save_empty'));
            delete session.awaitingPlanName;
            ctx.session = session;
            return;
        }
        savePlan(ctx.chat.id, name, answers);
        delete session.awaitingPlanName;
        await ctx.reply(t(locale, 'save_done', name));
        ctx.session = session;
        return;
    }

    // If we're awaiting free-text for a step (user tapped "Other")
    if (session.awaitingFreeText) {
        const step = session.awaitingFreeText;
        session.answers[step] = ctx.message.text.trim();
        session.history.push(step);
        delete session.awaitingFreeText;

        const nextIdx = STEP_ORDER.indexOf(step) + 1;
        if (nextIdx < STEP_ORDER.length) {
            await renderStep(ctx, STEP_ORDER[nextIdx]);
        }
        ctx.session = session;
        return;
    }

    // If we're editing a specific field (came from edit menu)
    if (session.editingField) {
        const field = session.editingField;
        session.answers[field] = ctx.message.text.trim();
        delete session.editingField;
        // Return to preview
        await renderStep(ctx, 'preview');
        ctx.session = session;
        return;
    }

    // ── Idle: detect raw HH:MM as a push time (for users who type it directly) ──
    if (session.step === 'idle' && /^(\d{1,2}):(\d{2})$/.test(ctx.message.text.trim())) {
        const m = ctx.message.text.trim().match(/^(\d{1,2}):(\d{2})$/);
        const h = Number(m[1]), min = Number(m[2]);
        if (h <= 23 && min <= 59) {
            ensureUser(ctx.chat.id, locale);
            setPushTime(ctx.chat.id, h, min);
            await ctx.reply(t(locale, 'settime_set', pad2(h), pad2(min)));
            ctx.session = session;
            return;
        }
    }

    // Default idle response
    await ctx.reply(t(getLocale(ctx), 'idle'));
    ctx.session = session;
});

bot.catch((err, ctx) => {
    console.error(`Unhandled error for ${ctx.updateType}:`, err);
});

// ────────────────────────────────────────────────────────────────────────────
// Daily scheduler — checks each subscribed user's own push time.
// ────────────────────────────────────────────────────────────────────────────
function userPushDue(user, now = new Date()) {
    const h = user.pushHour ?? DAILY_PUSH_HOUR;
    const m = user.pushMin ?? DAILY_PUSH_MIN;
    return now.getHours() === h && now.getMinutes() === m && now.getSeconds() < 60;
}

async function pushDailyPlans() {
    const today = new Date().toISOString().slice(0, 10);
    for (const sub of getSubscribedUsers()) {
        if (!userPushDue(sub)) continue;
        if (sub.lastPushed === today) continue;
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        if (sub.lastPushed !== yesterday) resetStreak(sub.chatId);
        try {
            const plan = await generateMealPlan(sub.answers, {
                locale: sub.locale,
                avoidCuisines: sub.lastCuisines,
            });
            await sendLong((txt) => bot.telegram.sendMessage(sub.chatId, txt), plan);
            bumpStreak(sub.chatId);
            setLastPushed(sub.chatId, today);
            setLastAnswers(sub.chatId, sub.answers);
            const streak = getUser(sub.chatId)?.streak || 0;
            if (streak > 0) {
                await bot.telegram.sendMessage(sub.chatId, t(sub.locale, 'streak_msg', streak));
            }
            const c = parseCuisine(plan);
            if (c) {
                const updated = [...(sub.lastCuisines || []), c].slice(-5);
                setLastCuisines(sub.chatId, updated);
            }
            console.log(`Pushed daily plan to ${sub.chatId}`);
        } catch (err) {
            console.error(`Daily push failed for ${sub.chatId}:`, err);
        }
    }
}

setInterval(pushDailyPlans, 60_000);

// ────────────────────────────────────────────────────────────────────────────
// Register the command menu with Telegram so "/" autocomplete shows all cmds.
// ────────────────────────────────────────────────────────────────────────────
await bot.telegram.setMyCommands([
    { command: 'mealplan', description: 'Build a new meal plan' },
    { command: 'subscribe', description: 'Get a fresh plan pushed daily' },
    { command: 'unsubscribe', description: 'Stop daily push' },
    { command: 'settime', description: 'Change your daily push time' },
    { command: 'status', description: 'Check subscription status' },
    { command: 'plans', description: 'View your saved plans' },
    { command: 'save', description: 'Save current plan as a preset' },
    { command: 'lang', description: 'Switch language (EN/ID)' },
    { command: 'cancel', description: 'Cancel current /mealplan session' },
    { command: 'help', description: 'Show available commands' },
]).catch((err) => console.error('setMyCommands failed:', err.message));

bot.launch();
console.log('Bot is running. Press Ctrl+C to stop.');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
