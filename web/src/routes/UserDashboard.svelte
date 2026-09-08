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
        const p = data.plans?.[0];
        if (p) {
          lastPlan = { ...p, meals: p.meals || [] };
        }
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
      lastPlan = { planText: data.plan, cuisine: data.cuisine, created: new Date().toISOString(), meals: data.meals || [] };
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

  // ── Plate helpers ──

  interface Meal {
    name: string;
    body: string;
    macros?: string;
    start: number;
    end: number;
  }

  // Parse meals from plan text (same logic as MealPlanView, kept here for plate segments)
  function parseMeals(text: string): Meal[] {
    if (!text) return [];
    const mealRegex = /(?:^|\n)(?:🍳|🍱|🌙|☀️|🌅|🥗|🍲)?\s*((?:Sarapan|Breakfast|Makan\s+siang|Lunch|Makan\s+malam|Dinner|Snack|Camilan|Brunch))[^\n]*/gi;
    const splits: { name: string; start: number }[] = [];
    let match;
    while ((match = mealRegex.exec(text)) !== null) {
      splits.push({ name: match[1].trim(), start: match.index });
    }
    if (splits.length === 0) return [];
    const result: Meal[] = [];
    for (let i = 0; i < splits.length; i++) {
      const start = splits[i].start;
      const end = i + 1 < splits.length ? splits[i + 1].start : text.length;
      const chunk = text.slice(start, end).trim();
      const macroMatch = chunk.match(/(~?\d+\s*(?:kal|kcal|kkal|cal).*?protein.*?\d+\s*g)/i);
      const macros = macroMatch ? macroMatch[1] : '';
      const body = chunk.replace(mealRegex, '').trim();
      result.push({ name: splits[i].name, body: body || chunk, macros, start, end });
    }
    return result;
  }

  // Determine plate position: morning=top, lunch=right, dinner=bottom, snack=left
  function mealPosition(name: string): { angle: number; label: string } {
    const key = name.toLowerCase();
    if (key.includes('sarapan') || key.includes('breakfast') || key.includes('brunch'))
      return { angle: 0, label: '07:00' }; // top
    if (key.includes('siang') || key.includes('lunch'))
      return { angle: 90, label: '12:00' }; // right
    if (key.includes('malam') || key.includes('dinner'))
      return { angle: 180, label: '18:00' }; // bottom
    return { angle: 270, label: '15:00' }; // left (snack/camilan)
  }

  // Segment color from tokens — rotate through warm palette
  function mealColor(idx: number): string {
    const colors = [
      'var(--leaf-500)',   // green
      'var(--amber-500)',  // amber
      'var(--cream-200)',  // cream
      'var(--leaf-400)',   // light green
      'var(--amber-400)',  // light amber
      'var(--cream-100)',  // light cream
    ];
    return colors[idx % colors.length];
  }

  // Extract kcal + protein from macros string
  function macrosOf(meal: Meal): { kcal: number; protein: number } {
    const m = meal.macros || '';
    const kcalMatch = m.match(/~?(\d+)\s*(?:kal|kcal|kkal|cal)/i);
    const proteinMatch = m.match(/protein\s*~?(\d+)\s*g/i);
    return {
      kcal: kcalMatch ? parseInt(kcalMatch[1], 10) : 0,
      protein: proteinMatch ? parseInt(proteinMatch[1], 10) : 0,
    };
  }

  // Parsed meals for plate + derived totals
  let meals = $derived(parseMeals(lastPlan?.planText || ''));
  let totals = $derived(
    meals.reduce(
      (acc, meal) => {
        const m = macrosOf(meal);
        acc.kcal += m.kcal;
        acc.protein += m.protein;
        return acc;
      },
      { kcal: 0, protein: 0 },
    ),
  );

  // Selected segment for detail view
  let selectedMealIdx = $state<number | null>(null);

  // Build conic-gradient string for plate segments
  let plateGradient = $derived.by(() => {
    if (meals.length === 0) return 'var(--surface-2)';
    // Build sorted segments by angle, then create gradient stops
    const segments = meals.map((m, i) => ({ ...mealPosition(m.name), idx: i, color: mealColor(i) }));
    segments.sort((a, b) => a.angle - b.angle);
    const slice = 360 / segments.length;
    const stops: string[] = [];
    segments.forEach((seg, i) => {
      const start = seg.angle - slice / 2;
      const end = seg.angle + slice / 2;
      const sStart = ((start % 360) + 360) % 360;
      const sEnd = ((end % 360) + 360) % 360;
      // Handle wrap for first/last segment
      if (i === 0 && sStart > sEnd) {
        // Split at 0
        stops.push(`${seg.color} ${sStart}deg 360deg`);
        stops.push(`${seg.color} 0deg ${sEnd}deg`);
      } else {
        stops.push(`${seg.color} ${sStart}deg ${sEnd}deg`);
      }
    });
    return `conic-gradient(from -${slice / 2}deg, ${stops.join(', ')})`;
  });

  // Convert angle to label position (polar to cartesian for time labels)
  function labelPos(angle: number, radius: number): { x: number; y: number } {
    const rad = (angle - 90) * (Math.PI / 180);
    return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
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

    <!-- ═══ Plate Section ═══ -->
    {#if lastPlan && meals.length > 0}
      <section class="plate-section">
        <!-- Streak bar above plate -->
        {#if (profile.streak_days || 0) > 0}
          <div class="streak-bar" style="--streak-pct: {Math.min((profile.streak_days / 7) * 100, 100)}%">
            <span class="streak-bar-label">🔥 {profile.streak_days} hari beruntun</span>
            <div class="streak-bar-fill"></div>
          </div>
        {/if}

        <div class="plate-wrap">
          <!-- Time labels positioned around plate -->
          {#each [{ a: 0, l: '07:00' }, { a: 90, l: '12:00' }, { a: 180, l: '18:00' }, { a: 270, l: '15:00' }] as tl}
            {@const pos = labelPos(tl.a, 42)}
            <span class="time-label" style="left: {pos.x}%; top: {pos.y}%;">{tl.l}</span>
          {/each}

          <!-- Plate itself -->
          <div class="plate" style="background: {plateGradient};">
            <!-- Inner circle = plate well -->
            <div class="plate-inner">
              {#each meals as meal, i (meal.name + i)}
                {@const pos = mealPosition(meal.name)}
                {@const lp = labelPos(pos.angle, 28)}
                <button
                  class="segment-label"
                  class:active={selectedMealIdx === i}
                  style="left: {lp.x}%; top: {lp.y}%; --seg-color: {mealColor(i)};"
                  onclick={() => selectedMealIdx = selectedMealIdx === i ? null : i}
                  aria-label="Lihat {meal.name}"
                >
                  <span class="seg-emoji">{meal.name.match(/Sarapan|Breakfast/) ? '🍳' : meal.name.match(/siang|Lunch/) ? '🍱' : meal.name.match(/malam|Dinner/) ? '🍲' : '🥗'}</span>
                  <span class="seg-name">{meal.name}</span>
                </button>
              {/each}
            </div>
          </div>
        </div>

        <!-- Summary line -->
        <div class="summary-line">
          <span class="summary-item">{meals.length} meals</span>
          <span class="summary-sep">·</span>
          <span class="summary-item summary-kcal">{totals.kcal || extractCalories(lastPlan.planText)} cal</span>
          <span class="summary-sep">·</span>
          <span class="summary-item summary-protein">{totals.protein}g protein</span>
          <span class="summary-sep">·</span>
          <span class="summary-item summary-streak">Day {profile.streak_days || 0}</span>
        </div>
      </section>

      <!-- ═══ Meal Details (selected or all) ═══ -->
      <section class="meal-details">
        {#if selectedMealIdx !== null && meals[selectedMealIdx]}
          <div class="detail-header">
            <button class="detail-back" onclick={() => selectedMealIdx = null}>← Semua</button>
            <span class="detail-cuisine">{cuisineEmoji(lastPlan.cuisine)} {lastPlan.cuisine || 'Rencana'}</span>
            <span class="detail-date">{isToday(lastPlan.created) ? 'Baru saja' : fmtDate(lastPlan.created)}</span>
          </div>
          <div class="detail-body">
            {#if meals[selectedMealIdx]}
              {@const meal = meals[selectedMealIdx]}
              {@const m = macrosOf(meal)}
            <h3 class="detail-meal-name">{meal.name}</h3>
            {#if m.kcal > 0 || m.protein > 0}
              <div class="detail-macros">
                {#if m.kcal > 0}<span class="dm-kcal">{m.kcal} kal</span>{/if}
                {#if m.protein > 0}<span class="dm-protein">{m.protein}g protein</span>{/if}
              </div>
            {/if}
            <pre class="detail-text">{meal.body}</pre>
            {/if}
          </div>
          <div class="plan-actions">
            <Button variant="secondary" loading={cookingLoading} onclick={getCookingSteps}>
              🍳 {cookingSteps ? 'Panduan Masak Ulang' : 'Panduan Masak'}
            </Button>
          </div>
        {:else}
          <div class="detail-header">
            <div class="detail-cuisine">
              <span class="cuisine-emoji">{cuisineEmoji(lastPlan.cuisine)}</span>
              <div>
                <span class="cuisine-label">Hari Ini</span>
                <h2 class="cuisine-name">{lastPlan.cuisine || 'Rencana Harian'}</h2>
              </div>
            </div>
            <span class="detail-date">{isToday(lastPlan.created) ? 'Baru saja' : fmtDate(lastPlan.created)}</span>
          </div>
          <div class="plan-body">
            <MealPlanView bind:planText={lastPlan.planText} bind:meals={lastPlan.meals} />
          </div>
          <div class="plan-actions">
            <Button variant="secondary" loading={cookingLoading} onclick={getCookingSteps}>
              🍳 {cookingSteps ? 'Panduan Masak Ulang' : 'Panduan Masak'}
            </Button>
          </div>
        {/if}
      </section>
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
          Belum ada rencana makan. Bayangkan saja satu kali klik —
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

  /* ── Plate Section ── */
  .plate-section {
    background: var(--surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-elevation-1);
    overflow: hidden;
    margin-bottom: var(--space-4);
    padding: var(--space-6) var(--space-5);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-5);
  }

  /* Streak bar — thin amber gradient above plate */
  .streak-bar {
    width: 100%;
    max-width: 280px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
  }
  .streak-bar-label {
    font-size: var(--fs-xs);
    color: var(--accent);
    font-weight: var(--fw-medium);
    font-variant-numeric: tabular-nums;
  }
  .streak-bar-fill {
    width: 100%;
    height: 4px;
    background: var(--surface-3);
    border-radius: var(--radius-pill);
    position: relative;
    overflow: hidden;
  }
  .streak-bar-fill::after {
    content: '';
    position: absolute;
    left: 0; top: 0;
    width: var(--streak-pct, 50%);
    height: 100%;
    background: linear-gradient(90deg, var(--amber-600), var(--amber-400));
    border-radius: var(--radius-pill);
  }

  /* Plate wrap — holds plate + labels */
  .plate-wrap {
    position: relative;
    width: 280px;
    height: 280px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  @media (min-width: 480px) {
    .plate-wrap { width: 320px; height: 320px; }
  }

  /* Time labels around plate */
  .time-label {
    position: absolute;
    font-size: var(--fs-xs);
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    transform: translate(-50%, -50%);
    white-space: nowrap;
  }

  /* The plate — circular conic-gradient */
  .plate {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    position: relative;
    box-shadow:
      0 0 0 4px var(--surface-2),
      0 8px 24px rgba(0,0,0,0.3);
    transition: filter var(--duration-small) var(--ease-standard);
  }
  .plate:hover {
    filter: brightness(1.05);
  }

  /* Inner well of plate */
  .plate-inner {
    position: absolute;
    inset: 18%;
    border-radius: 50%;
    background: var(--surface);
    box-shadow: inset 0 0 0 2px var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Segment labels — clickable meal markers inside plate */
  .segment-label {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    transform: translate(-50%, -50%);
    background: var(--surface-2);
    border: 2px solid var(--seg-color, var(--border-strong));
    border-radius: var(--radius-pill);
    padding: var(--space-1) var(--space-2);
    cursor: pointer;
    transition: all var(--duration-micro) var(--ease-standard);
    font-family: inherit;
    z-index: 2;
  }
  .segment-label:hover {
    background: var(--surface-3);
    transform: translate(-50%, -50%) scale(1.1);
  }
  .segment-label.active {
    background: var(--seg-color);
    box-shadow: 0 0 0 3px var(--accent);
  }
  .seg-emoji {
    font-size: var(--fs-md);
    line-height: 1;
  }
  .seg-name {
    font-size: var(--fs-xs);
    font-weight: var(--fw-medium);
    color: var(--text);
    text-transform: capitalize;
    white-space: nowrap;
  }

  /* Summary line — single row, mono tabular-nums */
  .summary-line {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: var(--fs-sm);
    color: var(--text-muted);
    flex-wrap: wrap;
    justify-content: center;
  }
  .summary-sep { color: var(--text-faint); }
  .summary-kcal { color: var(--primary); font-weight: var(--fw-medium); }
  .summary-protein { color: var(--accent); font-weight: var(--fw-medium); }
  .summary-streak { color: var(--text-subtle); }

  /* ── Meal Details ── */
  .meal-details {
    background: var(--surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-elevation-1);
    overflow: hidden;
    margin-bottom: var(--space-4);
  }
  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4) var(--space-5);
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .detail-back {
    background: none;
    border: none;
    color: var(--primary);
    font-family: inherit;
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
    cursor: pointer;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    transition: background var(--duration-micro) var(--ease-standard);
  }
  .detail-back:hover { background: var(--primary-soft); }
  .detail-cuisine {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex: 1;
  }
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
  .detail-date {
    font-size: var(--fs-xs);
    color: var(--text-faint);
    white-space: nowrap;
  }
  .detail-body { padding: var(--space-5); }
  .detail-meal-name {
    font-size: var(--fs-lg);
    font-weight: var(--fw-semibold);
    color: var(--primary);
    text-transform: capitalize;
    margin-bottom: var(--space-2);
  }
  .detail-macros {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
    flex-wrap: wrap;
  }
  .dm-kcal {
    background: var(--primary-soft);
    color: var(--primary);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-pill);
    font-size: var(--fs-xs);
    font-weight: var(--fw-semibold);
    font-variant-numeric: tabular-nums;
  }
  .dm-protein {
    background: var(--accent-soft);
    color: var(--accent);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-pill);
    font-size: var(--fs-xs);
    font-weight: var(--fw-semibold);
    font-variant-numeric: tabular-nums;
  }
  .detail-text {
    font-family: var(--font-sans);
    font-size: var(--fs-sm);
    line-height: var(--lh-relaxed);
    color: var(--text-muted);
    white-space: pre-wrap;
    margin: 0;
  }
  .plan-body { padding: 0; }
  .plan-actions {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-6);
    flex-wrap: wrap;
    padding: 0 var(--space-5) var(--space-4);
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
    .detail-header { flex-direction: column; align-items: flex-start; }
    .recent-row { flex-wrap: wrap; }
    .plate-wrap { width: 240px; height: 240px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .segment-label, .plate { transition: none; }
    .segment-label:hover { transform: translate(-50%, -50%); }
  }
</style>
