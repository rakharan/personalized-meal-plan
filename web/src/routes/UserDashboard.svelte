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
</script>

<UserLayout current="#/dashboard">
  {#if loading}
    <Skeleton rows={4} cols={3} />
  {:else if error}
    <Alert variant="danger" title="Error">{error}</Alert>
  {:else if profile}
    <div class="welcome-bar">
      <div>
        <h1>Halo, {profile.full_name}! 👋</h1>
        <p class="welcome-sub">{profile.goal === 'weight_loss' ? 'Turun berat badan' : profile.goal === 'muscle_gain' ? 'Naik mass otot' : profile.goal === 'maintenance' ? 'Maintenance' : 'Makan sehat'} · {profile.target_calories || '—'} kal · {profile.target_protein || '—'}g protein</p>
      </div>
      <Button variant="primary" loading={generating} onclick={generatePlan}>
        {generating ? 'Bikin...' : lastPlan ? '🎲 Rencana Baru' : '🍽️ Bikin Rencana Pertama'}
      </Button>
    </div>

    {#if lastPlan}
      <div class="plan-card">
        <div class="plan-header">
          <h3>Rencana Terakhir</h3>
          <span class="plan-date">{fmtDate(lastPlan.created)}</span>
        </div>
        <div class="plan-body">
          <MealPlanView bind:planText={lastPlan.planText} />
        </div>
      </div>

      <div class="plan-actions">
        <Button variant="secondary" loading={cookingLoading} onclick={getCookingSteps}>
          🍳 {cookingSteps ? 'Panduan Masak Ulang' : 'Panduan Masak'}
        </Button>
      </div>

      {#if cookingSteps}
        <div class="cooking-card">
          <div class="cooking-header">
            <h3>🍳 Panduan Masak</h3>
          </div>
          <pre class="cooking-text">{cookingSteps}</pre>
        </div>
      {/if}
    {:else if !generating}
      <div class="empty-plan">
        <div class="empty-icon">🍽️</div>
        <h3>Belum ada rencana makan</h3>
        <p>Klik tombol di atas buat bikin rencana pertamamu!</p>
      </div>
    {/if}

    <div class="stats-grid">
      <StatCard value={profile.meals_per_day || 3} label="Makan per Hari" icon="🍴" />
      <StatCard value={profile.cuisine_rotation === 'rotate' ? 'Rotate' : profile.cuisine_rotation} label="Masakan" icon="🥘" />
      <StatCard value={profile.budget_tier} label="Budget" icon="💰" />
    </div>
  {/if}
</UserLayout>

<style>
  .welcome-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); gap: var(--space-4); flex-wrap: wrap; }
  h1 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-1); }
  .welcome-sub { color: var(--text-subtle); font-size: var(--fs-sm); }
  .plan-card { background: var(--surface); border-radius: var(--radius-md); box-shadow: var(--shadow-elevation-1); overflow: hidden; margin-bottom: var(--space-4); }
  .plan-header { display: flex; justify-content: space-between; padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--border); }
  .plan-header h3 { font-size: var(--fs-sm); font-weight: var(--fw-semibold); color: var(--text-subtle); }
  .plan-date { font-size: var(--fs-xs); color: var(--text-faint); }
  .plan-body { padding: 0; }
  .plan-actions { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); flex-wrap: wrap; }
  .cooking-card { background: var(--surface); border-radius: var(--radius-md); box-shadow: var(--shadow-elevation-1); overflow: hidden; margin-bottom: var(--space-6); }
  .cooking-header { padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--border); background: var(--accent-soft); }
  .cooking-header h3 { font-size: var(--fs-sm); font-weight: var(--fw-semibold); color: var(--accent); }
  .cooking-text { font-family: var(--font-sans); font-size: var(--fs-sm); line-height: var(--lh-relaxed); color: var(--text-muted); white-space: pre-wrap; padding: var(--space-5); margin: 0; }
  .empty-plan { text-align: center; padding: var(--space-12) var(--space-6); background: var(--surface); border-radius: var(--radius-md); margin-bottom: var(--space-6); }
  .empty-icon { font-size: 4rem; margin-bottom: var(--space-3); }
  .empty-plan h3 { font-size: var(--fs-md); margin-bottom: var(--space-1); }
  .empty-plan p { color: var(--text-subtle); font-size: var(--fs-sm); }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: var(--space-3); }
  @media (max-width: 768px) {
    .welcome-bar { flex-direction: column; align-items: stretch; }
  }
</style>
