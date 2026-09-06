<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/stores/api.svelte';
  import DashboardLayout from '$lib/components/DashboardLayout.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import Alert from '$lib/components/Alert.svelte';

  let data = $state<any>(null);
  let error = $state('');
  let loading = $state(true);

  async function load() {
    loading = true;
    try { data = await api.getReferrals(); } catch (e: any) { error = e.message; } finally { loading = false; }
  }

  onMount(load);

  const columns = [
    { key: 'referredId', label: 'Referred Chat ID' },
    { key: 'locale', label: 'Locale' },
    { key: 'theirReferrals', label: 'Their Referrals' },
    { key: 'created', label: 'Joined' },
  ];
</script>

<DashboardLayout title="Referrals" current="#/admin/referrals">
  {#if loading}
    <p class="muted">Loading...</p>
  {:else if error}
    <Alert variant="danger" title="Error">{error}</Alert>
  {:else if data}
    <DataTable {columns} rows={data.rows} empty="No referrals yet" />
  {/if}
</DashboardLayout>

<style>
  .muted { color: var(--text-subtle); }
</style>
