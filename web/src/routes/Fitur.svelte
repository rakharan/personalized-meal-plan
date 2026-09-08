<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import PublicLayout from '$lib/components/PublicLayout.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { onMount } from 'svelte';

  onMount(() => theme.init());

  const features = [
    {
      emoji: '🥘',
      title: 'Generator bahan lokal',
      tagline: 'Bukan quinoa, bukan kale',
      desc: 'Setiap rencana pakai bahan yang ada di warung depan rumah. Tempe, kangkung, ikan kembung, tahu, kecap manis, nasi merah. Saji tahu apa yang gampang cari di Indonesia.',
      examples: ['Tempe', 'Kangkung', 'Ikan kembung', 'Tahu', 'Kecap manis', 'Nasi merah', 'Ayam', 'Telur', 'Bawang merah', 'Cabai', 'Sambal', 'Lontong'],
    },
    {
      emoji: '🔄',
      title: 'Rotasi masakan otomatis',
      tagline: 'Hari ini Indonesia, besok Jepang',
      desc: 'Saji otomatis ganti masakan tiap hari dan ingat yang udah dipakai. Nggak ada yang berulang dalam 7 hari. Pilih satu masakan atau biarkan Saji rotasi semua.',
      examples: ['Indonesia', 'Jepang', 'Korea', 'Mediterania', 'Thai', 'Vietnam', 'India', 'Meksiko'],
    },
    {
      emoji: '📊',
      title: 'Makro lengkap per meal',
      tagline: 'Kalori + protein, bukan tebakan',
      desc: 'Setiap meal ada estimasi kalori dan protein. Total harian dihitung otomatis. Sesuai target kamu — entah turun berat badan, naik mass otot, atau maintenance.',
      examples: ['Sarapan: 450 kal / 25g protein', 'Makan siang: 650 kal / 40g protein', 'Makan malam: 400 kal / 35g protein', 'Total: 1500 kal / 100g protein'],
    },
    {
      emoji: '🛒',
      title: 'Daftar belanja sekali klik',
      tagline: 'Semua bahan terkumpul otomatis',
      desc: 'Mau belanja? Satu klik. Saji kumpulkan semua bahan dari semua meal jadi satu daftar. Lengkap dengan jumlah — tinggal screenshot dan ke pasar.',
      examples: ['Nasi merah 2 cup', 'Telur 3 butir', 'Tempe 150g', 'Ayam 200g', 'Kangkung 1 ikat', 'Ikan kembung 2 ekor'],
    },
    {
      emoji: '🍳',
      title: 'Panduan masak step-by-step',
      tagline: 'Dari mentah jadi siap santap',
      desc: 'Setiap rencana bisa minta panduan masak. Saji kasih langkah-langkah jelas — siap dari bahan mentah sampai hidangan siap santap. Cocok untuk kamu yang baru mulai masak.',
      examples: ['1. Marinasi ayam 15 menit', '2. Bakar 20 menit, balik sekali', '3. Tumis bumbu, masukkan kangkung', '4. Sajikan dengan nasi hangat'],
    },
    {
      emoji: '🔥',
      title: 'Streak harian + push otomatis',
      tagline: 'Jaga konsistensi makan sehat',
      desc: 'Ikuti rencana tiap hari, jaga streak. Saji kirim rencana otomatis via Telegram atau WhatsApp sesuai jam yang kamu pilih. Nggak perlu ingat — Saji yang inget.',
      examples: ['Push tiap pagi 07:00', 'Streak counter harian', 'Feedback rating per rencana', 'Reminder kalau miss sehari'],
    },
  ];

  const tiers = [
    { tier: 'Gratis', items: '3 rencana/hari, 3 masakan, streak, bilingual' },
    { tier: 'Premium', items: 'Unlimited rencana, semua masakan, daftar belanja, panduan masak, push custom' },
  ];
</script>

<PublicLayout current="#/fitur">
  <div class="features-page">
    <header class="page-header">
      <h1>Fitur Saji</h1>
      <p>Semua yang kamu butuh buat makan enak dan sehat tiap hari — pakai bahan Indonesia.</p>
    </header>

    <div class="feature-list">
      {#each features as f, i}
        <section class="feature-row" class:reverse={i % 2 === 1}>
          <div class="feature-visual">
            <div class="feature-emoji">{f.emoji}</div>
            <div class="feature-tags">
              {#each f.examples as ex}
                <span class="tag">{ex}</span>
              {/each}
            </div>
          </div>
          <div class="feature-text">
            <span class="feature-tagline">{f.tagline}</span>
            <h2>{f.title}</h2>
            <p>{f.desc}</p>
          </div>
        </section>
      {/each}
    </div>

    <!-- Tier comparison mini -->
    <section class="tier-section">
      <h2>Fitur per tier</h2>
      <div class="tier-grid">
        {#each tiers as t}
          <div class="tier-card">
            <div class="tier-name">{t.tier}</div>
            <p>{t.items}</p>
          </div>
        {/each}
      </div>
      <a href="#/harga"><Button variant="secondary" size="lg">Lihat perbandingan lengkap</Button></a>
    </section>

    <section class="cta">
      <h2>Mau coba sendiri?</h2>
      <p>Daftar gratis, rencana pertama cuma 3 detik.</p>
      <a href="#/signup"><Button variant="primary" size="lg">Mulai dong!</Button></a>
    </section>
  </div>
</PublicLayout>

<style>
  .features-page { max-width: 900px; margin: 0 auto; }

  .page-header { text-align: center; margin-bottom: var(--space-12); }
  .page-header h1 { font-size: var(--fs-2xl); font-weight: var(--fw-bold); letter-spacing: var(--ls-tight); margin-bottom: var(--space-2); }
  .page-header p { color: var(--text-muted); font-size: var(--fs-md); }

  .feature-list { display: flex; flex-direction: column; gap: var(--space-14); margin-bottom: var(--space-14); }
  .feature-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-8); align-items: center; }
  .feature-row.reverse { direction: rtl; }
  .feature-row.reverse > * { direction: ltr; }

  .feature-visual {
    background: var(--surface); border-radius: var(--radius-xl); padding: var(--space-8);
    border: 1px solid var(--border); display: flex; flex-direction: column; align-items: center; gap: var(--space-5);
  }
  .feature-emoji { font-size: 3rem; }
  .feature-tags { display: flex; flex-wrap: wrap; gap: var(--space-2); justify-content: center; }
  .tag {
    padding: var(--space-1) var(--space-3); background: var(--surface-2);
    border-radius: var(--radius-pill); font-size: var(--fs-sm); color: var(--text-muted);
    border: 1px solid var(--border);
  }

  .feature-tagline { color: var(--primary); font-size: var(--fs-sm); font-weight: var(--fw-medium); display: block; margin-bottom: var(--space-1); }
  .feature-text h2 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-3); }
  .feature-text p { color: var(--text-muted); font-size: var(--fs-md); line-height: var(--lh-relaxed); }

  .tier-section { text-align: center; margin-bottom: var(--space-10); }
  .tier-section h2 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-6); }
  .tier-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); max-width: 700px; margin: 0 auto var(--space-6); }
  .tier-card {
    background: var(--surface); border-radius: var(--radius-lg); padding: var(--space-5);
    border: 1px solid var(--border); text-align: left;
  }
  .tier-name { font-size: var(--fs-md); font-weight: var(--fw-semibold); color: var(--primary); margin-bottom: var(--space-2); }
  .tier-card p { font-size: var(--fs-sm); color: var(--text-muted); }

  .cta {
    text-align: center; padding: var(--space-10) var(--space-6);
    background: var(--surface); border-radius: var(--radius-xl);
  }
  .cta h2 { font-size: var(--fs-2xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-3); }
  .cta p { color: var(--text-muted); margin-bottom: var(--space-6); }

  @media (max-width: 768px) {
    .feature-row { grid-template-columns: 1fr; }
    .feature-row.reverse { direction: ltr; }
    .tier-grid { grid-template-columns: 1fr; }
  }
</style>
