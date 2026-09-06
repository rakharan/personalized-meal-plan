<script lang="ts">
  type Variant = 'success' | 'danger' | 'warning' | 'info';

  let {
    variant = 'info' as Variant,
    title = '',
    children,
  }: {
    variant?: Variant;
    title?: string;
    children: import('svelte').Snippet;
  } = $props();
</script>

<div class="alert alert-{variant}">
  {#if title}<div class="alert-title">{title}</div>{/if}
  <div class="alert-body">
    {@render children()}
  </div>
</div>

<style>
  .alert {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    border-left: 3px solid;
    font-size: var(--fs-sm);
  }
  .alert-success { border-color: var(--success); background: var(--primary-soft); }
  .alert-danger { border-color: var(--danger); background: var(--danger-soft); }
  .alert-warning { border-color: var(--accent); background: var(--accent-soft); }
  .alert-info { border-color: var(--primary); background: var(--primary-soft); }
  .alert-title {
    font-weight: var(--fw-semibold);
    margin-bottom: var(--space-1);
  }
</style>
