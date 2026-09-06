<script lang="ts">
  import { auth } from '$lib/stores/auth.svelte';

  let {
    planText = $bindable(''),
  }: {
    planText?: string;
  } = $props();

  interface Meal {
    name: string;
    body: string;
    macros?: string;
    start: number;
    end: number;
  }

  let regenerating = $state<string | null>(null);
  let error = $state('');

  // Parse meals from plan text
  function parseMeals(text: string): Meal[] {
    if (!text) return [];
    const mealRegex = /(?:^|\n)(?:🍳|🍱|🌙|☀️|🌅|🥗|🍲)?\s*((?:Sarapan|Breakfast|Makan\s+siang|Lunch|Makan\s+malam|Dinner|Snack|Camilan|Brunch))[^\n]*/gi;
    const splits: { name: string; start: number }[] = [];
    let match;
    while ((match = mealRegex.exec(text)) !== null) {
      splits.push({ name: match[1].trim(), start: match.index });
    }
    if (splits.length === 0) return [];
    const result: Meal[] = [];
    for (let i = 0; i < splits.length; i++) {
      const start = splits[i].start;
      const end = i + 1 < splits.length ? splits[i + 1].start : text.length;
      const chunk = text.slice(start, end).trim();
      const macroMatch = chunk.match(/(~?\d+\s*(?:kal|kcal|kkal|cal).*?protein.*?\d+\s*g)/i);
      const macros = macroMatch ? macroMatch[1] : '';
      const body = chunk.replace(mealRegex, '').trim();
      result.push({ name: splits[i].name, body: body || chunk, macros, start, end });
    }
    return result;
  }

  let meals = $state<Meal[]>([]);

  // Re-parse when planText changes
  $effect(() => {
    meals = parseMeals(planText);
  });

  async function regenerateMeal(meal: Meal) {
    regenerating = meal.name;
    error = '';
    try {
      const res = await fetch('/api/plans/regenerate-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth.authHeaders() },
        body: JSON.stringify({ mealName: meal.name, planText }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal regenerasi');
      }
      const data = await res.json();
      // Replace the meal chunk in planText
      const newChunk = data.meal.trim();
      const before = planText.slice(0, meal.start);
      const after = planText.slice(meal.end);
      planText = before + newChunk + '\n' + after;
    } catch (e: any) {
      error = e.message;
    } finally {
      regenerating = null;
    }
  }

  // ── Derived display helpers (pure, no state mutation) ──
  // Split meal body into food-item lines; drop the macros line if it leaked in.
  function foodItems(meal: Meal): string[] {
    return meal.body
      .split('\n')
      .map((l) => l.replace(/^[•\-\*\u2022]\s*/, '').trim())
      .filter((l) => l.length > 0 && !/^~?\d+\s*(kal|kcal|kkal|cal)/i.test(l));
  }

  // Extract numeric calories + protein grams from a macros string.
  function macrosOf(meal: Meal): { kcal: number; protein: number } {
    const m = meal.macros || '';
    const kcalMatch = m.match(/~?(\d+)\s*(?:kal|kcal|kkal|cal)/i);
    const proteinMatch = m.match(/protein\s*~?(\d+)\s*g/i);
    return {
      kcal: kcalMatch ? parseInt(kcalMatch[1], 10) : 0,
      protein: proteinMatch ? parseInt(proteinMatch[1], 10) : 0,
    };
  }

  let totals = $derived(
    meals.reduce(
      (acc, meal) => {
        const m = macrosOf(meal);
        acc.kcal += m.kcal;
        acc.protein += m.protein;
        return acc;
      },
      { kcal: 0, protein: 0 },
    ),
  );
</script>

{#if error}
  <div class="meal-error" role="alert">
    <span class="error-icon">⚠️</span>
    <span>{error}</span>
  </div>
{/if}

{#if meals.length === 0 || (meals.length === 1 && !meals[0].name)}
  <pre class="plan-text">{planText}</pre>
{:else}
  <div class="meals-grid">
    {#each meals as meal, i (meal.name + i)}
      {@const items = foodItems(meal)}
      {@const m = macrosOf(meal)}
      <article class="meal-card">
        <header class="meal-header">
          <h3 class="meal-name">{meal.name}</h3>
          <div class="meal-actions">
            {#if m.kcal > 0}
              <span class="badge badge-kcal">
                <span class="badge-dot"></span>{m.kcal} kal
              </span>
            {/if}
            {#if m.protein > 0}
              <span class="badge badge-protein">
                <span class="badge-dot"></span>{m.protein}g protein
              </span>
            {/if}
            <button
              class="regen-btn"
              onclick={() => regenerateMeal(meal)}
              disabled={regenerating === meal.name}
              aria-label="Ganti {meal.name}"
              title="Regenerasi {meal.name}"
            >
              {#if regenerating === meal.name}⏳{:else}🔄{/if}
            </button>
          </div>
        </header>

        <div class="meal-body">
          {#if items.length > 0}
            <ul class="food-list">
              {#each items as item}
                <li class="food-item">
                  <span class="food-bullet" aria-hidden="true">●</span>
                  <span class="food-text">{item}</span>
                </li>
              {/each}
            </ul>
          {:else}
            <pre class="food-raw">{meal.body}</pre>
          {/if}
        </div>
      </article>
    {/each}
  </div>

  <div class="daily-total" role="status">
    <span class="total-label">Total Hari Ini</span>
    <div class="total-stats">
      {#if totals.kcal > 0}
        <span class="total-stat total-kcal">
          <span class="total-num">{totals.kcal}</span>
          <span class="total-unit">kalori</span>
        </span>
      {/if}
      {#if totals.protein > 0}
        <span class="total-stat total-protein">
          <span class="total-num">{totals.protein}g</span>
          <span class="total-unit">protein</span>
        </span>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* ── Meal grid ── */
  .meals-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-4);
  }
  @media (min-width: 720px) {
    .meals-grid { grid-template-columns: repeat(2, 1fr); }
  }

  /* ── Meal card: warm dark surface, organic corners, hover lift ── */
  .meal-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition:
      transform var(--duration-small) var(--ease-standard),
      box-shadow var(--duration-small) var(--ease-standard),
      border-color var(--duration-small) var(--ease-standard);
  }
  .meal-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 28px rgba(26, 22, 18, 0.55), 0 0 0 1px var(--border-strong);
    border-color: var(--border-strong);
  }

  /* ── Header: ceramic-glaze warm gradient ── */
  .meal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4) var(--space-5);
    gap: var(--space-3);
    flex-wrap: wrap;
    background:
      linear-gradient(135deg, rgba(245, 158, 11, 0.06) 0%, rgba(82, 183, 136, 0.04) 100%),
      var(--surface-2);
    border-bottom: 1px solid var(--border);
  }
  .meal-name {
    margin: 0;
    font-size: var(--fs-lg);
    font-weight: var(--fw-semibold);
    color: var(--primary);
    text-transform: capitalize;
    letter-spacing: var(--ls-snug);
    line-height: var(--lh-tight);
  }
  .meal-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  /* ── Macro badges: leaf-green + amber pills ── */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-pill);
    font-size: var(--fs-xs);
    font-weight: var(--fw-semibold);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    line-height: 1.4;
  }
  .badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .badge-kcal {
    background: var(--primary-soft);
    color: var(--primary);
  }
  .badge-kcal .badge-dot { background: var(--primary); }
  .badge-protein {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .badge-protein .badge-dot { background: var(--accent); }

  /* ── Per-meal regenerate button ── */
  .regen-btn {
    background: var(--surface-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    width: 34px;
    height: 34px;
    font-size: var(--fs-md);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--duration-micro) var(--ease-standard);
    flex-shrink: 0;
    padding: 0;
  }
  .regen-btn:not(:disabled):hover {
    background: var(--accent-soft);
    border-color: var(--accent);
    transform: rotate(90deg);
  }
  .regen-btn:disabled { opacity: 0.5; cursor: wait; }

  /* ── Meal body + food list ── */
  .meal-body {
    padding: var(--space-4) var(--space-5);
    flex: 1;
  }
  .food-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .food-item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    font-size: var(--fs-sm);
    line-height: var(--lh-relaxed);
    color: var(--text-muted);
  }
  .food-bullet {
    color: var(--primary);
    font-size: var(--fs-xs);
    line-height: var(--lh-relaxed);
    flex-shrink: 0;
    margin-top: 2px;
    opacity: 0.8;
  }
  .food-text { flex: 1; }
  .food-raw {
    font-family: var(--font-sans);
    font-size: var(--fs-sm);
    line-height: var(--lh-relaxed);
    color: var(--text-muted);
    white-space: pre-wrap;
    margin: 0;
  }

  /* ── Daily total summary bar (not a card) ── */
  .daily-total {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    margin-top: var(--space-6);
    padding: var(--space-4) var(--space-5);
    background:
      linear-gradient(90deg, var(--primary-soft) 0%, var(--accent-soft) 100%),
      var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-pill);
    flex-wrap: wrap;
  }
  .total-label {
    font-size: var(--fs-sm);
    font-weight: var(--fw-semibold);
    color: var(--text);
    letter-spacing: var(--ls-wide);
    text-transform: uppercase;
  }
  .total-stats {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    flex-wrap: wrap;
  }
  .total-stat {
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
  }
  .total-num {
    font-size: var(--fs-xl);
    font-weight: var(--fw-bold);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .total-kcal .total-num { color: var(--primary); }
  .total-protein .total-num { color: var(--accent); }
  .total-unit {
    font-size: var(--fs-xs);
    color: var(--text-subtle);
    text-transform: lowercase;
  }

  /* ── Unparseable plan: warm pre ── */
  .plan-text {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    line-height: var(--lh-relaxed);
    color: var(--text-muted);
    white-space: pre-wrap;
    padding: var(--space-6);
    margin: 0;
    background:
      linear-gradient(135deg, rgba(245, 158, 11, 0.04) 0%, transparent 100%),
      var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-elevation-1);
  }

  /* ── Error state: tomato-soft ── */
  .meal-error {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--danger);
    font-size: var(--fs-sm);
    margin-bottom: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--danger-soft);
    border: 1px solid var(--danger);
    border-radius: var(--radius-md);
  }
  .error-icon { font-size: var(--fs-md); flex-shrink: 0; }

  @media (prefers-reduced-motion: reduce) {
    .meal-card, .regen-btn { transition: none; }
    .meal-card:hover { transform: none; }
    .regen-btn:not(:disabled):hover { transform: none; }
  }
</style>
