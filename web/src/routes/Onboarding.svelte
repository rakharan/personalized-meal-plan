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
      accent: 'primary',
    },
    {
      icon: '🎯',
      title: 'Cerita goal kamu',
      desc: 'Mau turun berat badan? Naik mass otot? Atau makan sehat aja? Nanti di bot, kamu jawab beberapa pertanyaan dan aku sesuaikan rencana makan kamu.',
      cta: 'Lanjut',
      accent: 'amber',
    },
    {
      icon: '🥘',
      title: 'Masakan favorit?',
      desc: 'Indonesia, Jepang, Korea, Mediterania — atau putar tiap hari biar nggak bosen? Kamu pilih di bot nanti, aku masak (secara digital).',
      cta: 'Lanjut',
      accent: 'primary',
    },
    {
      icon: '🔥',
      title: 'Lanjut ke bot!',
      desc: 'Kamu bakal dibawa ke Telegram buat jawab pertanyaan singkat (goal, alergi, kalori, masakan). Setelah itu, rencana makan kamu langsung siap. Jaga streak tiap hari ya!',
      cta: 'Gas! 🚀',
      accent: 'amber',
    },
  ];

  // Food emojis floating in background
  const foodEmojis = ['🍚', '🍳', '🥘', '🍲', '🍱', '🥗', '🍜', '🍢', '🐟', '🌶️', '🥬', '🍜'];

  function next() {
    if (step < steps.length - 1) step++;
    else window.location.href = 'https://t.me/personalized_meal_planner_bot';
  }

  function prev() {
    if (step > 0) step--;
  }
</script>

<div class="onboarding">
  <!-- Floating food background -->
  <div class="food-bg">
    {#each foodEmojis as emoji, i}
      <span class="food-float" style="--delay: {i * 1.5}s; --x: {5 + (i * 8) % 90}%; --y: {10 + (i * 13) % 80}%; --size: {1.5 + (i % 3) * 0.5}rem">{emoji}</span>
    {/each}
  </div>

  <div class="onboarding-card" data-accent={steps[step].accent}>
    <!-- Progress bar -->
    <div class="progress-track">
      <div class="progress-fill" style="width: {((step + 1) / steps.length) * 100}%"></div>
    </div>
    <div class="step-dots">
      {#each steps as _, i}
        <div class="dot" class:active={i === step} class:done={i < step}></div>
      {/each}
    </div>

    <div class="step-content">
      <div class="step-icon-wrapper">
        <div class="step-icon-glow"></div>
        <div class="step-icon">{steps[step].icon}</div>
      </div>
      <h2>{steps[step].title}</h2>
      <p>{steps[step].desc}</p>
    </div>

    {#if step === steps.length - 1}
      <div class="telegram-bridge">
        <div class="bridge-pulse"></div>
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
    position: relative;
    overflow: hidden;
  }

  /* Floating food background */
  .food-bg {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    z-index: 0;
  }
  .food-float {
    position: absolute;
    left: var(--x);
    top: var(--y);
    font-size: var(--size);
    opacity: 0.06;
    animation: float 8s ease-in-out infinite;
    animation-delay: var(--delay);
  }
  @keyframes float {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-20px) rotate(10deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .food-float { animation: none; }
  }

  .onboarding-card {
    max-width: 460px;
    width: 100%;
    background: var(--surface);
    border-radius: var(--radius-xl);
    padding: var(--space-10) var(--space-8) var(--space-8);
    box-shadow: 0 20px 60px rgba(0,0,0,0.35), 0 0 0 1px var(--border-strong);
    text-align: center;
    position: relative;
    z-index: 1;
  }

  /* Progress bar */
  .progress-track {
    width: 100%;
    height: 4px;
    background: var(--surface-3);
    border-radius: var(--radius-pill);
    overflow: hidden;
    margin-bottom: var(--space-4);
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--primary), var(--accent));
    border-radius: var(--radius-pill);
    transition: width var(--duration-large) var(--ease-standard);
  }

  /* Step dots */
  .step-dots {
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

  /* Step content */
  .step-content { margin-bottom: var(--space-8); }
  .step-icon-wrapper {
    position: relative;
    display: inline-block;
    margin-bottom: var(--space-5);
  }
  .step-icon-glow {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 120%; height: 120%;
    background: radial-gradient(circle, var(--primary-soft) 0%, transparent 60%);
    pointer-events: none;
  }
  .onboarding-card[data-accent="amber"] .step-icon-glow {
    background: radial-gradient(circle, var(--accent-soft) 0%, transparent 60%);
  }
  .step-icon {
    font-size: 4rem;
    position: relative;
    z-index: 1;
  }
  h2 {
    font-size: var(--fs-xl);
    font-weight: var(--fw-semibold);
    margin-bottom: var(--space-3);
    color: var(--text);
    letter-spacing: var(--ls-snug);
  }
  p {
    color: var(--text-muted);
    font-size: var(--fs-md);
    line-height: var(--lh-relaxed);
    max-width: 360px;
    margin: 0 auto;
  }

  /* Telegram bridge */
  .telegram-bridge {
    background: var(--primary-soft);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-6);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    position: relative;
    overflow: hidden;
  }
  .bridge-pulse {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 100%; height: 100%;
    background: radial-gradient(circle, var(--primary-soft) 0%, transparent 70%);
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .bridge-pulse { animation: none; }
  }
  .bridge-icon { font-size: var(--fs-lg); position: relative; z-index: 1; }
  .bridge-text { font-size: var(--fs-sm); color: var(--primary); font-weight: var(--fw-medium); position: relative; z-index: 1; }

  /* Actions */
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

  @media (max-width: 768px) {
    .onboarding-card { padding: var(--space-8) var(--space-5) var(--space-6); }
    .step-icon { font-size: 3rem; }
    h2 { font-size: var(--fs-lg); }
  }
</style>
