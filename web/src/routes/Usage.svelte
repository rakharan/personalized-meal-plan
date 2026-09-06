<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/stores/api.svelte';
  import DashboardLayout from '$lib/components/DashboardLayout.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import StatCard from '$lib/components/StatCard.svelte';
  import Alert from '$lib/components/Alert.svelte';

  let data = $state<any>(null);
  let error = $state('');
  let loading = $state(true);

  async function load() {
    loading = true;
    try { data = await api.getUsage(); } catch (e: any) { error = e.message; } finally { loading = false; }
  }

  onMount(load);

  const columns = [
    { key: 'chatId', label: 'Chat ID' },
    { key: 'tier', label: 'Tier' },
    { key: 'feature', label: 'Feature' },
    { key: 'tokens', label: 'Tokens' },
    { key: 'created', label: 'Created' },
  ];
</script>

<DashboardLayout title="Token Usage" current="#/admin/usage">
  {#if loading}
    <p class="muted">Loading...</p>
  {:else if error}
    <Alert variant="danger" title="Error">{error}</Alert>
  {:else if data}
    <div class="stats-grid">
      <StatCard value={data.totalTokens} label="Total Tokens (200 rows)" />
    </div>
    <DataTable {columns} rows={data.rows} empty="No usage yet" />
  {/if}
</DashboardLayout>

<style>
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px,1fr)); gap: var(--space-3); margin-bottom: var(--space-6); }
  .muted { color: var(--text-subtle); }
</style>
