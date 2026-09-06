<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function submit(e: Event) {
    e.preventDefault();
    loading = true; error = '';
    try {
      await auth.login(email, password);
      window.location.hash = '#/dashboard';
      window.location.reload();
    } catch (e: any) {
      error = e.message;
    } finally { loading = false; }
  }

  onMount(() => {
    theme.init();
    if (auth.isAuthed) { window.location.hash = '#/dashboard'; }
  });
</script>

<div class="login-wrap">
  <div class="login-bg-deco"></div>
  <div class="login-card">
    <div class="login-icon">🍽️</div>
    <h1>Saji</h1>
    <p class="login-sub">Masuk buat kelola rencana makanmu</p>
    <form onsubmit={submit}>
      <Input label="Email" type="email" placeholder="kamu@email.com" bind:value={email} autofocus />
      <Input label="Password" type="password" placeholder="••••••••" bind:value={password} />
      <Button type="submit" variant="primary" {loading}>Masuk →</Button>
    </form>
    {#if error}<div class="error-msg">{error}</div>{/if}
    <div class="links">
      <a href="#/signup">Belum punya akun? Daftar di sini</a>
      <a href="#/" class="back">← Kembali ke beranda</a>
    </div>
  </div>
</div>

<style>
  .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: var(--space-6); position: relative; overflow: hidden; }
  .login-bg-deco { position: absolute; inset: 0; background: radial-gradient(ellipse at 20% 20%, var(--primary-soft) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, var(--accent-soft) 0%, transparent 50%); z-index: 0; pointer-events: none; }
  .login-card { position: relative; z-index: 1; max-width: 400px; width: 100%; background: var(--surface); border-radius: var(--radius-xl); padding: var(--space-10) var(--space-8); box-shadow: var(--shadow-elevation-3); border: 1px solid var(--border-strong); text-align: center; }
  .login-icon { font-size: 3rem; margin-bottom: var(--space-3); }
  h1 { font-size: var(--fs-2xl); font-weight: var(--fw-bold); letter-spacing: var(--ls-tight); margin-bottom: var(--space-1); color: var(--text); }
  .login-sub { color: var(--text-subtle); font-size: var(--fs-sm); margin-bottom: var(--space-6); }
  form { display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-4); }
  .error-msg { color: var(--danger); font-size: var(--fs-sm); margin-bottom: var(--space-3); }
  .links { display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-4); }
  .links a { font-size: var(--fs-xs); color: var(--primary); text-decoration: none; }
  .links a.back { color: var(--text-faint); }
  .links a:hover { text-decoration: underline; }
</style>
