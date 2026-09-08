<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import PublicLayout from '$lib/components/PublicLayout.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { onMount } from 'svelte';

  onMount(() => theme.init());

  const principles = [
    {
      emoji: '🥬',
      title: 'Bahan lokal dulu',
      desc: 'Indonesia punya tempe, tahu, kangkung, ikan kembung, ayam, rempah-rempah. Kenapa cari quinoa yang diimpor dan mahal? Saji pakai bahan yang ada di warung depan rumah.',
    },
    {
      emoji: '🍚',
      title: 'Enak lebih penting dari ketat',
      desc: 'Diet yang nggak enak nggak bakal bertahan. Saji bikin rencana yang enak dulu, sehat nomor dua — tapi tetap sehat. Kayak nasi merah + ayam bakar, bukan salad kosong.',
    },
    {
      emoji: '🔥',
      title: 'Konsistensi > kesempurnaan',
      desc: 'Makan sehat 70% setiap hari lebih baik dari 100% tiga hari terus nyerah. Saji bantu jaga streak, kirim rencana tiap hari, biar kamu tinggal ikutin.',
    },
    {
      emoji: '📱',
      title: 'Nggak perlu app baru',
      desc: 'Saji lewat Telegram atau WhatsApp. Nggak perlu download app baru, bikin akun baru, atau buka app lain. Rencana datang ke chat yang udah kamu pakai tiap hari.',
    },
  ];

  const manifest = [
    'Quinoa mahal — kita pakai nasi merah.',
    'Kale susah cari — kita pakai kangkung.',
    'Salmon impor — kita pakai ikan kembung.',
    'Olive oil mahal — kita pakai minyak kelapa sawit.',
    'Greek yogurt — kita pakai yogurt lokal.',
    'Bahan impor = mahal dan susah. Bahan lokal = murah, segar, dan gampang cari.',
  ];
</script>

<PublicLayout current="#/tentang">
  <div class="about-page">
    <header class="page-header">
      <div class="page-emoji">🍽️</div>
      <h1>Kenapa Saji?</h1>
      <p class="page-tagline">
        Karena kami capek lihat app diet yang nyuruh orang Indonesia makan quinoa dan kale.
      </p>
    </header>

    <!-- Manifesto -->
    <section class="manifesto">
      <h2>Manifesto Saji</h2>
      <ul class="manifest-list">
        {#each manifest as m}
          <li>{m}</li>
        {/each}
      </ul>
      <p class="manifest-note">
        Saji dirancang buat orang Indonesia. Rencana makan pakai bahan yang kamu kenal,
        masakan yang kamu tumbuh, dan rasa yang bikin kangen rumah.
      </p>
    </section>

    <!-- Principles -->
    <section class="principles">
      <h2>Prinsip kami</h2>
      <div class="principle-grid">
        {#each principles as p}
          <div class="principle-card">
            <div class="principle-emoji">{p.emoji}</div>
            <h3>{p.title}</h3>
            <p>{p.desc}</p>
          </div>
        {/each}
      </div>
    </section>

    <!-- Story -->
    <section class="story">
      <h2>Cerita singkat</h2>
      <p>
        Saji mulai dari satu masalah: "mau makan apa hari ini?" — pertanyaan yang muncul tiap hari,
        jawabannya makin lama makin capek. Kami mikir, kenapa nggak ada yang bikin rencana makan
        yang pakai bahan Indonesia, dikirim ke Telegram, dan nggak nyuruh kamu beli bahan yang
        nggak ada di pasar?
      </p>
      <p>
        Jadi kami bikin Saji. Generator rencana makan yang tahu tempe itu bukan "alternative protein"
        — itu makanan pokok. Yang tahu kangkung bukan "exotic green" — itu sayur murah yang enak
        ditumis. Yang tahu kecap manis bukan "sweet soy glaze" — itu bumbu dapur.
      </p>
      <p>
        Saji pakai AI buat generate rencana, tapi filosofinya sederhana: bikin makan sehat jadi
        gampang, enak, dan lokal. Tiap hari.
      </p>
    </section>

    <!-- CTA -->
    <section class="cta">
      <h2>Mau makan enak tiap hari?</h2>
      <p>Daftar gratis. Nggak ada kartu kredit, nggak ada alasan buat nunda.</p>
      <a href="#/signup"><Button variant="primary" size="lg">Mulai dari hari ini</Button></a>
    </section>
  </div>
</PublicLayout>

<style>
  .about-page { max-width: 800px; margin: 0 auto; }

  .page-header { text-align: center; margin-bottom: var(--space-12); }
  .page-emoji { font-size: 3rem; margin-bottom: var(--space-3); }
  .page-header h1 { font-size: var(--fs-2xl); font-weight: var(--fw-bold); letter-spacing: var(--ls-tight); margin-bottom: var(--space-3); }
  .page-tagline { color: var(--text-muted); font-size: var(--fs-md); max-width: 500px; margin: 0 auto; font-style: italic; }

  /* Manifesto */
  .manifesto {
    background: var(--surface); border-radius: var(--radius-xl); padding: var(--space-8);
    margin-bottom: var(--space-12); border: 1px solid var(--border);
  }
  .manifesto h2 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-5); text-align: center; }
  .manifest-list { list-style: none; padding: 0; margin: 0 0 var(--space-5); display: flex; flex-direction: column; gap: var(--space-3); }
  .manifest-list li {
    font-size: var(--fs-md); color: var(--text); padding: var(--space-2) 0 var(--space-2) var(--space-5);
    position: relative; border-bottom: 1px solid var(--border); line-height: var(--lh-normal);
  }
  .manifest-list li::before { content: '→'; position: absolute; left: 0; color: var(--primary); font-weight: var(--fw-bold); }
  .manifest-note { color: var(--text-muted); font-size: var(--fs-sm); line-height: var(--lh-relaxed); text-align: center; }

  /* Principles */
  .principles { margin-bottom: var(--space-12); }
  .principles h2 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); text-align: center; margin-bottom: var(--space-6); }
  .principle-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5); }
  .principle-card {
    background: var(--surface); border-radius: var(--radius-lg); padding: var(--space-5);
    border: 1px solid var(--border);
  }
  .principle-emoji { font-size: 2rem; margin-bottom: var(--space-2); }
  .principle-card h3 { font-size: var(--fs-md); font-weight: var(--fw-semibold); margin-bottom: var(--space-2); }
  .principle-card p { font-size: var(--fs-sm); color: var(--text-muted); line-height: var(--lh-relaxed); }

  /* Story */
  .story { margin-bottom: var(--space-10); }
  .story h2 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-5); }
  .story p { font-size: var(--fs-md); color: var(--text-muted); line-height: var(--lh-relaxed); margin-bottom: var(--space-4); }

  .cta { text-align: center; padding: var(--space-10) var(--space-6); background: var(--surface); border-radius: var(--radius-xl); }
  .cta h2 { font-size: var(--fs-2xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-3); }
  .cta p { color: var(--text-muted); margin-bottom: var(--space-6); }

  @media (max-width: 768px) {
    .principle-grid { grid-template-columns: 1fr; }
  }
</style>
