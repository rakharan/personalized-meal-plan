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

export function parseCuisine(planText: string): string | null {
  const m = planText.match(/^(?:Today|Hari ini):\s*(.+)$/im);
  return m ? m[1].trim() : null;
}
