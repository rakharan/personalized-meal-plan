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
</script>

{#if error}<div class="meal-error">{error}</div>{/if}

{#if meals.length === 0 || (meals.length === 1 && !meals[0].name)}
  <pre class="plan-text">{planText}</pre>
{:else}
  <div class="meals-grid">
    {#each meals as meal, i}
      <div class="meal-card">
        {#if meal.name}
          <div class="meal-header">
            <span class="meal-name">{meal.name}</span>
            <div class="meal-actions">
              {#if meal.macros}<span class="meal-macros">{meal.macros}</span>{/if}
              <button
                class="regen-btn"
                onclick={() => regenerateMeal(meal)}
                disabled={regenerating === meal.name}
                aria-label="Ganti {meal.name}"
              >
                {#if regenerating === meal.name}⏳{:else}🔄{/if}
              </button>
            </div>
          </div>
        {/if}
        <pre class="meal-body">{meal.body}</pre>
      </div>
    {/each}
  </div>
{/if}

<style>
  .meals-grid { display: grid; grid-template-columns: 1fr; gap: var(--space-3); }
  .meal-card {
    background: var(--surface);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-elevation-1);
    overflow: hidden;
    transition: box-shadow var(--duration-small) var(--ease-standard);
  }
  .meal-card:hover { box-shadow: var(--shadow-elevation-2); }
  .meal-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: var(--space-3) var(--space-4);
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .meal-name { font-size: var(--fs-sm); font-weight: var(--fw-semibold); color: var(--text); text-transform: capitalize; }
  .meal-actions { display: flex; align-items: center; gap: var(--space-2); }
  .meal-macros {
    font-size: var(--fs-xs); color: var(--primary);
    background: var(--primary-soft);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-pill);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .regen-btn {
    background: var(--surface-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    width: 32px; height: 32px;
    font-size: var(--fs-sm);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all var(--duration-micro) var(--ease-standard);
  }
  .regen-btn:not(:disabled):hover { background: var(--accent-soft); border-color: var(--accent); }
  .regen-btn:disabled { opacity: 0.5; cursor: wait; }
  .meal-body {
    font-family: var(--font-sans); font-size: var(--fs-sm);
    line-height: var(--lh-relaxed); color: var(--text-muted);
    white-space: pre-wrap; padding: var(--space-4); margin: 0;
  }
  .plan-text {
    font-family: var(--font-sans); font-size: var(--fs-sm);
    line-height: var(--lh-relaxed); color: var(--text-muted);
    white-space: pre-wrap; padding: var(--space-5); margin: 0;
    background: var(--surface); border-radius: var(--radius-md);
    box-shadow: var(--shadow-elevation-1);
  }
  .meal-error { color: var(--danger); font-size: var(--fs-sm); margin-bottom: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--danger-soft); border-radius: var(--radius-sm); }
</style>
