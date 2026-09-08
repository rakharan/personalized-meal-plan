<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import PublicLayout from '$lib/components/PublicLayout.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { onMount } from 'svelte';

  onMount(() => theme.init());

  const cuisines = [
    {
      name: 'Indonesia',
      flag: '🍛',
      emoji: '🍛',
      tagline: 'Bumbu kuat, sayuran lokal, nasi',
      desc: 'Saji paling tiap hari. Tempe, ayam bakar kecap, sayur asem, kangkung, ikan kembung. Bumbu yang bikin kangen rumah.',
      dishes: ['Nasi merah + telur dadar + tempe goreng', 'Ayam bakar kecap + sayur asem', 'Sup ikan kembung + kangkung tumis', 'Nasi goreng kampung + telur mata sapi', 'Rendang + nasi + lalapan', 'Soto ayam + nasi + kerupuk'],
      keyIngredients: ['Tempe', 'Kangkung', 'Ikan kembung', 'Kecap manis', 'Bawang', 'Cabai', 'Asam jawa', 'Nasi'],
    },
    {
      name: 'Jepang',
      flag: '🍱',
      emoji: '🍱',
      tagline: 'Seimbang, umami, porsi kecil',
      desc: 'Tamago, teriyaki, miso soup, onigiri. Porsi kecil tapi kenyang. Banyak protein, sayuran, dan karbo dari nasi. Umami jadi kunci.',
      dishes: ['Tamago + nasi + miso soup + edamame', 'Chicken teriyaki + onigiri + salad wakame', 'Gyudon (beef bowl) + pickled vegetables', 'Katsudon + miso + salad', 'Saba shio + nasi + miso', 'Tempura + soba + salad'],
      keyIngredients: ['Beras', 'Telur', 'Kecap manis', 'Mirin', 'Miso paste', 'Wakame', 'Daun bawang', 'Daging sapi'],
    },
    {
      name: 'Korea',
      flag: '🍲',
      emoji: '🍲',
      tagline: 'Pedas, fermentasi, kimchi',
      desc: 'Kimchi, bulgogi, bibimbap. Banyak sayur fermentasi dan daging grill. Rasa pedas dan asam khas. Sehat karena fermentasi.',
      dishes: ['Bibimbap + kimchi + telur', 'Bulgogi + nasi + banchan', 'Doenjang jjigae + nasi', 'Tteokbokki + kimchi', 'Jeyuk bokkeum + nasi + salad', 'Samgyeopsal + nasi + kimchi'],
      keyIngredients: ['Kimchi', 'Gochujang', 'Daging sapi', 'Beras', 'Daun bawang', 'Cabai', 'Bawang putih', 'Sewu'],
    },
    {
      name: 'Mediterania',
      flag: '🫒',
      emoji: '🥗',
      tagline: 'Segar, olive oil, herba',
      desc: 'Greek yogurt, hummus, grilled chicken pita, tzatziki. Banyak olive oil, sayuran segar, dan protein dari ayam/ikan. Ringan tapi kaya rasa.',
      dishes: ['Greek yogurt + granola + buah', 'Grilled chicken pita + hummus + tabbouleh', 'Ikan bakar + quinoa salad + tzatziki', 'Falafel + pita + hummus', 'Shakshuka + bread', 'Greek salad + grilled fish'],
      keyIngredients: ['Olive oil', 'Yogurt', 'Hummus', 'Pita bread', 'Quinoa', 'Mentimun', 'Tomat', 'Oregano'],
    },
    {
      name: 'Thai',
      flag: '🍜',
      emoji: '🍜',
      tagline: 'Pedas manis, coconut milk',
      desc: 'Pad thai, tom yum, green curry. Aromatik dan pedas. Banyak coconut milk dan herba segar. Kaya rasa: pedas, manis, asam, asin sekaligus.',
      dishes: ['Pad thai + telur + tauge', 'Tom yum + nasi + ikan', 'Green curry + ayam + nasi', 'Som tum + nasi + ayam grill', 'Massaman curry + nasi', 'Tom kha + nasi + sayuran'],
      keyIngredients: ['Coconut milk', 'Lemongrass', 'Cabai', 'Fish sauce', 'Tamarind', 'Daun ketumbar', 'Beras', 'Tauge'],
    },
    {
      name: 'Vietnam',
      flag: '🥢',
      emoji: '🥢',
      tagline: 'Ringan, segar, herbs',
      desc: 'Pho, banh mi, goi cuon. Ringan dan segar. Banyak herba segar, rice paper, dan broth bening. Cocok kalau mau makan enak tapi nggak berat.',
      dishes: ['Pho bo + bean sprouts + herbs', 'Banh mi + grilled pork', 'Goi cuon + peanut sauce', 'Com tam + suon + bi', 'Bun thit nuong + herbs', 'Canh chua + nasi'],
      keyIngredients: ['Rice noodles', 'Rice paper', 'Mint', 'Cilantro', 'Fish sauce', 'Lime', 'Beras', 'Bean sprouts'],
    },
    {
      name: 'India',
      flag: '🫓',
      emoji: '🫓',
      tagline: 'Bumbu kaya, kari, lentil',
      desc: 'Dal, chicken curry, roti. Bumbu kaya dan kompleks. Banyak lentil dan kacang-kacangan untuk protein. Vegetarian-friendly.',
      dishes: ['Dal + roti + yogurt', 'Chicken curry + basmati rice', 'Palak paneer + naan', 'Chana masala + rice', 'Aloo gobi + roti', 'Biryani + raita'],
      keyIngredients: ['Lentil', 'Curry powder', 'Basmati rice', 'Roti/naan', 'Yogurt', 'Bawang', 'Tomat', 'Paneer'],
    },
    {
      name: 'Meksiko',
      flag: '🌮',
      emoji: '🌮',
      tagline: 'Tortilla, bean, cabai, lime',
      desc: 'Tacos, burrito bowl, fajita. Tortilla, beans, dan banyak cabai. Asam dari lime, segar dari salsa. Kenyang dari beans dan jagung.',
      dishes: ['Breakfast burrito + beans + telur', 'Chicken fajita + tortilla + salsa', 'Burrito bowl + rice + beans', 'Fish tacos + salsa + lime', 'Quesadilla + salad', 'Nacho bowl + beans + guac'],
      keyIngredients: ['Tortilla', 'Black beans', 'Cabai', 'Lime', 'Salsa', 'Avocado', 'Beras', 'Jagung'],
    },
  ];

  let active = $state<number | null>(null);
</script>

<PublicLayout current="#/masakan">
  <div class="cuisines-page">
    <header class="page-header">
      <h1>8 Masakan, Rotasi Harian</h1>
      <p>Saji bisa bikin rencana dari 8 masakan berbeda. Pilih favoritmu, atau biarkan Saji rotasi biar nggak bosen.</p>
    </header>

    <div class="cuisine-grid">
      {#each cuisines as c, i}
        <button
          class="cuisine-card"
          class:active={active === i}
          onclick={() => active = active === i ? null : i}
        >
          <div class="cuisine-top">
            <span class="cuisine-flag">{c.flag}</span>
            <span class="cuisine-emoji">{c.emoji}</span>
          </div>
          <h3>{c.name}</h3>
          <p class="cuisine-tagline">{c.tagline}</p>
        </button>
      {/each}
    </div>

    <!-- Detail -->
    {#if active !== null}
      {@const c = cuisines[active]}
      <article class="cuisine-detail">
        <div class="detail-header">
          <span class="detail-emoji">{c.emoji}</span>
          <div>
            <h2>{c.flag} {c.name}</h2>
            <p class="detail-tagline">{c.tagline}</p>
          </div>
        </div>
        <p class="detail-desc">{c.desc}</p>

        <div class="detail-cols">
          <div class="detail-col">
            <h3>Contoh menu</h3>
            <ul class="dish-list">
              {#each c.dishes as dish}
                <li>{dish}</li>
              {/each}
            </ul>
          </div>
          <div class="detail-col">
            <h3>Bahan kunci</h3>
            <div class="ingredient-tags">
              {#each c.keyIngredients as ing}
                <span class="ingredient-tag">{ing}</span>
              {/each}
            </div>
          </div>
        </div>
      </article>
    {/if}

    <section class="cta">
      <h2>Pilih masakan favoritmu</h2>
      <p>Daftar gratis, set preferensi, Saji rotasi tiap hari.</p>
      <a href="#/signup"><Button variant="primary" size="lg">Mulai!</Button></a>
    </section>
  </div>
</PublicLayout>

<style>
  .cuisines-page { max-width: 900px; margin: 0 auto; }

  .page-header { text-align: center; margin-bottom: var(--space-10); }
  .page-header h1 { font-size: var(--fs-2xl); font-weight: var(--fw-bold); letter-spacing: var(--ls-tight); margin-bottom: var(--space-2); }
  .page-header p { color: var(--text-muted); font-size: var(--fs-md); max-width: 600px; margin: 0 auto; }

  .cuisine-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); margin-bottom: var(--space-8); }
  .cuisine-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
    padding: var(--space-4); cursor: pointer; font-family: inherit; text-align: left;
    transition: all var(--duration-micro) var(--ease-standard);
    color: var(--text);
    display: flex; flex-direction: column; gap: var(--space-2);
  }
  .cuisine-card:hover { border-color: var(--primary); box-shadow: var(--shadow-elevation-2); }
  .cuisine-card.active { border-color: var(--primary); background: var(--primary-soft); }
  .cuisine-top { display: flex; justify-content: space-between; align-items: center; }
  .cuisine-flag { font-size: var(--fs-lg); }
  .cuisine-emoji { font-size: var(--fs-2xl); }
  .cuisine-card h3 { font-size: var(--fs-md); font-weight: var(--fw-semibold); }
  .cuisine-tagline { font-size: var(--fs-xs); color: var(--text-subtle); }

  .cuisine-detail {
    background: var(--surface); border-radius: var(--radius-xl); padding: var(--space-6);
    border: 1px solid var(--border); margin-bottom: var(--space-8);
  }
  .detail-header { display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-4); }
  .detail-emoji { font-size: var(--fs-3xl); }
  .detail-header h2 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); }
  .detail-tagline { color: var(--primary); font-size: var(--fs-sm); font-weight: var(--fw-medium); }
  .detail-desc { color: var(--text-muted); font-size: var(--fs-md); line-height: var(--lh-relaxed); margin-bottom: var(--space-6); }

  .detail-cols { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-6); }
  .detail-col h3 { font-size: var(--fs-sm); font-weight: var(--fw-semibold); color: var(--text-subtle); text-transform: uppercase; letter-spacing: var(--ls-wide); margin-bottom: var(--space-3); }
  .dish-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2); }
  .dish-list li { font-size: var(--fs-sm); color: var(--text-muted); padding: var(--space-1) 0; padding-left: var(--space-4); position: relative; }
  .dish-list li::before { content: '•'; position: absolute; left: 0; color: var(--primary); }
  .ingredient-tags { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .ingredient-tag { padding: var(--space-1) var(--space-3); background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-pill); font-size: var(--fs-sm); color: var(--text-muted); }

  .cta { text-align: center; padding: var(--space-10) var(--space-6); background: var(--surface); border-radius: var(--radius-xl); }
  .cta h2 { font-size: var(--fs-2xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-3); }
  .cta p { color: var(--text-muted); margin-bottom: var(--space-6); }

  @media (max-width: 768px) {
    .cuisine-grid { grid-template-columns: repeat(2, 1fr); }
    .detail-cols { grid-template-columns: 1fr; }
  }
</style>
