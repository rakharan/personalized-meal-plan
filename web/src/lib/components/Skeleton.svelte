<script lang="ts">
  let {
    rows = 5,
    cols = 4,
  }: {
    rows?: number;
    cols?: number;
  } = $props();
</script>

<div class="skeleton-table">
  {#each Array(rows) as _}
    <div class="skeleton-row">
      {#each Array(cols) as __}
        <div class="skeleton-cell"></div>
      {/each}
    </div>
  {/each}
</div>

<style>
  .skeleton-table {
    background: var(--surface);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    overflow: hidden;
  }
  .skeleton-row {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-4);
  }
  .skeleton-cell {
    flex: 1;
    height: 14px;
    background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%);
    background-size: 200% 100%;
    border-radius: var(--radius-sm);
    animation: shimmer 1.5s infinite;
  }
  @keyframes shimmer {
    from { background-position: 200% 0; }
    to { background-position: -200% 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .skeleton-cell { animation: none; background: var(--surface-2); }
  }
</style>
