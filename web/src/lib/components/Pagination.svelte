<script lang="ts">
  let {
    page = 1,
    total = 1,
    onpage = undefined as ((page: number) => void) | undefined,
  }: {
    page?: number;
    total?: number;
    onpage?: (page: number) => void;
  } = $props();
</script>

{#if total > 1}
  <div class="pagination">
    {#if page > 1}
      <button class="pag-btn" onclick={() => onpage?.(page - 1)}>← Prev</button>
    {/if}
    <span>Page {page} of {total}</span>
    {#if page < total}
      <button class="pag-btn" onclick={() => onpage?.(page + 1)}>Next →</button>
    {/if}
  </div>
{/if}

<style>
  .pagination {
    display: flex; gap: var(--space-3); align-items: center;
    justify-content: center; margin: var(--space-4) 0; font-size: var(--fs-sm);
  }
  .pagination a, .pag-btn {
    color: var(--primary);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    transition: background var(--duration-micro) var(--ease-standard);
    background: none;
    border: none;
    font-family: inherit;
    font-size: var(--fs-sm);
    cursor: pointer;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
  .pagination a:hover, .pag-btn:hover { background: var(--primary-soft); }
  .pagination span { color: var(--text-subtle); }
</style>
