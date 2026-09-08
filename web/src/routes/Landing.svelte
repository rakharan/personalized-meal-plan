<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import PublicLayout from '$lib/components/PublicLayout.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { onMount } from 'svelte';

  onMount(() => theme.init());

  const samplePlan = [
    { meal: 'Sarapan', items: 'Nasi merah, telur dadar, tempe goreng', cal: 450, protein: 25 },
    { meal: 'Makan Siang', items: 'Ayam bakar, sayur asem, nasi putih', cal: 650, protein: 40 },
    { meal: 'Makan Malam', items: 'Sup ikan kembung, kangkung tumis', cal: 400, protein: 35 },
  ];
  const totalCal = samplePlan.reduce((s, m) => s + m.cal, 0);
  const totalProtein = samplePlan.reduce((s, m) => s + m.protein, 0);

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
      <div class="hero-text">
        <div class="hero-badge">Asisten makan harian</div>
        <h1>Mau makan enak <span class="accent-text">hari ini?</span></h1>
        <p class="hero-tagline">
          Saji bikin rencana makan harian yang enak, sehat, dan sesuai goal kamu —
          pakai bahan yang gampang cari di Indonesia. Bukan quinoa, bukan kale.
          Tempe, kangkung, ikan kembung.
        </p>
        <div class="hero-cta">
          <a href="#/signup"><Button variant="primary" size="lg">Mulai dong!</Button></a>
          <a href="#/sample"><Button variant="ghost" size="lg">Lihat contoh dulu</Button></a>
        </div>
      </div>
      <div class="hero-visual">
        <div class="glow-leaf"></div>
        <div class="glow-amber"></div>
        <div class="phone-mockup">
          <div class="phone-notch"></div>
          <div class="phone-screen">
            <div class="phone-statusbar">
              <span>9:41</span>
              <span class="phone-status-icons">📶 🔋</span>
            </div>
            <div class="phone-chat">
              <div class="phone-msg bot">
                <div class="msg-avatar">🍽️</div>
                <div class="msg-bubble">
                  Halo! Aku Saji. Bakal bantu kamu makan enak + sehat setiap hari. Mau mulai?
                </div>
              </div>
              <div class="phone-msg user">
                <div class="msg-bubble">Gas!</div>
              </div>
              <div class="phone-msg bot">
                <div class="msg-avatar">🍽️</div>
                <div class="msg-bubble msg-plan">
                  <div class="plan-cuisine">🇮🇩 Hari ini: Masakan Indonesia</div>
                  {#each samplePlan as m}
                    <div class="plan-meal">
                      <div class="meal-row">
                        <span class="meal-emoji">
                          {m.meal === 'Sarapan' ? '🍳' : m.meal === 'Makan Siang' ? '🍱' : '🌙'}
                        </span>
                        <div class="meal-info">
                          <div class="meal-name">{m.meal}</div>
                          <div class="meal-items">{m.items}</div>
                        </div>
                      </div>
                      <div class="meal-macros">
                        <span class="macro-cal">{m.cal} kal</span>
                        <span class="macro-protein">{m.protein}g protein</span>
                      </div>
                    </div>
                  {/each}
                  <div class="plan-total">
                    Total: {totalCal} kal · {totalProtein}g protein
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Social proof strip -->
    <section class="proof-strip">
      <div class="proof-item"><strong>3</strong><span>detik setup</span></div>
      <div class="proof-divider"></div>
      <div class="proof-item"><strong>8+</strong><span>masakan</span></div>
      <div class="proof-divider"></div>
      <div class="proof-item"><strong>100%</strong><span>bahan lokal</span></div>
      <div class="proof-divider"></div>
      <div class="proof-item"><strong>EN/ID</strong><span>bilingual</span></div>
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
      <h2>Yuk mulai hari ini</h2>
      <p>Rencana makan pertama kamu cuma 3 detik lagi.</p>
      <a href="#/signup"><Button variant="primary" size="lg">Ayo buat!</Button></a>
    </section>
  </div>
</PublicLayout>

<style>
  .home { max-width: 900px; margin: 0 auto; }

  /* Hero */
  .hero {
    display: grid; grid-template-columns: 1.1fr 0.9fr;
    gap: var(--space-10); align-items: center;
    min-height: 70vh; padding: var(--space-10) 0;
    position: relative;
  }
  .hero-badge {
    display: inline-flex; align-items: center; gap: var(--space-1);
    padding: var(--space-1) var(--space-3);
    background: var(--primary-soft); color: var(--primary);
    border-radius: var(--radius-pill); font-size: var(--fs-sm);
    font-weight: var(--fw-medium); margin-bottom: var(--space-5);
    border: 1px solid rgba(82, 183, 136, 0.2);
  }
  .hero h1 {
    font-size: clamp(2rem, 5vw, 3.2rem); font-weight: var(--fw-bold);
    letter-spacing: var(--ls-tight); line-height: var(--lh-tight);
    margin-bottom: var(--space-5);
  }
  .accent-text { color: var(--primary); }
  .hero-tagline {
    font-size: 1.05rem; color: var(--text-muted); line-height: var(--lh-relaxed);
    margin-bottom: var(--space-6); max-width: 440px;
  }
  .hero-cta { display: flex; gap: var(--space-3); flex-wrap: wrap; }

  /* Phone mockup */
  .hero-visual { position: relative; display: flex; justify-content: center; }
  .glow-leaf {
    position: absolute; top: 5%; left: 0; width: 70%; height: 60%;
    background: radial-gradient(ellipse, var(--primary-soft) 0%, transparent 55%);
    pointer-events: none;
  }
  .glow-amber {
    position: absolute; bottom: 5%; right: 0; width: 60%; height: 50%;
    background: radial-gradient(ellipse, var(--accent-soft) 0%, transparent 55%);
    pointer-events: none;
  }
  .phone-mockup {
    width: 320px; max-width: 100%;
    background: var(--surface); border-radius: 2rem;
    box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px var(--border-strong);
    padding: var(--space-2); position: relative; z-index: 1;
  }
  .phone-notch { width: 40%; height: 6px; background: var(--bg); border-radius: 0 0 8px 8px; margin: 0 auto; }
  .phone-screen { background: var(--bg); border-radius: 1.5rem; overflow: hidden; }
  .phone-statusbar { display: flex; justify-content: space-between; padding: var(--space-2) var(--space-3); font-size: var(--fs-xs); color: var(--text-subtle); }
  .phone-chat { padding: var(--space-2) var(--space-2) var(--space-3); }
  .phone-msg { display: flex; gap: var(--space-2); margin-bottom: var(--space-2); }
  .phone-msg.user { justify-content: flex-end; }
  .msg-avatar { width: 28px; height: 28px; background: var(--surface-3); border-radius: var(--radius-pill); display: flex; align-items: center; justify-content: center; font-size: var(--fs-sm); flex-shrink: 0; }
  .msg-bubble { background: var(--surface-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md) var(--radius-md) var(--radius-md) 2px; font-size: var(--fs-xs); line-height: var(--lh-normal); color: var(--text); max-width: 85%; }
  .phone-msg.user .msg-bubble { background: var(--primary); color: var(--bg); border-radius: var(--radius-md) var(--radius-md) 2px var(--radius-md); font-weight: var(--fw-medium); }
  .msg-plan { padding: var(--space-3); max-width: 88%; }
  .plan-cuisine { font-size: var(--fs-xs); font-weight: var(--fw-semibold); color: var(--accent); margin-bottom: var(--space-2); padding-bottom: var(--space-2); border-bottom: 1px solid var(--border); }
  .plan-meal { display: flex; justify-content: space-between; align-items: center; padding: var(--space-1) 0; gap: var(--space-2); }
  .meal-row { display: flex; gap: var(--space-2); align-items: flex-start; flex: 1; }
  .meal-emoji { font-size: var(--fs-md); }
  .meal-info { flex: 1; }
  .meal-name { font-size: var(--fs-xs); font-weight: var(--fw-semibold); color: var(--text); }
  .meal-items { font-size: 0.65rem; color: var(--text-subtle); line-height: 1.3; }
  .meal-macros { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; flex-shrink: 0; }
  .macro-cal { font-size: 0.65rem; color: var(--primary); font-weight: var(--fw-medium); font-variant-numeric: tabular-nums; }
  .macro-protein { font-size: 0.6rem; color: var(--text-faint); font-variant-numeric: tabular-nums; }
  .plan-total { margin-top: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--border); font-size: 0.65rem; color: var(--text-muted); font-variant-numeric: tabular-nums; }

  /* Proof strip */
  .proof-strip {
    display: flex; justify-content: center; align-items: center; gap: var(--space-8);
    padding: var(--space-6) 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
    margin-bottom: var(--space-10);
  }
  .proof-item { text-align: center; }
  .proof-item strong { display: block; font-size: var(--fs-xl); color: var(--primary); font-variant-numeric: tabular-nums; font-weight: var(--fw-bold); }
  .proof-item span { font-size: var(--fs-sm); color: var(--text-subtle); }
  .proof-divider { width: 1px; height: 32px; background: var(--border); }

  /* Teasers */
  .teasers { padding: var(--space-6) 0 var(--space-10); }
  .teasers h2 { font-size: var(--fs-2xl); font-weight: var(--fw-semibold); text-align: center; margin-bottom: var(--space-8); }
  .teaser-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-5); }
  .teaser-card {
    background: var(--surface); border-radius: var(--radius-xl); padding: var(--space-6);
    border: 1px solid var(--border); text-decoration: none; color: var(--text);
    display: flex; flex-direction: column; gap: var(--space-3);
    transition: border-color var(--duration-micro) var(--ease-standard), box-shadow var(--duration-micro) var(--ease-standard);
  }
  .teaser-card:hover { border-color: var(--primary); box-shadow: var(--shadow-elevation-2); }
  .teaser-emoji { font-size: 2.5rem; }
  .teaser-card h3 { font-size: var(--fs-lg); font-weight: var(--fw-semibold); }
  .teaser-card p { color: var(--text-muted); font-size: var(--fs-sm); line-height: var(--lh-normal); flex: 1; }
  .teaser-link { color: var(--primary); font-size: var(--fs-sm); font-weight: var(--fw-medium); }

  /* CTA */
  .cta {
    text-align: center; padding: var(--space-10) var(--space-6);
    background: var(--surface); border-radius: var(--radius-xl);
    margin-bottom: var(--space-10); position: relative; overflow: hidden;
  }
  .cta-glow {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 80%; height: 150%;
    background: radial-gradient(ellipse, var(--primary-soft) 0%, transparent 60%);
    pointer-events: none;
  }
  .cta h2, .cta p, .cta a { position: relative; z-index: 1; }
  .cta h2 { font-size: var(--fs-2xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-3); }
  .cta p { color: var(--text-muted); margin-bottom: var(--space-6); font-size: var(--fs-md); }

  @media (max-width: 768px) {
    .hero { grid-template-columns: 1fr; text-align: center; }
    .hero-cta { justify-content: center; }
    .hero-tagline { margin: 0 auto var(--space-6); }
    .hero-visual { order: -1; }
    .teaser-grid { grid-template-columns: 1fr; }
    .proof-strip { flex-wrap: wrap; gap: var(--space-4); }
    .proof-divider { display: none; }
  }
</style>
