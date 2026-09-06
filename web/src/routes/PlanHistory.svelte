<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import UserLayout from '$lib/components/UserLayout.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';

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
    if (!c) return 'var(--text-subtle)';
    const map: Record<string, string> = {
      Indonesian: 'var(--tomato-500)',
      Japanese: 'var(--leaf-500)',
      Korean: 'var(--amber-500)',
      Mediterranean: 'var(--leaf-600)',
    };
    return map[c] ?? 'var(--accent)';
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
      <div class="empty-card">
        <EmptyState title="Belum ada rencana" description="Generate rencana pertamamu dari dashboard" />
      </div>
    {:else}
      <div class="history-layout">
        <aside class="plan-list">
          <div class="list-head">Rencana</div>
          {#each plans as p}
            <button class="plan-item" class:selected={selectedPlan?.id === p.id} onclick={() => selectedPlan = p}>
              <span class="plan-dot" style="color: {cuisineAccent(p.cuisine)}">●</span>
              <span class="plan-item-meta">
                <span class="plan-item-cuisine">{p.cuisine || '—'}</span>
                <span class="plan-item-date">{fmtDate(p.created)}</span>
              </span>
            </button>
          {/each}
        </aside>
        <section class="plan-viewer">
          {#if selectedPlan}
            <div class="plan-viewer-header">
              <div class="plan-viewer-title">
                <span class="cuisine-tag" style="color: {cuisineAccent(selectedPlan.cuisine)}">{selectedPlan.cuisine || 'Rencana'}</span>
                <h3>Detail Rencana</h3>
              </div>
              <span class="plan-viewer-date">{fmtDate(selectedPlan.created)}</span>
            </div>
            <pre class="plan-text">{selectedPlan.planText}</pre>
          {/if}
        </section>
      </div>
    {/if}
  </div>
</UserLayout>

<style>
  .history-main { max-width: 1040px; margin: 0 auto; }
  .page-head { margin-bottom: var(--space-6); }
  h1 { font-size: var(--fs-2xl); font-weight: var(--fw-bold); letter-spacing: var(--ls-tight); color: var(--text); }
  .page-sub { font-size: var(--fs-sm); color: var(--text-subtle); margin-top: var(--space-2); }

  .empty-card {
    background: linear-gradient(160deg, var(--surface) 0%, var(--surface-2) 100%);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-elevation-1);
    margin-bottom: var(--space-6);
    position: relative; overflow: hidden;
  }
  .empty-card::after {
    content: ''; position: absolute; top: 0; left: 0;
    width: 3px; height: 100%;
    background: linear-gradient(180deg, var(--accent), transparent);
    opacity: 0.7;
  }

  .history-layout { display: grid; grid-template-columns: 220px 1fr; gap: var(--space-5); }

  .plan-list { display: flex; flex-direction: column; gap: var(--space-2); }
  .list-head {
    font-size: var(--fs-xs); font-weight: var(--fw-semibold);
    text-transform: uppercase; letter-spacing: var(--ls-wide);
    color: var(--text-faint); padding: 0 var(--space-2) var(--space-2);
  }
  .plan-item {
    display: flex; align-items: center; gap: var(--space-2);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    cursor: pointer; text-align: left; font-family: inherit;
    min-height: 44px;
    transition: background var(--duration-micro) var(--ease-standard), border-color var(--duration-micro) var(--ease-standard);
  }
  .plan-item:hover { background: var(--surface-2); }
  .plan-item.selected { border-color: var(--primary); background: var(--primary-soft); }
  .plan-dot { font-size: var(--fs-xs); line-height: 1; }
  .plan-item-meta { display: flex; flex-direction: column; gap: 2px; }
  .plan-item-cuisine { font-size: var(--fs-sm); font-weight: var(--fw-medium); color: var(--text); }
  .plan-item-date { font-size: var(--fs-xs); color: var(--text-subtle); font-variant-numeric: tabular-nums; }

  .plan-viewer {
    background: linear-gradient(160deg, var(--surface) 0%, var(--surface-2) 100%);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-elevation-1);
    overflow: hidden;
    min-height: 400px;
    position: relative;
  }
  .plan-viewer::after {
    content: ''; position: absolute; top: 0; left: 0;
    width: 3px; height: 100%;
    background: linear-gradient(180deg, var(--accent), transparent);
    opacity: 0.7;
  }
  .plan-viewer-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: var(--space-5) var(--space-6);
    border-bottom: 1px solid var(--border);
  }
  .plan-viewer-title { display: flex; align-items: center; gap: var(--space-3); }
  .cuisine-tag { font-size: var(--fs-xs); font-weight: var(--fw-semibold); text-transform: uppercase; letter-spacing: var(--ls-wide); }
  .plan-viewer-header h3 { font-size: var(--fs-md); font-weight: var(--fw-semibold); color: var(--text); }
  .plan-viewer-date { font-size: var(--fs-xs); color: var(--text-faint); font-variant-numeric: tabular-nums; }
  .plan-text {
    font-family: var(--font-sans); font-size: var(--fs-sm);
    line-height: var(--lh-relaxed); color: var(--text-muted);
    white-space: pre-wrap; padding: var(--space-6); margin: 0;
  }

  @media (max-width: 768px) {
    .history-layout { grid-template-columns: 1fr; }
    .plan-list { order: 2; }
    .plan-viewer { order: 1; min-height: 300px; }
  }
</style>
