<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { onMount } from 'svelte';

  onMount(() => theme.init());

  // Sample plan for phone mockup — real Indonesian food
  const samplePlan = [
    { meal: 'Sarapan', items: 'Nasi merah, telur dadar, tempe goreng', cal: 450, protein: 25 },
    { meal: 'Makan Siang', items: 'Ayam bakar, sayur asem, nasi putih', cal: 650, protein: 40 },
    { meal: 'Makan Malam', items: 'Sup ikan kembung, kangkung tumis', cal: 400, protein: 35 },
  ];
  const totalCal = samplePlan.reduce((s, m) => s + m.cal, 0);
  const totalProtein = samplePlan.reduce((s, m) => s + m.protein, 0);

  const cuisines = ['Indonesia', 'Jepang', 'Korea', 'Mediterania', 'Meksiko', 'India', 'Thai', 'Vietnam'];

  const pricing = [
    {
      tier: 'Gratis',
      price: 'Rp0',
      period: '/selamanya',
      features: ['3 rencana/hari', '3 masakan', 'Streak harian', 'Bilingual EN/ID'],
      cta: 'Mulai gratis',
      href: '#/signup',
      highlighted: false,
    },
    {
      tier: 'Premium',
      price: 'Rp29rb',
      period: '/bulan',
      features: ['Rencana unlimited', 'Semua masakan', 'Daftar belanja + makro', 'Panduan masak', 'Rencana mingguan', 'Push custom time'],
      cta: 'Coba Premium',
      href: '#/signup',
      highlighted: true,
    },
  ];
</script>

<div class="landing">
  <!-- ═══ Hero — split editorial, not centered ═══ -->
  <section class="hero">
    <div class="hero-text">
      <div class="hero-badge">🍱 Asisten makan harian</div>
      <h1>Mau makan enak <span class="accent-text">hari ini?</span></h1>
      <p class="hero-tagline">
        Saji bikin rencana makan harian yang enak, sehat, dan sesuai goal kamu —
        pakai bahan yang gampang cari di Indonesia. Bukan quinoa, bukan kale.
        Tempe, kangkung, ikan kembung.
      </p>
      <div class="hero-cta">
        <a href="#/signup"><Button variant="primary" size="lg">Mulai dong! →</Button></a>
        <a href="#/login"><Button variant="ghost" size="lg">Sudah punya akun?</Button></a>
      </div>
      <div class="hero-hint">
        <span>📱</span>
        <span>Daftar gratis, pilih Telegram atau WhatsApp buat terima rencana</span>
      </div>
    </div>

    <!-- Phone mockup — food-forward, layered depth -->
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
              <div class="msg-bubble">Gas! 🔥</div>
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
          <div class="phone-actions">
            <button class="phone-btn">🎲</button>
            <button class="phone-btn">🛒</button>
            <button class="phone-btn">📊</button>
            <button class="phone-btn">👍</button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══ Social proof strip ═══ -->
  <section class="proof-strip">
    <div class="proof-item">
      <strong>3</strong>
      <span>detik setup</span>
    </div>
    <div class="proof-divider"></div>
    <div class="proof-item">
      <strong>8+</strong>
      <span>masakan</span>
    </div>
    <div class="proof-divider"></div>
    <div class="proof-item">
      <strong>100%</strong>
      <span>bahan lokal</span>
    </div>
    <div class="proof-divider"></div>
    <div class="proof-item">
      <strong>EN/ID</strong>
      <span>bilingual</span>
    </div>
  </section>

  <!-- ═══ How it works — horizontal flow, not equal cards ═══ -->
  <section class="how-section">
    <h2>Gimana cara kerjanya?</h2>
    <div class="how-flow">
      <div class="how-step">
        <div class="how-num">1</div>
        <div class="how-body">
          <h3>Set preferensi</h3>
          <p>Jawab beberapa pertanyaan: goal, alergi, kalori, masakan favorit. 30 detik.</p>
        </div>
      </div>
      <div class="how-connector">→</div>
      <div class="how-step">
        <div class="how-num">2</div>
        <div class="how-body">
          <h3>Generate rencana</h3>
          <p>Saji bikin rencana makan harian dengan bahan yang ada di Indonesia. Beda masakan tiap hari.</p>
        </div>
      </div>
      <div class="how-connector">→</div>
      <div class="how-step">
        <div class="how-num">3</div>
        <div class="how-body">
          <h3>Makan enak</h3>
          <p>Ikuti rencana, jaga streak 🔥, request daftar belanja kapan saja. Push otomatis tiap hari.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══ Feature spotlight — alternating rows, not grid ═══ -->
  <section class="spotlight-section">
    <h2>Kenapa Saji?</h2>

    <div class="spotlight-row">
      <div class="spotlight-visual">
        <div class="spotlight-icon-big">🥘</div>
        <div class="spotlight-ingredient-tags">
          <span>tempe</span><span>kangkung</span><span>ikan kembung</span>
          <span>tahu</span><span>kecap manis</span><span>nasi merah</span>
        </div>
      </div>
      <div class="spotlight-text">
        <h3>Bahan lokal, bukan impor mahal</h3>
        <p>
          Rencana makan pakai bahan yang ada di warung depan rumah. Tempe, kangkung,
          ikan kembung, tahu, kecap manis. Bukan quinoa yang harganya 50rb sekotak.
        </p>
      </div>
    </div>

    <div class="spotlight-row reverse">
      <div class="spotlight-visual">
        <div class="spotlight-icon-big">🔄</div>
        <div class="spotlight-cuisine-chips">
          {#each cuisines.slice(0, 5) as c}
            <span class="chip">{c}</span>
          {/each}
        </div>
      </div>
      <div class="spotlight-text">
        <h3>Putar masakan, nggak bosen</h3>
        <p>
          Hari ini Indonesia, besok Jepang, lusa Korea. Saji otomatis ganti masakan
          tiap hari dan ingat yang udah dipakai — jadi nggak ada yang berulang.
        </p>
      </div>
    </div>

    <div class="spotlight-row">
      <div class="spotlight-visual">
        <div class="spotlight-icon-big">📊</div>
        <div class="spotlight-macro-bars">
          <div class="macro-bar"><span>Protein</span><div class="bar-fill" style="width:70%;background:var(--primary)"></div></div>
          <div class="macro-bar"><span>Karbo</span><div class="bar-fill" style="width:50%;background:var(--accent)"></div></div>
          <div class="macro-bar"><span>Lemak</span><div class="bar-fill" style="width:30%;background:var(--tomato-500, #E5484D)"></div></div>
        </div>
      </div>
      <div class="spotlight-text">
        <h3>Makro lengkap, daftar belanja sekali klik</h3>
        <p>
          Setiap rencana ada estimasi kalori + protein per meal. Mau daftar belanja?
          Satu klik. Mau breakdown makro? Satu klik. Mau panduan masak step-by-step?
          Tinggal tanya.
        </p>
      </div>
    </div>
  </section>

  <!-- ═══ Cuisine pills ═══ -->
  <section class="cuisines-section">
    <h2>8 masakan, rotasi harian</h2>
    <div class="cuisine-pills">
      {#each cuisines as c}
        <span class="cuisine-pill">{c}</span>
      {/each}
    </div>
  </section>

  <!-- ═══ Pricing ═══ -->
  <section class="pricing-section">
    <h2>Pilih plan kamu</h2>
    <div class="pricing-grid">
      {#each pricing as p}
        <div class="pricing-card" class:highlighted={p.highlighted}>
          {#if p.highlighted}<div class="pricing-badge">Paling populer</div>{/if}
          <div class="pricing-tier">{p.tier}</div>
          <div class="pricing-price">
            <span class="price-amount">{p.price}</span>
            <span class="price-period">{p.period}</span>
          </div>
          <ul class="pricing-features">
            {#each p.features as f}
              <li><span class="check">✓</span> {f}</li>
            {/each}
          </ul>
          <a href={p.href}><Button variant={p.highlighted ? 'primary' : 'secondary'} size="lg">{p.cta}</Button></a>
        </div>
      {/each}
    </div>
  </section>

  <!-- ═══ CTA ═══ -->
  <section class="cta">
    <div class="cta-glow"></div>
    <h2>Yuk mulai hari ini</h2>
    <p>Rencana makan pertama kamu cuma 3 detik lagi.</p>
    <a href="#/signup"><Button variant="primary" size="lg">Ayo buat! 🚀</Button></a>
  </section>

  <!-- ═══ Footer ═══ -->
  <footer>
    <div class="footer-brand">Saji 🍽️</div>
    <p>Asisten makan harian — bikin kamu makan enak, sehat, dan sesuai goal.</p>
    <p class="footer-meta">Dibuat dengan 🤍 di Indonesia</p>
  </footer>
</div>

<style>
  .landing { max-width: 1200px; margin: 0 auto; padding: 0 var(--space-6); }

  /* ═══ Hero ═══ */
  .hero {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: var(--space-10);
    align-items: center;
    min-height: 82vh;
    padding: var(--space-12) 0;
    position: relative;
  }
  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-3);
    background: var(--primary-soft);
    color: var(--primary);
    border-radius: var(--radius-pill);
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
    margin-bottom: var(--space-5);
    border: 1px solid rgba(82, 183, 136, 0.2);
  }
  .hero h1 {
    font-size: clamp(2.2rem, 5.5vw, 3.8rem);
    font-weight: var(--fw-bold);
    letter-spacing: var(--ls-tight);
    line-height: var(--lh-tight);
    margin-bottom: var(--space-5);
  }
  .accent-text { color: var(--primary); }
  .hero-tagline {
    font-size: 1.05rem;
    color: var(--text-muted);
    line-height: var(--lh-relaxed);
    margin-bottom: var(--space-6);
    max-width: 480px;
  }
  .hero-cta { display: flex; gap: var(--space-3); margin-bottom: var(--space-4); flex-wrap: wrap; }
  .hero-hint {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--fs-sm);
    color: var(--text-faint);
  }

  /* Phone mockup — layered with glows */
  .hero-visual { position: relative; display: flex; justify-content: center; }
  .glow-leaf {
    position: absolute;
    top: 5%; left: 0;
    width: 70%; height: 60%;
    background: radial-gradient(ellipse, var(--primary-soft) 0%, transparent 55%);
    pointer-events: none;
  }
  .glow-amber {
    position: absolute;
    bottom: 5%; right: 0;
    width: 60%; height: 50%;
    background: radial-gradient(ellipse, var(--accent-soft) 0%, transparent 55%);
    pointer-events: none;
  }
  .phone-mockup {
    width: 340px;
    max-width: 100%;
    background: var(--surface);
    border-radius: 2rem;
    box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px var(--border-strong);
    padding: var(--space-2);
    position: relative;
    z-index: 1;
  }
  .phone-notch {
    width: 40%;
    height: 6px;
    background: var(--bg);
    border-radius: 0 0 8px 8px;
    margin: 0 auto;
  }
  .phone-screen {
    background: var(--bg);
    border-radius: 1.5rem;
    overflow: hidden;
  }
  .phone-statusbar {
    display: flex;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    font-size: var(--fs-xs);
    color: var(--text-subtle);
  }
  .phone-chat { padding: var(--space-2) var(--space-2) var(--space-3); }
  .phone-msg {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }
  .phone-msg.user { justify-content: flex-end; }
  .msg-avatar {
    width: 28px; height: 28px;
    background: var(--surface-3);
    border-radius: var(--radius-pill);
    display: flex; align-items: center; justify-content: center;
    font-size: var(--fs-sm);
    flex-shrink: 0;
  }
  .msg-bubble {
    background: var(--surface-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md) var(--radius-md) var(--radius-md) 2px;
    font-size: var(--fs-xs);
    line-height: var(--lh-normal);
    color: var(--text);
    max-width: 85%;
  }
  .phone-msg.user .msg-bubble {
    background: var(--primary);
    color: var(--bg);
    border-radius: var(--radius-md) var(--radius-md) 2px var(--radius-md);
    font-weight: var(--fw-medium);
  }
  .msg-plan { padding: var(--space-3); max-width: 88%; }
  .plan-cuisine {
    font-size: var(--fs-xs);
    font-weight: var(--fw-semibold);
    color: var(--accent);
    margin-bottom: var(--space-2);
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--border);
  }
  .plan-meal {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-1) 0;
    gap: var(--space-2);
  }
  .meal-row { display: flex; gap: var(--space-2); align-items: flex-start; flex: 1; }
  .meal-emoji { font-size: var(--fs-md); }
  .meal-info { flex: 1; }
  .meal-name { font-size: var(--fs-xs); font-weight: var(--fw-semibold); color: var(--text); }
  .meal-items { font-size: 0.65rem; color: var(--text-subtle); line-height: 1.3; }
  .meal-macros { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; flex-shrink: 0; }
  .macro-cal { font-size: 0.65rem; color: var(--primary); font-weight: var(--fw-medium); font-variant-numeric: tabular-nums; }
  .macro-protein { font-size: 0.6rem; color: var(--text-faint); font-variant-numeric: tabular-nums; }
  .plan-total {
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--border);
    font-size: 0.65rem;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .phone-actions {
    display: flex;
    justify-content: space-around;
    padding: var(--space-2);
    border-top: 1px solid var(--border);
    background: var(--surface);
  }
  .phone-btn {
    background: none;
    border: none;
    font-size: var(--fs-md);
    cursor: pointer;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    transition: background var(--duration-micro) var(--ease-standard);
  }
  .phone-btn:hover { background: var(--surface-2); }

  /* ═══ Proof strip ═══ */
  .proof-strip {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-6) 0;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    margin-bottom: var(--space-12);
  }
  .proof-item { text-align: center; }
  .proof-item strong {
    display: block;
    font-size: var(--fs-xl);
    color: var(--primary);
    font-variant-numeric: tabular-nums;
    font-weight: var(--fw-bold);
  }
  .proof-item span { font-size: var(--fs-sm); color: var(--text-subtle); }
  .proof-divider { width: 1px; height: 32px; background: var(--border); }

  /* ═══ How it works — horizontal flow ═══ */
  .how-section { padding: var(--space-12) 0; }
  .how-section h2 {
    font-size: var(--fs-2xl);
    font-weight: var(--fw-semibold);
    letter-spacing: var(--ls-snug);
    text-align: center;
    margin-bottom: var(--space-10);
  }
  .how-flow {
    display: flex;
    align-items: stretch;
    justify-content: center;
    gap: var(--space-4);
  }
  .how-step {
    flex: 1;
    max-width: 280px;
    background: var(--surface);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    border: 1px solid var(--border);
  }
  .how-num {
    width: 40px; height: 40px;
    background: var(--primary);
    color: var(--bg);
    border-radius: var(--radius-pill);
    display: flex; align-items: center; justify-content: center;
    font-size: var(--fs-md);
    font-weight: var(--fw-bold);
    margin-bottom: var(--space-4);
  }
  .how-step h3 { font-size: var(--fs-md); font-weight: var(--fw-semibold); margin-bottom: var(--space-2); }
  .how-step p { color: var(--text-muted); font-size: var(--fs-sm); line-height: var(--lh-normal); }
  .how-connector {
    display: flex;
    align-items: center;
    color: var(--text-faint);
    font-size: var(--fs-xl);
  }

  /* ═══ Spotlight — alternating rows ═══ */
  .spotlight-section { padding: var(--space-12) 0; }
  .spotlight-section h2 {
    font-size: var(--fs-2xl);
    font-weight: var(--fw-semibold);
    text-align: center;
    margin-bottom: var(--space-10);
  }
  .spotlight-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-8);
    align-items: center;
    margin-bottom: var(--space-12);
  }
  .spotlight-row.reverse { direction: rtl; }
  .spotlight-row.reverse > * { direction: ltr; }
  .spotlight-visual {
    background: var(--surface);
    border-radius: var(--radius-xl);
    padding: var(--space-8);
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
  }
  .spotlight-icon-big { font-size: 3rem; }
  .spotlight-ingredient-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    justify-content: center;
  }
  .spotlight-ingredient-tags span {
    padding: var(--space-1) var(--space-3);
    background: var(--surface-2);
    border-radius: var(--radius-pill);
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }
  .spotlight-cuisine-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    justify-content: center;
  }
  .chip {
    padding: var(--space-1) var(--space-3);
    background: var(--primary-soft);
    color: var(--primary);
    border-radius: var(--radius-pill);
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
  }
  .spotlight-macro-bars { width: 100%; display: flex; flex-direction: column; gap: var(--space-3); }
  .macro-bar { display: flex; align-items: center; gap: var(--space-2); }
  .macro-bar > span { font-size: var(--fs-sm); color: var(--text-subtle); width: 60px; }
  .bar-fill {
    height: 8px;
    border-radius: var(--radius-pill);
  }
  .spotlight-text h3 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-3); }
  .spotlight-text p { color: var(--text-muted); font-size: var(--fs-md); line-height: var(--lh-relaxed); }

  /* ═══ Cuisines ═══ */
  .cuisines-section { padding: var(--space-12) 0; text-align: center; }
  .cuisines-section h2 {
    font-size: var(--fs-2xl);
    font-weight: var(--fw-semibold);
    margin-bottom: var(--space-6);
  }
  .cuisine-pills {
    display: flex; flex-wrap: wrap; gap: var(--space-2);
    justify-content: center; max-width: 700px; margin: 0 auto;
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
  .cuisine-pill:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-soft); }

  /* ═══ Pricing ═══ */
  .pricing-section { padding: var(--space-12) 0; }
  .pricing-section h2 {
    font-size: var(--fs-2xl);
    font-weight: var(--fw-semibold);
    text-align: center;
    margin-bottom: var(--space-10);
  }
  .pricing-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-5);
    max-width: 700px;
    margin: 0 auto;
  }
  .pricing-card {
    background: var(--surface);
    border-radius: var(--radius-xl);
    padding: var(--space-6);
    border: 1px solid var(--border);
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .pricing-card.highlighted {
    border-color: var(--primary);
    box-shadow: 0 0 0 1px var(--primary), var(--shadow-elevation-2);
  }
  .pricing-badge {
    position: absolute;
    top: -12px; left: 50%; transform: translateX(-50%);
    background: var(--primary);
    color: var(--bg);
    font-size: var(--fs-xs);
    font-weight: var(--fw-semibold);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-pill);
    white-space: nowrap;
  }
  .pricing-tier { font-size: var(--fs-md); font-weight: var(--fw-semibold); }
  .pricing-price { display: flex; align-items: baseline; gap: var(--space-1); }
  .price-amount { font-size: var(--fs-2xl); font-weight: var(--fw-bold); font-variant-numeric: tabular-nums; }
  .price-period { font-size: var(--fs-sm); color: var(--text-subtle); }
  .pricing-features { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2); }
  .pricing-features li { font-size: var(--fs-sm); color: var(--text-muted); display: flex; align-items: flex-start; gap: var(--space-2); }
  .check { color: var(--primary); font-weight: var(--fw-bold); flex-shrink: 0; }

  /* ═══ CTA ═══ */
  .cta {
    text-align: center;
    padding: var(--space-12) var(--space-6);
    background: var(--surface);
    border-radius: var(--radius-xl);
    margin-bottom: var(--space-12);
    position: relative;
    overflow: hidden;
  }
  .cta-glow {
    position: absolute;
    top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 80%; height: 150%;
    background: radial-gradient(ellipse, var(--primary-soft) 0%, transparent 60%);
    pointer-events: none;
  }
  .cta h2, .cta p, .cta a { position: relative; z-index: 1; }
  .cta h2 { font-size: var(--fs-2xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-3); }
  .cta p { color: var(--text-muted); margin-bottom: var(--space-6); font-size: var(--fs-md); }

  /* ═══ Footer ═══ */
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
    .hero-cta { justify-content: center; }
    .hero-tagline { margin: 0 auto var(--space-6); }
    .hero-hint { justify-content: center; }
    .how-flow { flex-direction: column; }
    .how-connector { display: none; }
    .spotlight-row { grid-template-columns: 1fr; }
    .spotlight-row.reverse { direction: ltr; }
    .pricing-grid { grid-template-columns: 1fr; }
    .proof-strip { flex-wrap: wrap; gap: var(--space-4); }
    .proof-divider { display: none; }
  }
</style>
