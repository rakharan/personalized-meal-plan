<script lang="ts">
  import Button, { type Variant as BtnVariant } from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import StatCard from '$lib/components/StatCard.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import ChartCard from '$lib/components/ChartCard.svelte';
  import BarList from '$lib/components/BarList.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Alert, { type Variant as AlertVariant } from '$lib/components/Alert.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Pagination from '$lib/components/Pagination.svelte';

  let modalOpen = $state(false);
  let inputValue = $state('');
  let themeMode = $state('auto');

  const navItems = [
    { href: '#/', icon: '📊', label: 'Dashboard' },
    { href: '#/users', icon: '👥', label: 'Users' },
  ];

  const tableColumns = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'status', label: 'Status' },
    { key: 'streak', label: 'Streak', sortable: true },
  ];

  const tableRows = [
    { id: 1, name: 'Budi', status: 'Active', streak: 7 },
    { id: 2, name: 'Sari', status: 'Inactive', streak: 0 },
    { id: 3, name: 'Andi', status: 'Active', streak: 14 },
    { id: 4, name: 'Dewi', status: 'Active', streak: 3 },
  ];

  const barData = [
    { label: 'Free', value: 42 },
    { label: 'Premium', value: 8 },
    { label: 'Trial', value: 5 },
  ];

  const alertVariants: AlertVariant[] = ['success', 'danger', 'warning', 'info'];
  const btnVariants: BtnVariant[] = ['primary', 'secondary', 'ghost', 'danger'];
  const btnSizes = ['sm', 'md', 'lg'] as const;
</script>

<div class="workshop">
  <header>
    <h1>Saji Design System — Component Workshop</h1>
    <p>Every component, every state. Living reference for building Saji interfaces.</p>
  </header>

  <!-- Section: Buttons -->
  <section>
    <h2>Button</h2>
    <div class="component-row">
      {#each btnVariants as v}
        <Button variant={v}>{v}</Button>
      {/each}
    </div>
    <div class="component-row">
      {#each btnSizes as s}
        <Button size={s}>size {s}</Button>
      {/each}
    </div>
    <div class="component-row">
      <Button disabled>disabled</Button>
      <Button loading>loading</Button>
    </div>
  </section>

  <!-- Section: Input -->
  <section>
    <h2>Input</h2>
    <div class="input-grid">
      <Input label="Default" placeholder="Type something..." bind:value={inputValue} />
      <Input label="Password" type="password" placeholder="••••••••" />
      <Input label="Disabled" placeholder="Can't edit" disabled />
    </div>
    <p>Bound value: {inputValue || '(empty)'}</p>
  </section>

  <!-- Section: Badge -->
  <section>
    <h2>Badge</h2>
    <div class="component-row">
      <Badge variant="primary">free</Badge>
      <Badge variant="accent">premium</Badge>
      <Badge variant="danger">bad</Badge>
      <Badge variant="neutral">neutral</Badge>
      <Badge variant="primary">good</Badge>
    </div>
  </section>

  <!-- Section: StatCard -->
  <section>
    <h2>StatCard</h2>
    <div class="stats-demo">
      <StatCard value={42} label="Total Users" icon="👥" />
      <StatCard value={7} label="Day Streak" icon="🔥" trend={{ value: '+2', positive: true }} />
      <StatCard value="95%" label="Good Ratio" icon="👍" trend={{ value: '-3%', positive: false }} />
      <StatCard value={1337} label="Tokens Today" icon="🪙" />
    </div>
  </section>

  <!-- Section: DataTable -->
  <section>
    <h2>DataTable</h2>
    <DataTable columns={tableColumns} rows={tableRows} sortable empty="No users found" />
    <h3>Empty state</h3>
    <DataTable columns={tableColumns} rows={[]} empty="No users found" />
  </section>

  <!-- Section: ChartCard + BarList -->
  <section>
    <h2>ChartCard + BarList</h2>
    <div class="charts-demo">
      <ChartCard title="Tier Distribution">
        <BarList data={barData} />
      </ChartCard>
      <ChartCard title="Empty Chart">
        <BarList data={[]} />
      </ChartCard>
    </div>
  </section>

  <!-- Section: EmptyState -->
  <section>
    <h2>EmptyState</h2>
    <div class="card-surface">
      <EmptyState icon="🍽️" title="Belum ada rencana makan" description="Jalankan /mealplan untuk mulai">
      </EmptyState>
    </div>
  </section>

  <!-- Section: Alert -->
  <section>
    <h2>Alert</h2>
    <div class="alerts-demo">
      {#each alertVariants as v}
        <Alert variant={v} title={v}>
          This is a {v} alert. Used for {v === 'success' ? 'confirmations' : v === 'danger' ? 'errors' : v === 'warning' ? 'cautions' : 'information'}.
        </Alert>
      {/each}
    </div>
  </section>

  <!-- Section: Modal -->
  <section>
    <h2>Modal</h2>
    <Button onclick={() => modalOpen = true}>Open Modal</Button>
    <Modal bind:open={modalOpen} title="Delete Plan?">
      <p>This action cannot be undone. The plan "Bulking Phase 1" will be permanently removed.</p>
      <svelte:fragment slot="footer">
        <Button variant="ghost" onclick={() => modalOpen = false}>Cancel</Button>
        <Button variant="danger" onclick={() => modalOpen = false}>Delete</Button>
      </svelte:fragment>
    </Modal>
  </section>

  <!-- Section: Skeleton -->
  <section>
    <h2>Skeleton</h2>
    <Skeleton rows={4} cols={4} />
  </section>

  <!-- Section: Pagination -->
  <section>
    <h2>Pagination</h2>
    <Pagination page={3} total={7} />
  </section>

  <!-- Section: Sidebar (preview) -->
  <section>
    <h2>Sidebar (preview, non-functional)</h2>
    <div class="sidebar-preview">
      <Sidebar items={navItems} current="#/" brand="Saji" />
    </div>
  </section>
</div>

<style>
  .workshop {
    padding: var(--space-8) var(--space-10);
    max-width: 1200px;
  }
  header { margin-bottom: var(--space-8); }
  header h1 {
    font-size: var(--fs-xl);
    font-weight: var(--fw-semibold);
    letter-spacing: var(--ls-snug);
    margin-bottom: var(--space-2);
  }
  header p { color: var(--text-subtle); font-size: var(--fs-sm); }
  section {
    margin-bottom: var(--space-10);
    padding-bottom: var(--space-6);
    border-bottom: 1px solid var(--border);
  }
  section:last-child { border-bottom: none; }
  h2 {
    font-size: var(--fs-md);
    font-weight: var(--fw-semibold);
    margin-bottom: var(--space-4);
    color: var(--text);
  }
  h3 {
    font-size: var(--fs-xs);
    font-weight: var(--fw-medium);
    text-transform: uppercase;
    letter-spacing: var(--ls-wide);
    color: var(--text-subtle);
    margin: var(--space-4) 0 var(--space-2);
  }
  .component-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
    align-items: center;
  }
  .input-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--space-4);
    margin-bottom: var(--space-3);
  }
  .stats-demo, .charts-demo {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--space-3);
  }
  .charts-demo { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  .card-surface {
    background: var(--surface);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-elevation-1);
  }
  .alerts-demo { display: flex; flex-direction: column; gap: var(--space-3); }
  .sidebar-preview {
    height: 300px;
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: var(--shadow-elevation-1);
  }
</style>
