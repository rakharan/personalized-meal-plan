<script lang="ts">
  type Variant = 'primary' | 'accent' | 'danger' | 'neutral';

  let {
    variant = 'neutral' as Variant,
    children,
  }: {
    variant?: Variant;
    children: import('svelte').Snippet;
  } = $props();
</script>

<span class="badge badge-{variant}">
  {@render children()}
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-pill);
    font-size: var(--fs-xs);
    font-weight: var(--fw-medium);
    line-height: 1;
  }
  .badge-primary { background: var(--primary-soft); color: var(--primary); }
  .badge-accent { background: var(--accent-soft); color: var(--accent); }
  .badge-danger { background: var(--danger-soft); color: var(--danger); }
  .badge-neutral { background: var(--surface-2); color: var(--text-muted); }
</style>
