<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { onMount } from 'svelte';

  onMount(() => theme.init());

  let step = $state(0);

  const steps = [
    {
      icon: '🍽️',
      title: 'Halo! Aku Saji',
      desc: 'Aku bakal bantu kamu makan enak + sehat setiap hari. Bahan-bahan yang aku pilih gampang cari di Indonesia — tempe, kangkung, ikan kembung, dan lainnya.',
      cta: 'Lanjut',
    },
    {
      icon: '🎯',
      title: 'Cerita goal kamu',
      desc: 'Mau turun berat badan? Naik mass otot? Atau makan sehat aja? Nanti di bot, kamu jawab beberapa pertanyaan dan aku sesuaikan rencana makan kamu.',
      cta: 'Lanjut',
    },
    {
      icon: '🥘',
      title: 'Masakan favorit?',
      desc: 'Indonesia, Jepang, Korea, Mediterania — atau putar tiap hari biar nggak bosen? Kamu pilih di bot nanti, aku masak (secara digital).',
      cta: 'Lanjut',
    },
    {
      icon: '🔥',
      title: 'Lanjut ke bot!',
      desc: 'Kamu bakal dibawa ke Telegram buat jawab pertanyaan singkat (goal, alergi, kalori, masakan). Setelah itu, rencana makan kamu langsung siap. Jaga streak tiap hari ya!',
      cta: 'Gas! 🚀',
    },
  ];

  function next() {
    if (step < steps.length - 1) step++;
    else window.location.href = 'https://t.me/personalized_meal_planner_bot';
  }

  function prev() {
    if (step > 0) step--;
  }
</script>

<div class="onboarding">
  <div class="onboarding-card">
    <div class="step-indicator">
      {#each steps as _, i}
        <div class="dot" class:active={i === step} class:done={i < step}></div>
      {/each}
    </div>

    <div class="step-content">
      <div class="step-icon">{steps[step].icon}</div>
      <h2>{steps[step].title}</h2>
      <p>{steps[step].desc}</p>
    </div>

    {#if step === steps.length - 1}
      <div class="telegram-bridge">
        <div class="bridge-icon">📱</div>
        <div class="bridge-text">Kamu bakal diarahkan ke Telegram</div>
      </div>
    {/if}

    <div class="step-actions">
      {#if step > 0}
        <Button variant="ghost" onclick={prev}>← Kembali</Button>
      {/if}
      <Button variant="primary" onclick={next}>{steps[step].cta}</Button>
    </div>

    {#if step < steps.length - 1}
      <button class="skip" onclick={() => window.location.href = 'https://t.me/personalized_meal_planner_bot'}>Skip → langsung ke bot</button>
    {/if}
  </div>
</div>

<style>
  .onboarding {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-6);
  }
  .onboarding-card {
    max-width: 440px;
    width: 100%;
    background: var(--surface);
    border-radius: var(--radius-xl);
    padding: var(--space-10) var(--space-8);
    box-shadow: var(--shadow-elevation-2);
    text-align: center;
  }
  .step-indicator {
    display: flex;
    justify-content: center;
    gap: var(--space-2);
    margin-bottom: var(--space-8);
  }
  .dot {
    width: 8px; height: 8px;
    border-radius: var(--radius-pill);
    background: var(--surface-3);
    transition: all var(--duration-small) var(--ease-standard);
  }
  .dot.active {
    width: 24px;
    background: var(--primary);
  }
  .dot.done { background: var(--primary); }
  .step-content { margin-bottom: var(--space-8); }
  .step-icon {
    font-size: 4rem;
    margin-bottom: var(--space-4);
  }
  h2 {
    font-size: var(--fs-xl);
    font-weight: var(--fw-semibold);
    margin-bottom: var(--space-3);
    color: var(--text);
  }
  p {
    color: var(--text-muted);
    font-size: var(--fs-md);
    line-height: var(--lh-relaxed);
  }
  .telegram-bridge {
    background: var(--primary-soft);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-6);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }
  .bridge-icon { font-size: var(--fs-lg); }
  .bridge-text { font-size: var(--fs-sm); color: var(--primary); font-weight: var(--fw-medium); }
  .step-actions {
    display: flex;
    justify-content: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .skip {
    font-size: var(--fs-sm);
    color: var(--text-faint);
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
    padding: var(--space-2) var(--space-4);
    min-height: 44px;
  }
  .skip:hover { color: var(--text-subtle); }
</style>
