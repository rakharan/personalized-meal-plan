<script lang="ts">
  import type { Snippet } from 'svelte';

  type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
  type Size = 'sm' | 'md' | 'lg';

  let {
    variant = 'primary' as Variant,
    size = 'md' as Size,
    disabled = false,
    loading = false,
    onclick = undefined as (() => void) | undefined,
    children,
    type = 'button' as 'button' | 'submit' | 'reset',
  }: {
    variant?: Variant;
    size?: Size;
    disabled?: boolean;
    loading?: boolean;
    onclick?: () => void;
    children: Snippet;
    type?: 'button' | 'submit' | 'reset';
  } = $props();

  const _disabled = $derived(disabled || loading);
</script>

<button
  {type}
  class="btn btn-{variant} btn-{size}"
  disabled={_disabled}
  {onclick}
>
  {#if loading}<span class="spinner"></span>{/if}
  {@render children()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    border: none;
    border-radius: var(--radius-sm);
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
    font-family: inherit;
    cursor: pointer;
    transition: all var(--duration-micro) var(--ease-standard);
    white-space: nowrap;
    user-select: none;
    line-height: 1;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn:not(:disabled):active { transform: scale(0.97); }

  .btn-primary { background: var(--primary); color: var(--text-on-primary); }
  .btn-primary:not(:disabled):hover { background: var(--primary-hover); filter: brightness(1.1); }

  .btn-secondary { background: var(--surface-2); color: var(--text); }
  .btn-secondary:not(:disabled):hover { background: var(--surface-3); }

  .btn-ghost { background: transparent; color: var(--text-muted); }
  .btn-ghost:not(:disabled):hover { background: var(--surface-2); color: var(--text); }

  .btn-danger { background: var(--danger); color: var(--text-on-danger); }
  .btn-danger:not(:disabled):hover { filter: brightness(1.1); }

  .btn-sm { padding: var(--space-1) var(--space-3); font-size: var(--fs-xs); min-height: 32px; }
  .btn-md { padding: var(--space-2) var(--space-4); min-height: 44px; }
  .btn-lg { padding: var(--space-3) var(--space-6); font-size: var(--fs-md); min-height: 48px; }

  .spinner {
    width: 14px; height: 14px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
</style>
