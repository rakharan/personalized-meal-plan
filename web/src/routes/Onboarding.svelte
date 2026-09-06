<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { onMount } from 'svelte';

  onMount(() => theme.init());

  // Scroll-driven progressive disclosure — sections reveal as user scrolls
  const sections = [
    {
      icon: '🍽️',
      title: 'Halo! Aku Saji',
      desc: 'Aku bakal bantu kamu makan enak + sehat setiap hari. Bahan-bahan yang aku pilih gampang cari di Indonesia — tempe, kangkung, ikan kembung, dan lainnya.',
    },
    {
      icon: '🎯',
      title: 'Cerita goal kamu',
      desc: 'Mau turun berat badan? Naik mass otot? Atau makan sehat aja? Nanti di bot, kamu jawab beberapa pertanyaan dan aku sesuaikan rencana makan kamu.',
    },
    {
      icon: '🥘',
      title: 'Masakan favorit?',
      desc: 'Indonesia, Jepang, Korea, Mediterania — atau putar tiap hari biar nggak bosen? Kamu pilih di bot nanti, aku masak (secara digital).',
    },
    {
      icon: '🔥',
      title: 'Lanjut ke bot!',
      desc: 'Kamu bakal dibawa ke Telegram buat jawab pertanyaan singkat (goal, alergi, kalori, masakan). Setelah itu, rencana makan kamu langsung siap. Jaga streak tiap hari ya!',
    },
  ];

  // Food emojis for floating background
  const foodEmojis = ['🍚', '🍳', '🥘', '🍲', '🍱', '🥗', '🍜', '🍢', '🐟', '🌶️', '🥬'];

  let activeSection = $state(0);
  let scrollProgress = $state(0);

  function handleScroll() {
    const total = document.body.scrollHeight - window.innerHeight;
    scrollProgress = total > 0 ? (window.scrollY / total) * 100 : 0;

    // Track which section is in view
    const viewportMid = window.scrollY + window.innerHeight / 2;
    const els = document.querySelectorAll('.ob-section');
    els.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const elTop = rect.top + window.scrollY;
      const elBottom = elTop + rect.height;
      if (viewportMid >= elTop && viewportMid < elBottom) {
        activeSection = i;
      }
    });
  }

  onMount(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  });
</script>

<div class="onboarding">
  <!-- Floating food background -->
  <div class="food-bg">
    {#each foodEmojis as emoji, i}
      <span class="food-float" style="--delay: {i * 1.5}s; --x: {5 + (i * 8) % 90}%; --y: {10 + (i * 13) % 80}%; --size: {1.5 + (i % 3) * 0.5}rem">{emoji}</span>
    {/each}
  </div>

  <!-- Scroll progress indicator — thin amber line on left -->
  <div class="scroll-rail">
    <div class="scroll-fill" style="height: {scrollProgress}%"></div>
    {#each sections as _, i}
      <div class="rail-dot" class:active={activeSection === i} class:done={activeSection > i} style="top: {(i + 0.5) * (100 / sections.length)}%"></div>
    {/each}
  </div>

  <!-- Sections -->
  {#each sections as section, i}
    <section class="ob-section" class:active={activeSection === i}>
      <div class="section-inner">
        <div class="icon-glow"></div>
        <div class="section-icon">{section.icon}</div>
        <h2>{section.title}</h2>
        <p>{section.desc}</p>
        {#if i === sections.length - 1}
          <div class="telegram-bridge">
            <div class="bridge-icon">📱</div>
            <div class="bridge-text">Kamu bakal diarahkan ke Telegram</div>
          </div>
          <a href="https://t.me/personalized_meal_planner_bot">
            <Button variant="primary" size="lg">Gas! 🚀</Button>
          </a>
        {/if}
      </div>
    </section>
  {/each}

  <!-- Skip link — always visible -->
  <a href="https://t.me/personalized_meal_planner_bot" class="skip-link">Skip → langsung ke bot</a>
</div>

<style>
  .onboarding {
    position: relative;
    overflow-x: hidden;
  }

  /* Floating food background */
  .food-bg {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }
  .food-float {
    position: absolute;
    left: var(--x);
    top: var(--y);
    font-size: var(--size);
    opacity: 0.05;
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

  /* Scroll progress rail — thin amber line on left edge */
  .scroll-rail {
    position: fixed;
    left: var(--space-2);
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--surface-3);
    z-index: 100;
    border-radius: var(--radius-pill);
  }
  .scroll-fill {
    width: 100%;
    background: linear-gradient(180deg, var(--primary), var(--accent));
    border-radius: var(--radius-pill);
    transition: height 0.1s linear;
  }
  .rail-dot {
    position: absolute;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--surface-3);
    transition: all var(--duration-small) var(--ease-standard);
  }
  .rail-dot.active {
    width: 12px;
    height: 12px;
    background: var(--primary);
    box-shadow: 0 0 0 4px var(--primary-soft);
  }
  .rail-dot.done {
    background: var(--primary);
  }

  /* Sections */
  .ob-section {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-8) var(--space-6);
    position: relative;
    z-index: 1;
    opacity: 0.3;
    transition: opacity var(--duration-large) var(--ease-standard);
  }
  .ob-section.active {
    opacity: 1;
  }

  .section-inner {
    max-width: 480px;
    text-align: center;
    position: relative;
  }

  .icon-glow {
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    width: 120px;
    height: 120px;
    background: radial-gradient(circle, var(--primary-soft) 0%, transparent 60%);
    pointer-events: none;
  }
  .ob-section:nth-child(2) .icon-glow {
    background: radial-gradient(circle, var(--accent-soft) 0%, transparent 60%);
  }

  .section-icon {
    font-size: 4rem;
    margin-bottom: var(--space-5);
    position: relative;
    z-index: 1;
  }

  h2 {
    font-size: clamp(1.5rem, 4vw, 2rem);
    font-weight: var(--fw-bold);
    letter-spacing: var(--ls-tight);
    margin-bottom: var(--space-4);
    color: var(--text);
  }

  p {
    font-size: 1.05rem;
    color: var(--text-muted);
    line-height: var(--lh-relaxed);
    margin-bottom: var(--space-6);
    max-width: 420px;
    margin-left: auto;
    margin-right: auto;
  }

  /* Telegram bridge */
  .telegram-bridge {
    background: var(--primary-soft);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-5);
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  .bridge-icon { font-size: var(--fs-lg); }
  .bridge-text { font-size: var(--fs-sm); color: var(--primary); font-weight: var(--fw-medium); }

  /* Skip link */
  .skip-link {
    display: block;
    text-align: center;
    padding: var(--space-6) var(--space-4);
    font-size: var(--fs-sm);
    color: var(--text-faint);
    text-decoration: none;
    position: relative;
    z-index: 1;
  }
  .skip-link:hover { color: var(--text-subtle); }

  @media (max-width: 768px) {
    .section-icon { font-size: 3rem; }
    .scroll-rail { display: none; }
  }
</style>
