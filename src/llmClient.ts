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

export interface LLMResult {
  content: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

// Usage callback — set by index.ts to log to DB
let usageCallback: ((chatId: number, tokens: number, feature: string) => Promise<void>) | null = null;

export function setUsageCallback(cb: (chatId: number, tokens: number, feature: string) => Promise<void>): void {
  usageCallback = cb;
}

async function logUsageSafe(chatId: number | undefined, usage: { total_tokens: number } | undefined, feature: string): Promise<void> {
  if (!chatId || !usageCallback || !usage?.total_tokens) return;
  try { await usageCallback(chatId, usage.total_tokens, feature); } catch { /* silent */ }
}

// ────────────────────────────────────────────────────────────────────────────
// System prompt — compact for token efficiency
// ────────────────────────────────────────────────────────────────────────────
function systemPrompt(locale: 'en' | 'id'): string {
  const id = locale === 'id';
  const lang = id ? 'Bahasa Indonesia.' : 'English.';
  return `Nutrition assistant. Write in ${lang} Generate one day meal plan. Rules:
- Respect allergies/restrictions — never include flagged ingredients
- Ingredients MUST be available in Indonesia (tempe, ikan kembung, kangkung, tahu, kecap manis)
- If calorie target given: stay within ~5%, show per-meal calories
- If protein target given: aim for it, show per-meal protein (g)
- EVERY meal MUST include all 4 macros in this exact format on the first line:
  MEAL_NAME (~XXX kkal, XXg protein, XXg karbo, XXg lemak)
  Example: SARAPAN (~740 kkal, 37g protein, 90g karbo, 25g lemak)
- Format: meal name line with macros, then food items as bullet list, then blank line
- If rotate cuisine: pick ONE, name at top (${id ? '"Hari ini: Jepang"' : '"Today: Japanese"'})
- Plain text, short lines, no markdown tables, no disclaimers`;
}

function buildUserPrompt(answers: Record<string, any>, opts: MealPlanOptions = {}): string {
  const { goal, restrictions, allergies, calories, mealsPerDay, cuisine } = answers;
  const lines: string[] = [
    `Goal: ${goal}`,
    `Diet: ${restrictions || 'none'}`,
    `Allergies: ${allergies || 'none'}`,
    `Calories: ${calories || 'auto'}`,
    `Protein: ${answers.protein ? answers.protein + 'g' : 'auto'}`,
    `Meals/day: ${mealsPerDay}`,
    `Cuisine: ${cuisine || 'any'}`,
  ];
  if (opts.profileContext) {
    const p = opts.profileContext;
    if (p.age) lines.push(`Age: ${p.age}`);
    if (p.gender) lines.push(`Gender: ${p.gender}`);
    if (p.height_cm) lines.push(`Height: ${p.height_cm}cm`);
    if (p.weight_kg) lines.push(`Weight: ${p.weight_kg}kg`);
    if (p.activity_level) lines.push(`Activity: ${p.activity_level}`);
    if (p.cooking_skill) lines.push(`Cooking skill: ${p.cooking_skill}`);
    if (p.household_size && p.household_size > 1) lines.push(`For ${p.household_size} people`);
    if (p.budget_tier) lines.push(`Budget: ${p.budget_tier}`);
    if (p.health_conditions) lines.push(`Health: ${p.health_conditions}`);
    if (p.disliked_ingredients) lines.push(`Dislike: ${p.disliked_ingredients}`);
  }
  if (opts.avoidCuisines?.length) {
    lines.push(`Avoid cuisines: ${opts.avoidCuisines.join(', ')}`);
  }
  if (opts.regenerate) {
    lines.push('Re-roll: make it different (different dishes, flavors).');
  }
  lines.push('', "Generate today's meal plan.");
  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// Low-level call — returns content + usage. Retries on empty content.
// ────────────────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseResponse(raw: string): { data: any; content: string } | null {
  const jsonEnd = raw.lastIndexOf('}');
  const jsonStr = jsonEnd === -1 ? raw : raw.slice(0, jsonEnd + 1);
  let data: any;
  try {
    data = JSON.parse(jsonStr);
  } catch {
    return null;
  }
  const msg = data?.choices?.[0]?.message;
  const content = msg?.content?.trim();
  if (!content) return null;
  return { data, content };
}

async function callLLM(
  systemContent: string,
  userContent: string,
  { temperature = 0.6, maxTokens = 8192 }: { temperature?: number; maxTokens?: number } = {},
): Promise<LLMResult> {
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
      const parsed = parseResponse(raw);
      if (!parsed) {
        throw new Error('LLM server returned no content (possible upstream error or empty stream).');
      }

      const content = sanitizePlanOutput(parsed.content);
      const usage = parsed.data?.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      return { content, usage };
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
        const parsed = parseResponse(raw);
        if (parsed) {
          const content = sanitizePlanOutput(parsed.content);
          const usage = parsed.data?.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
          return { content, usage };
        }
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
  s = s.replace(/^\|.*\|$/gm, '');
  s = s.replace(/^\|[-:\s|]+\|$/gm, '');
  s = s.replace(/\*\*(.+?)\*\*/g, '$1');
  s = s.replace(/\*(.+?)\*/g, '$1');
  s = s.replace(/__(.+?)__/g, '$1');
  s = s.replace(/^#{1,6}\s+/gm, '');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

// ────────────────────────────────────────────────────────────────────────────
// Public API — all accept chatId for usage tracking
// ────────────────────────────────────────────────────────────────────────────
export async function generateMealPlan(
  answers: Record<string, any>,
  opts: MealPlanOptions = {},
  chatId?: number,
): Promise<string> {
  const locale = opts.locale || 'en';
  const result = await callLLM(systemPrompt(locale), buildUserPrompt(answers, opts), {
    temperature: opts.regenerate ? 0.85 : 0.6,
    maxTokens: 8192,
  });
  await logUsageSafe(chatId, result.usage, 'mealplan');
  return result.content;
}

export async function generateWeeklyPlan(
  answers: Record<string, any>,
  opts: MealPlanOptions = {},
  chatId?: number,
): Promise<string> {
  const locale = opts.locale || 'en';
  const sys = systemPrompt(locale) + '\n\nGenerate a 7-day plan, different cuisine each day. Label Day 1, Day 2, etc.';
  const user = buildUserPrompt(answers, opts) + '\n\nGenerate a 7-day plan, different cuisine each day. Label Day 1, Day 2, etc.';
  const result = await callLLM(sys, user, { temperature: 0.7, maxTokens: 8192 });
  await logUsageSafe(chatId, result.usage, 'weekly');
  return result.content;
}

export async function generateShoppingList(planText: string, locale: 'en' | 'id' = 'en', chatId?: number): Promise<string> {
  const sys = locale === 'id'
    ? 'Asisten belanja. Ekstrak daftar belanja dari rencana makan: bahan + jumlah. Kelompokkan (Protein, Sayur, Lainnya). Tanpa disclaimer.'
    : 'Shopping assistant. Extract shopping list from meal plan: ingredient + quantity. Group by category (Protein, Produce, Other). No disclaimers.';
  const result = await callLLM(sys, planText, { temperature: 0.3, maxTokens: 4096 });
  await logUsageSafe(chatId, result.usage, 'shopping');
  return result.content;
}

export async function generateMacros(planText: string, locale: 'en' | 'id' = 'en', chatId?: number): Promise<string> {
  const sys = locale === 'id'
    ? 'Analis nutrisi. Hitung total: kalori, protein (g), karbo (g), lemak (g). Per meal + total hari. Format ringkas.'
    : 'Nutrition analyst. Compute totals: calories, protein (g), carbs (g), fat (g). Per meal + daily total. Concise format.';
  const result = await callLLM(sys, planText, { temperature: 0.2, maxTokens: 4096 });
  await logUsageSafe(chatId, result.usage, 'macros');
  return result.content;
}

export async function generateCookingSteps(planText: string, locale: 'en' | 'id' = 'en', chatId?: number): Promise<string> {
  const sys = locale === 'id'
    ? `Koki praktis. Buat panduan masak per meal: 🍳 Peralatan, 📝 Langkah (nomor), 🍽️ Sajian. Bahasa Indonesia, format Telegram.`
    : `Practical cook. Create cooking instructions per meal: 🍳 Utensils, 📝 Steps (numbered), 🍽️ Serving. Plain text, short lines.`;
  const result = await callLLM(sys, planText, { temperature: 0.4, maxTokens: 4096 });
  await logUsageSafe(chatId, result.usage, 'cooking');
  return result.content;
}

export async function regenerateMeal(
  planText: string,
  mealName: string,
  locale: 'en' | 'id' = 'en',
  answers: Record<string, any> = {},
  chatId?: number,
): Promise<string> {
  const sys = locale === 'id'
    ? `Asisten nutrisi. Ganti "${mealName}" dengan yang beda. Sesuai goal/alergi, bahan Indonesia, sertakan kalori+protein. Output HANYA meal pengganti dalam format yang SAMA dengan meal lain di rencana: nama meal di baris pertama, items di bawahnya, kalori+protein di akhir. Tanpa markdown, tanpa "(pengganti)", tanpa prefix.`
    : `Nutrition assistant. Replace "${mealName}" with something different. Match goal/allergies, Indonesian ingredients, include calories+protein. Output ONLY the replacement meal in the SAME format as other meals in the plan: meal name on first line, items below, calories+protein at end. No markdown, no "(replacement)" suffix, no prefix.`;
  const user = `Current plan:\n${planText}\n\nGoal: ${answers.goal || 'general'}\nAllergies: ${answers.allergies || 'none'}\nRestrictions: ${answers.restrictions || 'none'}\n\nReplace ONLY "${mealName}".`;
  const result = await callLLM(sys, user, { temperature: 0.85, maxTokens: 2048 });
  await logUsageSafe(chatId, result.usage, 'regenerate-meal');
  return result.content;
}

export function parseCuisine(planText: string): string | null {
  const m = planText.match(/^(?:Today|Hari ini):\s*(.+?)(?:\n|$)/im);
  if (!m) return null;
  // Strip anything from a meal name onward (SARAPAN, Breakfast, etc)
  const mealStart = m[1].match(/\b(?:Sarapan|Breakfast|Makan\s+siang|Lunch|Makan\s+malam|Dinner|Snack|Camilan|Brunch)\b/i);
  const cuisine = mealStart ? m[1].slice(0, mealStart.index).trim() : m[1].trim();
  // Also strip trailing macros like "(~740 kkal..."
  return cuisine.replace(/\s*\(.*$/i, '').trim() || null;
}
