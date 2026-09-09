<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import UserLayout from '$lib/components/UserLayout.svelte';
  import Button from '$lib/components/Button.svelte';
  import Alert from '$lib/components/Alert.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';

  let profile = $state<any>(null);
  let loading = $state(true);
  let error = $state('');
  let upgrading = $state(false);

  const isPro = $derived(profile?.tier === 'premium');

  const features = [
    { emoji: '🛒', title: 'Daftar Belanja Mingguan', desc: 'Konsolidasi 7 hari plan jadi 1 list. Sekali belanja, seminggu beres.', free: false },
    { emoji: '👶', title: 'Mode Ramah Anak', desc: 'Semua meal otomatis nggak pedas, rasa familiar, bentuk menarik buat anak.', free: false },
    { emoji: '⚡', title: 'Meal 30 Menit', desc: 'Filter meal cepat — masak sebelum suami pulang, sebelum anak cranky.', free: false },
    { emoji: '💰', title: 'Budget Tracker', desc: 'Set budget mingguan (Rp300rb, Rp500rb). Saji prioritaskan bahan murah.', free: false },
    { emoji: '♻️', title: 'Sisa Kemarin', desc: 'Ayam bakar kemarin? Besok jadi ayam suwir. Nggak ada yang terbuang.', free: false },
    { emoji: '⏰', title: 'Push Custom', desc: 'Plan dikirim jam 5 pagi, 10 malam, kapan pun kamu mau.', free: false },
    { emoji: '📅', title: 'Kalender Full', desc: 'History lebih dari 4 minggu. Lihat pola makan keluarga.', free: false },
    { emoji: '📊', title: 'Laporan Mingguan', desc: 'Email tiap Senin: apa yang berhasil, apa yang perlu adjust.', free: false },
  ];

  const freeFeatures = [
    { emoji: '🍽️', title: '1 plan/hari', desc: 'Rencana makan harian, bahan lokal, sesuai goal' },
    { emoji: '↻', title: '3 regen/plan', desc: 'Ganti meal yang nggak cocok' },
    { emoji: '🔥', title: 'Streak + Kalender', desc: '4 minggu history, badge, progress' },
    { emoji: '📱', title: 'Telegram + Web', desc: 'Push harian, dashboard web' },
  ];

  async function load() {
    loading = true;
    try {
      await auth.fetchMe();
      profile = auth.user;
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function toggleTier() {
    upgrading = true;
    error = '';
    try {
      const res = await fetch('/api/profile/tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth.authHeaders() },
        body: JSON.stringify({ tier: isPro ? 'free' : 'premium' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal update');
      profile = data.user;
      auth.user = data.user;
    } catch (e: any) {
      error = e.message;
    } finally {
      upgrading = false;
    }
  }

  onMount(() => {
    theme.init();
    if (!auth.isAuthed) {
      window.location.hash = '#/login';
      return;
    }
    load();
  });
</script>

<UserLayout current="#/pro">
  {#if loading}
    <Skeleton rows={4} cols={2} />
  {:else if error}
    <Alert variant="danger" title="Error">{error}</Alert>
  {:else}
    <div class="pro-page">
      <!-- Hero -->
      <section class="pro-hero">
        <div class="pro-badge" class:active={isPro}>
          {#if isPro}✓ Pro Aktif{:else}Saji Pro{/if}
        </div>
        <h1>Masak buat keluarga,<br />tanpa mikir setiap hari.</h1>
        <p class="pro-sub">
          {#if isPro}
            Semua fitur Pro aktif. Masak lebih gampang, belanja lebih hemat.
          {:else}
            Upgrade buat fitur keluarga: daftar belanja mingguan, mode anak, budget tracker, dan lainnya.
          {/if}
        </p>
        <div class="price-tag">
          <span class="price-amount">Rp29rb</span>
          <span class="price-per">/bulan</span>
        </div>
        <p class="price-note">atau Rp290rb/tahun — 2 bulan gratis</p>

        <div class="pro-cta">
          {#if isPro}
            <Button variant="secondary" loading={upgrading} onclick={toggleTier}>
              Turun ke Gratis
            </Button>
            <p class="cta-note">Data Pro tetap tersimpan. Upgrade lagi kapan saja.</p>
          {:else}
            <Button variant="primary" size="lg" loading={upgrading} onclick={toggleTier}>
              Coba Pro Gratis 7 Hari
            </Button>
            <p class="cta-note">Nggak perlu kartu kredit. Batalkan kapan saja.</p>
          {/if}
        </div>
      </section>

      <!-- Free vs Pro -->
      <section class="compare-section">
        <h2 class="section-title">Gratis vs Pro</h2>
        <div class="compare-grid">
          <div class="compare-col">
            <h3 class="compare-head free">Gratis</h3>
            {#each freeFeatures as f}
              <div class="compare-item">
                <span class="compare-emoji">{f.emoji}</span>
                <div>
                  <div class="compare-title">{f.title}</div>
                  <div class="compare-desc">{f.desc}</div>
                </div>
              </div>
            {/each}
          </div>
          <div class="compare-col pro">
            <h3 class="compare-head pro">Pro</h3>
            {#each freeFeatures as f}
              <div class="compare-item">
                <span class="compare-emoji">{f.emoji}</span>
                <div>
                  <div class="compare-title">{f.title}</div>
                  <div class="compare-desc">{f.desc}</div>
                </div>
              </div>
            {/each}
            {#each features as f}
              <div class="compare-item highlight">
                <span class="compare-emoji">{f.emoji}</span>
                <div>
                  <div class="compare-title">{f.title}</div>
                  <div class="compare-desc">{f.desc}</div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </section>

      <!-- Testimonial -->
      <section class="testimonial">
        <div class="testimonial-quote">
          "Dulu tiap sore bingung mau masak apa. Sekarang Saji yang pikirin, aku tinggal masak. Anak-anak suka, suami senang, aku nggak stress."
        </div>
        <div class="testimonial-author">— Ibu Rina, Jakarta, 2 anak</div>
      </section>
    </div>
  {/if}
</UserLayout>

<style>
  .pro-page { max-width: 800px; margin: 0 auto; }

  /* Hero */
  .pro-hero {
    text-align: center; padding: var(--space-8) var(--space-6) var(--space-10);
    background: var(--surface); border-radius: 28px 36px 24px 40px;
    border: 1px solid var(--border); margin-bottom: var(--space-8);
    position: relative; overflow: hidden;
  }
  .pro-hero::before {
    content: ''; position: absolute; top: -30%; right: -10%;
    width: 300px; height: 300px;
    background: radial-gradient(circle, var(--accent-soft) 0%, transparent 60%);
    pointer-events: none;
  }
  .pro-badge {
    display: inline-flex; padding: var(--space-1) var(--space-3);
    background: var(--accent-soft); color: var(--accent);
    border-radius: var(--radius-pill); font-size: var(--fs-sm);
    font-weight: var(--fw-semibold); margin-bottom: var(--space-4);
  }
  .pro-badge.active { background: var(--primary); color: var(--text-on-primary); }
  .pro-hero h1 {
    font-size: clamp(1.8rem, 4vw, 2.5rem); font-weight: var(--fw-bold);
    letter-spacing: var(--ls-tight); line-height: 1.15; margin-bottom: var(--space-4);
  }
  .pro-sub {
    font-size: var(--fs-md); color: var(--text-muted);
    max-width: 480px; margin: 0 auto var(--space-6); line-height: var(--lh-relaxed);
  }
  .price-tag { margin-bottom: var(--space-1); }
  .price-amount {
    font-size: var(--fs-3xl); font-weight: var(--fw-bold); color: var(--primary);
    font-family: var(--font-mono); letter-spacing: var(--ls-snug);
  }
  .price-per { font-size: var(--fs-md); color: var(--text-subtle); }
  .price-note { font-size: var(--fs-sm); color: var(--text-faint); margin-bottom: var(--space-6); }
  .pro-cta { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); }
  .cta-note { font-size: var(--fs-xs); color: var(--text-faint); }

  /* Compare */
  .compare-section { margin-bottom: var(--space-8); }
  .section-title {
    font-size: var(--fs-sm); font-weight: var(--fw-semibold); color: var(--text-subtle);
    margin-bottom: var(--space-4); text-transform: uppercase; letter-spacing: var(--ls-wide);
    text-align: center;
  }
  .compare-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);
  }
  .compare-col {
    background: var(--surface); border-radius: 20px 24px 16px 28px;
    padding: var(--space-5); border: 1px solid var(--border);
  }
  .compare-col.pro { border-color: var(--accent); border-width: 2px; }
  .compare-head {
    font-size: var(--fs-lg); font-weight: var(--fw-bold); text-align: center;
    margin-bottom: var(--space-4); padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--border);
  }
  .compare-head.free { color: var(--text-subtle); }
  .compare-head.pro { color: var(--accent); }
  .compare-item {
    display: flex; gap: var(--space-3); align-items: flex-start;
    padding: var(--space-3) 0; border-bottom: 1px solid var(--border);
  }
  .compare-item:last-child { border-bottom: none; }
  .compare-item.highlight { background: var(--accent-soft); margin: 0 calc(var(--space-3) * -1); padding: var(--space-3); border-radius: var(--radius-md); border-bottom: none; }
  .compare-emoji { font-size: var(--fs-lg); flex-shrink: 0; }
  .compare-title { font-weight: var(--fw-semibold); font-size: var(--fs-sm); margin-bottom: 2px; }
  .compare-desc { font-size: var(--fs-xs); color: var(--text-subtle); line-height: var(--lh-normal); }

  /* Testimonial */
  .testimonial {
    text-align: center; padding: var(--space-8);
    background: var(--surface-2); border-radius: 20px 24px 16px 28px;
    border: 1px solid var(--border); margin-bottom: var(--space-6);
  }
  .testimonial-quote {
    font-size: var(--fs-lg); color: var(--text); line-height: var(--lh-relaxed);
    font-style: italic; margin-bottom: var(--space-4); max-width: 500px; margin-left: auto; margin-right: auto;
  }
  .testimonial-author { font-size: var(--fs-sm); color: var(--text-subtle); }

  @media (max-width: 640px) {
    .compare-grid { grid-template-columns: 1fr; }
  }
</style>
