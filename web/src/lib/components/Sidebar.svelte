<script lang="ts">
  import type { Snippet } from 'svelte';
  import { theme } from '$lib/stores/theme.svelte';

  let {
    items = [] as { href: string; label: string }[],
    brand = 'Saji',
    current = '',
    children,
  }: {
    items: { href: string; label: string }[];
    brand?: string;
    current?: string;
    children?: Snippet;
  } = $props();

  let mobileNavOpen = $state(false);

  function toggleMobileNav() {
    mobileNavOpen = !mobileNavOpen;
  }

  function closeMobileNav() {
    mobileNavOpen = false;
  }
</script>

{#if mobileNavOpen}
  <div class="nav-backdrop" onclick={closeMobileNav} role="presentation"></div>
{/if}

<button class="hamburger" onclick={toggleMobileNav} aria-label="Menu navigasi">
  {#if mobileNavOpen}✕{:else}☰{/if}
</button>

<nav class="sidebar" class:open={mobileNavOpen}>
  <div class="sidebar-brand"><span class="saji-logo">saji</span></div>
  <div class="nav-list">
    {#each items as item}
      <a
        href={item.href}
        class:active={item.href === current}
        onclick={closeMobileNav}
      >
        {item.label}
      </a>
    {/each}
  </div>
  {#if children}
    <div class="nav-bottom">
      {@render children()}
    </div>
  {/if}
</nav>

<style>
  .hamburger {
    display: none;
    position: fixed;
    top: var(--space-3);
    left: var(--space-3);
    z-index: 1001;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    width: 44px;
    height: 44px;
    font-size: var(--fs-lg);
    cursor: pointer;
    color: var(--text);
    align-items: center;
    justify-content: center;
  }

  .sidebar {
    width: 220px;
    flex-shrink: 0;
    background: var(--surface);
    border-right: 1px solid var(--border);
    padding: var(--space-5) 0;
    position: fixed;
    height: 100vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .sidebar-brand {
    padding: 0 var(--space-5) var(--space-6);
    font-size: var(--fs-lg);
    font-weight: var(--fw-bold);
    letter-spacing: var(--ls-tight);
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 0;
  }
  .sidebar-brand .saji-logo { font-size: var(--fs-lg); }
  .nav-list { flex: 1; }
  .nav-list a, :global(.nav-bottom a), :global(.theme-toggle) {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-5);
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
    color: var(--text-subtle);
    text-decoration: none;
    border-left: 2px solid transparent;
    transition: color var(--duration-micro) var(--ease-standard), background var(--duration-micro) var(--ease-standard);
    min-height: 44px;
  }
  .nav-list a:hover, :global(.nav-bottom a:hover), :global(.theme-toggle:hover) {
    color: var(--text-muted);
    background: var(--surface-2);
  }
  .nav-list a.active {
    color: var(--text);
    background: var(--primary-soft);
    border-left-color: var(--primary);
  }
  .nav-bottom { margin-top: auto; }
  :global(.theme-toggle) {
    background: none;
    border: none;
    border-left: 2px solid transparent;
    width: 100%;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
  }
  .nav-backdrop {
    position: fixed;
    inset: 0;
    background: var(--scrim);
    z-index: 999;
  }

  @media (max-width: 768px) {
    .hamburger { display: flex; }
    .sidebar {
      transform: translateX(-100%);
      transition: transform var(--duration-small) var(--ease-standard);
      z-index: 1000;
      box-shadow: var(--shadow-elevation-3);
    }
    .sidebar.open {
      transform: translateX(0);
    }
  }
</style>
