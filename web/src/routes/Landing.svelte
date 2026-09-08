<script lang="ts">
  import PublicLayout from '$lib/components/PublicLayout.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { onMount } from 'svelte';

  onMount(() => theme.init());

  const samplePlan = [
    { meal: 'Sarapan', items: 'Nasi merah, telur dadar, tempe goreng', cal: 450, protein: 25, emoji: '🍳' },
    { meal: 'Makan Siang', items: 'Ayam bakar kecap, sayur asem, nasi', cal: 650, protein: 40, emoji: '🍱' },
    { meal: 'Makan Malam', items: 'Sup ikan kembung, kangkung tumis', cal: 400, protein: 35, emoji: '🌙' },
  ];
  const totalCal = samplePlan.reduce((s, m) => s + m.cal, 0);
  const totalProtein = samplePlan.reduce((s, m) => s + m.protein, 0);

  const proofs = [
    { num: '3s', label: 'setup' },
    { num: '8+', label: 'masakan' },
    { num: '100%', label: 'bahan lokal' },
    { num: '0', label: 'keputusan' },
  ];

  const teasers = [
    { href: '#/sample', emoji: '🍛', title: 'Lihat Rencana Sample', desc: '3 rencana makan lengkap dari masakan berbeda — Indonesia, Jepang, Mediterania. Bahan, kalori, protein, semua ada.' },
    { href: '#/fitur', emoji: '🥘', title: 'Fitur Saji', desc: 'Generator bahan lokal, rotasi masakan, makro lengkap, daftar belanja sekali klik, panduan masak step-by-step.' },
    { href: '#/masakan', emoji: '🍜', title: '8 Masakan', desc: 'Indonesia, Jepang, Korea, Mediterania, Thai, Vietnam, India, Meksiko. Rotasi harian, nggak bosen.' },
  ];
</script>

<PublicLayout current="#/">
  <div class="home">
    <!-- Hero -->
    <section class="hero">
      <div class="hero-bg" aria-hidden="true">
        <div class="blob blob-1"></div>
        <div class="blob blob-2"></div>
        <div class="blob blob-3"></div>
      </div>

      <div class="hero-inner">
        <div class="hero-copy anim-rise" style="animation-delay: .1s">
          <div class="hero-badge">Asisten makan harian</div>
          <h1 class="hero-title">
            Makan <em>enak</em> hari ini.<br />
            <span class="hero-no-think">Tanpa mikir.</span>
          </h1>
          <p class="hero-sub">
            Saji udah siapin rencana makan kamu — bahan lokal, sesuai goal, tinggal masak.
          </p>
          <div class="hero-cta anim-rise" style="animation-delay: .3s">
            <a href="#/signup" class="btn-hero">
              Lihat plan hari ini
              <span class="btn-arrow" aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Live plan preview -->
      <div class="plan-preview anim-rise" style="animation-delay: .45s">
        <div class="plan-preview-glow" aria-hidden="true"></div>
        <div class="plan-preview-header">
          <h3>Hari ini</h3>
          <span class="cuisine-tag">Masakan Indonesia</span>
        </div>
        {#each samplePlan as m}
          <div class="preview-meal">
            <span class="meal-emoji" aria-hidden="true">{m.emoji}</span>
            <div class="meal-main">
              <div class="meal-name">{m.meal}</div>
              <div class="meal-items">{m.items}</div>
            </div>
            <div class="meal-macros">
              <span class="macro-tag cal">{m.cal} kal</span>
              <span class="macro-tag protein">{m.protein}g</span>
            </div>
          </div>
        {/each}
        <div class="plan-preview-footer">
          <span class="total">{totalCal} kkal · {totalProtein}g protein</span>
          <span class="note">Bahan dari pasar terdekat</span>
        </div>
      </div>
    </section>

    <!-- Social proof -->
    <section class="proof-strip anim-rise" style="animation-delay: .6s">
      {#each proofs as p}
        <div class="proof-item">
          <div class="num">{p.num}</div>
          <div class="label">{p.label}</div>
        </div>
      {/each}
    </section>

    <!-- Teaser cards -->
    <section class="teasers">
      <h2>Kenalan dulu</h2>
      <div class="teaser-grid">
        {#each teasers as t}
          <a href={t.href} class="teaser-card">
            <div class="teaser-emoji">{t.emoji}</div>
            <h3>{t.title}</h3>
            <p>{t.desc}</p>
            <span class="teaser-link">Lihat →</span>
          </a>
        {/each}
      </div>
    </section>

    <!-- CTA -->
    <section class="cta">
      <div class="cta-glow"></div>
      <h2>Plan pertama kamu 3 detik lagi</h2>
      <p>Daftar sekarang, makan enak hari ini juga.</p>
      <a href="#/signup" class="btn-hero">Ayo mulai</a>
    </section>
  </div>
</PublicLayout>

<style>
  .home { max-width: 1000px; margin: 0 auto; }

  /* ── Hero ── */
  .hero { position: relative; padding: var(--space-10) 0 var(--space-8); text-align: center; }

  /* Animated background blobs */
  .hero-bg { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
  .blob { position: absolute; border-radius: 50%; filter: blur(70px); opacity: .5; }
  .blob-1 { width: 480px; height: 480px; background: var(--primary-soft); top: -140px; right: -120px; animation: drift 22s ease-in-out infinite; }
  .blob-2 { width: 400px; height: 400px; background: var(--accent-soft); bottom: -100px; left: -140px; animation: drift 26s ease-in-out infinite reverse; }
  .blob-3 { width: 280px; height: 280px; background: linear-gradient(135deg, var(--primary-soft), var(--accent-soft)); top: 40%; left: 20%; animation: pulse 16s ease-in-out infinite; }
  @keyframes drift {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(30px, -30px) scale(1.05); }
    66% { transform: translate(-20px, 20px) scale(.95); }
  }
  @keyframes pulse {
    0%, 100% { opacity: .35; transform: scale(1); }
    50% { opacity: .55; transform: scale(1.1); }
  }

  /* Entrance animations */
  .anim-rise { opacity: 0; animation: fadeUp .8s cubic-bezier(.22, 1, .36, 1) forwards; }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(28px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .hero-inner { position: relative; z-index: 1; }
  .hero-copy { margin-bottom: var(--space-8); }
  .hero-badge {
    display: inline-flex; padding: var(--space-1) var(--space-3);
    background: var(--primary-soft); color: var(--primary);
    border-radius: var(--radius-pill); font-size: var(--fs-sm);
    font-weight: var(--fw-medium); border: 1px solid rgba(82, 183, 136, .25);
  }
  .hero-title {
    font-size: clamp(2.6rem, 6.5vw, 4rem);
    font-weight: var(--fw-bold); letter-spacing: var(--ls-tight);
    line-height: 1.08; margin: var(--space-5) 0 var(--space-5);
  }
  .hero-title em {
    color: var(--primary); font-style: normal; position: relative;
  }
  .hero-title em::after {
    content: ''; position: absolute; bottom: .06em; left: -2%; right: -2%;
    height: .38em; background: var(--primary-soft); z-index: -1;
    border-radius: .1em .18em .1em .22em; transform: rotate(-1deg);
  }
  .hero-no-think { color: var(--text); }
  .hero-sub {
    font-size: var(--fs-lg); color: var(--text-muted);
    max-width: 460px; margin: 0 auto var(--space-6); line-height: var(--lh-relaxed);
  }

  .hero-cta { display: flex; justify-content: center; }

  /* Primary button w/ shine sweep */
  .btn-hero {
    display: inline-flex; align-items: center; gap: var(--space-2);
    background: var(--primary); color: var(--text-on-primary);
    padding: var(--space-3) var(--space-6); border-radius: var(--radius-pill);
    font-size: var(--fs-md); font-weight: var(--fw-semibold);
    text-decoration: none; box-shadow: 0 4px 20px rgba(45, 106, 79, .3);
    transition: transform var(--duration-small) cubic-bezier(.34, 1.56, .64, 1),
                box-shadow var(--duration-small) var(--ease-standard);
    position: relative; overflow: hidden; cursor: pointer;
  }
  .btn-hero::after {
    content: ''; position: absolute; top: -50%; left: -50%;
    width: 200%; height: 200%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .25), transparent);
    transform: rotate(30deg) translateX(-120%);
    transition: transform .6s ease;
  }
  .btn-hero:hover::after { transform: rotate(30deg) translateX(120%); }
  .btn-hero:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 8px 32px rgba(45, 106, 79, .45);
  }
  .btn-arrow { transition: transform var(--duration-small) var(--ease-standard); }
  .btn-hero:hover .btn-arrow { transform: translateX(3px); }

  /* ── Plan preview card ── */
  .plan-preview {
    position: relative; z-index: 1;
    background: var(--surface); border-radius: 24px 28px 20px 32px;
    padding: var(--space-6); border: 1px solid var(--border);
    box-shadow: var(--shadow-elevation-2); max-width: 640px;
    margin: var(--space-8) auto 0; text-align: left; overflow: hidden;
    transition: transform var(--duration-large) var(--ease-standard),
                box-shadow var(--duration-large) var(--ease-standard);
  }
  .plan-preview:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-elevation-3);
  }
  .plan-preview::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
    background: linear-gradient(90deg, var(--primary), var(--accent), var(--primary), var(--accent));
    background-size: 300% 100%; animation: shimmer 5s linear infinite;
  }
  @keyframes shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
  }
  .plan-preview-glow {
    position: absolute; top: -40%; right: -10%; width: 300px; height: 300px;
    background: radial-gradient(circle, var(--accent-soft) 0%, transparent 60%);
    pointer-events: none;
  }
  .plan-preview-header {
    display: flex; justify-content: space-between; align-items: center;
    gap: var(--space-3); margin-bottom: var(--space-4); flex-wrap: wrap;
  }
  .plan-preview-header h3 { font-size: var(--fs-xl); font-weight: var(--fw-bold); letter-spacing: var(--ls-snug); }
  .cuisine-tag {
    background: linear-gradient(135deg, var(--primary-soft), var(--accent-soft));
    color: var(--primary); padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-pill); font-size: var(--fs-xs); font-weight: var(--fw-semibold);
  }
  .preview-meal {
    display: flex; align-items: flex-start; gap: var(--space-3);
    padding: var(--space-3) 0; border-bottom: 1px solid var(--border);
    transition: background var(--duration-micro) var(--ease-standard);
  }
  .preview-meal:last-of-type { border-bottom: none; }
  .preview-meal:hover { background: var(--surface-2); margin: 0 calc(var(--space-3) * -1); padding-left: var(--space-3); padding-right: var(--space-3); border-radius: var(--radius-md); }
  .meal-emoji { font-size: var(--fs-xl); line-height: 1; margin-top: 2px; }
  .meal-main { flex: 1; min-width: 0; }
  .meal-name { font-weight: var(--fw-semibold); font-size: var(--fs-sm); margin-bottom: 2px; }
  .meal-items { font-size: var(--fs-xs); color: var(--text-subtle); line-height: var(--lh-normal); }
  .meal-macros { display: flex; gap: var(--space-2); flex-shrink: 0; margin-left: var(--space-2); flex-wrap: wrap; justify-content: flex-end; }
  .macro-tag {
    font-family: var(--font-mono); font-size: var(--fs-xs); font-weight: var(--fw-medium);
    padding: 2px var(--space-2); border-radius: var(--radius-pill);
    white-space: nowrap;
  }
  .macro-tag.cal { background: var(--primary-soft); color: var(--primary); }
  .macro-tag.protein { background: var(--accent-soft); color: var(--accent); }
  .plan-preview-footer {
    margin-top: var(--space-4); padding-top: var(--space-3);
    border-top: 1px solid var(--border);
    display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); flex-wrap: wrap;
  }
  .plan-preview-footer .total {
    font-family: var(--font-mono); font-size: var(--fs-sm); font-weight: var(--fw-medium);
    color: var(--primary); font-variant-numeric: tabular-nums;
  }
  .plan-preview-footer .note { font-size: var(--fs-xs); color: var(--text-faint); }

  /* ── Proof strip ── */
  .proof-strip {
    display: flex; justify-content: center; gap: var(--space-10);
    padding: var(--space-6) var(--space-4); margin: var(--space-6) auto 0;
    background: var(--surface); border-radius: 24px 28px 20px 32px;
    border: 1px solid var(--border); max-width: 700px;
  }
  .proof-item { text-align: center; }
  .proof-item .num {
    font-size: var(--fs-2xl); font-weight: var(--fw-bold); color: var(--primary);
    font-family: var(--font-mono); letter-spacing: var(--ls-snug);
  }
  .proof-item .label { font-size: var(--fs-xs); color: var(--text-subtle); margin-top: 2px; }

  /* ── Teasers ── */
  .teasers { padding: var(--space-10) 0; }
  .teasers h2 { font-size: var(--fs-2xl); font-weight: var(--fw-semibold); text-align: center; margin-bottom: var(--space-8); }
  .teaser-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-5); }
  .teaser-card {
    background: var(--surface); border-radius: 20px 24px 16px 28px; padding: var(--space-6);
    border: 1px solid var(--border); text-decoration: none; color: var(--text);
    display: flex; flex-direction: column; gap: var(--space-3);
    transition: border-color var(--duration-micro) var(--ease-standard),
                box-shadow var(--duration-micro) var(--ease-standard),
                transform var(--duration-micro) var(--ease-standard);
  }
  .teaser-card:hover { border-color: var(--primary); box-shadow: var(--shadow-elevation-2); transform: translateY(-2px); }
  .teaser-emoji { font-size: 2.5rem; }
  .teaser-card h3 { font-size: var(--fs-lg); font-weight: var(--fw-semibold); }
  .teaser-card p { color: var(--text-muted); font-size: var(--fs-sm); line-height: var(--lh-normal); flex: 1; }
  .teaser-link { color: var(--primary); font-size: var(--fs-sm); font-weight: var(--fw-medium); }

  /* ── CTA ── */
  .cta {
    text-align: center; padding: var(--space-10) var(--space-6);
    background: var(--surface); border-radius: 28px 32px 24px 36px;
    margin-bottom: var(--space-10); position: relative; overflow: hidden;
  }
  .cta-glow {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 70%; height: 140%;
    background: radial-gradient(ellipse, var(--primary-soft) 0%, transparent 60%);
    pointer-events: none;
  }
  .cta h2, .cta p, .cta a { position: relative; z-index: 1; }
  .cta h2 { font-size: var(--fs-2xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-3); }
  .cta p { color: var(--text-muted); margin-bottom: var(--space-6); font-size: var(--fs-md); }

  @media (prefers-reduced-motion: reduce) {
    .anim-rise { opacity: 1; animation: none; }
    .blob, .plan-preview::before { animation: none; }
    .btn-hero::after { display: none; }
    .plan-preview:hover, .btn-hero:hover { transform: none; }
  }

  @media (max-width: 768px) {
    .hero { padding: var(--space-6) 0; }
    .proof-strip { flex-wrap: wrap; gap: var(--space-4); padding: var(--space-5) var(--space-3); }
    .proof-item { flex: 1 1 40%; }
    .teaser-grid { grid-template-columns: 1fr; }
    .preview-meal { flex-wrap: wrap; }
    .meal-macros { justify-content: flex-start; margin-left: calc(var(--space-5) + var(--space-3)); }
  }
</style>
