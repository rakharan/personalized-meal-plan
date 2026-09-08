<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import PublicLayout from '$lib/components/PublicLayout.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { onMount } from 'svelte';

  onMount(() => theme.init());

  const steps = [
    {
      num: 1,
      title: 'Set preferensi',
      emoji: '⚙️',
      desc: 'Jawab beberapa pertanyaan: goal (turun berat badan, naik mass otot, maintenance), alergi, target kalori, masakan favorit. 30 detik selesai.',
      details: [
        { label: 'Goal', value: 'Turun berat badan, naik mass otot, atau maintenance' },
        { label: 'Alergi', value: 'Kacang, seafood, susu, gluten — atau bebas' },
        { label: 'Kalori', value: '1200–3000 kal/hari, sesuai kebutuhan' },
        { label: 'Masakan', value: 'Indonesia, Jepang, Korea, Mediterania, dll' },
        { label: 'Protein', value: 'Target protein harian (opsional)' },
      ],
      mockup: {
        type: 'chat',
        messages: [
          { from: 'bot', text: 'Halo! Aku Saji. Goal kamu apa? Turun berat badan, naik mass otot, atau maintenance?' },
          { from: 'user', text: 'Turun berat badan' },
          { from: 'bot', text: 'Oke! Ada alergi atau makanan yang dihindari?' },
          { from: 'user', text: 'Seafood' },
          { from: 'bot', text: 'Berapa target kalori harian kamu?' },
          { from: 'user', text: '1500 kal' },
          { from: 'bot', text: 'Masakan favorit? Bisa pilih lebih dari satu.' },
          { from: 'user', text: 'Indonesia, Jepang' },
          { from: 'bot', text: 'Mantap! Aku siap bikin rencana makan kamu.' },
        ],
      },
    },
    {
      num: 2,
      title: 'Generate rencana',
      emoji: '🍳',
      desc: 'Saji bikin rencana makan harian dengan bahan yang ada di Indonesia. Beda masakan tiap hari. Makro lengkap per meal. Satu klik, selesai.',
      details: [
        { label: 'Bahan', value: 'Tempe, kangkung, ikan kembung, tahu, kecap manis, nasi merah' },
        { label: 'Masakan', value: 'Otomatis rotasi — hari ini Indonesia, besok Jepang, lusa Korea' },
        { label: 'Makro', value: 'Kalori + protein per meal, total harian' },
        { label: 'Daftar belanja', value: 'Sekali klik, semua bahan terkumpul' },
        { label: 'Panduan masak', value: 'Step-by-step untuk setiap menu' },
      ],
      mockup: {
        type: 'plan',
        cuisine: 'Masakan Indonesia',
        meals: [
          { name: 'Sarapan', items: 'Nasi merah, telur dadar, tempe goreng', cal: 450, protein: 25 },
          { name: 'Makan Siang', items: 'Ayam bakar, sayur asem, nasi putih', cal: 650, protein: 40 },
          { name: 'Makan Malam', items: 'Sup ikan kembung, kangkung tumis', cal: 400, protein: 35 },
        ],
        totalCal: 1500,
        totalProtein: 100,
      },
    },
    {
      num: 3,
      title: 'Terima & ikuti',
      emoji: '📱',
      desc: 'Rencana dikirim via Telegram atau WhatsApp setiap hari. Ikuti rencana, jaga streak, request daftar belanja kapan saja. Push otomatis sesuai jam yang kamu pilih.',
      details: [
        { label: 'Channel', value: 'Telegram atau WhatsApp' },
        { label: 'Push', value: 'Otomatis tiap hari, jam sesuai pilihan kamu' },
        { label: 'Streak', value: 'Hitung hari beruntun ikuti rencana' },
        { label: 'Feedback', value: 'Kasih rating — bantu Saji belajar preferensi kamu' },
        { label: 'Referral', value: 'Ajak teman, dapat extra rencana gratis' },
      ],
      mockup: {
        type: 'push',
        messages: [
          { from: 'bot', text: '🌅 Rencana makan hari ini udah siap! Masakan Indonesia. Cek ya!' },
          { from: 'user', text: 'Mau daftar belanja' },
          { from: 'bot', text: '🛒 Daftar Belanja:\n• Nasi merah 2 cup\n• Telur 3 butir\n• Tempe 150g\n• Ayam 200g\n• Kangkung 1 ikat\n• Ikan kembung 2 ekor\n• Kecap manis, bawang, cabai' },
          { from: 'user', text: '👍 rencananya enak banget hari ini' },
          { from: 'bot', text: 'Yeay! 🔥 Streak kamu: 5 hari. Lanjut besok ya!' },
        ],
      },
    },
  ];

  function getMockupEmoji(name: string) {
    if (name.match(/Sarapan|Breakfast/)) return '🍳';
    if (name.match(/siang|Lunch/)) return '🍱';
    if (name.match(/malam|Dinner/)) return '🍲';
    return '🥗';
  }
</script>

<PublicLayout current="#/cara-kerja">
  <div class="how-page">
    <header class="page-header">
      <h1>Gimana cara kerjanya?</h1>
      <p>Tiga langkah aja. Setelah itu, Saji yang kerja — kamu tinggal makan.</p>
    </header>

    {#each steps as step, i}
      <section class="step-row" class:reverse={i % 2 === 1}>
        <!-- Step content -->
        <div class="step-content">
          <div class="step-header">
            <div class="step-num">{step.num}</div>
            <div>
              <span class="step-emoji">{step.emoji}</span>
              <h2>{step.title}</h2>
            </div>
          </div>
          <p class="step-desc">{step.desc}</p>
          <dl class="step-details">
            {#each step.details as d}
              <div class="detail-row">
                <dt>{d.label}</dt>
                <dd>{d.value}</dd>
              </div>
            {/each}
          </dl>
        </div>

        <!-- Phone mockup -->
        <div class="step-mockup">
          <div class="glow"></div>
          <div class="phone">
            <div class="phone-notch"></div>
            <div class="phone-screen">
              <div class="phone-statusbar">
                <span>9:41</span>
                <span>📶 🔋</span>
              </div>
              <div class="phone-chat">
                {#if step.mockup.type === 'chat' || step.mockup.type === 'push'}
                  {#each step.mockup.messages as msg}
                    <div class="phone-msg" class:user={msg.from === 'user'}>
                      {#if msg.from === 'bot'}
                        <div class="msg-avatar">🍽️</div>
                      {/if}
                      <div class="msg-bubble" class:plan={msg.from === 'bot' && step.mockup.type === 'push' && msg.text.includes('🛒')}>
                        <pre class="msg-text">{msg.text}</pre>
                      </div>
                    </div>
                  {/each}
                {:else if step.mockup.type === 'plan'}
                  <div class="phone-msg bot">
                    <div class="msg-avatar">🍽️</div>
                    <div class="msg-bubble msg-plan">
                      <div class="plan-cuisine">🇮🇩 {step.mockup.cuisine}</div>
                      {#each step.mockup.meals as m}
                        <div class="plan-meal">
                          <div class="meal-row">
                            <span class="meal-emoji">{getMockupEmoji(m.name)}</span>
                            <div class="meal-info">
                              <div class="meal-name">{m.name}</div>
                              <div class="meal-items">{m.items}</div>
                            </div>
                          </div>
                          <div class="meal-macros">
                            <span class="macro-cal">{m.cal} kal</span>
                            <span class="macro-protein">{m.protein}g protein</span>
                          </div>
                        </div>
                      {/each}
                      <div class="plan-total">Total: {step.mockup.totalCal} kal · {step.mockup.totalProtein}g protein</div>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </div>
      </section>
    {/each}

    <!-- CTA -->
    <section class="cta">
      <h2>Udah paham?</h2>
      <p>Rencana makan pertama cuma 3 detik lagi.</p>
      <a href="#/signup"><Button variant="primary" size="lg">Ayo mulai!</Button></a>
    </section>
  </div>
</PublicLayout>

<style>
  .how-page { max-width: 900px; margin: 0 auto; }

  .page-header { text-align: center; margin-bottom: var(--space-12); }
  .page-header h1 { font-size: var(--fs-2xl); font-weight: var(--fw-bold); letter-spacing: var(--ls-tight); margin-bottom: var(--space-2); }
  .page-header p { color: var(--text-muted); font-size: var(--fs-md); }

  .step-row {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: var(--space-10); align-items: center;
    margin-bottom: var(--space-14);
  }
  .step-row.reverse { direction: rtl; }
  .step-row.reverse > * { direction: ltr; }

  .step-header { display: flex; align-items: flex-start; gap: var(--space-4); margin-bottom: var(--space-4); }
  .step-num {
    width: 44px; height: 44px; background: var(--primary); color: var(--text-on-primary);
    border-radius: var(--radius-pill); display: flex; align-items: center; justify-content: center;
    font-size: var(--fs-lg); font-weight: var(--fw-bold); flex-shrink: 0;
  }
  .step-emoji { font-size: 1.5rem; }
  .step-row h2 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); margin-top: var(--space-1); }
  .step-desc { color: var(--text-muted); font-size: var(--fs-md); line-height: var(--lh-relaxed); margin-bottom: var(--space-5); }

  .step-details { display: flex; flex-direction: column; gap: var(--space-2); }
  .detail-row { display: flex; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--border); }
  .detail-row dt { font-size: var(--fs-sm); color: var(--text-subtle); width: 120px; flex-shrink: 0; font-weight: var(--fw-medium); }
  .detail-row dd { font-size: var(--fs-sm); color: var(--text-muted); margin: 0; }

  /* Phone mockup */
  .step-mockup { position: relative; display: flex; justify-content: center; }
  .glow {
    position: absolute; top: 10%; left: 10%; width: 80%; height: 60%;
    background: radial-gradient(ellipse, var(--primary-soft) 0%, transparent 55%);
    pointer-events: none;
  }
  .phone {
    width: 300px; max-width: 100%; background: var(--surface);
    border-radius: 2rem; box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px var(--border-strong);
    padding: var(--space-2); position: relative; z-index: 1;
  }
  .phone-notch { width: 40%; height: 6px; background: var(--bg); border-radius: 0 0 8px 8px; margin: 0 auto; }
  .phone-screen { background: var(--bg); border-radius: 1.5rem; overflow: hidden; }
  .phone-statusbar { display: flex; justify-content: space-between; padding: var(--space-2) var(--space-3); font-size: var(--fs-xs); color: var(--text-subtle); }
  .phone-chat { padding: var(--space-2); max-height: 360px; overflow: hidden; }
  .phone-msg { display: flex; gap: var(--space-2); margin-bottom: var(--space-2); }
  .phone-msg.user { justify-content: flex-end; }
  .msg-avatar { width: 24px; height: 24px; background: var(--surface-3); border-radius: var(--radius-pill); display: flex; align-items: center; justify-content: center; font-size: var(--fs-xs); flex-shrink: 0; }
  .msg-bubble { background: var(--surface-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md) var(--radius-md) var(--radius-md) 2px; font-size: 0.7rem; line-height: 1.4; color: var(--text); max-width: 85%; }
  .phone-msg.user .msg-bubble { background: var(--primary); color: var(--bg); border-radius: var(--radius-md) var(--radius-md) 2px var(--radius-md); font-weight: var(--fw-medium); }
  .msg-text { font-family: inherit; margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 0.7rem; }
  .msg-plan { padding: var(--space-3); }
  .plan-cuisine { font-size: var(--fs-xs); font-weight: var(--fw-semibold); color: var(--accent); margin-bottom: var(--space-2); padding-bottom: var(--space-2); border-bottom: 1px solid var(--border); }
  .plan-meal { display: flex; justify-content: space-between; align-items: center; padding: var(--space-1) 0; gap: var(--space-2); }
  .meal-row { display: flex; gap: var(--space-2); align-items: flex-start; flex: 1; }
  .meal-emoji { font-size: var(--fs-sm); }
  .meal-info { flex: 1; }
  .meal-name { font-size: 0.7rem; font-weight: var(--fw-semibold); color: var(--text); }
  .meal-items { font-size: 0.6rem; color: var(--text-subtle); line-height: 1.3; }
  .meal-macros { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; flex-shrink: 0; }
  .macro-cal { font-size: 0.6rem; color: var(--primary); font-weight: var(--fw-medium); font-variant-numeric: tabular-nums; }
  .macro-protein { font-size: 0.55rem; color: var(--text-faint); font-variant-numeric: tabular-nums; }
  .plan-total { margin-top: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--border); font-size: 0.6rem; color: var(--text-muted); font-variant-numeric: tabular-nums; }

  .cta {
    text-align: center; padding: var(--space-10) var(--space-6);
    background: var(--surface); border-radius: var(--radius-xl);
    margin-bottom: var(--space-10);
  }
  .cta h2 { font-size: var(--fs-2xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-3); }
  .cta p { color: var(--text-muted); margin-bottom: var(--space-6); }

  @media (max-width: 768px) {
    .step-row { grid-template-columns: 1fr; gap: var(--space-6); }
    .step-row.reverse { direction: ltr; }
    .step-mockup { order: -1; }
    .detail-row dt { width: 100px; }
  }
</style>
