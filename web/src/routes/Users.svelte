<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/stores/api.svelte';
  import DashboardLayout from '$lib/components/DashboardLayout.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import Alert from '$lib/components/Alert.svelte';

  let data = $state<any>(null);
  let error = $state('');
  let loading = $state(true);
  let page = $state(1);

  async function load(p = 1) {
    loading = true;
    page = p;
    try {
      data = await api.getUsers(p);
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(() => load(1));

  const columns = [
    { key: 'chatId', label: 'Chat ID', sortable: true },
    { key: 'locale', label: 'Locale' },
    { key: 'subscribed', label: 'Subscribed' },
    { key: 'streak', label: 'Streak', sortable: true },
    { key: 'lastPushed', label: 'Last Pushed' },
    { key: 'pushTime', label: 'Push Time' },
    { key: 'feedback', label: 'Feedback' },
    { key: 'tier', label: 'Tier' },
  ];
</script>

<DashboardLayout title="Users" current="#/admin/users">
  {#if loading}
    <Skeleton rows={10} cols={8} />
  {:else if error}
    <Alert variant="danger" title="Error">{error}</Alert>
  {:else if data}
    <DataTable
      {columns}
      rows={data.rows.map((r: any) => ({
        ...r,
        pushTime: r.pushHour !== null ? `${String(r.pushHour).padStart(2,'0')}:${String(r.pushMin).padStart(2,'0')}` : 'default',
        feedback: r.lastFeedback || '—',
      }))}
      {page}
      totalPages={data.totalPages}
      onpage={(p) => load(p)}
    >
      {#snippet cell({ row, key, value })}
        {#if key === 'subscribed'}
          {#if value}✅{:else}❌{/if}
        {:else if key === 'tier'}
          <Badge variant={value === 'premium' ? 'accent' : 'neutral'}>{value}</Badge>
        {:else if key === 'feedback' && value === 'good'}
          <Badge variant="primary">good</Badge>
        {:else if key === 'feedback' && value === 'bad'}
          <Badge variant="danger">bad</Badge>
        {:else}
          {value ?? '—'}
        {/if}
      {/snippet}
    </DataTable>
  {/if}
</DashboardLayout>
