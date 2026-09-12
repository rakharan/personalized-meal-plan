<script lang="ts">
  import MealDetail from './MealDetail.svelte';
  import { auth } from '$lib/stores/auth.svelte';

  interface Meal {
    name: string;
    body: string;
    macros?: string;
    kcal: number;
    protein: number;
    items: string[];
    imageSignature?: string | null;
    imagePath?: string | null;
  }

  let {
    planText = $bindable(''),
    meals = $bindable<Meal[]>([]),
    isPro = false,
  }: {
    planText?: string;
    meals?: Meal[];    isPro?: boolean;
  } = $props();

  let regenerating = $state<string | null>(null);
  let error = $state('');
  let selectedMeal = $state<Meal | null>(null);

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
      // Server returns full updated planText + structured meals
      if (data.planText) planText = data.planText;
      if (data.meals) meals = data.meals;
    } catch (e: any) {
      error = e.message;
    } finally {
      regenerating = null;
    }
  }

  let totals = $derived(
    (meals || []).reduce(
      (acc, meal) => {
        acc.kcal += meal.kcal || 0;
        acc.protein += meal.protein || 0;
        acc.carbs += meal.carbs || 0;
        acc.fat += meal.fat || 0;
        return acc;
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    ),
  );
</script>

{#if error}
  <div class="meal-error" role="alert">
    <span class="error-icon">!</span>
    <span>{error}</span>
  </div>
{/if}

{#if !meals || meals.length === 0}
  <pre class="plan-text">{planText}</pre>
{:else}
  <div class="meals-grid">
    {#each meals as meal, i (meal.name + i)}
      <article class="meal-card" class:regenerating={regenerating === meal.name} onclick={() => { if (!regenerating) selectedMeal = meal; }} style:cursor={regenerating ? 'default' : 'pointer'}>
        {#if regenerating === meal.name}
          <!-- Skeleton for this card while regenerating -->
          <header class="meal-header">
            <div class="skel-line skel-title"></div>
            <div class="skel-line skel-badge"></div>
          </header>
          <div class="meal-body">
            <div class="skel-line skel-w90"></div>
            <div class="skel-line skel-w70"></div>
            <div class="skel-line skel-w50"></div>
          </div>
        {:else}
          {#if meal.imagePath}
            <div class="meal-photo" class:blurred={!isPro}>
              <img src={meal.imagePath} alt={meal.name} loading="lazy" />
              {#if !isPro}
                <a class="pro-overlay" href="#/pro">
                  <span class="pro-pill">Pro ✓</span>
                  <span class="pro-caption">Buka foto menu dengan Pro</span>
                </a>
              {/if}
            </div>
          {/if}
          <header class="meal-header">
            <h3 class="meal-name">{meal.name}</h3>
            <div class="meal-actions">
              {#if meal.kcal > 0}
                <span class="badge badge-kcal">
                  <span class="badge-dot"></span>{meal.kcal} kal
                </span>
              {/if}
              {#if meal.protein > 0}
                <span class="badge badge-protein">
                  <span class="badge-dot"></span>{meal.protein}g protein
                </span>
              {/if}
              {#if meal.carbs > 0}
                <span class="badge badge-carbs">
                  <span class="badge-dot"></span>{meal.carbs}g karbo
                </span>
              {/if}
              {#if meal.fat > 0}
                <span class="badge badge-fat">
                  <span class="badge-dot"></span>{meal.fat}g lemak
                </span>
              {/if}
              <button
                class="regen-btn"
                onclick={(e) => { e.stopPropagation(); regenerateMeal(meal); }}
                disabled={regenerating === meal.name}
                aria-label="Ganti {meal.name}"
                title="Regenerasi {meal.name}"
              >
                {#if regenerating === meal.name}...{:else}↻{/if}
              </button>
            </div>
          </header>

          <div class="meal-body">
            {#if meal.items && meal.items.length > 0}
              <ul class="food-list">
                {#each meal.items as item}
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
        {/if}
      </article>
    {/each}
  </div>

  <div class="daily-total" role="status">
    <span class="total-label">Total hari ini</span>
    <span class="total-kcal">{totals.kcal} kal</span>
    <span class="total-sep">·</span>
    <span class="total-protein">{totals.protein}g protein</span>
    <span class="total-sep">·</span>
    <span class="total-carbs">{totals.carbs}g karbo</span>
    <span class="total-sep">·</span>
    <span class="total-fat">{totals.fat}g lemak</span>
  </div>
{/if}

{#if selectedMeal}
  <MealDetail meal={selectedMeal} {isPro} onclose={() => { selectedMeal = null; }} />
{/if}

<style>
  .meal-error {
    display: flex; align-items: center; gap: var(--space-2);
    padding: var(--space-3) var(--space-4); margin-bottom: var(--space-4);
    background: var(--danger-soft); border-radius: var(--radius-md);
    border: 1px solid var(--danger); color: var(--danger); font-size: var(--fs-sm);
  }
  .error-icon {
    width: 20px; height: 20px; border-radius: 50%; background: var(--danger);
    color: var(--text-on-danger); display: flex; align-items: center; justify-content: center;
    font-weight: var(--fw-bold); font-size: var(--fs-xs); flex-shrink: 0;
  }

  .plan-text {
    white-space: pre-wrap; word-break: break-word; font-family: var(--font-mono);
    font-size: var(--fs-sm); color: var(--text-muted); line-height: var(--lh-relaxed);
    background: var(--surface); padding: var(--space-4); border-radius: var(--radius-md);
    border: 1px solid var(--border);
  }

  .meals-grid { display: flex; flex-direction: column; gap: var(--space-4); }

  .meal-card {
    background: var(--surface); border-radius: var(--radius-lg);
    border: 1px solid var(--border); overflow: hidden;
    transition: border-color var(--duration-micro) var(--ease-standard);
  }
  .meal-card.regenerating { border-color: var(--primary); }
  .meal-card:hover { border-color: var(--border-strong); }

  /* Recipe photo — Pro sharp, free blurred */
  .meal-photo {
    position: relative; height: 140px; overflow: hidden;
    background: var(--surface-2);
  }
  .meal-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .meal-photo.blurred img { filter: blur(14px) brightness(.55); transform: scale(1.1); }
  .pro-overlay {
    position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: var(--space-2);
    text-decoration: none;
  }
  .pro-pill {
    background: linear-gradient(135deg, var(--accent), var(--amber-400));
    color: var(--brown-900); padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-pill); font-size: var(--fs-xs); font-weight: var(--fw-bold);
  }
  .pro-caption { font-size: var(--fs-xs); color: var(--text-muted); font-weight: var(--fw-medium); }

  @media (min-width: 769px) {
    /* Desktop: horizontal meal rows, photo left thumbnail */
    .meal-card { display: flex; }
    .meal-photo {
      flex: 0 0 200px; height: auto; min-height: 110px;
      border-right: 1px solid var(--border);
    }
    .meal-card .meal-header, .meal-card .meal-body { flex: 1; min-width: 0; }
    .meal-card .meal-header { flex-direction: column; align-items: flex-start; border-bottom: none; padding-top: var(--space-3); }
    .meal-card .meal-actions { flex-wrap: wrap; justify-content: flex-start; margin-left: 0; }
  }

  .meal-header {
    display: flex; justify-content: space-between; align-items: center;
    gap: var(--space-2); padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);
  }
  .meal-name { font-size: var(--fs-md); font-weight: var(--fw-semibold); color: var(--text); }
  .meal-actions { display: flex; align-items: center; gap: var(--space-2); }
  .badge {
    display: inline-flex; align-items: center; gap: var(--space-1);
    padding: 2px var(--space-2); border-radius: var(--radius-pill);
    font-size: var(--fs-xs); font-weight: var(--fw-medium);
  }
  .badge-kcal { background: var(--primary-soft); color: var(--primary); }
  .badge-protein { background: var(--accent-soft); color: var(--accent); }
  .badge-carbs { background: rgba(117, 198, 157, 0.12); color: var(--leaf-400); }
  .badge-fat { background: rgba(245, 158, 11, 0.10); color: var(--amber-500); }
  .badge-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .regen-btn {
    background: none; border: 1px solid var(--border); border-radius: var(--radius-sm);
    width: 32px; height: 32px; font-size: var(--fs-md); cursor: pointer; color: var(--text-subtle);
    transition: all var(--duration-micro) var(--ease-standard);
    display: flex; align-items: center; justify-content: center;
  }
  .regen-btn:hover { border-color: var(--primary); color: var(--primary); }
  .regen-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .meal-body { padding: var(--space-3) var(--space-4); }
  .food-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2); }
  .food-item { display: flex; gap: var(--space-2); align-items: flex-start; }
  .food-bullet { color: var(--primary); font-size: 0.5rem; line-height: 1.5; flex-shrink: 0; }
  .food-text { font-size: var(--fs-sm); color: var(--text-muted); line-height: var(--lh-normal); }
  .food-raw {
    white-space: pre-wrap; word-break: break-word; font-family: var(--font-mono);
    font-size: var(--fs-sm); color: var(--text-muted); line-height: var(--lh-normal);
    margin: 0;
  }
  .meal-macros {
    margin-top: var(--space-3); padding-top: var(--space-2); border-top: 1px solid var(--border);
    font-size: var(--fs-xs); color: var(--text-subtle); font-variant-numeric: tabular-nums;
  }

  .daily-total {
    display: flex; align-items: center; gap: var(--space-2); justify-content: center;
    padding: var(--space-4); margin-top: var(--space-4);
    background: var(--surface); border-radius: var(--radius-md); border: 1px solid var(--border);
  }
  .total-label { font-size: var(--fs-sm); color: var(--text-subtle); font-weight: var(--fw-medium); }
  .total-kcal { font-size: var(--fs-md); font-weight: var(--fw-bold); color: var(--primary); font-variant-numeric: tabular-nums; }
  .total-sep { color: var(--text-faint); }
  .total-protein { font-size: var(--fs-md); font-weight: var(--fw-bold); color: var(--accent); font-variant-numeric: tabular-nums; }
  .total-carbs { font-size: var(--fs-md); font-weight: var(--fw-bold); color: var(--leaf-400); font-variant-numeric: tabular-nums; }
  .total-fat { font-size: var(--fs-md); font-weight: var(--fw-bold); color: var(--amber-500); font-variant-numeric: tabular-nums; }

  /* Skeleton */
  .skel-line {
    background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%);
    background-size: 200% 100%; border-radius: var(--radius-sm);
    animation: shimmer 1.5s infinite;
  }
  .skel-title { height: 20px; width: 120px; }
  .skel-badge { height: 20px; width: 60px; }
  .skel-w90 { height: 16px; width: 90%; margin-bottom: var(--space-2); }
  .skel-w70 { height: 16px; width: 70%; margin-bottom: var(--space-2); }
  .skel-w50 { height: 16px; width: 50%; }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  @media (prefers-reduced-motion: reduce) { .skel-line { animation: none; } }
</style>
