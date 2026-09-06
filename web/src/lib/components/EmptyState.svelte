<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    icon = '📭',
    title = 'Nothing here yet',
    description = '',
    children,
  }: {
    icon?: string;
    title?: string;
    description?: string;
    children?: Snippet;
  } = $props();
</script>

<div class="empty-state">
  <div class="empty-icon">{icon}</div>
  <div class="empty-title">{title}</div>
  {#if description}<div class="empty-desc">{description}</div>{/if}
  {#if children}{@render children()}{/if}
</div>

<style>
  .empty-state {
    text-align: center;
    padding: var(--space-12) var(--space-6);
  }
  .empty-icon {
    font-size: 3rem;
    margin-bottom: var(--space-3);
    opacity: 0.6;
  }
  .empty-title {
    font-size: var(--fs-md);
    font-weight: var(--fw-semibold);
    color: var(--text-muted);
    margin-bottom: var(--space-1);
  }
  .empty-desc {
    font-size: var(--fs-sm);
    color: var(--text-faint);
  }
</style>
