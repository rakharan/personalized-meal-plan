<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/stores/api.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import Alert from '$lib/components/Alert.svelte';

  let token = $state('');
  let error = $state('');
  let loading = $state(false);

  async function submit(e: Event) {
    e.preventDefault();
    loading = true;
    error = '';
    try {
      const ok = await api.login(token);
      if (ok) {
        window.location.hash = '#/admin';
        window.location.reload();
      } else {
        error = 'Token salah. Coba lagi ya.';
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    if (api.isAuthed) {
      window.location.hash = '#/admin';
    }
  });
</script>

<div class="login-wrap">
  <div class="login-card">
    <div class="login-icon">🍽️</div>
    <h1>Saji <span>Admin</span></h1>
    <p class="login-sub">Masukkan token admin buat lanjut</p>
    <form onsubmit={submit}>
      <Input type="password" placeholder="Token admin" bind:value={token} autofocus />
      <Button type="submit" {loading}>Masuk →</Button>
    </form>
    {#if error}<div class="error-msg">{error}</div>{/if}
    <a href="#/" class="back-link">← Kembali ke beranda</a>
  </div>
  <div class="login-bg-deco"></div>
</div>

<style>
  .login-wrap {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-6);
    position: relative;
    overflow: hidden;
  }
  .login-bg-deco {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 20% 20%, var(--primary-soft) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 80%, var(--accent-soft) 0%, transparent 50%);
    z-index: 0;
    pointer-events: none;
  }
  .login-card {
    position: relative;
    z-index: 1;
    max-width: 380px;
    width: 100%;
    background: var(--surface);
    border-radius: var(--radius-xl);
    padding: var(--space-10) var(--space-8);
    box-shadow: var(--shadow-elevation-3);
    text-align: center;
    border: 1px solid var(--border-strong);
  }
  .login-icon {
    font-size: 3rem;
    margin-bottom: var(--space-3);
  }
  h1 {
    font-size: var(--fs-2xl);
    font-weight: var(--fw-bold);
    letter-spacing: var(--ls-tight);
    margin-bottom: var(--space-1);
    color: var(--text);
  }
  h1 span { color: var(--primary); }
  .login-sub {
    color: var(--text-subtle);
    font-size: var(--fs-sm);
    margin-bottom: var(--space-6);
  }
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .error-msg {
    color: var(--danger);
    font-size: var(--fs-sm);
    margin-bottom: var(--space-3);
  }
  .back-link {
    font-size: var(--fs-xs);
    color: var(--text-faint);
    text-decoration: none;
    transition: color var(--duration-micro) var(--ease-standard);
  }
  .back-link:hover { color: var(--text-subtle); }
</style>
