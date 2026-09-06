<script lang="ts">
  import type { Snippet } from 'svelte';
  import Pagination from './Pagination.svelte';

  let {
    columns = [] as { key: string; label: string; sortable?: boolean }[],
    rows = [] as Record<string, any>[],
    page = 1,
    totalPages = 1,
    sortable = false,
    onsort = undefined as ((key: string) => void) | undefined,
    onpage = undefined as ((page: number) => void) | undefined,
    empty = 'No data' as string | Snippet,
    cell = undefined as Snippet | undefined,
  }: {
    columns: { key: string; label: string; sortable?: boolean }[];
    rows: Record<string, any>[];
    page?: number;
    totalPages?: number;
    sortable?: boolean;
    onsort?: (key: string) => void;
    onpage?: (page: number) => void;
    empty?: string | Snippet;
    cell?: Snippet;
  } = $props();

  const emptyText = $derived(typeof empty === 'string' ? empty : 'No data');

  let sortKey = $state('');
  let sortDir = $state<'asc' | 'desc'>('asc');

  function handleSort(key: string) {
    if (!sortable || !onsort) return;
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = 'asc';
    }
    onsort(key);
  }

  function getAriaSort(key: string): 'ascending' | 'descending' | 'none' {
    if (sortKey !== key) return 'none';
    return sortDir === 'asc' ? 'ascending' : 'descending';
  }
</script>

<div class="table-wrap">
  <table>
    <thead>
      <tr>
        {#each columns as col}
          <th aria-sort={col.sortable ? getAriaSort(col.key) : undefined}>
            {#if col.sortable}
              <button class="sort-btn" onclick={() => handleSort(col.key)}>
                {col.label}
                {#if sortKey === col.key}
                  <span class="sort-arrow">{sortDir === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </button>
            {:else}
              {col.label}
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#if rows.length === 0}
        <tr><td colspan={columns.length} class="empty-row">{emptyText}</td></tr>
      {:else}
        {#each rows as row}
          <tr>
            {#each columns as col}
              <td>
                {#if cell}
                  {@render cell({ row, key: col.key, value: row[col.key] })}
                {:else}
                  {row[col.key] ?? '—'}
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>

{#if totalPages > 1}
  <Pagination {page} total={totalPages} {onpage} />
{/if}

<style>
  .table-wrap {
    background: var(--surface);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-elevation-1);
    overflow: hidden;
    overflow-x: auto;
    margin-bottom: var(--space-5);
  }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: var(--space-2) var(--space-4); text-align: left; }
  th {
    font-size: var(--fs-xs);
    font-weight: var(--fw-medium);
    text-transform: uppercase;
    letter-spacing: var(--ls-wide);
    color: var(--text-subtle);
    border-bottom: 1px solid var(--border);
    background: var(--surface-2);
    white-space: nowrap;
  }
  .sort-btn {
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
    padding: 0;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-height: 44px;
  }
  .sort-btn:hover { color: var(--text); }
  .sort-arrow { margin-left: var(--space-1); }
  td {
    font-size: var(--fs-sm);
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 300px;
  }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr { transition: background var(--duration-micro) var(--ease-standard); }
  tbody tr:hover { background: var(--surface-2); }
  .empty-row { text-align: center; color: var(--text-faint); padding: var(--space-6); }
</style>
