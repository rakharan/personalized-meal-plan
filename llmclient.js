import 'dotenv/config';

const BASE_URL = process.env.LLM_BASE_URL || 'http://127.0.0.1:8080/v1';
const MODEL = process.env.LLM_MODEL || 'hermes';
const API_KEY = process.env.LLM_API_KEY || 'not-needed';

// ────────────────────────────────────────────────────────────────────────────
// System prompt is built per-locale so the model answers in the right language.
// ────────────────────────────────────────────────────────────────────────────
function systemPrompt(locale) {
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

function buildUserPrompt(answers, opts = {}) {
  const {
    goal, restrictions, allergies, calories, mealsPerDay, cuisine,
  } = answers;
  const lines = [
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
// Low-level call — shared by all public functions.
// ────────────────────────────────────────────────────────────────────────────
async function callLLM(systemContent, userContent, { temperature = 0.6, maxTokens = 8192 } = {}) {
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
      // Harmless if ignored — the field is non-standard but OpenAI-compatible.
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
  // Some local servers append a trailing `data: [DONE]` line after the JSON
  // body, which makes res.json() throw. Strip anything after the last `}`.
  const jsonEnd = raw.lastIndexOf('}');
  const jsonStr = jsonEnd === -1 ? raw : raw.slice(0, jsonEnd + 1);
  let data;
  try {
    data = JSON.parse(jsonStr);
  } catch {
    throw new Error(`LLM server returned non-JSON: ${raw.slice(0, 200)}`);
  }

  const msg = data?.choices?.[0]?.message;
  const content = msg?.content?.trim();

  if (!content) {
    throw new Error('LLM server returned no content — check the response shape in the logs.');
  }
  return content;
}

export async function generateMealPlan(answers, opts = {}) {
  const locale = opts.locale || 'en';
  return callLLM(systemPrompt(locale), buildUserPrompt(answers, opts), {
    temperature: opts.regenerate ? 0.85 : 0.6,
    maxTokens: 4096,
  });
}

export async function generateShoppingList(planText, locale = 'en') {
  const sys = locale === 'id'
    ? 'Kamu asisten belanja. Dari rencana makan yang diberikan, ekstrak daftar belanja lengkap: bahan + jumlah perkiraan. Format: nama bahan — jumlah. Kelompokkan per kategori (Protein, Sayur, Lainnya). Tanpa disclaimer.'
    : 'You are a shopping assistant. From the given meal plan, extract a full shopping list: ingredient + rough quantity. Format: ingredient name — quantity. Group by category (Protein, Produce, Other). No disclaimers.';
  return callLLM(sys, planText, { temperature: 0.3, maxTokens: 4096 });
}

export async function generateMacros(planText, locale = 'en') {
  const sys = locale === 'id'
    ? 'Kamu analis nutrisi. Dari rencana makan, hitung total: kalori, protein (g), karbohidrat (g), lemak (g). Tampilkan per meal dan total hari. Format ringkas untuk Telegram.'
    : 'You are a nutrition analyst. From the meal plan, compute totals: calories, protein (g), carbs (g), fat (g). Show per meal and daily total. Concise Telegram format.';
  return callLLM(sys, planText, { temperature: 0.2, maxTokens: 4096 });
}

// Parse the cuisine name from the first line of a plan (e.g. "Today: Japanese").
export function parseCuisine(planText) {
  const m = planText.match(/^(?:Today|Hari ini):\s*(.+)$/im);
  return m ? m[1].trim() : null;
}
