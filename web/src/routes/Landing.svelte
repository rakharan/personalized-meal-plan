<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { onMount } from 'svelte';

  onMount(() => theme.init());

  const features = [
    { icon: '🎯', title: 'Sesuai Goal', desc: 'Bulking? Cutting? Maintenance? Rencana disesuaikan dengan target kamu.' },
    { icon: '🥘', title: 'Bahan Lokal', desc: 'Tempe, kangkung, ikan kembung — bukan quinoa atau kale yang susah cari.' },
    { icon: '🔥', title: 'Streak Harian', desc: 'Konsisten makan enak tiap hari. Streak bikin kamu tetap semangat.' },
    { icon: '🛒', title: 'Daftar Belanja', desc: 'Satu klik, langsung dapet daftar bahan yang perlu dibeli.' },
    { icon: '📊', title: 'Makro Lengkap', desc: 'Kalori, protein, karbo, lemak — semua terhitung per meal.' },
    { icon: '🍳', title: 'Panduan Masak', desc: 'Step-by-step tiap meal: alat, langkah, plus saran penyajian.' },
  ];

  const steps = [
    { num: 1, title: 'Set preferensi', desc: 'Jawab beberapa pertanyaan: goal, alergi, kalori, masakan favorit.' },
    { num: 2, title: 'Generate rencana', desc: 'Saji bikin rencana makan harian dengan bahan yang ada di Indonesia.' },
    { num: 3, title: 'Makan enak', desc: 'Ikuti rencana, jaga streak, request daftar belanja kapan saja.' },
  ];

  const cuisines = ['Indonesia', 'Jepang', 'Korea', 'Mediterania', 'Meksiko', 'India', 'Thai', 'Vietnam'];
</script>

<div class="landing">
  <!-- Hero -->
  <section class="hero">
    <div class="hero-content">
      <div class="hero-badge">🍱 Asisten makan harian</div>
      <h1>Mau makan enak <span>hari ini?</span></h1>
      <p class="hero-tagline">
        Saji bikin rencana makan harian yang enak, sehat, dan sesuai goal kamu —
        pakai bahan yang gampang cari di Indonesia.
      </p>
      <div class="hero-cta">
        <a href="#/signup">
          <Button variant="primary" size="lg">Mulai dong! →</Button>
        </a>
        <a href="#/login"><Button variant="ghost" size="lg">Sudah punya akun?</Button></a>
      </div>
      <div class="hero-bridge-hint">
        <span class="bridge-icon">📱</span>
        <span>Daftar gratis, pilih Telegram atau WhatsApp buat terima rencana</span>
      </div>
      <div class="hero-stats">
        <div><strong>3</strong> detik setup</div>
        <div><strong>4+</strong> masakan</div>
        <div><strong>100%</strong> bahan lokal</div>
      </div>
    </div>
    <div class="hero-visual">
      <div class="phone-mockup">
        <div class="phone-screen">
          <div class="phone-header">Saji 🍽️</div>
          <div class="phone-msg bot">
            Halo! Aku Saji. Bakal bantu kamu makan enak + sehat setiap hari. Mau mulai?
          </div>
          <div class="phone-msg user">Gas!</div>
          <div class="phone-msg bot">
            Hari ini: Masakan Indonesia 🇮🇩<br><br>
            🍳 Sarapan — Nasi merah + telur dadar + tempe goreng<br>
            ~450 kal · 25g protein<br><br>
            🍱 Makan siang — Ayam bakar + sayur asem + nasi<br>
            ~650 kal · 40g protein<br><br>
            🌙 Makan malam — Sup ikan kembung + kangkung<br>
            ~400 kal · 35g protein
          </div>
          <div class="phone-buttons">
            <span class="phone-btn">🎲 Regenerasi</span>
            <span class="phone-btn">🛒 Belanja</span>
            <span class="phone-btn">📊 Makro</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Features -->
  <section id="features" class="features">
    <h2>Kenapa Saji?</h2>
    <div class="feature-grid">
      {#each features as f}
        <div class="feature-card">
          <div class="feature-icon">{f.icon}</div>
          <h3>{f.title}</h3>
          <p>{f.desc}</p>
        </div>
      {/each}
    </div>
  </section>

  <!-- How it works -->
  <section class="how-it-works">
    <h2>Cara kerja</h2>
    <div class="steps">
      {#each steps as step}
        <div class="step-card">
          <div class="step-num">{step.num}</div>
          <h3>{step.title}</h3>
          <p>{step.desc}</p>
        </div>
      {/each}
    </div>
  </section>

  <!-- Cuisines -->
  <section class="cuisines-section">
    <h2>Putar masakan, nggak bosen</h2>
    <div class="cuisine-pills">
      {#each cuisines as c}
        <span class="cuisine-pill">{c}</span>
      {/each}
    </div>
  </section>

  <!-- CTA -->
  <section class="cta">
    <h2>Yuk mulai hari ini</h2>
    <p>Rencana makan pertama kamu cuma 3 detik lagi.</p>
    <a href="#/signup">
      <Button variant="primary" size="lg">Ayo buat! 🚀</Button>
    </a>
  </section>

  <!-- Footer -->
  <footer>
    <div class="footer-content">
      <div class="footer-brand">Saji 🍽️</div>
      <p>Asisten makan harian — bikin kamu makan enak, sehat, dan sesuai goal.</p>
      <p class="footer-meta">Dibuat dengan 🤍 di Indonesia</p>
    </div>
  </footer>
</div>

<style>
  .landing { max-width: 1200px; margin: 0 auto; padding: 0 var(--space-6); }

  /* Hero */
  .hero {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-10);
    align-items: center;
    min-height: 80vh;
    padding: var(--space-12) 0;
  }
  .hero-badge {
    display: inline-block;
    padding: var(--space-1) var(--space-3);
    background: var(--primary-soft);
    color: var(--primary);
    border-radius: var(--radius-pill);
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
    margin-bottom: var(--space-4);
  }
  .hero h1 {
    font-size: clamp(2rem, 5vw, 3.5rem);
    font-weight: var(--fw-bold);
    letter-spacing: var(--ls-tight);
    line-height: var(--lh-tight);
    margin-bottom: var(--space-4);
  }
  .hero h1 span { color: var(--primary); }
  .hero-tagline {
    font-size: var(--fs-md);
    color: var(--text-muted);
    line-height: var(--lh-relaxed);
    margin-bottom: var(--space-6);
    max-width: 500px;
  }
  .hero-cta { display: flex; gap: var(--space-3); margin-bottom: var(--space-4); }
  .hero-bridge-hint {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-8);
    font-size: var(--fs-sm);
    color: var(--text-faint);
  }
  .bridge-icon { font-size: var(--fs-md); }
  .hero-stats { display: flex; gap: var(--space-6); }
  .hero-stats div { font-size: var(--fs-sm); color: var(--text-subtle); }
  .hero-stats strong { display: block; font-size: var(--fs-xl); color: var(--text); font-variant-numeric: tabular-nums; }

  /* Phone mockup */
  .phone-mockup {
    width: 320px;
    max-width: 100%;
    margin: 0 auto;
    background: var(--surface);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-elevation-3);
    padding: var(--space-3);
    border: 1px solid var(--border-strong);
  }
  .phone-screen {
    background: var(--bg);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .phone-header {
    padding: var(--space-3);
    font-weight: var(--fw-semibold);
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .phone-msg {
    padding: var(--space-3);
    margin: var(--space-2);
    border-radius: var(--radius-md);
    font-size: var(--fs-xs);
    line-height: var(--lh-normal);
  }
  .phone-msg.bot { background: var(--surface-2); color: var(--text); }
  .phone-msg.user { background: var(--primary); color: var(--bg); text-align: right; }
  .phone-buttons { display: flex; gap: var(--space-1); padding: var(--space-2); }
  .phone-btn {
    font-size: var(--fs-xs);
    padding: var(--space-1) var(--space-2);
    background: var(--surface-2);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
  }

  /* Features */
  .features { padding: var(--space-12) 0; }
  .features h2, .how-it-works h2, .cuisines-section h2, .cta h2 {
    font-size: var(--fs-2xl);
    font-weight: var(--fw-semibold);
    letter-spacing: var(--ls-snug);
    margin-bottom: var(--space-8);
    text-align: center;
  }
  .feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--space-4);
  }
  .feature-card {
    background: var(--surface);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    box-shadow: var(--shadow-elevation-1);
    transition: box-shadow var(--duration-small) var(--ease-standard);
  }
  .feature-card:hover { box-shadow: var(--shadow-elevation-2); }
  .feature-icon { font-size: 2rem; margin-bottom: var(--space-3); }
  .feature-card h3 { font-size: var(--fs-md); font-weight: var(--fw-semibold); margin-bottom: var(--space-2); }
  .feature-card p { color: var(--text-muted); font-size: var(--fs-sm); line-height: var(--lh-normal); }

  /* How it works */
  .how-it-works { padding: var(--space-12) 0; }
  .steps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--space-4);
  }
  .step-card {
    text-align: center;
    padding: var(--space-6);
  }
  .step-num {
    width: 48px; height: 48px;
    background: var(--primary-soft);
    color: var(--primary);
    border-radius: var(--radius-pill);
    display: flex; align-items: center; justify-content: center;
    font-size: var(--fs-xl);
    font-weight: var(--fw-bold);
    margin: 0 auto var(--space-4);
  }
  .step-card h3 { font-size: var(--fs-md); font-weight: var(--fw-semibold); margin-bottom: var(--space-2); }
  .step-card p { color: var(--text-muted); font-size: var(--fs-sm); }

  /* Cuisines */
  .cuisines-section { padding: var(--space-12) 0; text-align: center; }
  .cuisine-pills {
    display: flex; flex-wrap: wrap; gap: var(--space-2);
    justify-content: center; max-width: 800px; margin: 0 auto;
  }
  .cuisine-pill {
    padding: var(--space-2) var(--space-4);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    font-size: var(--fs-sm);
    color: var(--text-muted);
    transition: all var(--duration-micro) var(--ease-standard);
  }
  .cuisine-pill:hover { border-color: var(--primary); color: var(--primary); }

  /* CTA */
  .cta {
    padding: var(--space-12) 0;
    text-align: center;
    background: var(--surface);
    border-radius: var(--radius-xl);
    margin-bottom: var(--space-12);
  }
  .cta p { color: var(--text-muted); margin-bottom: var(--space-6); font-size: var(--fs-md); }

  /* Footer */
  footer {
    border-top: 1px solid var(--border);
    padding: var(--space-8) 0;
    text-align: center;
  }
  .footer-brand { font-size: var(--fs-lg); font-weight: var(--fw-semibold); margin-bottom: var(--space-2); }
  footer p { color: var(--text-subtle); font-size: var(--fs-sm); }
  .footer-meta { margin-top: var(--space-2); color: var(--text-faint); }

  @media (max-width: 768px) {
    .hero { grid-template-columns: 1fr; text-align: center; }
    .hero-cta, .hero-stats { justify-content: center; }
    .hero-tagline { margin: 0 auto var(--space-6); }
  }
</style>
