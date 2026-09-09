<script lang="ts">
  import type { Snippet } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';

  let {
    title = '',
    current = '',
    children,
  }: {
    title?: string;
    current?: string;
    children: Snippet;
  } = $props();

  let mobileNavOpen = $state(false);

  const navItems = [
    { href: '#/dashboard', label: 'Dasbor' },
    { href: '#/kalender', label: 'Kalender' },
    { href: '#/profile', label: 'Profil' },
    { href: '#/history', label: 'Riwayat' },
    { href: '#/settings', label: 'Pengaturan' },
    { href: '#/pro', label: 'Pro' },
  ];

  function closeMobileNav() { mobileNavOpen = false; }

  function logout() {
    auth.logout();
    window.location.hash = '#/';
    window.location.reload();
  }
</script>

<a href="#main" class="skip-link">Skip to content</a>

{#if mobileNavOpen}
  <div class="nav-backdrop" onclick={closeMobileNav} role="presentation"></div>
{/if}

<nav class="user-nav">
  <a href="#/dashboard" class="brand"><span class="saji-logo">saji</span></a>
  <div class="nav-links" class:open={mobileNavOpen}>
    {#each navItems as item}
      <a href={item.href} class:active={current === item.href} onclick={closeMobileNav}>
        {item.label}
      </a>
    {/each}
    <button class="logout-btn" onclick={logout}>Logout</button>
  </div>
  <button class="hamburger" onclick={() => mobileNavOpen = !mobileNavOpen} aria-label="Menu navigasi">
    {#if mobileNavOpen}✕{:else}☰{/if}
  </button>
</nav>

<main class="user-main" id="main">
  {#if title}<h1>{title}</h1>{/if}
  {@render children()}
</main>

<style>
  .skip-link { position: absolute; left: -9999px; top: 0; z-index: 10000; background: var(--primary); color: var(--text-on-primary); padding: var(--space-2) var(--space-4); border-radius: var(--radius-sm); font-size: var(--fs-sm); font-weight: var(--fw-medium); }
  .skip-link:focus { left: var(--space-3); top: var(--space-3); }
  .nav-backdrop { position: fixed; inset: 0; background: var(--scrim); z-index: 999; }

  .user-nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: var(--space-3) var(--space-6);
    background: var(--surface); border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 1001;
  }
  .brand { font-size: var(--fs-lg); font-weight: var(--fw-bold); letter-spacing: var(--ls-tight); color: var(--text); text-decoration: none; }
  .brand .saji-logo { font-size: var(--fs-lg); }

  .nav-links { display: flex; gap: var(--space-4); align-items: center; }
  .nav-links a {
    font-size: var(--fs-sm); color: var(--text-subtle); text-decoration: none;
    min-height: 44px; display: flex; align-items: center; gap: var(--space-1);
    transition: color var(--duration-micro) var(--ease-standard);
    border-bottom: 2px solid transparent;
  }
  .nav-links a:hover { color: var(--text); }
  .nav-links a.active { color: var(--primary); border-bottom-color: var(--primary); }

  .logout-btn {
    background: none; border: 1px solid var(--border); border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-3); color: var(--text-subtle); font-family: inherit;
    font-size: var(--fs-sm); cursor: pointer; min-height: 44px;
  }
  .logout-btn:hover { color: var(--danger); border-color: var(--danger); }

  .hamburger {
    display: none; background: var(--surface-2); border: 1px solid var(--border);
    border-radius: var(--radius-sm); width: 44px; height: 44px;
    font-size: var(--fs-lg); cursor: pointer; color: var(--text);
    align-items: center; justify-content: center;
  }

  .user-main { max-width: 900px; margin: 0 auto; padding: var(--space-6); }
  h1 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-6); }

  @media (max-width: 768px) {
    .hamburger { display: flex; }
    .nav-links {
      position: fixed; top: 0; left: 0; bottom: 0;
      flex-direction: column; gap: 0; align-items: stretch;
      background: var(--surface); padding: var(--space-6) var(--space-4);
      width: 240px; transform: translateX(-100%);
      transition: transform var(--duration-small) var(--ease-standard);
      z-index: 1000; box-shadow: var(--shadow-elevation-3);
      padding-top: var(--space-10);
    }
    .nav-links.open { transform: translateX(0); }
    .nav-links a { padding: var(--space-3); border-bottom: 1px solid var(--border); }
    .logout-btn { margin-top: var(--space-4); width: 100%; }
  }
</style>
