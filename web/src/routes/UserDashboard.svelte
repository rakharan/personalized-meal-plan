<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import UserLayout from '$lib/components/UserLayout.svelte';
  import Button from '$lib/components/Button.svelte';
  import Alert from '$lib/components/Alert.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import MealPlanView from '$lib/components/MealPlanView.svelte';

  let profile = $state<any>(null);
  let lastPlan = $state<any>(null);
  let recentPlans = $state<any[]>([]);
  let generating = $state(false);
  let cookingSteps = $state('');
  let cookingLoading = $state(false);
  let cookingDone = $state(false);
  let cookingLoadingDone = $state(false);
  let error = $state('');
  let loading = $state(true);
  let streak = $state(0);
  let groceryList = $state('');
  let groceryLoading = $state(false);
  let groceryWeek = $state('');
  let remixText = $state('');
  let remixLoading = $state(false);
  let remixInput = $state('');

  const isPro = $derived(profile?.tier === 'premium');

  async function loadProfile() {
    loading = true;
    try {
      await auth.fetchMe();
      profile = auth.user;
      const res = await fetch('/api/plans/history', { headers: auth.authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const p = data.plans?.[0];
        if (p) {
          lastPlan = { ...p, meals: p.meals || [] };
          // Cooked today if today's plan has cookedAt in WIB today
          cookingDone = isCookedToday(p.cookedAt);
        }
        recentPlans = data.plans?.slice(0, 3) || [];
        // Streak = current cooked streak if today's plan cooked, else count of
        // consecutive cooked days through yesterday (streak still alive until midnight)
        streak = data.streak || 0;
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
    cookingDone = false;
    // Clear current plan to show skeleton loading
    if (lastPlan) {
      lastPlan = { ...lastPlan, planText: '', meals: [] };
    }
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
      lastPlan = { planText: data.plan, cuisine: data.cuisine, created: new Date().toISOString(), meals: data.meals || [], cookedAt: null };
    } catch (e: any) {
      error = e.message;
      // Restore old plan on failure
      await loadProfile();
    } finally {
      generating = false;
    }
  }

  async function markCooked() {
    cookingLoadingDone = true;
    error = '';
    try {
      const res = await fetch('/api/plans/cook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth.authHeaders() },
        body: JSON.stringify({ planId: lastPlan?.id ?? null }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal simpan');
      }
      const data = await res.json();
      cookingDone = true;
      if (lastPlan) lastPlan.cookedAt = new Date().toISOString();
      streak = data.streak || 0;
    } catch (e: any) {
      error = e.message;
    } finally {
      cookingLoadingDone = false;
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

  async function getGroceryList() {
    groceryLoading = true;
    error = '';
    try {
      const res = await fetch('/api/plans/grocery-list', {
        method: 'POST',
        headers: auth.authHeaders(),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal ambil daftar belanja');
      }
      const data = await res.json();
      groceryList = data.list;
      groceryWeek = data.week;
    } catch (e: any) {
      error = e.message;
    } finally {
      groceryLoading = false;
    }
  }

  async function getRemix() {
    if (!remixInput.trim()) return;
    remixLoading = true;
    error = '';
    try {
      const res = await fetch('/api/plans/leftover-remix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth.authHeaders() },
        body: JSON.stringify({ leftovers: remixInput.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal ambil remix');
      }
      const data = await res.json();
      remixText = data.remix;
    } catch (e: any) {
      error = e.message;
    } finally {
      remixLoading = false;
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

  // ── Display helpers ──
  function goalLabel(goal: string): string {
    const map: Record<string, string> = {
      weight_loss: 'Turun berat badan',
      muscle_gain: 'Naik mass otot',
      maintenance: 'Maintenance',
    };
    return map[goal] || 'Makan sehat';
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

  function isCookedToday(cookedAt: string | null): boolean {
    if (!cookedAt) return false;
    return new Date(cookedAt).toDateString() === new Date().toDateString();
  }

  function feedbackIcon(plan: any): string {
    if (plan.feedback === 'love' || plan.rating === 5) return '😍';
    if (plan.feedback === 'like' || plan.rating >= 4) return '👍';
    if (plan.feedback === 'dislike' || plan.rating <= 2) return '👎';
    return '·';
  }

  let meals = $derived(lastPlan?.meals?.length ? lastPlan.meals : []);
  let totals = $derived(
    meals.reduce(
      (acc, meal: any) => {
        acc.kcal += meal.kcal || 0;
        acc.protein += meal.protein || 0;
        acc.carbs += meal.carbs || 0;
        acc.fat += meal.fat || 0;
        return acc;
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    ),
  );

  function extractCalories(text: string): string {
    if (!text) return '—';
    const m = text.match(/(\d+)\s*(?:kal|kcal|kkal)/i);
    return m ? m[1] : '—';
  }

  // Tomorrow's cuisine — cheap rotation guess from last plan (rotate to next in Masakan set)
  let tomorrowCuisine = $derived.by(() => {
    const cuisines = [
      { name: 'Masakan Indonesia', emoji: '🍛' },
      { name: 'Masakan Jepang', emoji: '🍱' },
      { name: 'Masakan Korea', emoji: '🍲' },
      { name: 'Masakan Mediterania', emoji: '🫒' },
      { name: 'Masakan Thai', emoji: '🍜' },
      { name: 'Masakan Vietnam', emoji: '🥢' },
      { name: 'Masakan India', emoji: '🫓' },
      { name: 'Masakan Meksiko', emoji: '🌮' },
    ];
    const cur = lastPlan?.cuisine?.toLowerCase() || '';
    const idx = cuisines.findIndex(c => cur.includes(c.name.toLowerCase().replace('masakan ', '')) || c.name.toLowerCase().includes(cur));
    const next = idx >= 0 ? cuisines[(idx + 1) % cuisines.length] : cuisines[0];
    return next;
  });
</script>

<UserLayout current="#/dashboard">
  {#if loading}
    <Skeleton rows={4} cols={3} />
  {:else if error}
    <Alert variant="danger" title="Error">{error}</Alert>
  {:else if profile}
    <!-- ═══ Streak bar ═══ -->
    {#if (streak || 0) > 0}
      <section class="streak-hero">
        <div class="streak-left">
          <span class="streak-flame" aria-hidden="true">🔥</span>
          <div>
            <div class="streak-num">{streak}</div>
            <div class="streak-label">hari beruntun</div>
          </div>
        </div>
        <div class="streak-right">
          <span class="streak-pct">{(streak / 7) * 100 > 100 ? 100 : Math.round((streak / 7) * 100)}%</span>
          <div class="streak-track"><div class="streak-fill" style="width: {Math.min((streak / 7) * 100, 100)}%"></div></div>
          <span class="streak-sub">menuju 7 hari</span>
        </div>
      </section>
    {/if}

    <!-- ═══ Welcome ═══ -->
    <div class="welcome-bar">
      <div class="welcome-info">
        <h1>Halo, {profile.full_name?.split(' ')[0] || 'Koki'}! 👋</h1>
        {#if isPro}
          <a href="#/pro" class="pro-badge-mini">Pro ✓</a>
        {/if}
        <p class="welcome-sub">
          {goalLabel(profile.goal)} ·
          <span class="macro-pill">{profile.target_calories || '—'} kal</span> ·
          <span class="macro-pill">{profile.target_protein || '—'}g protein</span>
        </p>
      </div>
    </div>

    <!-- ═══ Today Plan ═══ -->
    {#if lastPlan && (meals.length > 0 || generating)}
      <section class="today-plan" class:cooked={cookingDone}>
        <div class="today-plan-header">
          <div class="today-title">
            <h2>{isToday(lastPlan.created) ? 'Hari ini' : 'Terakhir'}</h2>
            <span class="today-date">{isToday(lastPlan.created) ? 'Baru saja' : fmtDate(lastPlan.created)}</span>
          </div>
          {#if cookingDone}
            <span class="cooked-badge">✓ Sudah masak</span>
          {:else}
            <span class="cuisine-tag">{cuisineEmoji(lastPlan.cuisine)} {lastPlan.cuisine || 'Rencana harian'}</span>
          {/if}
        </div>
        {#if !isToday(lastPlan.created)}
          <div class="stale-notice">
            <span>Ini plan kemarin.</span>
            <button class="stale-regen" onclick={generatePlan} disabled={generating}>
              {generating ? 'Lagi nyiapin...' : 'Bikin plan hari ini →'}
            </button>
          </div>
        {/if}

        <div class="plan-body">
          {#if generating}
            <div class="meals-grid">
              {#each [0, 1, 2] as i}
                <div class="skel-card">
                  <div class="skel-line skel-title"></div>
                  <div class="skel-line skel-w90"></div>
                  <div class="skel-line skel-w70"></div>
                </div>
              {/each}
            </div>
          {:else}
            <MealPlanView bind:planText={lastPlan.planText} bind:meals={lastPlan.meals} {isPro} />
          {/if}
        </div>

        <div class="today-plan-footer">
          <span class="total-macros">
            Target: {profile.target_calories || '—'} kal · {profile.target_protein || '—'}g protein
          </span>
          <div class="footer-actions">
            {#if !cookingDone}
              <Button variant="primary" size="lg" loading={cookingLoadingDone} onclick={markCooked}>
                ✓ Sudah masak
              </Button>
            {/if}
            <Button variant="secondary" loading={cookingLoading} onclick={getCookingSteps}>
              🍳 Panduan Masak
            </Button>
            <Button variant="secondary" loading={groceryLoading} onclick={getGroceryList}>
              🛒 Belanja
            </Button>
            {#if isPro}
              <div class="remix-row">
                <input
                  class="remix-input"
                  type="text"
                  placeholder="Sisa: ayam 2 potong, nasi 1 mangkuk..."
                  bind:value={remixInput}
                  onkeydown={(e) => e.key === 'Enter' && getRemix()}
                />
                <Button variant="secondary" loading={remixLoading} onclick={getRemix} disabled={!remixInput.trim()}>
                  ♻️ Remix
                </Button>
              </div>
            {/if}
          </div>
        </div>
      </section>

      <!-- ═══ Regenerate: escape valve, small ═══ -->
      <div class="regen-row">
        <button class="regen-link" onclick={generatePlan} disabled={generating}>
          {#if generating}Lagi nyiapin...{:else}Ganti rencana hari ini ↻{/if}
        </button>
      </div>

      <!-- ═══ Tomorrow preview ═══ -->
      <div class="tomorrow-preview">
        <span class="tomorrow-label">Besok</span>
        <span class="tomorrow-cuisine">{tomorrowCuisine.emoji} {tomorrowCuisine.name}</span>
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
          Belum ada rencana makan. Satu klik aja — nasi merah, ayam bakar,
          sayur asem, tempe orek... semua siap diatur.
        </p>
        <Button variant="primary" size="lg" loading={generating} onclick={generatePlan}>
          🍽️ Bikin Rencana Pertama
        </Button>
      </section>
    {/if}

    <!-- ═══ Cooking Guide ═══ -->
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

    <!-- ═══ Grocery List ═══ -->
    {#if groceryList}
      <section class="cooking-section">
        <div class="cooking-header" style="background: var(--primary-soft); border-left-color: var(--primary);">
          <span class="cooking-icon">🛒</span>
          <div>
            <h3 style="color: var(--primary);">Daftar Belanja</h3>
            <span class="cooking-sub">{groceryWeek}</span>
          </div>
        </div>
        <pre class="cooking-text">{groceryList}</pre>
      </section>
    {/if}

    <!-- ═══ Leftover Remix ═══ -->
    {#if remixText}
      <section class="cooking-section" style="border-left-color: var(--leaf-400);">
        <div class="cooking-header" style="background: var(--primary-soft);">
          <span class="cooking-icon">♻️</span>
          <div>
            <h3 style="color: var(--leaf-400);">Sisa Kemarin</h3>
            <span class="cooking-sub">Meal baru dari bahan kemarin</span>
          </div>
        </div>
        <pre class="cooking-text">{remixText}</pre>
      </section>
    {/if}

    <!-- ═══ Recent Activity ═══ -->
    {#if recentPlans.length > 1}
      <section class="recent-section">
        <h3 class="section-title">Rencana Terakhir</h3>
        <div class="recent-list">
          {#each recentPlans as plan, i}
            <div class="recent-row" class:first={i === 0}>
              <span class="recent-emoji">{cuisineEmoji(plan.cuisine)}</span>
              <div class="recent-main">
                <span class="recent-cuisine">{plan.cuisine || '—'}</span>
                <span class="recent-date">{fmtDate(plan.created)}</span>
              </div>
              <span class="recent-cal">{extractCalories(plan.planText || plan.plan || '')} kal</span>
              {#if plan.cookedAt}
                <span class="recent-cooked" title="Sudah dimasak">✓</span>
              {/if}
              <span class="recent-feedback">{feedbackIcon(plan)}</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</UserLayout>

<style>
  /* ── Streak hero ── */
  .streak-hero {
    display: flex; justify-content: space-between; align-items: center;
    gap: var(--space-6); padding: var(--space-5) var(--space-6);
    background: linear-gradient(135deg, var(--primary), var(--leaf-400));
    border-radius: 24px 28px 20px 32px; margin-bottom: var(--space-6);
    color: var(--text-on-primary); position: relative; overflow: hidden;
  }
  .streak-hero::before {
    content: ''; position: absolute; top: -60%; right: -10%;
    width: 240px; height: 240px; background: rgba(255, 255, 255, .12);
    border-radius: 50%;
  }
  .streak-left { display: flex; align-items: center; gap: var(--space-3); position: relative; z-index: 1; }
  .streak-flame { font-size: var(--fs-2xl); }
  .streak-num { font-size: var(--fs-2xl); font-weight: var(--fw-bold); line-height: 1; font-family: var(--font-mono); }
  .streak-label { font-size: var(--fs-sm); opacity: .9; }
  .streak-right { text-align: right; position: relative; z-index: 1; min-width: 140px; }
  .streak-pct { font-size: var(--fs-xs); font-weight: var(--fw-semibold); opacity: .95; }
  .streak-track { height: 6px; background: rgba(255, 255, 255, .25); border-radius: var(--radius-pill); margin: var(--space-1) 0; overflow: hidden; }
  .streak-fill { height: 100%; background: var(--text-on-primary); border-radius: var(--radius-pill); transition: width .6s var(--ease-standard); }
  .streak-sub { font-size: var(--fs-xs); opacity: .8; }

  /* ── Welcome ── */
  .welcome-bar { margin-bottom: var(--space-5); }
  h1 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); letter-spacing: var(--ls-tight); margin-bottom: var(--space-1); }
  .welcome-sub { color: var(--text-subtle); font-size: var(--fs-sm); display: flex; align-items: center; gap: var(--space-1); flex-wrap: wrap; }
  .macro-pill {
    background: var(--primary-soft); color: var(--primary);
    padding: var(--space-1) var(--space-2); border-radius: var(--radius-pill);
    font-size: var(--fs-xs); font-weight: var(--fw-medium); font-variant-numeric: tabular-nums;
  }
  .pro-badge-mini {
    display: inline-flex; margin-left: var(--space-2);
    background: linear-gradient(135deg, var(--accent), var(--amber-400));
    color: var(--brown-900); padding: 2px var(--space-2);
    border-radius: var(--radius-pill); font-size: var(--fs-xs);
    font-weight: var(--fw-bold); text-decoration: none; vertical-align: middle;
  }
  .pro-badge-mini:hover { filter: brightness(1.1); }

  /* ── Today Plan ── */
  .today-plan {
    background: var(--surface); border-radius: 24px 28px 20px 32px;
    box-shadow: var(--shadow-elevation-1); overflow: hidden;
    margin-bottom: var(--space-3); position: relative;
    border: 1px solid var(--border);
    transition: border-color var(--duration-micro) var(--ease-standard);
  }
  .today-plan::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
    background: linear-gradient(90deg, var(--primary), var(--accent), var(--primary), var(--accent));
    background-size: 300% 100%; animation: shimmer 6s linear infinite;
  }
  .today-plan.cooked::before { background: var(--primary); animation: none; }
  @keyframes shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
  }
  .today-plan-header {
    display: flex; justify-content: space-between; align-items: center;
    gap: var(--space-3); padding: var(--space-4) var(--space-5) 0; flex-wrap: wrap;
  }
  .today-title { display: flex; align-items: baseline; gap: var(--space-3); }
  .today-title h2 { font-size: var(--fs-xl); font-weight: var(--fw-bold); letter-spacing: var(--ls-snug); }
  .today-date { font-size: var(--fs-xs); color: var(--text-faint); }
  .stale-notice {
    display: flex; align-items: center; justify-content: center; gap: var(--space-3);
    margin: var(--space-3) var(--space-5) 0; padding: var(--space-2) var(--space-3);
    background: var(--accent-soft); border-radius: var(--radius-md);
    font-size: var(--fs-sm); color: var(--accent);
  }
  .stale-regen {
    background: none; border: none; cursor: pointer;
    color: var(--accent); font-weight: var(--fw-semibold); font-size: var(--fs-sm);
    font-family: inherit; text-decoration: underline;
  }
  .stale-regen:hover { color: var(--amber-400); }
  .stale-regen:disabled { opacity: .5; cursor: wait; }
  .cuisine-tag {
    background: linear-gradient(135deg, var(--primary-soft), var(--accent-soft));
    color: var(--primary); padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-pill); font-size: var(--fs-xs); font-weight: var(--fw-semibold);
  }
  .cooked-badge {
    background: var(--primary); color: var(--text-on-primary);
    padding: var(--space-1) var(--space-3); border-radius: var(--radius-pill);
    font-size: var(--fs-xs); font-weight: var(--fw-semibold);
  }
  .plan-body { padding: var(--space-4) var(--space-5) 0; }
  .today-plan-footer {
    display: flex; justify-content: space-between; align-items: center;
    gap: var(--space-3); flex-wrap: wrap;
    padding: var(--space-4) var(--space-5) var(--space-5);
    margin-top: var(--space-4); border-top: 1px solid var(--border);
  }
  .total-macros {
    font-family: var(--font-mono); font-size: var(--fs-md); font-weight: var(--fw-medium);
    color: var(--primary); font-variant-numeric: tabular-nums;
  }
  .footer-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .remix-row { display: flex; gap: var(--space-2); flex: 1; min-width: 240px; }
  .remix-input {
    flex: 1; padding: var(--space-2) var(--space-3);
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: var(--radius-sm); color: var(--text);
    font-size: var(--fs-sm); font-family: inherit; min-height: 44px;
  }
  .remix-input:focus { outline: 2px solid var(--primary); outline-offset: 1px; border-color: var(--primary); }

  /* Regenerate — subtle escape valve */
  .regen-row { text-align: center; margin: var(--space-2) 0 var(--space-5); }
  .regen-link {
    background: none; border: none; cursor: pointer;
    color: var(--text-faint); font-size: var(--fs-sm); font-family: inherit;
    border-bottom: 1px dashed var(--border-strong); padding-bottom: 2px;
    transition: color var(--duration-micro) var(--ease-standard);
  }
  .regen-link:hover { color: var(--text-subtle); }
  .regen-link:disabled { opacity: .5; cursor: wait; }

  /* ── Tomorrow preview ── */
  .tomorrow-preview {
    display: flex; justify-content: center; align-items: center; gap: var(--space-2);
    padding: var(--space-4) var(--space-5);
    background: var(--surface-2); border-radius: 20px 24px 16px 28px;
    border: 1px solid var(--border); margin-bottom: var(--space-6);
  }
  .tomorrow-label { font-size: var(--fs-xs); color: var(--text-faint); text-transform: uppercase; letter-spacing: var(--ls-wide); font-weight: var(--fw-medium); }
  .tomorrow-cuisine { font-size: var(--fs-md); font-weight: var(--fw-semibold); color: var(--text); }

  /* ── Empty State ── */
  .empty-plan {
    text-align: center; padding: var(--space-12) var(--space-6);
    background: var(--surface); border-radius: 24px 28px 20px 32px;
    box-shadow: var(--shadow-elevation-1); margin-bottom: var(--space-6);
    display: flex; flex-direction: column; align-items: center; gap: var(--space-4);
    border: 1px solid var(--border);
  }
  .empty-illustration { position: relative; width: 160px; height: 160px; display: flex; align-items: center; justify-content: center; }
  .plate { font-size: 5rem; filter: drop-shadow(0 4px 12px rgba(0, 0, 0, .3)); }
  .food-float { position: absolute; font-size: 1.75rem; opacity: .85; animation: float 3s ease-in-out infinite; }
  .food-float.f1 { top: 0; left: var(--space-2); animation-delay: 0s; }
  .food-float.f2 { top: var(--space-2); right: 0; animation-delay: .5s; }
  .food-float.f3 { bottom: var(--space-2); left: 0; animation-delay: 1s; }
  .food-float.f4 { bottom: 0; right: var(--space-2); animation-delay: 1.5s; }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  @media (prefers-reduced-motion: reduce) { .food-float { animation: none; } }
  .empty-plan h2 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); }
  .empty-text { color: var(--text-subtle); font-size: var(--fs-sm); line-height: var(--lh-relaxed); max-width: 420px; }

  /* ── Cooking Guide ── */
  .cooking-section {
    background: var(--surface); border-radius: 20px 24px 16px 28px;
    box-shadow: var(--shadow-elevation-1); overflow: hidden;
    margin-bottom: var(--space-6); border: 1px solid var(--border); border-left: 3px solid var(--accent);
  }
  .cooking-header {
    display: flex; align-items: center; gap: var(--space-3);
    padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--border);
    background: var(--accent-soft);
  }
  .cooking-icon { font-size: var(--fs-xl); }
  .cooking-header h3 { font-size: var(--fs-md); font-weight: var(--fw-semibold); color: var(--accent); line-height: 1.2; }
  .cooking-sub { display: block; font-size: var(--fs-xs); color: var(--text-faint); }
  .cooking-text {
    font-family: var(--font-sans); font-size: var(--fs-sm); line-height: var(--lh-relaxed);
    color: var(--text-muted); white-space: pre-wrap; padding: var(--space-5); margin: 0;
  }

  /* ── Recent ── */
  .recent-section { margin-bottom: var(--space-6); }
  .section-title {
    font-size: var(--fs-sm); font-weight: var(--fw-semibold); color: var(--text-subtle);
    margin-bottom: var(--space-3); text-transform: uppercase; letter-spacing: var(--ls-wide);
  }
  .recent-list {
    background: var(--surface); border-radius: 20px 24px 16px 28px;
    box-shadow: var(--shadow-elevation-1); overflow: hidden; border: 1px solid var(--border);
  }
  .recent-row {
    display: flex; align-items: center; gap: var(--space-3);
    padding: var(--space-3) var(--space-4); border-top: 1px solid var(--border);
    transition: background var(--duration-micro) var(--ease-standard);
  }
  .recent-row:first-child { border-top: none; }
  .recent-row:hover { background: var(--surface-2); }
  .recent-emoji { font-size: var(--fs-lg); flex-shrink: 0; }
  .recent-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .recent-cuisine { font-size: var(--fs-sm); font-weight: var(--fw-medium); text-transform: capitalize; }
  .recent-date { font-size: var(--fs-xs); color: var(--text-faint); }
  .recent-cal { font-size: var(--fs-xs); color: var(--primary); font-weight: var(--fw-medium); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .recent-cooked {
    width: 22px; height: 22px; border-radius: 50%; background: var(--primary);
    color: var(--text-on-primary); font-size: var(--fs-xs); display: flex;
    align-items: center; justify-content: center; flex-shrink: 0;
  }
  .recent-feedback { font-size: var(--fs-sm); width: 28px; text-align: center; flex-shrink: 0; }

  /* Skeleton */
  .skel-line {
    background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%);
    background-size: 200% 100%; border-radius: var(--radius-sm);
    animation: shimmer 1.5s infinite;
  }
  .skel-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius-md); padding: var(--space-4);
    display: flex; flex-direction: column; gap: var(--space-3);
  }
  .skel-title { height: 20px; width: 120px; }
  .skel-w90 { height: 14px; width: 90%; }
  .skel-w70 { height: 14px; width: 70%; }
  .meals-grid { display: grid; grid-template-columns: 1fr; gap: var(--space-3); }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  @media (prefers-reduced-motion: reduce) { .skel-line { animation: none; } }

  @media (max-width: 768px) {
    .streak-hero { flex-direction: column; align-items: flex-start; gap: var(--space-3); }
    .streak-right { text-align: left; width: 100%; }
    .today-plan-footer { flex-direction: column; align-items: stretch; }
    .footer-actions { justify-content: stretch; }
    .footer-actions :global(.btn) { flex: 1; }
  }
</style>
