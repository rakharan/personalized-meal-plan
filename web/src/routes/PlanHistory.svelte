<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import UserLayout from '$lib/components/UserLayout.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import MealPlanView from '$lib/components/MealPlanView.svelte';

  let plans = $state<any[]>([]);
  let loading = $state(true);
  let selectedPlan = $state<any>(null);

  async function load() {
    loading = true;
    try {
      const res = await fetch('/api/plans/history', { headers: auth.authHeaders() });
      if (res.ok) {
        const data = await res.json();
        plans = data.plans || [];
        if (plans.length) selectedPlan = plans[0];
      }
    } catch {}
    finally { loading = false; }
  }

  onMount(() => {
    if (!auth.isAuthed) { window.location.hash = '#/login'; return; }
    load();
  });

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('id-ID', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function cuisineAccent(c?: string): string {
    if (!c) return 'var(--surface-3)';
    const map: Record<string, string> = {
      Indonesian: 'var(--tomato-500)',
      Japanese: 'var(--leaf-500)',
      Korean: 'var(--amber-500)',
      Mediterranean: 'var(--cream-200)',
    };
    return map[c] ?? 'var(--surface-3)';
  }

  // Sum per-meal kcal from macros lines; null when none parseable.
  // ponytail: shares regex shape with MealPlanView.macrosOf — extract to shared util if a 3rd consumer appears.
  function extractCalories(text: string): number | null {
    if (!text) return null;
    let total = 0;
    const re = /~?(\d+)\s*(?:kal|kcal|kkal|cal).*?protein\s*~?\d+\s*g/gi;
    let m;
    while ((m = re.exec(text)) !== null) total += parseInt(m[1], 10);
    return total > 0 ? total : null;
  }
</script>

<UserLayout current="#/history">
  <div class="history-main">
    <div class="page-head">
      <h1>Riwayat Rencana Makan</h1>
      <p class="page-sub">Semua rencana yang sudah dibuat, siap dibuka kembali.</p>
    </div>

    {#if loading}
      <Skeleton rows={5} cols={3} />
    {:else if plans.length === 0}
      <div class="empty-timeline">
        <svg class="empty-art" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M48 10 C44 16, 52 20, 48 26" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
          <path d="M60 6 C56 12, 64 16, 60 22" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
          <path d="M72 10 C68 16, 76 20, 72 26" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
          <path d="M26 46 H94 L86 74 Q84 84, 74 86 H46 Q36 84, 34 74 Z" fill="var(--surface-3)" stroke="var(--border-strong)" stroke-width="2" stroke-linejoin="round"/>
          <path d="M60 54 C54 52, 48 54, 46 60 C52 62, 58 60, 60 54 Z" fill="var(--primary)" opacity="0.85"/>
          <path d="M60 54 C66 52, 72 54, 74 60 C68 62, 62 60, 60 54 Z" fill="var(--leaf-400)" opacity="0.65"/>
        </svg>
        <h2 class="empty-title">Belum ada rencana tersimpan</h2>
        <p class="empty-desc">Buat rencana makan pertamamu — Saji siap merancang hidangan hangat untuk setiap harimu.</p>
      </div>
    {:else}
      <div class="timeline">
        <div class="timeline-line" aria-hidden="true"></div>
        <ol class="timeline-items">
          {#each plans.slice(0, 30) as p}
            {@const kcal = extractCalories(p.planText)}
            {@const isOpen = selectedPlan?.id === p.id}
            <li class="tl-entry">
              <span class="tl-dot" style="--dot: {cuisineAccent(p.cuisine)}" aria-hidden="true"></span>
              <article class="tl-card" class:expanded={isOpen}>
                <button
                  class="tl-card-head"
                  onclick={() => selectedPlan = isOpen ? null : p}
                  aria-expanded={isOpen}
                >
                  <span class="tl-date">{fmtDate(p.created)}</span>
                  <span class="tl-cuisine">{p.cuisine || 'Rencana'}</span>
                  {#if kcal !== null}
                    <span class="tl-kcal">{kcal} kal</span>
                  {/if}
                  {#if p.feedback}
                    <span class="tl-feedback" title="Ada umpan balik" aria-hidden="true">●</span>
                  {/if}
                  <span class="tl-chevron" aria-hidden="true">▾</span>
                </button>
                <div class="tl-body" class:open={isOpen}>
                  {#if isOpen}
                    <div class="tl-body-inner">
                      <MealPlanView planText={selectedPlan.planText} />
                    </div>
                  {/if}
                </div>
              </article>
            </li>
          {/each}
        </ol>
      </div>
    {/if}
  </div>
</UserLayout>

<style>
  .history-main { max-width: 760px; margin: 0 auto; }
  .page-head { margin-bottom: var(--space-6); }
  h1 { font-size: var(--fs-2xl); font-weight: var(--fw-bold); letter-spacing: var(--ls-tight); color: var(--text); }
  .page-sub { font-size: var(--fs-sm); color: var(--text-subtle); margin-top: var(--space-2); }

  /* ── Empty state: warm bowl + leaf illustration ── */
  .empty-timeline {
    text-align: center;
    padding: var(--space-12) var(--space-6);
    background: linear-gradient(160deg, var(--surface) 0%, var(--surface-2) 100%);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-elevation-1);
    position: relative; overflow: hidden;
  }
  .empty-timeline::after {
    content: ''; position: absolute; top: 0; left: 0;
    width: 3px; height: 100%;
    background: linear-gradient(180deg, var(--accent), transparent);
    opacity: 0.7;
  }
  .empty-art { width: 120px; height: 100px; margin: 0 auto var(--space-4); display: block; }
  .empty-title { font-size: var(--fs-lg); font-weight: var(--fw-semibold); color: var(--text); margin: 0 0 var(--space-2); }
  .empty-desc { font-size: var(--fs-sm); color: var(--text-subtle); max-width: 360px; margin: 0 auto; line-height: var(--lh-relaxed); }

  /* ── Timeline rail ── */
  .timeline { position: relative; padding-left: 32px; }
  .timeline-line {
    position: absolute; left: 11px; top: 8px; bottom: 8px;
    width: 2px; background: var(--border-strong);
    border-radius: var(--radius-pill);
  }
  .timeline-items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3); }

  .tl-entry { position: relative; }
  .tl-dot {
    position: absolute; left: -27px; top: 16px;
    width: 14px; height: 14px; border-radius: 50%;
    background: var(--dot, var(--surface-3));
    border: 2px solid var(--surface);
    box-shadow: 0 0 0 1px var(--border-strong);
    z-index: 1;
  }

  /* ── Plan card ── */
  .tl-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: border-color var(--duration-micro) var(--ease-standard), box-shadow var(--duration-micro) var(--ease-standard);
  }
  .tl-card:hover { border-color: var(--border-strong); }
  .tl-card.expanded { border-color: var(--border-strong); box-shadow: var(--shadow-elevation-2); }

  .tl-card-head {
    display: flex; align-items: center; gap: var(--space-3);
    width: 100%; padding: var(--space-3) var(--space-4);
    background: none; border: none; cursor: pointer;
    font-family: inherit; font-size: var(--fs-sm); color: inherit;
    text-align: left; min-height: 44px;
  }
  .tl-date {
    font-size: var(--fs-xs); color: var(--text-faint);
    font-variant-numeric: tabular-nums; white-space: nowrap;
  }
  .tl-cuisine {
    font-size: var(--fs-sm); font-weight: var(--fw-semibold); color: var(--text);
    margin-right: auto;
  }
  .tl-kcal {
    font-size: var(--fs-xs); font-weight: var(--fw-semibold);
    color: var(--primary); font-variant-numeric: tabular-nums;
    background: var(--primary-soft);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-pill); white-space: nowrap;
  }
  .tl-feedback { color: var(--accent); font-size: var(--fs-xs); line-height: 1; }
  .tl-chevron {
    font-size: var(--fs-xs); color: var(--text-subtle);
    transition: transform var(--duration-small) var(--ease-standard);
    margin-left: var(--space-1);
  }
  .tl-card.expanded .tl-chevron { transform: rotate(180deg); }

  /* ── Inline expand: max-height transition ── */
  .tl-body {
    max-height: 0; overflow: hidden;
    transition: max-height var(--duration-large) var(--ease-standard);
  }
  .tl-body.open { max-height: 4000px; }
  /* ponytail: 4000px ceiling; swap to scrollHeight svelte action if plans exceed it */
  .tl-body-inner { padding: var(--space-4) var(--space-4) var(--space-5); }

  /* ── Mobile: rail hugs left edge, cards full width ── */
  @media (max-width: 768px) {
    .timeline { padding-left: 24px; }
    .timeline-line { left: 7px; }
    .tl-dot { left: -23px; }
    .tl-card-head { flex-wrap: wrap; }
  }

  @media (prefers-reduced-motion: reduce) {
    .tl-body, .tl-chevron, .tl-card { transition: none; }
  }
</style>
