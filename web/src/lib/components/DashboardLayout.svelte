<script lang="ts">
  import type { Snippet } from 'svelte';
  import Sidebar from './Sidebar.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { api } from '$lib/stores/api.svelte';

  let {
    title = '',
    current = '',
    children,
  }: {
    title?: string;
    current?: string;
    children: Snippet;
  } = $props();

  const navItems = [
    { href: '#/admin', icon: '📊', label: 'Dashboard' },
    { href: '#/admin/users', icon: '👥', label: 'Pengguna' },
    { href: '#/admin/plans', icon: '📋', label: 'Rencana' },
    { href: '#/admin/feedback', icon: '👍', label: 'Feedback' },
    { href: '#/admin/usage', icon: '📈', label: 'Usage' },
    { href: '#/admin/referrals', icon: '🔗', label: 'Referral' },
  ];

  let mode = $state(theme.mode);

  function cycleTheme() {
    const modes = ['auto', 'dark', 'light'] as const;
    const idx = modes.indexOf(mode);
    const next = modes[(idx + 1) % modes.length];
    mode = next;
    theme.set(next);
  }

  function logout() {
    api.logout();
    window.location.hash = '#/admin-login';
  }
</script>

<a href="#main" class="skip-link">Skip to content</a>

<div class="shell">
  <Sidebar items={navItems} current={current || '#/admin'} brand="Saji">
    <a href="#/"><span class="icon">🌐</span> Lihat Situs</a>
    <a href="#/workshop"><span class="icon">🎨</span> Workshop</a>
    <a href="#/theme-editor"><span class="icon">⚙️</span> Theme Editor</a>
    <button class="theme-toggle" onclick={cycleTheme}>
      <span class="icon">{mode === 'dark' ? '🌙' : mode === 'light' ? '☀️' : '🖥️'}</span> {mode}
    </button>
    <button class="theme-toggle" onclick={logout}>
      <span class="icon">🚪</span> Logout
    </button>
  </Sidebar>
  <main class="main" id="main">
    {#if title}<h1>{title}</h1>{/if}
    {@render children()}
  </main>
</div>

<style>
  .skip-link {
    position: absolute;
    left: -9999px;
    top: 0;
    z-index: 10000;
    background: var(--primary);
    color: var(--text-on-primary);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
  }
  .skip-link:focus {
    left: var(--space-3);
    top: var(--space-3);
  }
  .shell { display: flex; min-height: 100vh; }
  .main {
    flex: 1;
    margin-left: 220px;
    padding: var(--space-8) var(--space-10);
    max-width: 1200px;
    transition: margin var(--duration-small) var(--ease-standard);
  }
  h1 {
    font-size: var(--fs-xl);
    font-weight: var(--fw-semibold);
    letter-spacing: var(--ls-snug);
    margin-bottom: var(--space-6);
  }
  @media (max-width: 768px) {
    .main { margin-left: 0; padding: var(--space-8) var(--space-5) var(--space-5); }
  }
</style>
