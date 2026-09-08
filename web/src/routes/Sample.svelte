<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import PublicLayout from '$lib/components/PublicLayout.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { onMount } from 'svelte';

  onMount(() => theme.init());

  const plans = [
    {
      cuisine: 'Masakan Indonesia',
      flag: '🍛',
      emoji: '🍛',
      target: '1500 kal · 100g protein',
      meals: [
        { name: 'Sarapan', emoji: '🍳', items: 'Nasi merah, telur dadar, tempe goreng', cal: 450, protein: 25 },
        { name: 'Makan Siang', emoji: '🍱', items: 'Ayam bakar kecap, sayur asem, nasi putih', cal: 650, protein: 40 },
        { name: 'Makan Malam', emoji: '🌙', items: 'Sup ikan kembung, kangkung tumis belacan', cal: 400, protein: 35 },
      ],
      shopping: [
        'Nasi merah 2 cup', 'Telur 3 butir', 'Tempe 150g', 'Ayam paha 200g',
        'Kangkung 1 ikat', 'Ikan kembung 2 ekor', 'Kecap manis, bawang, cabai, asam jawa',
      ],
      cookingSteps: [
        'Marinasi ayam dengan kecap manis, bawang putih, merica 15 menit',
        'Bakar ayam 20 menit, balik sekali di tengah',
        'Tumis bumbu sayur asem: bawang, cabai, asam jawa',
        'Masukkan kangkung, masak 2 menit jangan terlalu matang',
        'Goreng ikan kembung sampai kering, buat sup bening dengan bawang & jahe',
      ],
    },
    {
      cuisine: 'Masakan Jepang',
      flag: '🍱',
      emoji: '🍱',
      target: '1500 kal · 95g protein',
      meals: [
        { name: 'Sarapan', emoji: '🍳', items: 'Tamago (telur gulung manis), nasi, miso soup, edamame', cal: 420, protein: 22 },
        { name: 'Makan Siang', emoji: '🍱', items: 'Chicken teriyaki, onigiri, salad wakame', cal: 630, protein: 38 },
        { name: 'Makan Malam', emoji: '🌙', items: 'Gyudon (beef bowl), pickled vegetables, miso', cal: 450, protein: 35 },
      ],
      shopping: [
        'Beras 2 cup', 'Telur 4 butir', 'Edamame 100g', 'Ayam dada 200g',
        'Daging sapi tipis 150g', 'Wakame 20g', 'Kecap manis, mirin, miso paste, daun bawang',
      ],
      cookingSteps: [
        'Buat tamago: kocok telur dengan gula dan mirin, gulung tipis di wajan',
        'Simmer daging sapi dengan bawang, kecap manis, mirin, dashi untuk gyudon',
        'Marinasi ayam teriyaki: kecap manis, bawang putih, jahe, grill 15 menit',
        'Buat miso soup: larutkan miso paste dalam dashi, tambahkan wakame & tahu',
      ],
    },
    {
      cuisine: 'Masakan Mediterania',
      flag: '🫒',
      emoji: '🥗',
      target: '1500 kal · 90g protein',
      meals: [
        { name: 'Sarapan', emoji: '🍳', items: 'Greek yogurt, madu, granola, buah segar', cal: 380, protein: 20 },
        { name: 'Makan Siang', emoji: '🍱', items: 'Grilled chicken pita, hummus, tabbouleh', cal: 620, protein: 38 },
        { name: 'Makan Malam', emoji: '🌙', items: 'Ikan bakar, quinoa salad, tzatziki', cal: 500, protein: 32 },
      ],
      shopping: [
        'Greek yogurt 200g', 'Granola 50g', 'Buah segar', 'Pita bread 2 lembar',
        'Hummus 100g', 'Ayam dada 200g', 'Ikan fillet 150g', 'Quinoa 1 cup', 'Mentimun, tomat, bawang bombay',
      ],
      cookingSteps: [
        'Layer yogurt dengan granola dan buah potong untuk sarapan',
        'Grill ayam dengan oregano, lemon, minyak zaitun 15 menit',
        'Isi pita dengan ayam, tomat, mentimun, saus tzatziki',
        'Bakar ikan dengan lemon dan herba 12 menit',
        'Campur quinoa dengan tomat, mentimun, bawang, minyak zaitun',
      ],
    },
  ];

  let activePlan = $state(0);
  let showShopping = $state(false);
  let showCooking = $state(false);
</script>

<PublicLayout current="#/sample">
  <div class="sample-page">
    <header class="page-header">
      <h1>Sample Rencana Makan</h1>
      <p>Tiga rencana asli dari Saji — format yang sama dengan yang kamu terima di Telegram. Beda masakan, target kalori sama.</p>
    </header>

    <!-- Plan selector -->
    <div class="plan-selector">
      {#each plans as p, i}
        <button
          class="selector-btn"
          class:active={activePlan === i}
          onclick={() => { activePlan = i; showShopping = false; showCooking = false; }}
        >
          <span class="selector-flag">{p.flag}</span>
          <span class="selector-label">{p.cuisine}</span>
        </button>
      {/each}
    </div>

    <!-- Active plan -->
    {#each plans as plan, i}
      {#if activePlan === i}
        {@const totalCal = plan.meals.reduce((s, m) => s + m.cal, 0)}
        {@const totalProtein = plan.meals.reduce((s, m) => s + m.protein, 0)}
        <article class="plan-detail">
          <!-- Plan header -->
          <div class="plan-header">
            <div>
              <span class="plan-emoji">{plan.emoji}</span>
              <span class="plan-cuisine">{plan.cuisine}</span>
            </div>
            <span class="plan-target">{plan.target}</span>
          </div>

          <!-- Meals -->
          <div class="meals-list">
            {#each plan.meals as m}
              <div class="meal-card">
                <div class="meal-left">
                  <span class="meal-emoji">{m.emoji}</span>
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
            <div class="plan-total">
              Total: {totalCal} kal · {totalProtein}g protein
            </div>
          </div>

          <!-- Toggle sections -->
          <div class="extra-sections">
            <button class="toggle-btn" onclick={() => showShopping = !showShopping}>
              🛒 {showShopping ? 'Sembunyikan' : 'Lihat'} daftar belanja
            </button>
            {#if showShopping}
              <div class="shopping-list">
                {#each plan.shopping as item}
                  <label class="shopping-item">
                    <input type="checkbox" />
                    <span>{item}</span>
                  </label>
                {/each}
              </div>
            {/if}

            <button class="toggle-btn" onclick={() => showCooking = !showCooking}>
              🍳 {showCooking ? 'Sembunyikan' : 'Lihat'} panduan masak
            </button>
            {#if showCooking}
              <ol class="cooking-list">
                {#each plan.cookingSteps as step}
                  <li>{step}</li>
                {/each}
              </ol>
            {/if}
          </div>
        </article>
      {/if}
    {/each}

    <!-- Comparison -->
    <section class="comparison">
      <h2>Perbandingan sekilas</h2>
      <table>
        <thead>
          <tr>
            <th>Masakan</th>
            <th>Kalori</th>
            <th>Protein</th>
            <th>Karakter</th>
          </tr>
        </thead>
        <tbody>
          {#each plans as p}
            {@const tc = p.meals.reduce((s, m) => s + m.cal, 0)}
            {@const tp = p.meals.reduce((s, m) => s + m.protein, 0)}
            <tr>
              <td>{p.flag} {p.cuisine}</td>
              <td>{tc} kal</td>
              <td>{tp}g</td>
              <td>{p.cuisine === 'Masakan Indonesia' ? 'Bumbu kuat, sayuran lokal' : p.cuisine === 'Masakan Jepang' ? 'Seimbang, umami, porsi kecil' : 'Segar, olive oil, herba'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>

    <section class="cta">
      <h2>Mau rencana kayak gini?</h2>
      <p>Daftar gratis, pilih masakan favorit, Saji bikin tiap hari.</p>
      <a href="#/signup"><Button variant="primary" size="lg">Gas!</Button></a>
    </section>
  </div>
</PublicLayout>

<style>
  .sample-page { max-width: 900px; margin: 0 auto; }

  .page-header { text-align: center; margin-bottom: var(--space-10); }
  .page-header h1 { font-size: var(--fs-2xl); font-weight: var(--fw-bold); letter-spacing: var(--ls-tight); margin-bottom: var(--space-2); }
  .page-header p { color: var(--text-muted); font-size: var(--fs-md); max-width: 600px; margin: 0 auto; }

  /* Selector */
  .plan-selector { display: flex; gap: var(--space-3); margin-bottom: var(--space-6); flex-wrap: wrap; }
  .selector-btn {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-pill);
    padding: var(--space-2) var(--space-4); font-family: inherit; font-size: var(--fs-sm);
    color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: var(--space-2);
    transition: all var(--duration-micro) var(--ease-standard);
  }
  .selector-btn:hover { border-color: var(--primary); }
  .selector-btn.active { background: var(--primary); color: var(--text-on-primary); border-color: var(--primary); }
  .selector-flag { font-size: var(--fs-md); }
  .selector-label { font-weight: var(--fw-medium); }

  /* Plan detail */
  .plan-detail {
    background: var(--surface); border-radius: var(--radius-xl); padding: var(--space-6);
    border: 1px solid var(--border); margin-bottom: var(--space-8);
  }
  .plan-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-5); flex-wrap: wrap; gap: var(--space-3); }
  .plan-header > div { display: flex; align-items: center; gap: var(--space-3); }
  .plan-emoji { font-size: var(--fs-2xl); }
  .plan-cuisine { font-size: var(--fs-xl); font-weight: var(--fw-semibold); }
  .plan-target {
    background: var(--primary-soft); color: var(--primary); padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-pill); font-size: var(--fs-sm); font-weight: var(--fw-medium);
    font-variant-numeric: tabular-nums;
  }

  /* Meals */
  .meals-list { display: flex; flex-direction: column; gap: var(--space-3); }
  .meal-card {
    display: flex; justify-content: space-between; align-items: center;
    background: var(--surface-2); border-radius: var(--radius-md); padding: var(--space-4);
    gap: var(--space-3);
  }
  .meal-left { display: flex; gap: var(--space-3); align-items: flex-start; flex: 1; }
  .meal-card .meal-emoji { font-size: var(--fs-xl); }
  .meal-card .meal-name { font-size: var(--fs-md); font-weight: var(--fw-semibold); margin-bottom: var(--space-1); }
  .meal-card .meal-items { font-size: var(--fs-sm); color: var(--text-subtle); line-height: 1.4; }
  .meal-macros { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
  .macro-cal { font-size: var(--fs-sm); color: var(--primary); font-weight: var(--fw-semibold); font-variant-numeric: tabular-nums; }
  .macro-protein { font-size: var(--fs-xs); color: var(--text-faint); font-variant-numeric: tabular-nums; }
  .plan-total {
    text-align: right; padding-top: var(--space-3); border-top: 1px solid var(--border);
    font-size: var(--fs-sm); color: var(--text-muted); font-variant-numeric: tabular-nums;
  }

  /* Extra sections */
  .extra-sections { margin-top: var(--space-5); }
  .toggle-btn {
    background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-4); font-family: inherit; font-size: var(--fs-sm);
    color: var(--text-muted); cursor: pointer; width: 100%; text-align: left; margin-bottom: var(--space-3);
    transition: all var(--duration-micro) var(--ease-standard);
  }
  .toggle-btn:hover { border-color: var(--primary); color: var(--text); }

  .shopping-list { display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-5); padding: var(--space-4); background: var(--surface-2); border-radius: var(--radius-md); }
  .shopping-item { display: flex; align-items: center; gap: var(--space-3); cursor: pointer; }
  .shopping-item input { width: 18px; height: 18px; accent-color: var(--primary); }
  .shopping-item span { font-size: var(--fs-sm); color: var(--text-muted); }
  .shopping-item input:checked + span { text-decoration: line-through; color: var(--text-faint); }

  .cooking-list { margin: 0 0 var(--space-5) var(--space-4); padding: var(--space-4); background: var(--surface-2); border-radius: var(--radius-md); list-style: decimal; }
  .cooking-list li { font-size: var(--fs-sm); color: var(--text-muted); padding: var(--space-1) 0; line-height: var(--lh-normal); }

  /* Comparison table */
  .comparison { margin-bottom: var(--space-8); }
  .comparison h2 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-5); }
  .comparison table { width: 100%; border-collapse: collapse; }
  .comparison th, .comparison td { text-align: left; padding: var(--space-3); border-bottom: 1px solid var(--border); font-size: var(--fs-sm); }
  .comparison th { color: var(--text-subtle); text-transform: uppercase; font-size: var(--fs-xs); letter-spacing: var(--ls-wide); font-weight: var(--fw-semibold); }
  .comparison td { color: var(--text-muted); }
  .comparison td:nth-child(2), .comparison td:nth-child(3) { font-variant-numeric: tabular-nums; }

  .cta { text-align: center; padding: var(--space-10) var(--space-6); background: var(--surface); border-radius: var(--radius-xl); }
  .cta h2 { font-size: var(--fs-2xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-3); }
  .cta p { color: var(--text-muted); margin-bottom: var(--space-6); }

  @media (max-width: 768px) {
    .plan-header { flex-direction: column; align-items: flex-start; }
    .meal-card { flex-direction: column; align-items: flex-start; }
    .meal-macros { flex-direction: row; gap: var(--space-3); }
  }
</style>
