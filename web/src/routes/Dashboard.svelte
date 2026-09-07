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
      data = await api.getMetrics();
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

  function fmtTime(d: Date) {
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  // Mini sparkline bar for DAU/trend data
  function maxVal(arr: { count?: number; dau?: number }[]): number {
    return Math.max(...arr.map(a => a.count ?? a.dau ?? 0), 1);
  }
</script>

<DashboardLayout title="Dashboard" current="#/admin">
  {#if loading && !data}
    <Skeleton rows={4} cols={3} />
  {:else if error}
    <Alert variant="danger" title="Connection error">
      {error}
    </Alert>
    <div class="retry">
      <Button variant="secondary" onclick={load}>Retry</Button>
    </div>
  {:else if data}
    <!-- Key metrics strip -->
    <div class="pulse-strip">
      {#if lastUpdated}
        <span class="pulse-time">Updated {fmtTime(lastUpdated)}</span>
      {/if}
      <div class="pulse-metrics">
        <div class="metric" class:highlight={true}>
          <span class="m-value">{data.mau}</span>
          <span class="m-label">MAU (30d)</span>
        </div>
        <div class="metric-sep"></div>
        <div class="metric">
          <span class="m-value">{data.conversion?.rate ?? 0}%</span>
          <span class="m-label">Conversion</span>
        </div>
        <div class="metric-sep"></div>
        <div class="metric" class:danger={data.churn?.rate > 20}>
          <span class="m-value">{data.churn?.rate ?? 0}%</span>
          <span class="m-label">Churn</span>
        </div>
        <div class="metric-sep"></div>
        <div class="metric">
          <span class="m-value">${data.tokenEconomics?.totalCost ?? 0}</span>
          <span class="m-label">Token Cost (30d)</span>
        </div>
        <div class="metric-sep"></div>
        <div class="metric">
          <span class="m-value">{data.tokenEconomics?.perUser ?? 0}</span>
          <span class="m-label">Tokens/User</span>
        </div>
      </div>
    </div>

    <!-- DAU trend — sparkline bars -->
    <section class="chart-section">
      <h2 class="section-title">Daily Active Users (30d)</h2>
      {#if data.dau?.length}
        <div class="sparkline">
          {#each data.dau as day}
            <div class="spark-col" title="{day.date}: {day.dau} active">
              <div class="spark-bar" style="height: {(day.dau / maxVal(data.dau)) * 100}%"></div>
              <div class="spark-new" style="height: {day.new_users > 0 ? 8 : 0}%"></div>
            </div>
          {/each}
        </div>
        <div class="spark-legend">
          <span class="legend-item"><span class="dot dot-green"></span> DAU</span>
          <span class="legend-item"><span class="dot dot-amber"></span> New users</span>
        </div>
      {:else}
        <p class="muted">No activity yet</p>
      {/if}
    </section>

    <!-- Plan generation trend -->
    <section class="chart-section">
      <h2 class="section-title">Plan Generation (14d)</h2>
      {#if data.planTrend?.length}
        <div class="sparkline">
          {#each data.planTrend as day}
            <div class="spark-col" title="{day.date}: {day.count} plans">
              <div class="spark-bar bar-amber" style="height: {(day.count / maxVal(data.planTrend)) * 100}%"></div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="muted">No plans generated yet</p>
      {/if}
    </section>

    <!-- Two-column charts -->
    <div class="charts-grid">
      <!-- Conversion funnel -->
      <div class="chart-card">
        <h3>Free → Premium</h3>
        <div class="funnel">
          <div class="funnel-row">
            <span class="funnel-label">Free</span>
            <div class="funnel-bar bar-green" style="width: {data.conversion?.total > 0 ? 100 : 0}%">{data.conversion?.free ?? 0}</div>
          </div>
          <div class="funnel-row">
            <span class="funnel-label">Premium</span>
            <div class="funnel-bar bar-amber" style="width: {data.conversion?.total > 0 ? (data.conversion.premium / data.conversion.total) * 100 : 0}%">{data.conversion?.premium ?? 0}</div>
          </div>
        </div>
        <div class="funnel-rate">
          Conversion rate: <strong>{data.conversion?.rate ?? 0}%</strong>
        </div>
      </div>

      <!-- Churn -->
      <div class="chart-card">
        <h3>Churn (30d)</h3>
        <div class="churn-stats">
          <div class="churn-row">
            <span class="churn-label">Active (30d)</span>
            <span class="churn-value">{data.churn?.totalActive ?? 0}</span>
          </div>
          <div class="churn-row">
            <span class="churn-label">Churned (>7d inactive)</span>
            <span class="churn-value churn-bad">{data.churn?.churned ?? 0}</span>
          </div>
          <div class="churn-rate">
            Churn rate: <strong class:bad={data.churn?.rate > 20}>{data.churn?.rate ?? 0}%</strong>
          </div>
        </div>
      </div>

      <!-- Token economics -->
      <div class="chart-card">
        <h3>Token Economics</h3>
        <div class="token-stats">
          <div class="token-row">
            <span class="token-label">Total tokens (30d)</span>
            <span class="token-value">{(data.tokenEconomics?.totalTokens ?? 0).toLocaleString()}</span>
          </div>
          <div class="token-row">
            <span class="token-label">Est. cost</span>
            <span class="token-value">${data.tokenEconomics?.totalCost ?? 0}</span>
          </div>
          <div class="token-row">
            <span class="token-label">Per user</span>
            <span class="token-value">{(data.tokenEconomics?.perUser ?? 0).toLocaleString()}</span>
          </div>
          <div class="token-row">
            <span class="token-label">Active users</span>
            <span class="token-value">{data.tokenEconomics?.activeUsers ?? 0}</span>
          </div>
        </div>
      </div>

      <!-- Feature usage -->
      <div class="chart-card">
        <h3>Feature Usage (30d)</h3>
        {#if data.featureUsage?.length}
          <div class="feature-list">
            {#each data.featureUsage as f}
              <div class="feature-row">
                <span class="feature-name">{f.feature}</span>
                <div class="feature-bar-wrap">
                  <div class="feature-bar" style="width: {(f.calls / data.featureUsage[0].calls) * 100}%"></div>
                </div>
                <span class="feature-count">{f.calls}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="muted">No usage yet</p>
        {/if}
      </div>

      <!-- Activity by hour -->
      <div class="chart-card chart-wide">
        <h3>Activity by Hour (7d)</h3>
        {#if data.activityByHour?.length}
          <div class="hour-bars">
            {#each data.activityByHour as h}
              <div class="hour-col" title="{h.hour}:00 — {h.count} calls">
                <div class="hour-bar" style="height: {h.count > 0 ? (h.count / Math.max(...data.activityByHour.map(a => a.count), 1)) * 100 : 0}%"></div>
                <span class="hour-label">{h.hour}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="muted">No activity</p>
        {/if}
      </div>

      <!-- Cuisine popularity -->
      <div class="chart-card chart-wide">
        <h3>Cuisine Popularity</h3>
        {#if data.cuisinePopularity?.length}
          <div class="cuisine-list">
            {#each data.cuisinePopularity as c}
              <div class="cuisine-row">
                <span class="cuisine-name">{c.cuisine}</span>
                <div class="cuisine-bar-wrap">
                  <div class="cuisine-bar" style="width: {data.cuisinePopularity[0].count > 0 ? (c.count / data.cuisinePopularity[0].count) * 100 : 0}%"></div>
                </div>
                <span class="cuisine-count">{c.count}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="muted">No cuisine data yet</p>
        {/if}
      </div>

      <!-- Retention cohorts -->
      <div class="chart-card chart-wide">
        <h3>Retention (Cohort %)</h3>
        {#if data.retention?.length}
          <div class="retention-table">
            <div class="retention-header">
              <span>Month</span>
              <span>Size</span>
              <span>D1</span>
              <span>D7</span>
              <span>D30</span>
            </div>
            {#each data.retention as r}
              <div class="retention-row">
                <span class="r-cohort">{r.cohort}</span>
                <span class="r-size">{r.size}</span>
                <span class="r-pct" class:bad={r.d1 < 30}>{r.d1}%</span>
                <span class="r-pct" class:bad={r.d7 < 15}>{r.d7}%</span>
                <span class="r-pct" class:bad={r.d30 < 5}>{r.d30}%</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="muted">No retention data yet</p>
        {/if}
      </div>
    </div>
  {/if}
</DashboardLayout>

<style>
  /* Pulse strip */
  .pulse-strip {
    position: sticky; top: 0; z-index: 10;
    background: color-mix(in srgb, var(--surface) 90%, transparent);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border);
    padding: var(--space-3) var(--space-5);
    margin: calc(-1 * var(--space-8)) calc(-1 * var(--space-10)) var(--space-6);
    display: flex; flex-direction: column; gap: var(--space-2);
  }
  .pulse-time { font-size: var(--fs-xs); color: var(--text-faint); font-variant-numeric: tabular-nums; }
  .pulse-metrics { display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; }
  .metric { display: flex; flex-direction: column; gap: 2px; min-width: 60px; }
  .metric.highlight .m-value { color: var(--primary); }
  .metric.danger .m-value { color: var(--danger); }
  .m-value { font-size: var(--fs-lg); font-weight: var(--fw-bold); font-variant-numeric: tabular-nums; line-height: 1; color: var(--text); }
  .m-label { font-size: 0.65rem; color: var(--text-subtle); text-transform: uppercase; letter-spacing: var(--ls-wide); }
  .metric-sep { width: 1px; height: 24px; background: var(--border); flex-shrink: 0; }

  /* Section */
  .section-title { font-size: var(--fs-xs); font-weight: var(--fw-semibold); text-transform: uppercase; letter-spacing: var(--ls-wide); color: var(--text-subtle); margin-bottom: var(--space-3); }
  .chart-section { margin-bottom: var(--space-6); }
  .muted { color: var(--text-faint); font-size: var(--fs-sm); }

  /* Sparkline */
  .sparkline { display: flex; align-items: flex-end; gap: 2px; height: 80px; background: var(--surface); border-radius: var(--radius-md); padding: var(--space-3); border: 1px solid var(--border); }
  .spark-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 1px; }
  .spark-bar { width: 100%; background: var(--primary); border-radius: 2px 2px 0 0; min-height: 2px; transition: opacity var(--duration-micro) var(--ease-standard); }
  .spark-bar.bar-amber { background: var(--accent); }
  .spark-new { width: 100%; background: var(--amber-400, #FCD34D); border-radius: 2px; min-height: 0; }
  .spark-col:hover .spark-bar { opacity: 0.7; }
  .spark-legend { display: flex; gap: var(--space-4); margin-top: var(--space-2); }
  .legend-item { display: flex; align-items: center; gap: var(--space-1); font-size: var(--fs-xs); color: var(--text-subtle); }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot-green { background: var(--primary); }
  .dot-amber { background: var(--amber-400, #FCD34D); }

  /* Charts grid */
  .charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-4); }
  .chart-card { background: var(--surface); border-radius: var(--radius-md); padding: var(--space-4); border: 1px solid var(--border); }
  .chart-card h3 { font-size: var(--fs-sm); font-weight: var(--fw-semibold); color: var(--text); margin-bottom: var(--space-3); }
  .chart-wide { grid-column: 1 / -1; }

  /* Funnel */
  .funnel { display: flex; flex-direction: column; gap: var(--space-2); }
  .funnel-row { display: flex; align-items: center; gap: var(--space-2); }
  .funnel-label { font-size: var(--fs-xs); color: var(--text-subtle); width: 50px; }
  .funnel-bar { height: 24px; border-radius: var(--radius-sm); display: flex; align-items: center; padding-left: var(--space-2); font-size: var(--fs-xs); font-weight: var(--fw-semibold); color: var(--bg); min-width: 30px; }
  .bar-green { background: var(--primary); }
  .bar-amber { background: var(--accent); }
  .funnel-rate { margin-top: var(--space-2); font-size: var(--fs-sm); color: var(--text-muted); }
  .funnel-rate strong { color: var(--accent); }

  /* Churn */
  .churn-stats { display: flex; flex-direction: column; gap: var(--space-2); }
  .churn-row { display: flex; justify-content: space-between; }
  .churn-label { font-size: var(--fs-sm); color: var(--text-subtle); }
  .churn-value { font-size: var(--fs-sm); font-weight: var(--fw-semibold); font-variant-numeric: tabular-nums; }
  .churn-bad { color: var(--danger); }
  .churn-rate { margin-top: var(--space-2); font-size: var(--fs-sm); color: var(--text-muted); }
  .churn-rate strong { color: var(--primary); }
  .churn-rate strong.bad { color: var(--danger); }

  /* Token */
  .token-stats { display: flex; flex-direction: column; gap: var(--space-2); }
  .token-row { display: flex; justify-content: space-between; }
  .token-label { font-size: var(--fs-sm); color: var(--text-subtle); }
  .token-value { font-size: var(--fs-sm); font-weight: var(--fw-semibold); font-variant-numeric: tabular-nums; color: var(--text); }

  /* Feature usage */
  .feature-list { display: flex; flex-direction: column; gap: var(--space-2); }
  .feature-row { display: flex; align-items: center; gap: var(--space-2); }
  .feature-name { font-size: var(--fs-xs); color: var(--text-muted); width: 80px; text-transform: capitalize; }
  .feature-bar-wrap { flex: 1; height: 8px; background: var(--surface-3); border-radius: var(--radius-pill); overflow: hidden; }
  .feature-bar { height: 100%; background: var(--primary); border-radius: var(--radius-pill); }
  .feature-count { font-size: var(--fs-xs); color: var(--text-subtle); width: 30px; text-align: right; font-variant-numeric: tabular-nums; }

  /* Hour bars */
  .hour-bars { display: flex; align-items: flex-end; gap: 1px; height: 60px; }
  .hour-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
  .hour-bar { width: 80%; background: var(--accent); border-radius: 2px 2px 0 0; min-height: 2px; }
  .hour-label { font-size: 0.55rem; color: var(--text-faint); margin-top: 2px; }
  .hour-bar:hover { background: var(--primary); }

  /* Cuisine */
  .cuisine-list { display: flex; flex-direction: column; gap: var(--space-2); }
  .cuisine-row { display: flex; align-items: center; gap: var(--space-2); }
  .cuisine-name { font-size: var(--fs-xs); color: var(--text-muted); width: 100px; }
  .cuisine-bar-wrap { flex: 1; height: 8px; background: var(--surface-3); border-radius: var(--radius-pill); overflow: hidden; }
  .cuisine-bar { height: 100%; background: var(--accent); border-radius: var(--radius-pill); }
  .cuisine-count { font-size: var(--fs-xs); color: var(--text-subtle); width: 30px; text-align: right; font-variant-numeric: tabular-nums; }

  /* Retention table */
  .retention-table { width: 100%; }
  .retention-header, .retention-row { display: grid; grid-template-columns: 1fr 60px 60px 60px 60px; gap: var(--space-2); padding: var(--space-1) 0; }
  .retention-header { font-size: var(--fs-xs); color: var(--text-faint); text-transform: uppercase; border-bottom: 1px solid var(--border); padding-bottom: var(--space-2); }
  .retention-row { font-size: var(--fs-sm); color: var(--text-muted); border-bottom: 1px solid var(--border); }
  .retention-row span { font-variant-numeric: tabular-nums; }
  .r-pct.bad { color: var(--danger); }

  .retry { margin-top: var(--space-4); }

  @media (max-width: 768px) {
    .pulse-strip { margin: calc(-1 * var(--space-6)) calc(-1 * var(--space-5)) var(--space-4); padding: var(--space-3); }
    .pulse-metrics { gap: var(--space-3); }
    .metric-sep { display: none; }
    .charts-grid { grid-template-columns: 1fr; }
  }
</style>
