import 'dotenv/config';

const BASE_URL = process.env.LLM_BASE_URL || 'http://127.0.0.1:8080/v1';
const MODEL = process.env.LLM_MODEL || 'hermes';
const API_KEY = process.env.LLM_API_KEY || 'not-needed';
const MAX_RETRIES = Number(process.env.LLM_MAX_RETRIES ?? 3);
const RETRY_DELAY_MS = Number(process.env.LLM_RETRY_DELAY_MS ?? 2000);

export interface MealPlanOptions {
  locale?: 'en' | 'id';
  avoidCuisines?: string[];
  regenerate?: boolean;
  profileContext?: {
    age?: number | null;
    gender?: string | null;
    height_cm?: number | null;
    weight_kg?: number | null;
    activity_level?: string;
    cooking_skill?: string;
    household_size?: number;
    budget_tier?: string;
    health_conditions?: string | null;
    disliked_ingredients?: string | null;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// System prompt is built per-locale so the model answers in the right language.
// ────────────────────────────────────────────────────────────────────────────
function systemPrompt(locale: 'en' | 'id'): string {
  const id = locale === 'id';
  const langLine = id
    ? 'Tulis seluruh jawaban dalam Bahasa Indonesia.'
    : 'Write the entire answer in English.';

  return `You are a practical nutrition assistant. ${langLine}
Generate a single day's meal plan tailored to the user's stated goal, dietary restrictions,
allergies, calorie target, protein target, and preferred number of meals. Rules:
- Respect allergies and restrictions strictly — never include a flagged ingredient.
- All ingredients MUST be commonly available in Indonesia (use Indonesian names where natural,
  e.g. tempe, ikan kembung, kangkung, tahu, kecap manis).
- If a calorie target is given, keep the day's total within ~5% of it and show an estimated
  calorie count per meal.
- If a protein target (g) is given, aim for it across the day and show an estimated protein
  count per meal.
- Structure the output as a clean list: meal name, what to eat, rough calories (+ protein g).
- Keep it realistic and buyable with common ingredients unless the user requested a specific cuisine.
- If the user asked for a different cuisine each day, pick ONE cuisine for today and name it at
  the top (e.g. ${id ? '"Hari ini: Masakan Jepang"' : '"Today: Japanese"'}).
${id ? '- Jangan tambahkan disclaimer tentang AI atau "konsultasi dokter" — berikan rencananya saja.' : '- Do not add disclaimers about being an AI or "consult a doctor" — just give the plan.'}
- Output plain text formatted for a Telegram message (short lines, simple dashes), no markdown tables.`;
}

function buildUserPrompt(answers: Record<string, any>, opts: MealPlanOptions = {}): string {
  const {
    goal, restrictions, allergies, calories, mealsPerDay, cuisine,
  } = answers;
  const lines: string[] = [
    `Goal: ${goal}`,
    `Dietary restrictions: ${restrictions || 'none'}`,
    `Allergies/must-avoid: ${allergies || 'none'}`,
    `Calorie target: ${calories || 'no specific target, use a sensible default for the goal'}`,
    `Protein target: ${answers.protein ? answers.protein + 'g' : 'no specific target'}`,
    `Meals per day: ${mealsPerDay}`,
    `Cuisine preference: ${cuisine || 'no preference'}`,
  ];

  // Enhanced profile context
  if (opts.profileContext) {
    const p = opts.profileContext;
    if (p.age) lines.push(`Age: ${p.age}`);
    if (p.gender) lines.push(`Gender: ${p.gender}`);
    if (p.height_cm) lines.push(`Height: ${p.height_cm}cm`);
    if (p.weight_kg) lines.push(`Weight: ${p.weight_kg}kg`);
    if (p.activity_level) lines.push(`Activity level: ${p.activity_level}`);
    if (p.cooking_skill) lines.push(`Cooking skill: ${p.cooking_skill}`);
    if (p.household_size && p.household_size > 1) lines.push(`Cooking for ${p.household_size} people`);
    if (p.budget_tier) lines.push(`Budget: ${p.budget_tier}`);
    if (p.health_conditions) lines.push(`Health conditions: ${p.health_conditions}`);
    if (p.disliked_ingredients) lines.push(`Disliked ingredients: ${p.disliked_ingredients}`);
  }

  if (opts.avoidCuisines?.length) {
    lines.push(`Cuisines already used recently (pick a DIFFERENT one): ${opts.avoidCuisines.join(', ')}`);
  }
  if (opts.regenerate) {
    lines.push('This is a re-roll — make it noticeably different from a typical plan (different dishes, different flavors).');
  }
  lines.push('', 'Generate today\'s meal plan.');
  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// Low-level call — shared by all public functions. Retries on empty content.
// ────────────────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callLLM(
  systemContent: string,
  userContent: string,
  { temperature = 0.6, maxTokens = 8192 }: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          temperature,
          max_tokens: maxTokens,
          // Try to suppress reasoning/thinking if the backend supports it.
          thinking: false,
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent },
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`LLM server responded ${res.status}: ${errText.slice(0, 200)}`);
      }

      const raw = await res.text();
      const jsonEnd = raw.lastIndexOf('}');
      const jsonStr = jsonEnd === -1 ? raw : raw.slice(0, jsonEnd + 1);
      let data: any;
      try {
        data = JSON.parse(jsonStr);
      } catch {
        throw new Error(`LLM server returned non-JSON: ${raw.slice(0, 200)}`);
      }

      const msg = data?.choices?.[0]?.message;
      const content = msg?.content?.trim();

      if (!content) {
        // Empty content = empty stream from provider. Retryable.
        throw new Error('LLM server returned no content (possible upstream error or empty stream).');
      }

      return sanitizePlanOutput(content);
    } catch (err) {
      lastErr = err as Error;
      console.error(`LLM attempt ${attempt}/${MAX_RETRIES} failed:`, (err as Error).message);
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * attempt;
        console.log(`Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted — try fallback model if configured
  const fallbackModel = process.env.LLM_FALLBACK_MODEL;
  if (fallbackModel && fallbackModel !== MODEL) {
    console.log(`Falling back to ${fallbackModel}...`);
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: fallbackModel,
          temperature,
          max_tokens: maxTokens,
          thinking: false,
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent },
          ],
        }),
      });
      if (res.ok) {
        const raw = await res.text();
        const jsonEnd = raw.lastIndexOf('}');
        const jsonStr = jsonEnd === -1 ? raw : raw.slice(0, jsonEnd + 1);
        const data = JSON.parse(jsonStr);
        const content = data?.choices?.[0]?.message?.content?.trim();
        if (content) return sanitizePlanOutput(content);
      }
    } catch (fbErr) {
      console.error('Fallback model also failed:', (fbErr as Error).message);
    }
  }

  throw lastErr || new Error('LLM call failed after all retries');
}

// ────────────────────────────────────────────────────────────────────────────
// Plan quality validation — strip markdown tables, validate structure
// ────────────────────────────────────────────────────────────────────────────
function sanitizePlanOutput(text: string): string {
  let s = text;

  // Strip markdown tables — model sometimes ignores "no tables" instruction
  // Removes lines like |---|---| and table rows
  s = s.replace(/^\|.*\|$/gm, '');    // table rows
  s = s.replace(/^\|[-:\s|]+\|$/gm, ''); // separator rows

  // Strip markdown bold/italic
  s = s.replace(/\*\*(.+?)\*\*/g, '$1');
  s = s.replace(/\*(.+?)\*/g, '$1');
  s = s.replace(/__(.+?)__/g, '$1');

  // Strip markdown headers
  s = s.replace(/^#{1,6}\s+/gm, '');

  // Collapse multiple blank lines
  s = s.replace(/\n{3,}/g, '\n\n');

  // Trim leading/trailing whitespace
  return s.trim();
}

// ────────────────────────────────────────────────────────────────────────────
// Multi-day plan — generate N days in one call
// ────────────────────────────────────────────────────────────────────────────
export async function generateWeeklyPlan(
  answers: Record<string, any>,
  opts: MealPlanOptions = {},
): Promise<string> {
  const locale = opts.locale || 'en';
  const sys = systemPrompt(locale) + '\n\nGenerate a 7-day meal plan (one per day) with different cuisine each day. Label each day clearly (Day 1, Day 2, etc).';
  const user = buildUserPrompt(answers, opts) + '\n\nGenerate a 7-day meal plan (one per day) with different cuisine each day. Label each day clearly (Day 1, Day 2, etc).';
  return callLLM(sys, user, { temperature: 0.7, maxTokens: 8192 });
}

export async function generateMealPlan(
  answers: Record<string, any>,
  opts: MealPlanOptions = {},
): Promise<string> {
  const locale = opts.locale || 'en';
  return callLLM(systemPrompt(locale), buildUserPrompt(answers, opts), {
    temperature: opts.regenerate ? 0.85 : 0.6,
    maxTokens: 8192,
  });
}

export async function generateShoppingList(planText: string, locale: 'en' | 'id' = 'en'): Promise<string> {
  const sys = locale === 'id'
    ? 'Kamu asisten belanja. Dari rencana makan yang diberikan, ekstrak daftar belanja lengkap: bahan + jumlah perkiraan. Format: nama bahan — jumlah. Kelompokkan per kategori (Protein, Sayur, Lainnya). Tanpa disclaimer.'
    : 'You are a shopping assistant. From the given meal plan, extract a full shopping list: ingredient + rough quantity. Format: ingredient name — quantity. Group by category (Protein, Produce, Other). No disclaimers.';
  return callLLM(sys, planText, { temperature: 0.3, maxTokens: 8192 });
}

export async function generateMacros(planText: string, locale: 'en' | 'id' = 'en'): Promise<string> {
  const sys = locale === 'id'
    ? 'Kamu analis nutrisi. Dari rencana makan, hitung total: kalori, protein (g), karbohidrat (g), lemak (g). Tampilkan per meal dan total hari. Format ringkas untuk Telegram.'
    : 'You are a nutrition analyst. From the meal plan, compute totals: calories, protein (g), carbs (g), fat (g). Show per meal and daily total. Concise Telegram format.';
  return callLLM(sys, planText, { temperature: 0.2, maxTokens: 8192 });
}

export async function generateCookingSteps(planText: string, locale: 'en' | 'id' = 'en'): Promise<string> {
  const sys = locale === 'id'
    ? `Kamu koki praktis. Dari rencana makan yang diberikan, buat panduan masak untuk SETIAP meal:

 Untuk setiap meal, tampilkan:
 1. 🍳 Peralatan — daftar alat masak (wajan, panci, talenan, pisau, dll)
 2. 📝 Langkah-langkah — nomor, ringkas, jelas (potong, tumis, masak, dll)
 3. 🍽️ Saran penyajian — tips plating/sajian singkat

 Format per meal:
 --- Nama Meal ---
 🍳 Peralatan: ...
 📝 Langkah:
 1. ...
 2. ...
 🍽️ Sajian: ...

 Bahasa Indonesia, tanpa disclaimer, format Telegram (baris pendek).`
    : `You are a practical cook. From the given meal plan, create cooking instructions for EACH meal:

 For each meal, show:
 1. 🍳 Utensils — list cooking tools needed (pan, pot, cutting board, knife, etc)
 2. 📝 Steps — numbered, concise, clear (chop, saute, cook, etc)
 3. 🍽️ Serving — brief plating/serving tips

 Format per meal:
 --- Meal Name ---
 🍳 Utensils: ...
 📝 Steps:
 1. ...
 2. ...
 🍽️ Serving: ...

 Plain English, no disclaimers, Telegram format (short lines).`;
  return callLLM(sys, planText, { temperature: 0.4, maxTokens: 8192 });
}

export async function regenerateMeal(
  planText: string,
  mealName: string,
  locale: 'en' | 'id' = 'en',
  answers: Record<string, any> = {},
): Promise<string> {
  const sys = locale === 'id'
    ? `Kamu asisten nutrisi. User mau ganti salah satu meal dari rencana makan mereka.
Buat SATU pengganti untuk "${mealName}" yang:
- Beda dari yang ada di rencana sekarang
- Sesuai goal, alergi, dan pantangan user
- Bahan tersedia di Indonesia
- Sertakan kalori + protein perkiraan per meal
- Format sama dengan meal lainnya di rencana

Keluarin HANYA meal pengganti, bukan rencana lengkap. Tanpa preamble atau penjelasan.`
    : `You are a nutrition assistant. The user wants to replace one meal from their plan.
Generate ONE replacement for "${mealName}" that:
- Is different from what's in the current plan
- Matches the user's goal, allergies, and restrictions
- Uses ingredients available in Indonesia
- Includes estimated calories + protein per meal
- Matches the format of other meals in the plan

Output ONLY the replacement meal, not the full plan. No preamble or explanation.`;

  const user = `Current full plan:\n${planText}\n\nUser goal: ${answers.goal || 'general health'}\nAllergies: ${answers.allergies || 'none'}\nRestrictions: ${answers.restrictions || 'none'}\nCalorie target: ${answers.calories || 'default'}\nProtein target: ${answers.protein || 'default'}\n\nReplace ONLY "${mealName}" with something different.`;

  return callLLM(sys, user, { temperature: 0.85, maxTokens: 2048 });
}

export function parseCuisine(planText: string): string | null {
  const m = planText.match(/^(?:Today|Hari ini):\s*(.+)$/im);
  return m ? m[1].trim() : null;
}
