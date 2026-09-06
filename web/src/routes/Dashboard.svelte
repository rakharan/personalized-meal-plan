<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/stores/api.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import DashboardLayout from '$lib/components/DashboardLayout.svelte';
  import StatCard from '$lib/components/StatCard.svelte';
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

  function pct(value: number, total: number) {
    return total > 0 ? `${Math.round((value / total) * 100)}%` : '0%';
  }
</script>

<DashboardLayout title="Dashboard" current="#/admin">
  {#if loading && !data}
    <div class="stats-grid">
      {#each Array(9) as _}<Skeleton rows={1} cols={1} />{/each}
    </div>
  {:else if error}
    <Alert variant="danger" title="Yah, koneksinya bermasalah">
      Dashboard lagi nggak bisa ambil data. Coba lagi sebentar ya.
    </Alert>
    <div class="retry-row">
      <Button variant="secondary" onclick={load}>Coba lagi</Button>
      <details class="dev-hint">
        <summary>Detail teknis</summary>
        <p>{error}</p>
      </details>
    </div>
  {:else if data}
    <div class="refresh-bar">
      {#if lastUpdated}
        <span class="refresh-time">Diperbarui {fmtUpdateTime(lastUpdated)}</span>
      {/if}
    </div>

    <h2 class="section-title">Pengguna</h2>
    <div class="stats-grid">
      <StatCard value={data.totalUsers} label="Total Pengguna" highlight />
      <StatCard value={data.activeSubs} label="Langganan Aktif" />
      <StatCard value={data.retention7d} label="Retensi 7 Hari" highlight />
    </div>

    <h2 class="section-title">Engagement</h2>
    <div class="stats-grid">
      <StatCard value={data.avgStreak} label="Rata-rata Streak" />
      <StatCard value={data.maxStreak} label="Streak Terpanjang" />
      <StatCard value={data.referrals} label="Referral" />
    </div>

    <h2 class="section-title">Operasional</h2>
    <div class="stats-grid">
      <StatCard value={data.todayPushed} label="Dikirim Hari Ini" />
      <StatCard value={data.plansCount} label="Rencana Disimpan" />
      <StatCard value={data.tokensToday} label="Token Hari Ini" />
    </div>

    <div class="charts">
      <ChartCard title="Distribusi Tier">
        {#if data.tiers?.length}
          <BarList data={data.tiers.map((t: any) => ({ label: t.tier, value: t.count }))} />
        {:else}
          <p class="muted">Belum ada data tier</p>
        {/if}
      </ChartCard>
      <ChartCard title="Rasio Feedback">
        {#if data.feedback?.length}
          <BarList data={data.feedback.map((f: any) => ({ label: f.last_feedback, value: f.count }))} />
        {:else}
          <p class="muted">Belum ada feedback</p>
        {/if}
      </ChartCard>
      <ChartCard title="Distribusi Locale">
        {#if data.locale?.length}
          <BarList data={data.locale.map((l: any) => ({ label: l.locale, value: l.count }))} />
        {:else}
          <p class="muted">Belum ada data locale</p>
        {/if}
      </ChartCard>
      <ChartCard title="Distribusi Jam Kirim">
        {#if data.pushDist?.length}
          <BarList data={data.pushDist.map((p: any) => ({ label: fmtTime(p.push_hour, p.push_min), value: p.count }))} />
        {:else}
          <p class="muted">Belum ada jam kirim kustom</p>
        {/if}
      </ChartCard>
    </div>
  {/if}
</DashboardLayout>

<style>
  .refresh-bar {
    margin-bottom: var(--space-4);
  }
  .refresh-time {
    font-size: var(--fs-xs);
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }
  .section-title {
    font-size: var(--fs-xs);
    font-weight: var(--fw-semibold);
    text-transform: uppercase;
    letter-spacing: var(--ls-wide);
    color: var(--text-subtle);
    margin: var(--space-6) 0 var(--space-3);
  }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .charts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: var(--space-3);
    margin-top: var(--space-6);
  }
  .muted { color: var(--text-faint); font-size: var(--fs-sm); }
  .retry-row { margin-top: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); }
  .dev-hint summary { cursor: pointer; font-size: var(--fs-xs); color: var(--text-faint); }
  .dev-hint p { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--text-faint); margin-top: var(--space-2); }
</style>
