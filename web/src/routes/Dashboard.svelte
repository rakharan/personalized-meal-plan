<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/stores/api.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import DashboardLayout from '$lib/components/DashboardLayout.svelte';
  import ChartCard from '$lib/components/ChartCard.svelte';
  import BarList from '$lib/components/BarList.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import Alert from '$lib/components/Alert.svelte';
  import Button from '$lib/components/Button.svelte';

  let data = $state<any>(null);
  let error = $state('');
  let loading = $state(true);
  let lastUpdated = $state<Date | null>(null);

  async function load() {
    loading = true;
    error = '';
    try {
      data = await api.getOverview();
      lastUpdated = new Date();
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    theme.init();
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  });

  function fmtTime(h: number, m: number) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function fmtUpdateTime(d: Date) {
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
</script>

<DashboardLayout title="Dashboard" current="#/admin">
  {#if loading && !data}
    <Skeleton rows={4} cols={3} />
  {:else if error}
    <Alert variant="danger" title="Koneksinya bermasalah">
      Dashboard nggak bisa ambil data. Coba lagi sebentar.
    </Alert>
    <div class="retry">
      <Button variant="secondary" onclick={load}>Coba lagi</Button>
      <details class="dev-hint"><summary>Detail</summary><p>{error}</p></details>
    </div>
  {:else if data}
    <!-- Pulse strip — compact metrics in a single row -->
    <div class="pulse-strip">
      {#if lastUpdated}
        <span class="pulse-time">Update {fmtUpdateTime(lastUpdated)}</span>
      {/if}
      <div class="pulse-metrics">
        <div class="metric" class:highlight>
          <span class="m-value">{data.totalUsers}</span>
          <span class="m-label">Users</span>
        </div>
        <div class="metric-sep"></div>
        <div class="metric" class:highlight>
          <span class="m-value">{data.activeSubs}</span>
          <span class="m-label">Active Subs</span>
        </div>
        <div class="metric-sep"></div>
        <div class="metric">
          <span class="m-value">{data.todayPushed}</span>
          <span class="m-label">Pushed Today</span>
        </div>
        <div class="metric-sep"></div>
        <div class="metric">
          <span class="m-value">{data.retention7d}</span>
          <span class="m-label">7d Retention</span>
        </div>
        <div class="metric-sep"></div>
        <div class="metric">
          <span class="m-value">{data.avgStreak}</span>
          <span class="m-label">Avg Streak</span>
        </div>
        <div class="metric-sep"></div>
        <div class="metric">
          <span class="m-value">{data.maxStreak}</span>
          <span class="m-label">Max Streak</span>
        </div>
        <div class="metric-sep"></div>
        <div class="metric">
          <span class="m-value">{data.referrals}</span>
          <span class="m-label">Referrals</span>
        </div>
        <div class="metric-sep"></div>
        <div class="metric">
          <span class="m-value">{data.plansCount}</span>
          <span class="m-label">Saved Plans</span>
        </div>
        <div class="metric-sep"></div>
        <div class="metric">
          <span class="m-value">{data.tokensToday}</span>
          <span class="m-label">Tokens Today</span>
        </div>
      </div>
    </div>

    <!-- Charts — 2-column grid -->
    <div class="charts">
      <ChartCard title="Distribusi Tier">
        {#if data.tiers?.length}
          <BarList data={data.tiers.map((t: any) => ({ label: t.tier, value: t.count }))} />
        {:else}<p class="muted">Belum ada data tier</p>{/if}
      </ChartCard>
      <ChartCard title="Rasio Feedback">
        {#if data.feedback?.length}
          <BarList data={data.feedback.map((f: any) => ({ label: f.last_feedback, value: f.count }))} />
        {:else}<p class="muted">Belum ada feedback</p>{/if}
      </ChartCard>
      <ChartCard title="Distribusi Locale">
        {#if data.locale?.length}
          <BarList data={data.locale.map((l: any) => ({ label: l.locale, value: l.count }))} />
        {:else}<p class="muted">Belum ada data locale</p>{/if}
      </ChartCard>
      <ChartCard title="Distribusi Jam Kirim">
        {#if data.pushDist?.length}
          <BarList data={data.pushDist.map((p: any) => ({ label: fmtTime(p.push_hour, p.push_min), value: p.count }))} />
        {:else}<p class="muted">Belum ada jam kirim kustom</p>{/if}
      </ChartCard>
    </div>
  {/if}
</DashboardLayout>

<style>
  /* Pulse strip — sticky compact metrics row */
  .pulse-strip {
    position: sticky;
    top: 0;
    z-index: 10;
    background: color-mix(in srgb, var(--surface) 90%, transparent);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border);
    padding: var(--space-3) var(--space-5);
    margin: calc(-1 * var(--space-8)) calc(-1 * var(--space-10)) var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .pulse-time {
    font-size: var(--fs-xs);
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }
  .pulse-metrics {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-wrap: wrap;
  }
  .metric {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 60px;
  }
  .metric.highlight .m-value { color: var(--primary); }
  .m-value {
    font-size: var(--fs-lg);
    font-weight: var(--fw-bold);
    font-variant-numeric: tabular-nums;
    line-height: 1;
    color: var(--text);
  }
  .m-label {
    font-size: 0.65rem;
    color: var(--text-subtle);
    text-transform: uppercase;
    letter-spacing: var(--ls-wide);
  }
  .metric-sep {
    width: 1px;
    height: 24px;
    background: var(--border);
    flex-shrink: 0;
  }

  /* Charts */
  .charts {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4);
  }
  .muted { color: var(--text-faint); font-size: var(--fs-sm); }
  .retry { margin-top: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); }
  .dev-hint summary { cursor: pointer; font-size: var(--fs-xs); color: var(--text-faint); }
  .dev-hint p { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--text-faint); margin-top: var(--space-2); }

  @media (max-width: 768px) {
    .pulse-strip { margin: calc(-1 * var(--space-6)) calc(-1 * var(--space-5)) var(--space-4); padding: var(--space-3); }
    .pulse-metrics { gap: var(--space-3); }
    .metric-sep { display: none; }
    .charts { grid-template-columns: 1fr; }
  }
</style>
