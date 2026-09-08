<script lang="ts">
  import type { Snippet } from 'svelte';
  import Button from './Button.svelte';
  import { theme } from '$lib/stores/theme.svelte';

  let {
    current = '',
    children,
  }: {
    current?: string;
    children: Snippet;
  } = $props();

  let mobileNavOpen = $state(false);

  const navItems = [
    { href: '#/', label: 'Beranda' },
    { href: '#/fitur', label: 'Fitur' },
    { href: '#/sample', label: 'Sample' },
    { href: '#/masakan', label: 'Masakan' },
    { href: '#/harga', label: 'Harga' },
    { href: '#/faq', label: 'FAQ' },
  ];

  function closeMobileNav() { mobileNavOpen = false; }

  let mode = $state(theme.mode);
  function cycleTheme() {
    const modes = ['auto', 'dark', 'light'] as const;
    const idx = modes.indexOf(mode);
    mode = modes[(idx + 1) % modes.length];
    theme.set(mode);
  }
</script>

<a href="#main" class="skip-link">Skip to content</a>

{#if mobileNavOpen}
  <div class="nav-backdrop" onclick={closeMobileNav} role="presentation"></div>
{/if}

<nav class="public-nav">
  <a href="#/" class="brand"><span class="saji-logo">saji</span></a>
  <div class="nav-links" class:open={mobileNavOpen}>
    {#each navItems as item}
      <a href={item.href} class:active={current === item.href} onclick={closeMobileNav}>
        {item.label}
      </a>
    {/each}
    <button class="theme-toggle" onclick={cycleTheme}>{mode}</button>
    <a href="#/login" onclick={closeMobileNav}><Button variant="ghost" size="sm">Masuk</Button></a>
    <a href="#/signup" onclick={closeMobileNav}><Button variant="primary" size="sm">Daftar Gratis</Button></a>
  </div>
  <button class="hamburger" onclick={() => mobileNavOpen = !mobileNavOpen} aria-label="Menu navigasi">
    {#if mobileNavOpen}&times;{:else}&#9776;{/if}
  </button>
</nav>

<main class="public-main" id="main">
  {@render children()}
</main>

<footer class="public-footer">
  <div class="footer-inner">
    <div class="footer-brand-col">
      <div class="footer-brand"><span class="saji-logo">saji</span></div>
      <p>Asisten makan harian — bikin kamu makan enak, sehat, dan sesuai goal.</p>
      <p class="footer-meta">Dibuat dengan &hearts; di Indonesia</p>
    </div>
    <div class="footer-links">
      <a href="#/fitur">Fitur</a>
      <a href="#/sample">Sample Plans</a>
      <a href="#/masakan">Masakan</a>
      <a href="#/harga">Harga</a>
      <a href="#/faq">FAQ</a>
      <a href="#/tentang">Tentang</a>
      <a href="#/login">Masuk</a>
      <a href="#/signup">Daftar</a>
    </div>
  </div>
</footer>

<style>
  .skip-link {
    position: absolute; left: -9999px; top: 0; z-index: 10000;
    background: var(--primary); color: var(--text-on-primary);
    padding: var(--space-2) var(--space-4); border-radius: var(--radius-sm);
    font-size: var(--fs-sm); font-weight: var(--fw-medium);
  }
  .skip-link:focus { left: var(--space-3); top: var(--space-3); }
  .nav-backdrop { position: fixed; inset: 0; background: var(--scrim); z-index: 999; }

  .public-nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: var(--space-3) var(--space-6);
    background: color-mix(in srgb, var(--surface) 90%, transparent);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 1001;
  }
  .brand { font-size: var(--fs-lg); font-weight: var(--fw-bold); letter-spacing: var(--ls-tight); color: var(--text); text-decoration: none; }
  .brand .saji-logo { font-size: var(--fs-lg); }

  .nav-links { display: flex; gap: var(--space-3); align-items: center; }
  .nav-links a {
    font-size: var(--fs-sm); color: var(--text-subtle); text-decoration: none;
    min-height: 44px; display: flex; align-items: center;
    transition: color var(--duration-micro) var(--ease-standard);
    border-bottom: 2px solid transparent; padding: 0 var(--space-1);
  }
  .nav-links a:hover { color: var(--text); }
  .nav-links a.active { color: var(--primary); border-bottom-color: var(--primary); }

  .theme-toggle {
    background: none; border: 1px solid var(--border); border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-3); color: var(--text-subtle); font-family: inherit;
    font-size: var(--fs-xs); cursor: pointer; min-height: 32px; text-transform: capitalize;
  }
  .theme-toggle:hover { color: var(--text); border-color: var(--text-subtle); }

  .hamburger {
    display: none; background: var(--surface-2); border: 1px solid var(--border);
    border-radius: var(--radius-sm); width: 44px; height: 44px;
    font-size: var(--fs-lg); cursor: pointer; color: var(--text);
    align-items: center; justify-content: center;
  }

  .public-main { max-width: 900px; margin: 0 auto; padding: var(--space-8) var(--space-6); min-height: 60vh; }

  .public-footer {
    border-top: 1px solid var(--border);
    padding: var(--space-8) var(--space-6);
    margin-top: var(--space-12);
  }
  .footer-inner { max-width: 900px; margin: 0 auto; display: flex; gap: var(--space-10); flex-wrap: wrap; }
  .footer-brand-col { flex: 1; min-width: 200px; }
  .footer-brand { font-size: var(--fs-lg); font-weight: var(--fw-bold); margin-bottom: var(--space-2); color: var(--text); }
  .footer-brand .saji-logo { font-size: inherit; }
  .footer-brand-col p { color: var(--text-subtle); font-size: var(--fs-sm); }
  .footer-meta { margin-top: var(--space-2); color: var(--text-faint) !important; }
  .footer-links { display: flex; flex-direction: column; gap: var(--space-2); }
  .footer-links a { font-size: var(--fs-sm); color: var(--text-subtle); text-decoration: none; }
  .footer-links a:hover { color: var(--primary); }

  @media (max-width: 768px) {
    .hamburger { display: flex; }
    .nav-links {
      position: fixed; top: 57px; left: 0; right: 0;
      background: var(--surface); border-bottom: 1px solid var(--border);
      flex-direction: column; gap: var(--space-3); padding: var(--space-4);
      transform: translateY(-100%); transition: transform var(--duration-small) var(--ease-standard);
      z-index: 1000;
    }
    .nav-links.open { transform: translateY(0); }
    .nav-links a { width: 100%; min-height: 48px; }
    .footer-inner { flex-direction: column; gap: var(--space-6); }
  }
</style>
