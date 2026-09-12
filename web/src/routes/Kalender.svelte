<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import UserLayout from '$lib/components/UserLayout.svelte';
  import Alert from '$lib/components/Alert.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';

  interface Day {
    date: string;
    dayName: string;
    dayNum: number;
    status: 'cooked' | 'skipped' | 'today' | 'future';
    cuisine: string | null;
    planId: number | null;
  }

  interface Badge {
    key: string;
    name: string;
    desc: string;
    emoji: string;
    unlocked: boolean;
    progress: number;
  }

  let days = $state<Day[]>([]);
  let badges = $state<Badge[]>([]);
  let weekCooked = $state(0);
  let weekTarget = $state(7);
  let streak = $state(0);
  let weekOffset = $state(0);
  let loading = $state(true);
  let error = $state('');

  const dayEmojis: Record<string, string> = {
    Sen: '🍛', Sel: '🍱', Rab: '🍲', Kam: '🫒', Jum: '🍜', Sab: '🥢', Min: '🌮',
  };

  async function load(background = false) {
    if (!background) loading = true;
    error = '';
    try {
      const [calRes, badgeRes, histRes] = await Promise.all([
        fetch(`/api/calendar?week=${weekOffset}`, { headers: auth.authHeaders() }),
        fetch('/api/badges', { headers: auth.authHeaders() }),
        fetch('/api/plans/history', { headers: auth.authHeaders() }),
      ]);
      if (!calRes.ok) throw new Error('Gagal ambil kalender');
      const cal = await calRes.json();
      days = cal.days || [];
      if (badgeRes.ok) {
        const b = await badgeRes.json();
        badges = b.badges || [];
        weekCooked = b.weekCooked || 0;
        weekTarget = b.weekTarget || 7;
      }
      if (histRes.ok) {
        const h = await histRes.json();
        streak = h.streak || 0;
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function prevWeek() { weekOffset--; load(true); }
  function nextWeek() { if (weekOffset < 0) { weekOffset++; load(true); } }

  function weekLabel(): string {
    if (days.length === 0) return '';
    const first = new Date(days[0].date);
    const last = new Date(days[6].date);
    const fmt = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    return `${fmt(first)} — ${fmt(last)}`;
  }

  let ringPct = $derived(weekTarget > 0 ? Math.min(weekCooked / weekTarget, 1) : 0);

  onMount(() => {
    theme.init();
    if (!auth.isAuthed) {
      window.location.hash = '#/login';
      return;
    }
    load();
  });
</script>

<UserLayout current="#/kalender">
  <div class="kalender">
    <!-- Header -->
    <div class="page-head">
      <div>
        <h1>Kalender Makan</h1>
        <p class="page-sub">Tracking harian, streak, dan progress kamu.</p>
      </div>
      <div class="week-nav">
        <button class="nav-btn" onclick={prevWeek} aria-label="Minggu sebelumnya">←</button>
        <span class="week-label">{weekLabel()}</span>
        <button class="nav-btn" onclick={nextWeek} disabled={weekOffset >= 0} aria-label="Minggu berikutnya">→</button>
      </div>
    </div>

    {#if loading}
      <Skeleton rows={3} cols={4} />
    {:else if error}
      <Alert variant="danger" title="Error">{error}</Alert>
    {:else}
      <!-- Week grid — {#key} forces remount → fade on week change -->
      {#key days[0]?.date ?? 'w'}
      <section class="week-grid">
        {#each days as d (d.date)}
          <div class="day-card {d.status}" class:has-plan={!!d.planId}>
            <span class="status-dot" aria-hidden="true">
              {#if d.status === 'cooked'}✓{:else if d.status === 'skipped'}✕{:else if d.status === 'today'}●{:else}·{/if}
            </span>
            <div class="day-name">{d.dayName}</div>
            <div class="day-num">{d.dayNum}</div>
            {#if d.cuisine}
              <span class="cuisine-tag">{d.cuisine}</span>
            {:else if d.status === 'future'}
              <span class="cuisine-tag muted">{dayEmojis[d.dayName] || '🍽️'}</span>
            {/if}
          </div>
        {/each}
      </section>
      {/key}
      <section class="progress-row">
        <div class="streak-card">
          <!-- svelte-ignore a11y_unknown_tag -->
          <dotlottie-player src="/fire-noto.lottie" autoplay loop style="width:44px;height:44px"></dotlottie-player>
          <div>
            <div class="streak-num">{streak}</div>
            <div class="streak-label">hari beruntun</div>
          </div>
        </div>

        <div class="ring-card">
          <div class="ring-wrap">
            <svg viewBox="0 0 120 120" class="ring-svg">
              <circle cx="60" cy="60" r="52" class="ring-bg" />
              <circle
                cx="60" cy="60" r="52"
                class="ring-fill"
                style="stroke-dasharray: {ringPct * 326.7} 326.7"
                transform="rotate(-90 60 60)"
              />
            </svg>
            <div class="ring-text">
              <span class="ring-num">{weekCooked}/{weekTarget}</span>
              <span class="ring-cap">minggu ini</span>
            </div>
          </div>
          <p class="ring-label">Masak {weekCooked} dari {weekTarget} hari</p>
        </div>
      </section>

      <!-- Badges -->
      <section class="badges-section">
        <h2 class="section-title">Lencana</h2>
        <div class="badges-grid">
          {#each badges as b}
            <div class="badge-card" class:locked={!b.unlocked}>
              <div class="badge-icon" class:unlocked={b.unlocked}>{b.emoji}</div>
              <div class="badge-name">{b.name}</div>
              <div class="badge-desc">{b.desc}</div>
              {#if !b.unlocked}
                <div class="badge-progress">
                  <div class="badge-progress-fill" style="width: {Math.round(b.progress * 100)}%"></div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </section>
    {/if}
  </div>
</UserLayout>

<style>
  .kalender { max-width: 900px; margin: 0 auto; }

  .page-head {
    display: flex; justify-content: space-between; align-items: flex-end;
    gap: var(--space-4); margin-bottom: var(--space-6); flex-wrap: wrap;
  }
  h1 { font-size: var(--fs-xl); font-weight: var(--fw-bold); letter-spacing: var(--ls-tight); margin-bottom: var(--space-1); }
  .page-sub { color: var(--text-subtle); font-size: var(--fs-sm); }
  .week-nav { display: flex; align-items: center; gap: var(--space-2); }
  .nav-btn {
    width: 36px; height: 36px; border-radius: var(--radius-md);
    border: 1px solid var(--border); background: var(--surface); color: var(--text-subtle);
    cursor: pointer; font-size: var(--fs-md);
    transition: all var(--duration-micro) var(--ease-standard);
  }
  .nav-btn:hover:not(:disabled) { background: var(--surface-2); color: var(--text); }
  .nav-btn:disabled { opacity: .4; cursor: not-allowed; }
  .week-label { font-size: var(--fs-sm); color: var(--text-subtle); min-width: 110px; text-align: center; }

  /* Week grid */
  .week-grid {
    display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--space-3);
    margin-bottom: var(--space-6);
    animation: weekFade .25s ease;
  }
  @keyframes weekFade { from { opacity: .3; } to { opacity: 1; } }
  .day-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 16px 20px 12px 24px; padding: var(--space-3);
    min-height: 110px; position: relative; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    transition: transform var(--duration-micro) var(--ease-standard),
                box-shadow var(--duration-micro) var(--ease-standard);
  }
  .day-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-elevation-2); }
  .day-card.cooked { background: var(--primary-soft); border-color: var(--primary); }
  .day-card.today { border-color: var(--primary); border-width: 2px; }
  .day-card.skipped { opacity: .55; }
  .day-card.future { opacity: .7; }
  .status-dot {
    position: absolute; top: var(--space-2); right: var(--space-2);
    width: 22px; height: 22px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: var(--fs-xs); font-weight: var(--fw-bold);
  }
  .cooked .status-dot { background: var(--primary); color: var(--text-on-primary); }
  .skipped .status-dot { background: var(--surface-3); color: var(--text-faint); }
  .today .status-dot { background: var(--accent); color: var(--text-on-primary); }
  .future .status-dot { background: var(--surface-2); color: var(--text-faint); }
  .day-name {
    font-size: var(--fs-xs); font-weight: var(--fw-semibold); color: var(--text-faint);
    text-transform: uppercase; letter-spacing: var(--ls-wide);
  }
  .day-num {
    font-size: var(--fs-xl); font-weight: var(--fw-bold); color: var(--text);
    font-family: var(--font-mono); line-height: 1.2;
  }
  .cuisine-tag {
    font-size: 0.7rem; font-weight: var(--fw-semibold); padding: 2px var(--space-2);
    border-radius: var(--radius-pill); background: var(--primary-soft); color: var(--primary);
    margin-top: var(--space-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
  }
  .cuisine-tag.muted { background: var(--surface-2); color: var(--text-faint); }

  /* Progress row */
  .progress-row {
    display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);
    margin-bottom: var(--space-6);
  }
  .streak-card {
    display: flex; align-items: center; gap: var(--space-4);
    background: linear-gradient(135deg, var(--primary), var(--leaf-400));
    border-radius: 20px 24px 16px 28px; padding: var(--space-6);
    color: var(--text-on-primary); position: relative; overflow: hidden;
  }
  .streak-card::before {
    content: ''; position: absolute; top: -50%; right: -15%;
    width: 200px; height: 200px; background: rgba(255,255,255,.1); border-radius: 50%;
  }
  .streak-flame { font-size: 2.5rem; position: relative; z-index: 1; }
  .streak-num {
    font-size: var(--fs-3xl); font-weight: var(--fw-bold);
    font-family: var(--font-mono); line-height: 1; position: relative; z-index: 1;
  }
  .streak-label { font-size: var(--fs-sm); opacity: .9; position: relative; z-index: 1; }

  .ring-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 20px 24px 16px 28px; padding: var(--space-5);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .ring-wrap { position: relative; width: 120px; height: 120px; }
  .ring-svg { width: 100%; height: 100%; transform: rotate(0deg); }
  .ring-bg { fill: none; stroke: var(--surface-3); stroke-width: 10; }
  .ring-fill {
    fill: none; stroke: var(--primary); stroke-width: 10; stroke-linecap: round;
    transition: stroke-dasharray .6s var(--ease-standard);
  }
  .ring-text {
    position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
  }
  .ring-num {
    font-size: var(--fs-xl); font-weight: var(--fw-bold); color: var(--primary);
    font-family: var(--font-mono); font-variant-numeric: tabular-nums;
  }
  .ring-cap { font-size: var(--fs-xs); color: var(--text-faint); }
  .ring-label { font-size: var(--fs-sm); color: var(--text-subtle); margin-top: var(--space-3); text-align: center; }

  /* Badges */
  .badges-section { margin-bottom: var(--space-6); }
  .section-title {
    font-size: var(--fs-sm); font-weight: var(--fw-semibold); color: var(--text-subtle);
    margin-bottom: var(--space-3); text-transform: uppercase; letter-spacing: var(--ls-wide);
  }
  .badges-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4);
  }
  .badge-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 20px 24px 16px 28px; padding: var(--space-5);
    text-align: center; transition: transform var(--duration-micro) var(--ease-standard),
                box-shadow var(--duration-micro) var(--ease-standard);
  }
  .badge-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-elevation-2); }
  .badge-card.locked { opacity: .5; }
  .badge-icon {
    width: 56px; height: 56px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.75rem; margin: 0 auto var(--space-3);
    background: var(--surface-2);
  }
  .badge-icon.unlocked { background: var(--primary-soft); }
  .badge-name { font-weight: var(--fw-semibold); font-size: var(--fs-sm); margin-bottom: 2px; }
  .badge-desc { font-size: var(--fs-xs); color: var(--text-subtle); line-height: var(--lh-normal); }
  .badge-progress {
    height: 4px; background: var(--surface-3); border-radius: var(--radius-pill);
    margin-top: var(--space-3); overflow: hidden;
  }
  .badge-progress-fill {
    height: 100%; background: linear-gradient(90deg, var(--primary), var(--accent));
    border-radius: var(--radius-pill); transition: width .6s var(--ease-standard);
  }

  @media (max-width: 768px) {
    .week-grid { grid-template-columns: repeat(4, 1fr); }
    .progress-row { grid-template-columns: 1fr; }
    .badges-grid { grid-template-columns: repeat(2, 1fr); }
  }

  @media (prefers-reduced-motion: reduce) {
    .day-card:hover, .badge-card:hover { transform: none; }
  }
</style>
