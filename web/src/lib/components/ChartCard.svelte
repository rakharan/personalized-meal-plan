<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title = '',
    children,
  }: {
    title?: string;
    children: Snippet;
  } = $props();
</script>

<div class="chart-card">
  {#if title}<h3>{title}</h3>{/if}
  {@render children()}
</div>

<style>
  .chart-card {
    background: var(--surface);
    border-radius: var(--radius-md);
    padding: var(--space-5);
    box-shadow: var(--shadow-elevation-1);
    transition: box-shadow var(--duration-small) var(--ease-standard);
  }
  .chart-card:hover {
    box-shadow: var(--shadow-elevation-2);
  }
  h3 {
    font-size: var(--fs-xs);
    font-weight: var(--fw-semibold);
    text-transform: uppercase;
    letter-spacing: var(--ls-wide);
    color: var(--text-subtle);
    margin-bottom: var(--space-3);
  }
</style>
