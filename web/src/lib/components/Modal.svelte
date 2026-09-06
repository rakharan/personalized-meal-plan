<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    open = $bindable(false),
    title = '',
    children,
    footer,
  }: {
    open?: boolean;
    title?: string;
    children: Snippet;
    footer?: Snippet;
  } = $props();

  let modalEl: HTMLDivElement | undefined = $state();
  let titleId = 'modal-title-' + Math.random().toString(36).slice(2, 9);
  let lastFocused: HTMLElement | null = null;

  function close() {
    open = false;
    if (lastFocused) lastFocused.focus();
  }

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Tab' && modalEl) {
      const focusable = modalEl.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  $effect(() => {
    if (open) {
      lastFocused = document.activeElement as HTMLElement;
      // Focus first focusable or close button after render
      setTimeout(() => {
        if (modalEl) {
          const first = modalEl.querySelector<HTMLElement>('button, [href], input');
          if (first) first.focus();
          else modalEl.focus();
        }
      }, 0);
      document.addEventListener('keydown', onKeydown);
    } else {
      document.removeEventListener('keydown', onKeydown);
    }

    return () => document.removeEventListener('keydown', onKeydown);
  });
</script>

{#if open}
  <div class="modal-backdrop" onclick={onBackdropClick} role="presentation">
    <div
      bind:this={modalEl}
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabindex="-1"
    >
      <div class="modal-header">
        {#if title}<h2 id={titleId}>{title}</h2>{/if}
        <button class="modal-close" onclick={close} aria-label="Tutup">✕</button>
      </div>
      <div class="modal-body">
        {@render children()}
      </div>
      {#if footer}
        <div class="modal-footer">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: var(--scrim);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: var(--space-4);
  }
  .modal {
    background: var(--surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-elevation-3);
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--border);
  }
  .modal-header h2 {
    font-size: var(--fs-md);
    font-weight: var(--fw-semibold);
    color: var(--text);
  }
  .modal-close {
    background: none;
    border: none;
    color: var(--text-subtle);
    font-size: var(--fs-md);
    cursor: pointer;
    padding: var(--space-2);
    border-radius: var(--radius-sm);
    transition: background var(--duration-micro) var(--ease-standard);
    min-height: 44px;
    min-width: 44px;
  }
  .modal-close:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .modal-body {
    padding: var(--space-5);
  }
  .modal-footer {
    padding: var(--space-3) var(--space-5);
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
