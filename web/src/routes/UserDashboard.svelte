<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import UserLayout from '$lib/components/UserLayout.svelte';
  import Button from '$lib/components/Button.svelte';
  import StatCard from '$lib/components/StatCard.svelte';
  import Alert from '$lib/components/Alert.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import MealPlanView from '$lib/components/MealPlanView.svelte';

  let profile = $state<any>(null);
  let lastPlan = $state<any>(null);
  let recentPlans = $state<any[]>([]);
  let generating = $state(false);
  let cookingSteps = $state('');
  let cookingLoading = $state(false);
  let error = $state('');
  let loading = $state(true);

  async function loadProfile() {
    loading = true;
    try {
      await auth.fetchMe();
      profile = auth.user;
      const res = await fetch('/api/plans/history', { headers: auth.authHeaders() });
      if (res.ok) {
        const data = await res.json();
        lastPlan = data.plans?.[0] || null;
        recentPlans = data.plans?.slice(0, 3) || [];
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function generatePlan() {
    generating = true;
    error = '';
    cookingSteps = '';
    try {
      const res = await fetch('/api/plans/generate', {
        method: 'POST',
        headers: auth.authHeaders(),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal generate');
      }
      const data = await res.json();
      lastPlan = { planText: data.plan, cuisine: data.cuisine, created: new Date().toISOString() };
    } catch (e: any) {
      error = e.message;
    } finally {
      generating = false;
    }
  }

  async function getCookingSteps() {
    cookingLoading = true;
    error = '';
    try {
      const res = await fetch('/api/plans/cooking-steps', {
        method: 'POST',
        headers: auth.authHeaders(),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal ambil panduan masak');
      }
      const data = await res.json();
      cookingSteps = data.steps;
    } catch (e: any) {
      error = e.message;
    } finally {
      cookingLoading = false;
    }
  }

  onMount(() => {
    theme.init();
    if (!auth.isAuthed) {
      window.location.hash = '#/login';
      return;
    }
    loadProfile();
  });

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  // ── Display helpers (template-only) ──
  function goalLabel(goal: string): string {
    const map: Record<string, string> = {
      weight_loss: 'Turun berat badan',
      muscle_gain: 'Naik mass otot',
      maintenance: 'Maintenance',
    };
    return map[goal] || 'Makan sehat';
  }

  function extractCalories(text: string): string {
    if (!text) return '—';
    const m = text.match(/(\d+)\s*(?:kal|kcal|kkal)/i);
    return m ? m[1] : '—';
  }

  function cuisineEmoji(c: string): string {
    if (!c) return '🍽️';
    const key = c.toLowerCase();
    const map: Record<string, string> = {
      indonesian: '🍛', indonesia: '🍛', japanese: '🍱', italia: '🍝', italian: '🍝',
      chinese: '🥡', cina: '🥡', korean: '🍲', korea: '🍲', mexican: '🌮',
      thai: '🍜', indian: '🫓', india: '🫓', vietnamese: '🥢', vietnam: '🥢',
      mediterranean: '🫒', western: '🥩',
    };
    return map[key] || '🍽️';
  }

  function isToday(dateStr: string): boolean {
    if (!dateStr) return false;
    return new Date(dateStr).toDateString() === new Date().toDateString();
  }

  function feedbackIcon(plan: any): string {
    if (plan.feedback === 'love' || plan.rating === 5) return '😍';
    if (plan.feedback === 'like' || plan.rating >= 4) return '👍';
    if (plan.feedback === 'dislike' || plan.rating <= 2) return '👎';
    return '·';
  }
</script>

<UserLayout current="#/dashboard">
  {#if loading}
    <Skeleton rows={4} cols={3} />
  {:else if error}
    <Alert variant="danger" title="Error">{error}</Alert>
  {:else if profile}
    <!-- ═══ Welcome Bar ═══ -->
    <div class="welcome-bar">
      <div class="welcome-info">
        <div class="welcome-greeting">
          <h1>Halo, {profile.full_name?.split(' ')[0] || 'Koki'}! 👋</h1>
          {#if (profile.streak_days || 0) > 0}
            <span class="streak-badge">🔥 Day {profile.streak_days}</span>
          {/if}
        </div>
        <p class="welcome-sub">
          {goalLabel(profile.goal)} ·
          <span class="macro-pill">{profile.target_calories || '—'} kal</span> ·
          <span class="macro-pill">{profile.target_protein || '—'}g protein</span>
        </p>
      </div>
      <Button variant="primary" size="lg" loading={generating} onclick={generatePlan}>
        {#if generating}⏳ Bikin...{:else if lastPlan}🎲 Rencana Baru{:else}🍽️ Bikin Rencana{/if}
      </Button>
    </div>

    <!-- ═══ Quick Stats Row ═══ -->
    <div class="stats-grid">
      <StatCard value={profile.meals_per_day || 3} label="Makan/hari" />
      <StatCard
        value={profile.cuisine_rotation === 'rotate' ? 'Rotasi' : profile.cuisine_rotation || '—'}
        label="Masakan" />
      <StatCard
        value={profile.streak_days || 0}
        label="Streak"
        highlight={(profile.streak_days || 0) > 0} />
      <StatCard
        value={profile.budget_tier || '—'}
        label="Budget" />
      {#if profile.referral_count}
        <StatCard value={profile.referral_count} label="Referral" />
      {/if}
    </div>

    <!-- ═══ Today's Plan ═══ -->
    {#if lastPlan}
      <section class="plan-section">
        <div class="cuisine-header">
          <div class="cuisine-left">
            <span class="cuisine-emoji">{cuisineEmoji(lastPlan.cuisine)}</span>
            <div>
              <span class="cuisine-label">Hari Ini</span>
              <h2 class="cuisine-name">{lastPlan.cuisine || 'Rencana Harian'}</h2>
            </div>
          </div>
          <span class="plan-date">{isToday(lastPlan.created) ? 'Baru saja' : fmtDate(lastPlan.created)}</span>
        </div>
        <div class="plan-body">
          <MealPlanView bind:planText={lastPlan.planText} />
        </div>
      </section>

      <div class="plan-actions">
        <Button variant="secondary" loading={cookingLoading} onclick={getCookingSteps}>
          🍳 {cookingSteps ? 'Panduan Masak Ulang' : 'Panduan Masak'}
        </Button>
      </div>
    {:else if !generating}
      <section class="empty-plan">
        <div class="empty-illustration">
          <span class="plate">🍽️</span>
          <span class="food-float f1">🍛</span>
          <span class="food-float f2">🥗</span>
          <span class="food-float f3">🍜</span>
          <span class="food-float f4">🥘</span>
        </div>
        <h2>Dapur masih kosong!</h2>
        <p class="empty-text">
          Belum ada rencana makan. Bayarkan saja sekali klik —
          nasi merah, ayam bakar, sayur asem, tempe orek,
          ikan kembung, kangkung... semua siap diatur.
        </p>
        <Button variant="primary" size="lg" loading={generating} onclick={generatePlan}>
          🍽️ Bikin Rencana Pertama
        </Button>
      </section>
    {/if}

    <!-- ═══ Cooking Guide (amber accent) ═══ -->
    {#if cookingSteps}
      <section class="cooking-section">
        <div class="cooking-header">
          <span class="cooking-icon">🍳</span>
          <div>
            <h3>Panduan Masak</h3>
            <span class="cooking-sub">Langkah demi langkah</span>
          </div>
        </div>
        <pre class="cooking-text">{cookingSteps}</pre>
      </section>
    {/if}

    <!-- ═══ Recent Activity ═══ -->
    {#if recentPlans.length > 1}
      <section class="recent-section">
        <h3 class="section-title">📋 Rencana Terakhir</h3>
        <div class="recent-list">
          {#each recentPlans as plan, i}
            <div class="recent-row" class:first={i === 0}>
              <span class="recent-emoji">{cuisineEmoji(plan.cuisine)}</span>
              <div class="recent-main">
                <span class="recent-cuisine">{plan.cuisine || '—'}</span>
                <span class="recent-date">{fmtDate(plan.created)}</span>
              </div>
              <span class="recent-cal">{extractCalories(plan.planText || plan.plan || '')} kal</span>
              <span class="recent-feedback">{feedbackIcon(plan)}</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</UserLayout>

<style>
  /* ── Welcome Bar ── */
  .welcome-bar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
    flex-wrap: wrap;
  }
  .welcome-info { flex: 1; min-width: 200px; }
  .welcome-greeting {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-1);
    flex-wrap: wrap;
  }
  h1 {
    font-size: var(--fs-xl);
    font-weight: var(--fw-semibold);
    letter-spacing: var(--ls-tight);
  }
  .streak-badge {
    background: var(--accent-soft);
    color: var(--accent);
    font-size: var(--fs-xs);
    font-weight: var(--fw-semibold);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-pill);
    border: 1px solid var(--accent);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .welcome-sub {
    color: var(--text-subtle);
    font-size: var(--fs-sm);
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-wrap: wrap;
  }
  .macro-pill {
    background: var(--primary-soft);
    color: var(--primary);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-pill);
    font-size: var(--fs-xs);
    font-weight: var(--fw-medium);
    font-variant-numeric: tabular-nums;
  }

  /* ── Stats Grid ── */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--space-3);
    margin-bottom: var(--space-6);
  }

  /* ── Plan Section ── */
  .plan-section {
    background: var(--surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-elevation-1);
    overflow: hidden;
    margin-bottom: var(--space-4);
  }
  .cuisine-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4) var(--space-5);
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
    gap: var(--space-3);
  }
  .cuisine-left { display: flex; align-items: center; gap: var(--space-3); }
  .cuisine-emoji { font-size: var(--fs-2xl); line-height: 1; }
  .cuisine-label {
    display: block;
    font-size: var(--fs-xs);
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: var(--ls-wide);
    font-weight: var(--fw-medium);
  }
  .cuisine-name {
    font-size: var(--fs-lg);
    font-weight: var(--fw-semibold);
    color: var(--text);
    letter-spacing: var(--ls-snug);
    line-height: 1.2;
  }
  .plan-date {
    font-size: var(--fs-xs);
    color: var(--text-faint);
    white-space: nowrap;
  }
  .plan-body { padding: 0; }
  .plan-actions {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-6);
    flex-wrap: wrap;
  }

  /* ── Empty State ── */
  .empty-plan {
    text-align: center;
    padding: var(--space-12) var(--space-6);
    background: var(--surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-elevation-1);
    margin-bottom: var(--space-6);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
  }
  .empty-illustration {
    position: relative;
    width: 160px;
    height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .plate {
    font-size: 5rem;
    filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3));
  }
  .food-float {
    position: absolute;
    font-size: 1.75rem;
    opacity: 0.85;
    animation: float 3s ease-in-out infinite;
  }
  .food-float.f1 { top: 0; left: var(--space-2); animation-delay: 0s; }
  .food-float.f2 { top: var(--space-2); right: 0; animation-delay: 0.5s; }
  .food-float.f3 { bottom: var(--space-2); left: 0; animation-delay: 1s; }
  .food-float.f4 { bottom: 0; right: var(--space-2); animation-delay: 1.5s; }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .food-float { animation: none; }
  }
  .empty-plan h2 {
    font-size: var(--fs-xl);
    font-weight: var(--fw-semibold);
    color: var(--text);
  }
  .empty-text {
    color: var(--text-subtle);
    font-size: var(--fs-sm);
    line-height: var(--lh-relaxed);
    max-width: 420px;
  }

  /* ── Cooking Section (amber) ── */
  .cooking-section {
    background: var(--surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-elevation-1);
    overflow: hidden;
    margin-bottom: var(--space-6);
    border-left: 3px solid var(--accent);
  }
  .cooking-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--border);
    background: var(--accent-soft);
  }
  .cooking-icon { font-size: var(--fs-xl); }
  .cooking-header h3 {
    font-size: var(--fs-md);
    font-weight: var(--fw-semibold);
    color: var(--accent);
    line-height: 1.2;
  }
  .cooking-sub {
    display: block;
    font-size: var(--fs-xs);
    color: var(--text-faint);
  }
  .cooking-text {
    font-family: var(--font-sans);
    font-size: var(--fs-sm);
    line-height: var(--lh-relaxed);
    color: var(--text-muted);
    white-space: pre-wrap;
    padding: var(--space-5);
    margin: 0;
  }

  /* ── Recent Activity ── */
  .recent-section { margin-bottom: var(--space-6); }
  .section-title {
    font-size: var(--fs-sm);
    font-weight: var(--fw-semibold);
    color: var(--text-subtle);
    margin-bottom: var(--space-3);
    text-transform: uppercase;
    letter-spacing: var(--ls-wide);
  }
  .recent-list {
    background: var(--surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-elevation-1);
    overflow: hidden;
  }
  .recent-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--border);
    transition: background var(--duration-micro) var(--ease-standard);
  }
  .recent-row:first-child { border-top: none; }
  .recent-row:hover { background: var(--surface-2); }
  .recent-emoji { font-size: var(--fs-lg); flex-shrink: 0; }
  .recent-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0;
    min-width: 0;
  }
  .recent-cuisine {
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
    color: var(--text);
    text-transform: capitalize;
  }
  .recent-date {
    font-size: var(--fs-xs);
    color: var(--text-faint);
  }
  .recent-cal {
    font-size: var(--fs-xs);
    color: var(--primary);
    font-weight: var(--fw-medium);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .recent-feedback {
    font-size: var(--fs-sm);
    width: 28px;
    text-align: center;
    flex-shrink: 0;
  }

  /* ── Mobile ── */
  @media (max-width: 768px) {
    .welcome-bar { flex-direction: column; align-items: stretch; }
    .cuisine-header { flex-direction: column; align-items: flex-start; }
    .recent-row { flex-wrap: wrap; }
  }
</style>
