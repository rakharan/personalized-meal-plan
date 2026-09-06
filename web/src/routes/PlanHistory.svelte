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
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
</script>

<UserLayout current="#/history">
  <div class="history-main">
    <h1>Riwayat Rencana Makan</h1>

    {#if loading}
      <Skeleton rows={5} cols={3} />
    {:else if plans.length === 0}
      <div class="card">
        <EmptyState icon="🍽️" title="Belum ada rencana" description="Generate rencana pertamamu dari dashboard" />
      </div>
    {:else}
      <div class="history-layout">
        <div class="plan-list">
          {#each plans as p}
            <button class="plan-item" class:selected={selectedPlan?.id === p.id} onclick={() => selectedPlan = p}>
              <div class="plan-item-date">{fmtDate(p.created)}</div>
              <div class="plan-item-cuisine">{p.cuisine || '—'}</div>
            </button>
          {/each}
        </div>
        <div class="plan-viewer">
          {#if selectedPlan}
            <div class="plan-viewer-header">
              <h3>{selectedPlan.cuisine || 'Rencana Makan'}</h3>
              <span class="plan-viewer-date">{fmtDate(selectedPlan.created)}</span>
            </div>
            <pre class="plan-text">{selectedPlan.planText}</pre>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</UserLayout>

<style>
  .history-main { max-width: 1000px; margin: 0 auto; }
  h1 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-6); }
  .card { background: var(--surface); border-radius: var(--radius-md); box-shadow: var(--shadow-elevation-1); margin-bottom: var(--space-6); }
  .history-layout { display: grid; grid-template-columns: 200px 1fr; gap: var(--space-4); }
  .plan-list { display: flex; flex-direction: column; gap: var(--space-2); }
  .plan-item { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: var(--space-3); cursor: pointer; text-align: left; font-family: inherit; min-height: 44px; transition: all var(--duration-micro); }
  .plan-item.selected { border-color: var(--primary); background: var(--primary-soft); }
  .plan-item-date { font-size: var(--fs-xs); color: var(--text-subtle); }
  .plan-item-cuisine { font-size: var(--fs-sm); font-weight: var(--fw-medium); color: var(--text); margin-top: 2px; }
  .plan-viewer { background: var(--surface); border-radius: var(--radius-md); box-shadow: var(--shadow-elevation-1); overflow: hidden; }
  .plan-viewer-header { display: flex; justify-content: space-between; align-items: center; padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--border); }
  .plan-viewer-header h3 { font-size: var(--fs-md); font-weight: var(--fw-semibold); }
  .plan-viewer-date { font-size: var(--fs-xs); color: var(--text-faint); }
  .plan-text { font-family: var(--font-sans); font-size: var(--fs-sm); line-height: var(--lh-relaxed); color: var(--text-muted); white-space: pre-wrap; padding: var(--space-5); margin: 0; }
  @media (max-width: 768px) {
    .history-layout { grid-template-columns: 1fr; }
  }
</style>
