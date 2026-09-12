<script lang="ts">
  import { auth } from '../stores/auth.svelte';

  interface Props {
    meal: { name: string; items?: string[]; body?: string; kcal?: number; protein?: number; carbs?: number; fat?: number; imagePath?: string | null };
    isPro?: boolean;
    onclose: () => void;
    oncooked?: (() => void) | null;
  }

  let { meal, isPro = false, onclose, oncooked = null }: Props = $props();

  let steps = $state<string | null>(null);
  let loadingSteps = $state(true);

  $effect(() => {
    (async () => {
      try {
        const res = await fetch('/api/plans/meal-steps', {
          method: 'POST',
          headers: { ...auth.authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ mealName: meal.name }),
        });
        if (res.ok) {
          const d = await res.json();
          steps = d.steps;
        }
      } catch { /* panduan optional */ }
      loadingSteps = false;
    })();
  });

  function backdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="backdrop" onclick={backdropClick}>
  <div class="sheet" role="dialog" aria-label={meal.name}>
    <div class="handle"></div>

    {#if meal.imagePath}
      <div class="photo" class:blurred={!isPro}>
        <img src={meal.imagePath} alt={meal.name} />
        <span class="kcal-chip">~{meal.kcal ?? '—'} kkal · {meal.protein ?? '—'}g protein</span>
        {#if !isPro}
          <a class="pro-overlay" href="#/pro" onclick={onclose}>
            <span class="pro-pill">Pro ✓</span>
          </a>
        {/if}
      </div>
    {/if}

    <h2 class="title">{meal.name}</h2>
    <div class="macros">
      <span class="macro"><b>{meal.kcal ?? '—'}</b> kkal</span>
      <span class="macro"><b>{meal.protein ?? '—'}g</b> protein</span>
      <span class="macro"><b>{meal.carbs ?? '—'}g</b> karbo</span>
      <span class="macro"><b>{meal.fat ?? '—'}g</b> lemak</span>
    </div>

    <h3 class="sec">Bahan</h3>
    {#if meal.items?.length}
      <ul class="ings">
        {#each meal.items as item}
          <li>{item}</li>
        {/each}
      </ul>
    {:else}
      <pre class="raw">{meal.body}</pre>
    {/if}

    <h3 class="sec">Panduan masak</h3>
    {#if loadingSteps}
      <div class="skel">
        <div class="skel-line" style="width: 90%"></div>
        <div class="skel-line" style="width: 70%"></div>
        <div class="skel-line" style="width: 80%"></div>
      </div>
    {:else if steps}
      <p class="steps">{steps}</p>
    {:else}
      <p class="steps muted">Panduan belum tersedia.</p>
    {/if}

    {#if oncooked}
      <button class="cooked" onclick={() => { oncooked!(); onclose(); }}>✓ Sudah masak</button>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed; inset: 0; background: rgba(26,22,18,.55); backdrop-filter: blur(3px);
    display: grid; place-items: end center; z-index: 100; padding: 0;
  }
  @media (min-width: 769px) {
    .backdrop { place-items: center; padding: 24px; }
    .sheet { max-width: 480px; border-radius: 24px !important; }
  }
  .sheet {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 24px 24px 0 0; width: 100%;
    max-height: 85vh; overflow-y: auto; padding: 12px 20px 28px;
    animation: slideUp .25s cubic-bezier(.2,.9,.3,1);
  }
  @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } }
  .handle { width: 40px; height: 4px; border-radius: 2px; background: var(--border); margin: 0 auto 14px; }

  .photo { position: relative; height: 160px; border-radius: 16px; overflow: hidden; margin-bottom: 14px; }
  .photo img { width: 100%; height: 100%; object-fit: cover; }
  .photo.blurred img { filter: blur(14px) brightness(.55); transform: scale(1.1); }
  .kcal-chip {
    position: absolute; bottom: 10px; left: 10px;
    background: rgba(26,22,18,.85); color: #FDF8F2; padding: 4px 10px; border-radius: 999px;
    font-size: 11px; font-weight: 700;
  }
  .pro-overlay {
    position: absolute; inset: 0; display: grid; place-items: center; text-decoration: none;
  }
  .pro-pill {
    background: linear-gradient(90deg, var(--accent), #fcd34d);
    color: #1a1612; padding: 6px 14px; border-radius: 999px;
    font-size: 13px; font-weight: 800;
  }

  .title { font-size: 20px; font-weight: 800; color: var(--text); }
  .macros { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0 16px; }
  .macro {
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 12px; padding: 8px 12px; font-size: 12px; font-weight: 700;
    color: var(--text-muted);
  }
  .macro b { color: var(--text); font-size: 14px; }

  .sec {
    font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .8px;
    color: var(--primary); margin: 16px 0 8px;
  }
  .ings { list-style: none; padding: 0; }
  .ings li { font-size: 13.5px; color: var(--text); padding: 4px 0; display: flex; gap: 8px; }
  .ings li::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: var(--accent); flex-shrink: 0; margin-top: 7px; }
  .raw { font-size: 13px; white-space: pre-wrap; color: var(--text-muted); font-family: inherit; }

  .steps { font-size: 13.5px; line-height: 1.6; white-space: pre-wrap; color: var(--text); }
  .steps.muted { color: var(--text-muted); }
  .skel { display: grid; gap: 8px; }
  .skel-line {
    height: 12px; border-radius: 6px;
    background: linear-gradient(90deg, var(--border) 25%, var(--surface-2) 50%, var(--border) 75%);
    background-size: 200% 100%; animation: shimmer 1.2s infinite;
  }
  @keyframes shimmer { to { background-position: -200% 0; } }

  .cooked {
    width: 100%; margin-top: 18px; padding: 14px; border: none; border-radius: 16px;
    background: var(--primary); color: white; font-size: 15px; font-weight: 800; cursor: pointer;
    font-family: inherit;
  }
</style>
