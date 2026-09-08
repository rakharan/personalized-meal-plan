<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import PublicLayout from '$lib/components/PublicLayout.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { onMount } from 'svelte';

  onMount(() => theme.init());

  const features = [
    { name: 'Rencana makan harian', free: '3/hari', premium: 'Unlimited' },
    { name: 'Pilihan masakan', free: '3', premium: '8 (semua)' },
    { name: 'Streak harian', free: true, premium: true },
    { name: 'Bilingual EN/ID', free: true, premium: true },
    { name: 'Makro per meal (kal + protein)', free: true, premium: true },
    { name: 'Daftar belanja otomatis', free: false, premium: true },
    { name: 'Panduan masak step-by-step', free: false, premium: true },
    { name: 'Rencana mingguan', free: false, premium: true },
    { name: 'Push custom time', free: 'Jam standar', premium: 'Custom' },
    { name: 'Rotasi masakan otomatis', free: false, premium: true },
    { name: 'Riwayat rencana', free: '7 hari', premium: 'Unlimited' },
    { name: 'Referral bonus', free: true, premium: '2x bonus' },
  ];

  const faqs = [
    { q: 'Gratisnya selamanya?', a: 'Iya. 3 rencana per hari, 3 masakan, streak — selamanya gratis. Nggak ada kartu kredit, nggak ada trial.' },
    { q: 'Kenapa Premium?', a: 'Kalau kamu mau unlimited rencana, semua masakan, daftar belanja, panduan masak, dan push custom jam. Cocok buat yang serius makan sehat tiap hari.' },
    { q: 'Bayar gimana?', a: 'Transfer bank atau e-wallet (GoPay, OVO, DANA). Bulanan, bisa cancel kapan saja.' },
    { q: 'Bisa upgrade nanti?', a: 'Bisa. Mulai gratis dulu, kalo kerasa cocok baru upgrade. Data dan streak ikut pindah.' },
  ];
</script>

<PublicLayout current="#/harga">
  <div class="pricing-page">
    <header class="page-header">
      <h1>Pilih plan kamu</h1>
      <p>Mulai gratis. Upgrade kalo kerasa cocok. Nggak ada kartu kredit buat mulai.</p>
    </header>

    <!-- Pricing cards -->
    <div class="pricing-grid">
      <div class="pricing-card">
        <div class="pricing-tier">Gratis</div>
        <div class="pricing-price">
          <span class="price-amount">Rp0</span>
          <span class="price-period">/selamanya</span>
        </div>
        <ul class="pricing-features">
          <li><span class="check">✓</span> 3 rencana/hari</li>
          <li><span class="check">✓</span> 3 masakan</li>
          <li><span class="check">✓</span> Streak harian</li>
          <li><span class="check">✓</span> Bilingual EN/ID</li>
          <li><span class="check">✓</span> Makro per meal</li>
        </ul>
        <a href="#/signup"><Button variant="secondary" size="lg">Mulai gratis</Button></a>
      </div>

      <div class="pricing-card highlighted">
        <div class="pricing-badge">Paling populer</div>
        <div class="pricing-tier">Premium</div>
        <div class="pricing-price">
          <span class="price-amount">Rp29rb</span>
          <span class="price-period">/bulan</span>
        </div>
        <ul class="pricing-features">
          <li><span class="check">✓</span> Rencana unlimited</li>
          <li><span class="check">✓</span> Semua 8 masakan</li>
          <li><span class="check">✓</span> Daftar belanja + makro</li>
          <li><span class="check">✓</span> Panduan masak</li>
          <li><span class="check">✓</span> Rencana mingguan</li>
          <li><span class="check">✓</span> Push custom time</li>
          <li><span class="check">✓</span> Rotasi masakan otomatis</li>
          <li><span class="check">✓</span> Riwayat unlimited</li>
        </ul>
        <a href="#/signup"><Button variant="primary" size="lg">Coba Premium</Button></a>
      </div>
    </div>

    <!-- Comparison table -->
    <section class="comparison-section">
      <h2>Perbandingan lengkap</h2>
      <div class="comparison-table">
        <div class="comparison-header">
          <span>Fitur</span>
          <span>Gratis</span>
          <span>Premium</span>
        </div>
        {#each features as f}
          <div class="comparison-row">
            <span class="feat-name">{f.name}</span>
            <span class="feat-val">
              {#if f.free === true}<span class="check">✓</span>{:else if f.free === false}<span class="dash">—</span>{:else}{f.free}{/if}
            </span>
            <span class="feat-val feat-premium">
              {#if f.premium === true}<span class="check">✓</span>{:else if f.premium === false}<span class="dash">—</span>{:else}{f.premium}{/if}
            </span>
          </div>
        {/each}
      </div>
    </section>

    <!-- FAQ mini -->
    <section class="faq-section">
      <h2>Pertanyaan umum</h2>
      <div class="faq-list">
        {#each faqs as f}
          <div class="faq-item">
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        {/each}
      </div>
      <a href="#/faq"><Button variant="ghost" size="md">Lihat semua FAQ</Button></a>
    </section>

    <section class="cta">
      <h2>Mulai gratis hari ini</h2>
      <p>Nggak ada kartu kredit. Nggak ada trial. Gratis selamanya.</p>
      <a href="#/signup"><Button variant="primary" size="lg">Daftar sekarang!</Button></a>
    </section>
  </div>
</PublicLayout>

<style>
  .pricing-page { max-width: 900px; margin: 0 auto; }

  .page-header { text-align: center; margin-bottom: var(--space-10); }
  .page-header h1 { font-size: var(--fs-2xl); font-weight: var(--fw-bold); letter-spacing: var(--ls-tight); margin-bottom: var(--space-2); }
  .page-header p { color: var(--text-muted); font-size: var(--fs-md); }

  .pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5); max-width: 700px; margin: 0 auto var(--space-12); }
  .pricing-card {
    background: var(--surface); border-radius: var(--radius-xl); padding: var(--space-6);
    border: 1px solid var(--border); position: relative; display: flex; flex-direction: column; gap: var(--space-4);
  }
  .pricing-card.highlighted { border-color: var(--primary); box-shadow: 0 0 0 1px var(--primary), var(--shadow-elevation-2); }
  .pricing-badge {
    position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
    background: var(--primary); color: var(--text-on-primary);
    font-size: var(--fs-xs); font-weight: var(--fw-semibold);
    padding: var(--space-1) var(--space-3); border-radius: var(--radius-pill); white-space: nowrap;
  }
  .pricing-tier { font-size: var(--fs-md); font-weight: var(--fw-semibold); }
  .pricing-price { display: flex; align-items: baseline; gap: var(--space-1); }
  .price-amount { font-size: var(--fs-2xl); font-weight: var(--fw-bold); font-variant-numeric: tabular-nums; }
  .price-period { font-size: var(--fs-sm); color: var(--text-subtle); }
  .pricing-features { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2); flex: 1; }
  .pricing-features li { font-size: var(--fs-sm); color: var(--text-muted); display: flex; align-items: flex-start; gap: var(--space-2); }
  .check { color: var(--primary); font-weight: var(--fw-bold); flex-shrink: 0; }

  /* Comparison table */
  .comparison-section { margin-bottom: var(--space-12); }
  .comparison-section h2 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); text-align: center; margin-bottom: var(--space-6); }
  .comparison-table { max-width: 700px; margin: 0 auto; border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
  .comparison-header { display: grid; grid-template-columns: 2fr 1fr 1fr; padding: var(--space-3) var(--space-4); background: var(--surface-2); font-size: var(--fs-sm); font-weight: var(--fw-semibold); color: var(--text-subtle); }
  .comparison-header span { text-align: center; }
  .comparison-header span:first-child { text-align: left; }
  .comparison-row { display: grid; grid-template-columns: 2fr 1fr 1fr; padding: var(--space-2) var(--space-4); border-top: 1px solid var(--border); }
  .comparison-row span { text-align: center; font-size: var(--fs-sm); display: flex; align-items: center; justify-content: center; }
  .feat-name { text-align: left !important; justify-content: flex-start !important; color: var(--text-muted); }
  .feat-premium { color: var(--primary); font-weight: var(--fw-medium); }
  .dash { color: var(--text-faint); }

  /* FAQ */
  .faq-section { margin-bottom: var(--space-10); text-align: center; }
  .faq-section h2 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-6); }
  .faq-list { max-width: 700px; margin: 0 auto var(--space-6); display: flex; flex-direction: column; gap: var(--space-4); }
  .faq-item { background: var(--surface); border-radius: var(--radius-md); padding: var(--space-4); border: 1px solid var(--border); text-align: left; }
  .faq-item h3 { font-size: var(--fs-md); font-weight: var(--fw-semibold); margin-bottom: var(--space-2); }
  .faq-item p { font-size: var(--fs-sm); color: var(--text-muted); line-height: var(--lh-normal); }

  .cta { text-align: center; padding: var(--space-10) var(--space-6); background: var(--surface); border-radius: var(--radius-xl); }
  .cta h2 { font-size: var(--fs-2xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-3); }
  .cta p { color: var(--text-muted); margin-bottom: var(--space-6); }

  @media (max-width: 768px) {
    .pricing-grid { grid-template-columns: 1fr; }
    .comparison-header, .comparison-row { grid-template-columns: 1.5fr 1fr 1fr; padding: var(--space-2); }
  }
</style>
