<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import PublicLayout from '$lib/components/PublicLayout.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { onMount } from 'svelte';

  onMount(() => theme.init());

  const faqs = [
    {
      category: 'Umum',
      items: [
        { q: 'Apa itu Saji?', a: 'Saji adalah asisten makan harian yang bikin rencana makan enak, sehat, dan sesuai goal kamu. Pakai bahan yang gampang cari di Indonesia — tempe, kangkung, ikan kembung, bukan quinoa atau kale.' },
        { q: 'Saji ini buat siapa?', a: 'Buat kamu yang mau makan sehat tapi bingung makan apa tiap hari. Bukan diet ketat — ini lebih ke membantu kamu makan enak sambil njaga gizi. Cocok buat mahasiswa, kerja kantoran, ibu rumah tangga, siapa aja.' },
        { q: 'Bedanya sama app diet lain?', a: 'Saji pakai bahan Indonesia. Nggak nyuruh kamu beli quinoa 50rb sekotak. Rencana pakai tempe, ayam, kangkung — bahan yang ada di warung depan rumah. Plus, dikirim via Telegram/WhatsApp, nggak perlu buka app.' },
      ],
    },
    {
      category: 'Makanan',
      items: [
        { q: 'Apa bahan mudah cari?', a: 'Iya. Saji dirancang buat Indonesia. Bahan utama: tempe, tahu, ayam, telur, ikan kembung, kangkung, nasi merah, kecap manis. Semua ada di pasar tradisional atau minimarket.' },
        { q: 'Bisa pilih masakan?', a: 'Bisa. 8 masakan: Indonesia, Jepang, Korea, Mediterania, Thai, Vietnam, India, Meksiko. Pilih favorit atau biarkan Saji rotasi otomatis tiap hari.' },
        { q: 'Kalau ada alergi?', a: 'Saji bakal hindari bahan yang kamu alergi. Saat daftar, kasih tahu alergi kamu — seafood, kacang, susu, gluten, atau yang lain. Rencana bakal disesuaikan.' },
        { q: 'Vegetarian/vegan bisa?', a: 'Saji bisa bikin rencana vegetarian. Protein dari tempe, tahu, lentil, edamame. Vegan juga bisa — tinggal bilang saat onboarding.' },
      ],
    },
    {
      category: 'Cara pakai',
      items: [
        { q: 'Harus pakai Telegram?', a: 'Telegram atau WhatsApp. Pilih salah satu. Rencana dikirim kesana tiap hari. Kalau belum punya Telegram, bisa pakai WhatsApp.' },
        { q: 'Kapan rencana dikirim?', a: 'Default: pagi jam 07:00. Premium bisa custom jam sesuai keinginan. Kalau mau push sore atau malam juga bisa.' },
        { q: 'Bisa request rencana ulang?', a: 'Bisa. Kapan saja, ketik /mealplan di Telegram, Saji bikin rencana baru. Gratis: 3x/hari. Premium: unlimited.' },
        { q: 'Cara lihat daftar belanja?', a: 'Setelah terima rencana, tinggal ketik "daftar belanja" atau klik tombol yang tersedia. Saji kumpulkan semua bahan dari semua meal jadi satu daftar.' },
      ],
    },
    {
      category: 'Harga',
      items: [
        { q: 'Gratisnya selamanya?', a: 'Iya. 3 rencana per hari, 3 masakan, streak harian, bilingual — selamanya gratis. Nggak ada kartu kredit, nggak ada trial.' },
        { q: 'Kenapa Premium?', a: 'Kalau mau unlimited rencana, semua masakan, daftar belanja, panduan masak, rencana mingguan, dan push custom jam. Rp29rb/bulan.' },
        { q: 'Bayar gimana?', a: 'Transfer bank atau e-wallet (GoPay, OVO, DANA). Bulanan, bisa cancel kapan saja.' },
        { q: 'Bisa refund?', a: 'Kalau dalam 7 hari pertama kamu nggak puas, refund 100%. Nggak ada pertanyaan.' },
      ],
    },
  ];
</script>

<PublicLayout current="#/faq">
  <div class="faq-page">
    <header class="page-header">
      <h1>Pertanyaan Umum</h1>
      <p>Hal-hal yang sering ditanya. Kalau pertanyaan kamu nggak ada disini, tinggal chat Saji di Telegram.</p>
    </header>

    {#each faqs as cat}
      <section class="faq-category">
        <h2>{cat.category}</h2>
        <div class="faq-list">
          {#each cat.items as item}
            <details class="faq-item">
              <summary>
                <span>{item.q}</span>
                <span class="chevron">+</span>
              </summary>
              <p>{item.a}</p>
            </details>
          {/each}
        </div>
      </section>
    {/each}

    <section class="cta">
      <h2>Masih ada pertanyaan?</h2>
      <p>Chat langsung Saji di Telegram. Atau daftar dulu, coba sendiri.</p>
      <div class="cta-buttons">
        <a href="#/signup"><Button variant="primary" size="lg">Daftar gratis</Button></a>
        <a href="https://t.me/personalized_meal_planner_bot"><Button variant="secondary" size="lg">Chat di Telegram</Button></a>
      </div>
    </section>
  </div>
</PublicLayout>

<style>
  .faq-page { max-width: 800px; margin: 0 auto; }

  .page-header { text-align: center; margin-bottom: var(--space-10); }
  .page-header h1 { font-size: var(--fs-2xl); font-weight: var(--fw-bold); letter-spacing: var(--ls-tight); margin-bottom: var(--space-2); }
  .page-header p { color: var(--text-muted); font-size: var(--fs-md); max-width: 600px; margin: 0 auto; }

  .faq-category { margin-bottom: var(--space-8); }
  .faq-category h2 {
    font-size: var(--fs-md); font-weight: var(--fw-semibold); color: var(--primary);
    margin-bottom: var(--space-3); padding-bottom: var(--space-2); border-bottom: 1px solid var(--border);
  }
  .faq-list { display: flex; flex-direction: column; gap: var(--space-2); }

  .faq-item {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md);
    overflow: hidden; transition: border-color var(--duration-micro) var(--ease-standard);
  }
  .faq-item[open] { border-color: var(--primary); }
  .faq-item summary {
    padding: var(--space-3) var(--space-4); cursor: pointer; font-size: var(--fs-sm);
    font-weight: var(--fw-medium); color: var(--text); display: flex; justify-content: space-between;
    align-items: center; list-style: none;
  }
  .faq-item summary::-webkit-details-marker { display: none; }
  .faq-item summary:hover { color: var(--primary); }
  .chevron { font-size: var(--fs-md); color: var(--text-subtle); transition: transform var(--duration-micro) var(--ease-standard); }
  .faq-item[open] .chevron { transform: rotate(45deg); }
  .faq-item p { padding: 0 var(--space-4) var(--space-4); font-size: var(--fs-sm); color: var(--text-muted); line-height: var(--lh-relaxed); margin: 0; }

  .cta { text-align: center; padding: var(--space-10) var(--space-6); background: var(--surface); border-radius: var(--radius-xl); }
  .cta h2 { font-size: var(--fs-2xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-3); }
  .cta p { color: var(--text-muted); margin-bottom: var(--space-6); }
  .cta-buttons { display: flex; gap: var(--space-3); justify-content: center; flex-wrap: wrap; }

  @media (max-width: 768px) {
    .faq-item summary { padding: var(--space-3); }
    .faq-item p { padding: 0 var(--space-3) var(--space-3); }
  }
</style>
