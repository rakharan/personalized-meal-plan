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

  let metrics = $state<any>(null);
  let dash = $state<any>(null);
  let error = $state('');
  let loading = $state(true);
  let lastUpdated = $state<Date | null>(null);

  async function load() {
    loading = true;
    error = '';
    try {
      [metrics, dash] = await Promise.all([
        api.getMetrics(),
        api.getDashboard(),
      ]);
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

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }

  function fmtDateTime(d: string) {
    return new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function maxVal(arr: { count?: number; dau?: number }[]): number {
    return Math.max(...arr.map(a => a.count ?? a.dau ?? 0), 1);
  }

  // Health score color
  function healthColor(score: number): string {
    if (score >= 75) return 'var(--primary)';
    if (score >= 50) return 'var(--accent)';
    if (score >= 30) return '#F59E0B';
    return 'var(--danger)';
  }

  // Alert severity styling
  function alertClass(severity: string): string {
    switch (severity) {
      case 'danger': return 'alert-danger';
      case 'warning': return 'alert-warning';
      case 'info': return 'alert-info';
      case 'ok': return 'alert-ok';
      default: return 'alert-info';
    }
  }

  function alertIcon(severity: string): string {
    switch (severity) {
      case 'danger': return '!';
      case 'warning': return '!';
      case 'info': return 'i';
      case 'ok': return '✓';
      default: return 'i';
    }
  }

  // Rating stars
  function ratingStars(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  // Feedback emoji
  function feedbackEmoji(rating: number): string {
    if (rating >= 5) return '😍';
    if (rating >= 4) return '👍';
    if (rating >= 3) return '👌';
    if (rating >= 2) return '🤔';
    return '👎';
  }
</script>

<DashboardLayout title="Dashboard" current="#/admin">
  {#if loading && !metrics}
    <Skeleton rows={4} cols={3} />
  {:else if error}
    <Alert variant="danger" title="Connection error">
      {error}
    </Alert>
    <div class="retry">
      <Button variant="secondary" onclick={load}>Retry</Button>
    </div>
  {:else if metrics}
    <!-- ═══ Today Snapshot ═══ -->
    {#if dash?.today}
      <section class="today-snapshot">
        <div class="snapshot-header">
          <h2 class="section-title">Hari Ini</h2>
          {#if lastUpdated}
            <span class="pulse-time">Updated {fmtTime(lastUpdated)}</span>
          {/if}
        </div>
        <div class="snapshot-grid">
          <div class="snapshot-card">
            <span class="snapshot-emoji">🍳</span>
            <span class="snapshot-value">{dash.today.plansToday}</span>
            <span class="snapshot-label">Rencana dibuat</span>
          </div>
          <div class="snapshot-card">
            <span class="snapshot-emoji">👥</span>
            <span class="snapshot-value">{dash.today.activeToday}</span>
            <span class="snapshot-label">User aktif</span>
          </div>
          <div class="snapshot-card">
            <span class="snapshot-emoji">📤</span>
            <span class="snapshot-value">{dash.today.pushesSent}</span>
            <span class="snapshot-label">Push terkirim</span>
          </div>
          <div class="snapshot-card" class:danger={dash.today.pushesFailed > 0}>
            <span class="snapshot-emoji">⚠️</span>
            <span class="snapshot-value">{dash.today.pushesFailed}</span>
            <span class="snapshot-label">Push gagal</span>
          </div>
          <div class="snapshot-card">
            <span class="snapshot-emoji">✨</span>
            <span class="snapshot-value">{dash.today.newUsersToday}</span>
            <span class="snapshot-label">User baru</span>
          </div>
          <div class="snapshot-card" class:success={dash.today.cookedToday > 0}>
            <span class="snapshot-emoji">🔥</span>
            <span class="snapshot-value">{dash.today.cookedToday ?? 0}</span>
            <span class="snapshot-label">Sudah masak</span>
          </div>
          <div class="snapshot-card">
            <span class="snapshot-emoji">📋</span>
            <span class="snapshot-value">{dash.today.plannedTodayWeb ?? 0}</span>
            <span class="snapshot-label">Plan web hari ini</span>
          </div>
        </div>
      </section>
    {/if}

    <!-- ═══ Health Score + Alerts ═══ -->
    {#if dash?.health}
      <div class="health-alerts-row">
        <!-- Health score -->
        <div class="health-card">
          <div class="health-ring" style="--health-color: {healthColor(dash.health.score)}">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" class="ring-bg" />
              <circle
                cx="60" cy="60" r="52"
                class="ring-fill"
                style="stroke-dashoffset: {327 - (327 * dash.health.score / 100)}; stroke: {healthColor(dash.health.score)}"
              />
            </svg>
            <div class="health-numbers">
              <span class="health-score" style="color: {healthColor(dash.health.score)}">{dash.health.score}</span>
              <span class="health-label">{dash.health.label}</span>
            </div>
          </div>
          <div class="health-breakdown">
            {#each dash.health.components as c}
              <div class="health-comp">
                {#if c.dauTrend !== undefined}
                  <span class="comp-label">DAU Trend</span>
                  <span class="comp-value" class:positive={c.dauTrend >= 0} class:negative={c.dauTrend < 0}>
                    {c.dauTrend >= 0 ? '+' : ''}{c.dauTrend}%
                  </span>
                {/if}
                {#if c.churn !== undefined}
                  <span class="comp-label">Churn</span>
                  <span class="comp-value">{c.churn}%</span>
                {/if}
                {#if c.conversion !== undefined}
                  <span class="comp-label">Conversion</span>
                  <span class="comp-value">{c.conversion}%</span>
                {/if}
                {#if c.retention !== undefined}
                  <span class="comp-label">D1 Retention</span>
                  <span class="comp-value">{c.retention}%</span>
                {/if}
              </div>
            {/each}
          </div>
        </div>

        <!-- Alerts -->
        <div class="alerts-card">
          <h3>Notifikasi</h3>
          <div class="alerts-list">
            {#each dash.alerts as alert}
              <div class="alert-item {alertClass(alert.severity)}">
                <span class="alert-icon">{alertIcon(alert.severity)}</span>
                <span class="alert-msg">{alert.message}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- ═══ Key metrics strip ═══ -->
    <div class="pulse-strip">
      <div class="pulse-metrics">        <div class="metric" class:highlight={true}>
          <span class="m-value">{metrics.mau}</span>
          <span class="m-label">MAU (30d)</span>
        </div>
        <div class="metric-sep"></div>
        <div class="metric">
          <span class="m-value">{metrics.conversion?.rate ?? 0}%</span>
          <span class="m-label">Conversion</span>
        </div>
        <div class="metric-sep"></div>
        <div class="metric" class:danger={metrics.churn?.rate > 20}>
          <span class="m-value">{metrics.churn?.rate ?? 0}%</span>
          <span class="m-label">Churn</span>
        </div>
        <div class="metric-sep"></div>
        <div class="metric">
          <span class="m-value">${metrics.tokenEconomics?.totalCost ?? 0}</span>
          <span class="m-label">Token Cost (30d)</span>
        </div>
        <div class="metric-sep"></div>
        <div class="metric">
          <span class="m-value">{metrics.tokenEconomics?.perUser ?? 0}</span>
          <span class="m-label">Tokens/User</span>
        </div>
      </div>
    </div>

    <!-- ═══ DAU trend — sparkline bars ═══ -->
    <section class="chart-section">
      <h2 class="section-title">Daily Active Users (30d)</h2>
      {#if metrics.dau?.length}
        <div class="sparkline">
          {#each metrics.dau as day}
            <div class="spark-col" title="{day.date}: {day.dau} active">
              <div class="spark-bar" style="height: {(day.dau / maxVal(metrics.dau)) * 100}%"></div>
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

    <!-- ═══ Plan generation trend ═══ -->
    <section class="chart-section">
      <h2 class="section-title">Plan Generation (14d)</h2>
      {#if metrics.planTrend?.length}
        <div class="sparkline">
          {#each metrics.planTrend as day}
            <div class="spark-col" title="{day.date}: {day.count} plans">
              <div class="spark-bar bar-amber" style="height: {(day.count / maxVal(metrics.planTrend)) * 100}%"></div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="muted">No plans generated yet</p>
      {/if}
    </section>

    <!-- ═══ User Management: Recent + Power + At-Risk ═══ -->
    {#if dash?.recentUsers || dash?.powerUsers || dash?.atRiskUsers}
      <section class="user-section">
        <h2 class="section-title">Manajemen User</h2>
        <div class="user-grid">
          <!-- Recent signups -->
          {#if dash.recentUsers?.length}
            <div class="user-card">
              <h3>User Terbaru</h3>
              <div class="user-list">
                {#each dash.recentUsers as u}
                  <div class="user-row">
                    <span class="user-chat">{u.chat_id?.slice(-6) || '—'}</span>
                    <span class="user-tier" class:premium={u.tier === 'premium'}>{u.tier}</span>
                    <span class="user-streak">🔥{u.streak || 0}</span>
                    <span class="user-date">{fmtDate(u.created_at)}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Power users -->
          {#if dash.powerUsers?.length}
            <div class="user-card">
              <h3>Power Users</h3>
              <div class="user-list">
                {#each dash.powerUsers as u}
                  <div class="user-row">
                    <span class="user-chat">{u.chat_id?.slice(-6) || '—'}</span>
                    <span class="user-tier" class:premium={u.tier === 'premium'}>{u.tier}</span>
                    <span class="user-plans">{u.plan_count} plans</span>
                    <span class="user-streak">🔥{u.streak || 0}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- At-risk users -->
          {#if dash.atRiskUsers?.length}
            <div class="user-card user-at-risk">
              <h3>⚠️ User At-Risk</h3>
              <div class="user-list">
                {#each dash.atRiskUsers as u}
                  <div class="user-row">
                    <span class="user-chat">{u.chat_id?.slice(-6) || '—'}</span>
                    <span class="user-tier" class:premium={u.tier === 'premium'}>{u.tier}</span>
                    <span class="user-inactive">{u.days_inactive}d inactive</span>
                    <span class="user-streak">🔥{u.streak || 0}</span>
                  </div>
                {/each}
              </div>
              <p class="user-note">User ini aktif 4-7 hari lalu, belum kembali. Pertimbangkan push manual.</p>
            </div>
          {/if}
        </div>
      </section>
    {/if}

    <!-- ═══ Content & Feedback ═══ -->
    {#if dash?.feedbackWall || dash?.planQuality}
      <section class="feedback-section">
        <h2 class="section-title">Feedback & Kualitas Plan</h2>
        <div class="feedback-grid">
          <!-- Plan quality -->
          {#if dash.planQuality}
            <div class="quality-card">
              <h3>Plan Quality</h3>
              <div class="quality-stats">
                <div class="quality-row">
                  <span class="quality-label">Avg Rating</span>
                  <span class="quality-value">{dash.planQuality.avgRating > 0 ? ratingStars(dash.planQuality.avgRating) : '—'}</span>
                </div>
                <div class="quality-row">
                  <span class="quality-label">Total Feedback</span>
                  <span class="quality-value">{dash.planQuality.totalFeedback}</span>
                </div>
              </div>
              {#if dash.planQuality.bestCuisines?.length}
                <div class="quality-sub">
                  <span class="quality-sub-label">Masakan terbaik</span>
                  {#each dash.planQuality.bestCuisines as c}
                    <div class="cuisine-quality-row">
                      <span>{c.cuisine}</span>
                      <span class="cuisine-quality-rating">{ratingStars(c.avgRating)}</span>
                      <span class="cuisine-quality-count">({c.count})</span>
                    </div>
                  {/each}
                </div>
              {/if}
              {#if dash.planQuality.worstCuisines?.length}
                <div class="quality-sub">
                  <span class="quality-sub-label">Masakan terburuk</span>
                  {#each dash.planQuality.worstCuisines as c}
                    <div class="cuisine-quality-row">
                      <span>{c.cuisine}</span>
                      <span class="cuisine-quality-rating">{ratingStars(c.avgRating)}</span>
                      <span class="cuisine-quality-count">({c.count})</span>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}

          <!-- Feedback wall -->
          {#if dash.feedbackWall?.length}
            <div class="feedback-wall">
              <h3>Feedback Terbaru</h3>
              <div class="feedback-list">
                {#each dash.feedbackWall as f}
                  <div class="feedback-item">
                    <span class="feedback-emoji">{feedbackEmoji(f.rating)}</span>
                    <div class="feedback-content">
                      <span class="feedback-rating">{ratingStars(f.rating)}</span>
                      {#if f.feedback}<span class="feedback-text">"{f.feedback}"</span>{/if}
                      <span class="feedback-meta">{f.cuisine || '—'} · {fmtDateTime(f.created_at)}</span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </section>
    {/if}

    <!-- ═══ Push Delivery Status ═══ -->
    {#if dash?.pushStatus}
      <section class="push-section">
        <h2 class="section-title">Push Delivery Status (Hari Ini)</h2>
        <div class="push-summary">
          <div class="push-stat">
            <span class="push-num">{dash.pushStatus.total}</span>
            <span class="push-label">Total</span>
          </div>
          <div class="push-stat push-sent">
            <span class="push-num">{dash.pushStatus.sent}</span>
            <span class="push-label">Terkirim</span>
          </div>
          <div class="push-stat push-failed" class:show={dash.pushStatus.failed > 0}>
            <span class="push-num">{dash.pushStatus.failed}</span>
            <span class="push-label">Gagal</span>
          </div>
          <div class="push-stat push-pending" class:show={dash.pushStatus.pending > 0}>
            <span class="push-num">{dash.pushStatus.pending}</span>
            <span class="push-label">Pending</span>
          </div>
        </div>
        {#if dash.pushStatus.recent?.length}
          <div class="push-recent">
            {#each dash.pushStatus.recent.slice(0, 5) as p}
              <div class="push-row">
                <span class="push-status-dot" class:sent={p.status === 'sent'} class:failed={p.status === 'failed'} class:pending={p.status === 'pending'}></span>
                <span class="push-chat">{p.chat_id?.slice(-6) || '—'}</span>
                <span class="push-cuisine">{p.cuisine || '—'}</span>
                <span class="push-time">{fmtDateTime(p.created_at)}</span>
                {#if p.error}<span class="push-error">{p.error}</span>{/if}
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}

    <!-- ═══ Two-column charts ═══ -->
    <div class="charts-grid">
      <!-- Conversion funnel -->
      <div class="chart-card">
        <h3>Free → Premium</h3>
        <div class="funnel">
          <div class="funnel-row">
            <span class="funnel-label">Free</span>
            <div class="funnel-bar bar-green" style="width: {metrics.conversion?.total > 0 ? 100 : 0}%">{metrics.conversion?.free ?? 0}</div>
          </div>
          <div class="funnel-row">
            <span class="funnel-label">Premium</span>
            <div class="funnel-bar bar-amber" style="width: {metrics.conversion?.total > 0 ? (metrics.conversion.premium / metrics.conversion.total) * 100 : 0}%">{metrics.conversion?.premium ?? 0}</div>
          </div>
        </div>
        <div class="funnel-rate">
          Conversion rate: <strong>{metrics.conversion?.rate ?? 0}%</strong>
        </div>
      </div>

      <!-- Churn -->
      <div class="chart-card">
        <h3>Churn (30d)</h3>
        <div class="churn-stats">
          <div class="churn-row">
            <span class="churn-label">Active (30d)</span>
            <span class="churn-value">{metrics.churn?.totalActive ?? 0}</span>
          </div>
          <div class="churn-row">
            <span class="churn-label">Churned (>7d inactive)</span>
            <span class="churn-value churn-bad">{metrics.churn?.churned ?? 0}</span>
          </div>
          <div class="churn-rate">
            Churn rate: <strong class:bad={metrics.churn?.rate > 20}>{metrics.churn?.rate ?? 0}%</strong>
          </div>
        </div>
      </div>

      <!-- Token economics -->
      <div class="chart-card">
        <h3>Token Economics</h3>
        <div class="token-stats">
          <div class="token-row">
            <span class="token-label">Total tokens (30d)</span>
            <span class="token-value">{(metrics.tokenEconomics?.totalTokens ?? 0).toLocaleString()}</span>
          </div>
          <div class="token-row">
            <span class="token-label">Est. cost</span>
            <span class="token-value">${metrics.tokenEconomics?.totalCost ?? 0}</span>
          </div>
          <div class="token-row">
            <span class="token-label">Per user</span>
            <span class="token-value">{(metrics.tokenEconomics?.perUser ?? 0).toLocaleString()}</span>
          </div>
          <div class="token-row">
            <span class="token-label">Active users</span>
            <span class="token-value">{metrics.tokenEconomics?.activeUsers ?? 0}</span>
          </div>
        </div>
      </div>

      <!-- Feature usage -->
      <div class="chart-card">
        <h3>Feature Usage (30d)</h3>
        {#if metrics.featureUsage?.length}
          <div class="feature-list">
            {#each metrics.featureUsage as f}
              <div class="feature-row">
                <span class="feature-name">{f.feature}</span>
                <div class="feature-bar-wrap">
                  <div class="feature-bar" style="width: {(f.calls / metrics.featureUsage[0].calls) * 100}%"></div>
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
        {#if metrics.activityByHour?.length}
          <div class="hour-bars">
            {#each metrics.activityByHour as h}
              <div class="hour-col" title="{h.hour}:00 — {h.count} calls">
                <div class="hour-bar" style="height: {h.count > 0 ? (h.count / Math.max(...metrics.activityByHour.map(a => a.count), 1)) * 100 : 0}%"></div>
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
        {#if metrics.cuisinePopularity?.length}
          <div class="cuisine-list">
            {#each metrics.cuisinePopularity as c}
              <div class="cuisine-row">
                <span class="cuisine-name">{c.cuisine}</span>
                <div class="cuisine-bar-wrap">
                  <div class="cuisine-bar" style="width: {metrics.cuisinePopularity[0].count > 0 ? (c.count / metrics.cuisinePopularity[0].count) * 100 : 0}%"></div>
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
        {#if metrics.retention?.length}
          <div class="retention-table">
            <div class="retention-header">
              <span>Month</span>
              <span>Size</span>
              <span>D1</span>
              <span>D7</span>
              <span>D30</span>
            </div>
            {#each metrics.retention as r}
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
  /* ═══ Today Snapshot ═══ */
  .today-snapshot {
    background: var(--surface); border-radius: var(--radius-lg);
    padding: var(--space-5); margin-bottom: var(--space-5);
    border: 1px solid var(--border);
  }
  .snapshot-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); }
  .snapshot-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-3); }
  .snapshot-card {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: var(--space-3); background: var(--surface-2); border-radius: var(--radius-md);
  }
  .snapshot-card.danger { background: var(--danger-soft); }
  .snapshot-card.success { background: var(--primary-soft); }
  .snapshot-emoji { font-size: var(--fs-lg); }
  .snapshot-value { font-size: var(--fs-2xl); font-weight: var(--fw-bold); color: var(--text); font-variant-numeric: tabular-nums; }
  .snapshot-label { font-size: 0.6rem; color: var(--text-subtle); text-transform: uppercase; letter-spacing: var(--ls-wide); }

  /* ═══ Health + Alerts ═══ */
  .health-alerts-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-5); }
  .health-card {
    background: var(--surface); border-radius: var(--radius-lg); padding: var(--space-5);
    border: 1px solid var(--border); display: flex; gap: var(--space-5); align-items: center;
  }
  .health-ring { position: relative; width: 120px; height: 120px; flex-shrink: 0; }
  .health-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .ring-bg { fill: none; stroke: var(--surface-3); stroke-width: 8; }
  .ring-fill { fill: none; stroke-width: 8; stroke-linecap: round; stroke-dasharray: 327; transition: stroke-dashoffset 0.5s ease; }
  .health-numbers {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    display: flex; flex-direction: column; align-items: center;
  }
  .health-score { font-size: var(--fs-2xl); font-weight: var(--fw-bold); line-height: 1; }
  .health-label { font-size: var(--fs-xs); color: var(--text-subtle); text-transform: capitalize; }
  .health-breakdown { flex: 1; display: flex; flex-direction: column; gap: var(--space-2); }
  .health-comp { display: flex; justify-content: space-between; }
  .comp-label { font-size: var(--fs-sm); color: var(--text-subtle); }
  .comp-value { font-size: var(--fs-sm); font-weight: var(--fw-semibold); font-variant-numeric: tabular-nums; }
  .comp-value.positive { color: var(--primary); }
  .comp-value.negative { color: var(--danger); }

  .alerts-card {
    background: var(--surface); border-radius: var(--radius-lg); padding: var(--space-5);
    border: 1px solid var(--border);
  }
  .alerts-card h3 { font-size: var(--fs-sm); font-weight: var(--fw-semibold); margin-bottom: var(--space-3); }
  .alerts-list { display: flex; flex-direction: column; gap: var(--space-2); }
  .alert-item { display: flex; gap: var(--space-2); align-items: flex-start; padding: var(--space-2); border-radius: var(--radius-sm); }
  .alert-danger { background: var(--danger-soft); }
  .alert-warning { background: var(--accent-soft); }
  .alert-info { background: var(--surface-2); }
  .alert-ok { background: var(--primary-soft); }
  .alert-icon {
    width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: var(--fs-xs); font-weight: var(--fw-bold);
  }
  .alert-danger .alert-icon { background: var(--danger); color: var(--text-on-danger); }
  .alert-warning .alert-icon { background: var(--accent); color: var(--bg); }
  .alert-info .alert-icon { background: var(--text-subtle); color: var(--bg); }
  .alert-ok .alert-icon { background: var(--primary); color: var(--text-on-primary); }
  .alert-msg { font-size: var(--fs-sm); color: var(--text-muted); line-height: var(--lh-normal); }

  /* ═══ Pulse strip ═══ */
  .pulse-strip {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-5);
    margin-bottom: var(--space-6);
  }
  .pulse-time { font-size: var(--fs-xs); color: var(--text-faint); font-variant-numeric: tabular-nums; }
  .pulse-metrics { display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; }
  .metric { display: flex; flex-direction: column; gap: 2px; min-width: 60px; }
  .metric.highlight .m-value { color: var(--primary); }
  .metric.danger .m-value { color: var(--danger); }
  .m-value { font-size: var(--fs-lg); font-weight: var(--fw-bold); font-variant-numeric: tabular-nums; line-height: 1; color: var(--text); }
  .m-label { font-size: 0.65rem; color: var(--text-subtle); text-transform: uppercase; letter-spacing: var(--ls-wide); }
  .metric-sep { width: 1px; height: 24px; background: var(--border); flex-shrink: 0; }

  /* ═══ Section ═══ */
  .section-title { font-size: var(--fs-xs); font-weight: var(--fw-semibold); text-transform: uppercase; letter-spacing: var(--ls-wide); color: var(--text-subtle); margin-bottom: var(--space-3); }
  .chart-section { margin-bottom: var(--space-6); }
  .muted { color: var(--text-faint); font-size: var(--fs-sm); }

  /* ═══ Sparkline ═══ */
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

  /* ═══ User Management ═══ */
  .user-section { margin-bottom: var(--space-6); }
  .user-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); }
  .user-card {
    background: var(--surface); border-radius: var(--radius-md); padding: var(--space-4);
    border: 1px solid var(--border);
  }
  .user-card h3 { font-size: var(--fs-sm); font-weight: var(--fw-semibold); margin-bottom: var(--space-3); }
  .user-at-risk { border-color: var(--accent); }
  .user-list { display: flex; flex-direction: column; gap: var(--space-2); }
  .user-row {
    display: flex; align-items: center; gap: var(--space-2);
    padding: var(--space-1) 0; border-bottom: 1px solid var(--border);
    font-size: var(--fs-sm);
  }
  .user-row:last-child { border-bottom: none; }
  .user-chat { font-family: var(--font-mono); color: var(--text-muted); width: 60px; }
  .user-tier {
    padding: 2px var(--space-2); border-radius: var(--radius-pill);
    font-size: var(--fs-xs); background: var(--surface-3); color: var(--text-subtle);
  }
  .user-tier.premium { background: var(--accent-soft); color: var(--accent); }
  .user-streak { color: var(--accent); font-size: var(--fs-xs); }
  .user-date, .user-plans { color: var(--text-subtle); font-size: var(--fs-xs); margin-left: auto; }
  .user-inactive { color: var(--danger); font-size: var(--fs-xs); margin-left: auto; }
  .user-note { font-size: var(--fs-xs); color: var(--text-subtle); margin-top: var(--space-3); line-height: var(--lh-normal); }

  /* ═══ Feedback & Quality ═══ */
  .feedback-section { margin-bottom: var(--space-6); }
  .feedback-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
  .quality-card, .feedback-wall {
    background: var(--surface); border-radius: var(--radius-md); padding: var(--space-4);
    border: 1px solid var(--border);
  }
  .quality-card h3, .feedback-wall h3 { font-size: var(--fs-sm); font-weight: var(--fw-semibold); margin-bottom: var(--space-3); }
  .quality-stats { display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-3); }
  .quality-row { display: flex; justify-content: space-between; }
  .quality-label { font-size: var(--fs-sm); color: var(--text-subtle); }
  .quality-value { font-size: var(--fs-sm); color: var(--accent); }
  .quality-sub { margin-bottom: var(--space-3); }
  .quality-sub-label { font-size: var(--fs-xs); color: var(--text-subtle); text-transform: uppercase; letter-spacing: var(--ls-wide); display: block; margin-bottom: var(--space-1); }
  .cuisine-quality-row { display: flex; align-items: center; gap: var(--space-2); padding: 2px 0; }
  .cuisine-quality-row span:first-child { font-size: var(--fs-sm); color: var(--text-muted); flex: 1; }
  .cuisine-quality-rating { font-size: var(--fs-xs); color: var(--accent); }
  .cuisine-quality-count { font-size: var(--fs-xs); color: var(--text-faint); }

  .feedback-list { display: flex; flex-direction: column; gap: var(--space-2); }
  .feedback-item { display: flex; gap: var(--space-2); padding: var(--space-2) 0; border-bottom: 1px solid var(--border); }
  .feedback-item:last-child { border-bottom: none; }
  .feedback-emoji { font-size: var(--fs-lg); flex-shrink: 0; }
  .feedback-content { display: flex; flex-direction: column; gap: 2px; }
  .feedback-rating { font-size: var(--fs-xs); color: var(--accent); }
  .feedback-text { font-size: var(--fs-sm); color: var(--text); font-style: italic; }
  .feedback-meta { font-size: var(--fs-xs); color: var(--text-faint); }

  /* ═══ Push Status ═══ */
  .push-section {
    background: var(--surface); border-radius: var(--radius-lg); padding: var(--space-5);
    margin-bottom: var(--space-6); border: 1px solid var(--border);
  }
  .push-summary { display: flex; gap: var(--space-4); margin-bottom: var(--space-4); }
  .push-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .push-num { font-size: var(--fs-xl); font-weight: var(--fw-bold); font-variant-numeric: tabular-nums; color: var(--text); }
  .push-sent .push-num { color: var(--primary); }
  .push-failed .push-num { color: var(--danger); }
  .push-pending .push-num { color: var(--accent); }
  .push-stat:not(.show) .push-num { color: var(--text-faint); }
  .push-label { font-size: var(--fs-xs); color: var(--text-subtle); }
  .push-recent { display: flex; flex-direction: column; gap: var(--space-1); }
  .push-row { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-1) 0; border-bottom: 1px solid var(--border); font-size: var(--fs-sm); }
  .push-row:last-child { border-bottom: none; }
  .push-status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-faint); flex-shrink: 0; }
  .push-status-dot.sent { background: var(--primary); }
  .push-status-dot.failed { background: var(--danger); }
  .push-status-dot.pending { background: var(--accent); }
  .push-chat { font-family: var(--font-mono); color: var(--text-muted); width: 60px; }
  .push-cuisine { color: var(--text-muted); flex: 1; }
  .push-time { color: var(--text-faint); font-size: var(--fs-xs); }
  .push-error { color: var(--danger); font-size: var(--fs-xs); }

  /* ═══ Charts grid ═══ */
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
    .snapshot-grid { grid-template-columns: repeat(2, 1fr); }
    .health-alerts-row { grid-template-columns: 1fr; }
    .user-grid { grid-template-columns: 1fr; }
    .feedback-grid { grid-template-columns: 1fr; }
    .push-summary { flex-wrap: wrap; gap: var(--space-3); }
  }
</style>
