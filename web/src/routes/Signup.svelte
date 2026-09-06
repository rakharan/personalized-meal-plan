<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import Alert from '$lib/components/Alert.svelte';
  import { calcTDEE, suggestProtein } from '$lib/utils/calc';

  let step = $state(1);
  let error = $state('');
  let loading = $state(false);
  let calcFailed = $state(false);
  let deliveryChannel = $state('telegram');

  // Form data
  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let fullName = $state('');
  let age = $state('');
  let gender = $state('');
  let heightCm = $state('');
  let weightKg = $state('');
  let activityLevel = $state('moderate');
  let cookingSkill = $state('beginner');
  let householdSize = $state('1');
  let hasChildren = $state(false);
  let budgetTier = $state('moderate');
  let healthConditions = $state('');
  let allergies = $state('');
  let dietaryRestrictions = $state('');
  let goal = $state('');
  let targetCalories = $state('');
  let targetProtein = $state('');
  let cuisineRotation = $state('rotate');
  let mealsPerDay = $state('3');
  let dislikedIngredients = $state('');

  const totalSteps = 7;
  const DRAFT_KEY = 'saji-signup-draft';

  const goals = [
    { value: 'weight_loss', label: 'Turun berat badan', icon: '📉' },
    { value: 'muscle_gain', label: 'Naik mass otot', icon: '💪' },
    { value: 'maintenance', label: 'Maintenance', icon: '⚖️' },
    { value: 'general_health', label: 'Makan sehat', icon: '🌟' },
  ];

  const activityLevels = [
    { value: 'sedentary', label: 'Jarang gerak (kerja kantoran)' },
    { value: 'light', label: 'Ringan (jalan kaki 1-3x/minggu)' },
    { value: 'moderate', label: 'Sedang (olahraga 3-5x/minggu)' },
    { value: 'active', label: 'Aktif (olahraga 6-7x/minggu)' },
  ];

  const cuisines = [
    { value: 'rotate', label: '🔄 Putar tiap hari' },
    { value: 'Indonesian', label: 'Indonesia' },
    { value: 'Japanese', label: 'Jepang' },
    { value: 'Korean', label: 'Korea' },
    { value: 'Mediterranean', label: 'Mediterania' },
  ];

  onMount(() => {
    theme.init();
    // Restore draft if exists
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        const d = JSON.parse(draft);
        step = d.step || 1;
        email = d.email || ''; password = d.password || ''; confirmPassword = d.confirmPassword || '';
        fullName = d.fullName || ''; age = d.age || ''; gender = d.gender || '';
        heightCm = d.heightCm || ''; weightKg = d.weightKg || ''; activityLevel = d.activityLevel || 'moderate';
        cookingSkill = d.cookingSkill || 'beginner'; householdSize = d.householdSize || '1';
        hasChildren = d.hasChildren || false; budgetTier = d.budgetTier || 'moderate';
        healthConditions = d.healthConditions || ''; allergies = d.allergies || '';
        dietaryRestrictions = d.dietaryRestrictions || ''; goal = d.goal || '';
        targetCalories = d.targetCalories || ''; targetProtein = d.targetProtein || '';
        cuisineRotation = d.cuisineRotation || 'rotate'; mealsPerDay = d.mealsPerDay || '3';
        dislikedIngredients = d.dislikedIngredients || ''; deliveryChannel = d.deliveryChannel || 'telegram';
      } catch {}
    }
  });

  function saveDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      step, email, password, confirmPassword, fullName, age, gender, heightCm, weightKg,
      activityLevel, cookingSkill, householdSize, hasChildren, budgetTier, healthConditions,
      allergies, dietaryRestrictions, goal, targetCalories, targetProtein, cuisineRotation,
      mealsPerDay, dislikedIngredients, deliveryChannel,
    }));
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
  }

  // Client-side BMR/TDEE calc — no API call needed
  function autoCalcTargets() {
    calcFailed = false;
    if (!gender || !weightKg || !heightCm || !age || !goal) return;
    const tdee = calcTDEE(gender, Number(weightKg), Number(heightCm), Number(age), activityLevel);
    const protein = suggestProtein(goal, Number(weightKg));
    let targetCal = tdee;
    if (goal === 'weight_loss') targetCal = Math.round(tdee * 0.85);
    if (goal === 'muscle_gain') targetCal = Math.round(tdee * 1.1);
    targetCalories = String(targetCal);
    targetProtein = String(protein);
  }

  function next() {
    if (step === 1) {
      if (!email || !password || !fullName) { error = 'Isi semua field'; return; }
      if (password !== confirmPassword) { error = 'Password nggak cocok'; return; }
      if (password.length < 6) { error = 'Password minimal 6 karakter'; return; }
    }
    if (step === 2) {
      if (!age || !gender || !heightCm || !weightKg) { error = 'Isi data personal'; return; }
    }
    if (step === 4) {
      if (!goal) { error = 'Pilih goal'; return; }
    }
    error = '';
    if (step < totalSteps) {
      step++;
      saveDraft();
    }
    if (step === 5) setTimeout(autoCalcTargets, 100);
  }

  function prev() {
    if (step > 1) { step--; saveDraft(); }
    error = '';
  }

  async function submit() {
    loading = true;
    error = '';
    let userId: number | null = null;
    try {
      // Step 1: Register
      const regRes = await auth.register(email, password, fullName);
      if (!regRes) throw new Error('Gagal daftar');
      userId = auth.user?.id || null;

      // Step 2-6: Update profile
      const profileData = {
        age: Number(age), gender, height_cm: Number(heightCm), weight_kg: Number(weightKg),
        activity_level: activityLevel, cooking_skill: cookingSkill,
        household_size: Number(householdSize), has_children: hasChildren,
        budget_tier: budgetTier, health_conditions: healthConditions,
        allergies, dietary_restrictions: dietaryRestrictions, goal,
        target_calories: Number(targetCalories) || undefined,
        target_protein: Number(targetProtein) || undefined,
        cuisine_rotation: cuisineRotation, meals_per_day: Number(mealsPerDay),
        disliked_ingredients: dislikedIngredients,
        delivery_channel: deliveryChannel,
      };

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth.authHeaders() },
        body: JSON.stringify(profileData),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal simpan profil');
      }

      clearDraft();
      step = 7;
    } catch (e: any) {
      error = e.message;
      // Rollback: if account was created but profile failed, delete it
      if (userId) {
        try {
          await fetch('/api/auth/delete', { method: 'POST', headers: auth.authHeaders() });
          auth.logout();
        } catch {}
      }
    } finally {
      loading = false;
    }
  }

  function finish() {
    window.location.hash = '#/dashboard';
  }

  const stepLabels = ['Akun', 'Personal', 'Rumah', 'Kesehatan', 'Preferensi', 'Channel', 'Selesai'];
</script>

<div class="signup-wrap">
  <div class="signup-card">
    <div class="progress-bar" role="progressbar" aria-valuenow={step} aria-valuemax={totalSteps}>
      {#each stepLabels as label, i}
        <div class="step-dot" class:active={step === i + 1} class:done={step > i + 1}>
          <span class="step-num">{i + 1}</span>
        </div>
      {/each}
    </div>

    {#if step === 1}
      <h2>Buat akun Saji 🍽️</h2>
      <p class="step-desc">Buat akun dulu. Nanti kamu bisa atur preferensi makanmu.</p>
      <div class="form-fields">
        <Input label="Nama Lengkap" placeholder="Rakha Randhikatama" bind:value={fullName} />
        <Input label="Email" type="email" placeholder="kamu@email.com" bind:value={email} />
        <Input label="Password" type="password" placeholder="Min. 6 karakter" bind:value={password} />
        <Input label="Konfirmasi Password" type="password" placeholder="Ulang password" bind:value={confirmPassword} />
      </div>
    {:else if step === 2}
      <h2>Data Personal</h2>
      <p class="step-desc">Biar rencana makanmu lebih akurat.</p>
      <div class="form-fields">
        <Input label="Umur" type="number" placeholder="25" bind:value={age} />
        <div class="field-group">
          <span class="input-label" id="label-gender">Gender</span>
          <div class="radio-row" role="radiogroup" aria-labelledby="label-gender">
            <button type="button" role="radio" aria-checked={gender === 'male'} class="radio-btn" class:selected={gender === 'male'} onclick={() => gender = 'male'}>👨 Pria</button>
            <button type="button" role="radio" aria-checked={gender === 'female'} class="radio-btn" class:selected={gender === 'female'} onclick={() => gender = 'female'}>👩 Wanita</button>
            <button type="button" role="radio" aria-checked={gender === 'other'} class="radio-btn" class:selected={gender === 'other'} onclick={() => gender = 'other'}>Lainnya</button>
          </div>
        </div>
        <div class="row-2">
          <Input label="Tinggi (cm)" type="number" placeholder="175" bind:value={heightCm} />
          <Input label="Berat (kg)" type="number" placeholder="70" bind:value={weightKg} />
        </div>
        <div class="field-group">
          <label class="input-label" for="activity">Level Aktivitas</label>
          <select id="activity" bind:value={activityLevel} class="select-input">
            {#each activityLevels as al}<option value={al.value}>{al.label}</option>{/each}
          </select>
        </div>
        <div class="field-group">
          <span class="input-label" id="label-cook">Skill Masak</span>
          <div class="radio-row" role="radiogroup" aria-labelledby="label-cook">
            <button type="button" role="radio" aria-checked={cookingSkill === 'beginner'} class="radio-btn" class:selected={cookingSkill === 'beginner'} onclick={() => cookingSkill = 'beginner'}>Pemula</button>
            <button type="button" role="radio" aria-checked={cookingSkill === 'intermediate'} class="radio-btn" class:selected={cookingSkill === 'intermediate'} onclick={() => cookingSkill = 'intermediate'}>Menengah</button>
            <button type="button" role="radio" aria-checked={cookingSkill === 'advanced'} class="radio-btn" class:selected={cookingSkill === 'advanced'} onclick={() => cookingSkill = 'advanced'}>Mahir</button>
          </div>
        </div>
      </div>
    {:else if step === 3}
      <h2>Rumah Tangga</h2>
      <p class="step-desc">Buat rencana yang sesuai sama kebutuhan keluargamu.</p>
      <div class="form-fields">
        <Input label="Jumlah Orang di Rumah" type="number" placeholder="2" bind:value={householdSize} />
        <div class="field-group">
          <span class="input-label" id="label-children">Ada anak-anak?</span>
          <div class="radio-row" role="radiogroup" aria-labelledby="label-children">
            <button type="button" role="radio" aria-checked={hasChildren} class="radio-btn" class:selected={hasChildren} onclick={() => hasChildren = true}>Ya</button>
            <button type="button" role="radio" aria-checked={!hasChildren} class="radio-btn" class:selected={!hasChildren} onclick={() => hasChildren = false}>Tidak</button>
          </div>
        </div>
        <div class="field-group">
          <span class="input-label" id="label-budget">Budget Makanan</span>
          <div class="radio-row" role="radiogroup" aria-labelledby="label-budget">
            <button type="button" role="radio" aria-checked={budgetTier === 'frugal'} class="radio-btn" class:selected={budgetTier === 'frugal'} onclick={() => budgetTier = 'frugal'}>Hemat</button>
            <button type="button" role="radio" aria-checked={budgetTier === 'moderate'} class="radio-btn" class:selected={budgetTier === 'moderate'} onclick={() => budgetTier = 'moderate'}>Sedang</button>
            <button type="button" role="radio" aria-checked={budgetTier === 'premium'} class="radio-btn" class:selected={budgetTier === 'premium'} onclick={() => budgetTier = 'premium'}>Premium</button>
          </div>
        </div>
      </div>
    {:else if step === 4}
      <h2>Kesehatan & Goal</h2>
      <p class="step-desc">Goal kamu menentukan kalori + protein target.</p>
      <div class="form-fields">
        <div class="field-group">
          <span class="input-label" id="label-goal">Goal Utama</span>
          <div class="goal-grid" role="radiogroup" aria-labelledby="label-goal">
            {#each goals as g}
              <button type="button" role="radio" aria-checked={goal === g.value} class="goal-card" class:selected={goal === g.value} onclick={() => goal = g.value}>
                <span class="goal-icon">{g.icon}</span>
                <span>{g.label}</span>
              </button>
            {/each}
          </div>
        </div>
        <Input label="Alergi (pisah koma)" placeholder="kacang, seafood" bind:value={allergies} />
        <div class="field-group">
          <label class="input-label" for="diet">Pantangan Diet</label>
          <select id="diet" bind:value={dietaryRestrictions} class="select-input">
            <option value="">Tidak ada</option>
            <option value="Halal">Halal</option>
            <option value="Vegetarian">Vegetarian</option>
            <option value="Vegan">Vegan</option>
            <option value="Pescatarian">Pescatarian</option>
          </select>
        </div>
        <Input label="Kondisi Kesehatan (opsional)" placeholder="diabetes, hipertensi" bind:value={healthConditions} />
      </div>
    {:else if step === 5}
      <h2>Preferensi Makan</h2>
      <p class="step-desc">Auto-dihitung dari data kamu. Bisa diedit nanti.</p>
      {#if calcFailed}<Alert variant="warning">Otomatis gagal — isi target manual ya.</Alert>{/if}
      <div class="form-fields">
        <div class="field-group">
          <span class="input-label" id="label-cuisine">Masakan Favorit</span>
          <div class="cuisine-grid" role="radiogroup" aria-labelledby="label-cuisine">
            {#each cuisines as c}
              <button type="button" role="radio" aria-checked={cuisineRotation === c.value} class="cuisine-btn" class:selected={cuisineRotation === c.value} onclick={() => cuisineRotation = c.value}>
                {c.label}
              </button>
            {/each}
          </div>
        </div>
        <div class="field-group">
          <span class="input-label" id="label-meals">Makan per Hari</span>
          <div class="radio-row" role="radiogroup" aria-labelledby="label-meals">
            {#each [3, 4, 5, 6] as n}
              <button type="button" role="radio" aria-checked={mealsPerDay === String(n)} class="radio-btn" class:selected={mealsPerDay === String(n)} onclick={() => mealsPerDay = String(n)}>{n}x</button>
            {/each}
          </div>
        </div>
        <div class="row-2">
          <Input label="Target Kalori" type="number" bind:value={targetCalories} />
          <Input label="Target Protein (g)" type="number" bind:value={targetProtein} />
        </div>
        <Input label="Bahan yang Dihindari (opsional)" placeholder="pare, ati" bind:value={dislikedIngredients} />
      </div>
    {:else if step === 6}
      <h2>Pilih Channel</h2>
      <p class="step-desc">Mau terima rencana makan lewat mana? Bisa diubah nanti di Pengaturan.</p>
      <div class="form-fields">
        <div class="field-group">
          <span class="input-label" id="label-channel">Channel Pengiriman</span>
          <div class="channel-grid" role="radiogroup" aria-labelledby="label-channel">
            <button type="button" role="radio" aria-checked={deliveryChannel === 'telegram'} class="channel-card" class:selected={deliveryChannel === 'telegram'} onclick={() => deliveryChannel = 'telegram'}>
              <span class="channel-icon">📱</span>
              <span class="channel-name">Telegram</span>
              <span class="channel-desc">Connect via bot</span>
            </button>
            <button type="button" role="radio" aria-checked={deliveryChannel === 'whatsapp'} class="channel-card" class:selected={deliveryChannel === 'whatsapp'} onclick={() => deliveryChannel = 'whatsapp'}>
              <span class="channel-icon">💬</span>
              <span class="channel-name">WhatsApp</span>
              <span class="channel-desc">Setup di Pengaturan nanti</span>
            </button>
            <button type="button" role="radio" aria-checked={deliveryChannel === 'both'} class="channel-card" class:selected={deliveryChannel === 'both'} onclick={() => deliveryChannel = 'both'}>
              <span class="channel-icon">📬</span>
              <span class="channel-name">Keduanya</span>
              <span class="channel-desc">Telegram + WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    {:else if step === 7}
      <div class="welcome-step">
        <div class="welcome-icon">🎉</div>
        <h2>Selamat datang, {fullName}!</h2>
        <p class="step-desc">Akunmu udah jadi. Rencana makan pertama tinggal klik tombol di bawah.</p>
        <div class="welcome-summary">
          <div class="summary-item"><span>Goal</span><strong>{goals.find(g => g.value === goal)?.label || '—'}</strong></div>
          <div class="summary-item"><span>Kalori</span><strong>{targetCalories || '—'} kcal</strong></div>
          <div class="summary-item"><span>Protein</span><strong>{targetProtein || '—'} g</strong></div>
          <div class="summary-item"><span>Makan</span><strong>{mealsPerDay}x/hari</strong></div>
        </div>
      </div>
    {/if}

    {#if error}<div class="error-msg">{error}</div>{/if}

    {#if step < 7}
      <div class="step-actions">
        {#if step > 1}<Button variant="ghost" onclick={prev}>← Kembali</Button>{/if}
        {#if step < 6}
          <Button variant="primary" onclick={next}>Lanjut →</Button>
        {:else}
          <Button variant="primary" loading={loading} onclick={submit}>Buat akun! 🚀</Button>
        {/if}
      </div>
    {:else}
      <div class="step-actions">
        <Button variant="primary" onclick={finish}>Lihat Dashboard →</Button>
      </div>
    {/if}

    <a href="#/login" class="back-link">Udah punya akun? Login di sini</a>
  </div>
</div>

<style>
  .signup-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: var(--space-4) var(--space-6); }
  .signup-card { max-width: 520px; width: 100%; background: var(--surface); border-radius: var(--radius-xl); padding: var(--space-8) var(--space-6); box-shadow: var(--shadow-elevation-3); border: 1px solid var(--border-strong); }
  .progress-bar { display: flex; justify-content: space-between; margin-bottom: var(--space-6); position: relative; }
  .progress-bar::before { content: ''; position: absolute; top: 14px; left: 0; right: 0; height: 2px; background: var(--surface-3); z-index: 0; }
  .step-dot { width: 28px; height: 28px; border-radius: var(--radius-pill); background: var(--surface-3); display: flex; align-items: center; justify-content: center; z-index: 1; transition: all var(--duration-small) var(--ease-standard); }
  .step-dot.active { background: var(--primary); transform: scale(1.15); }
  .step-dot.done { background: var(--primary); }
  .step-num { font-size: var(--fs-xs); font-weight: var(--fw-semibold); color: var(--text-on-primary); }
  .step-dot:not(.active):not(.done) .step-num { color: var(--text-faint); }
  h2 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-1); }
  .step-desc { color: var(--text-subtle); font-size: var(--fs-sm); margin-bottom: var(--space-5); }
  .form-fields { display: flex; flex-direction: column; gap: var(--space-4); }
  .field-group { display: flex; flex-direction: column; gap: var(--space-1); }
  .input-label { font-size: var(--fs-xs); font-weight: var(--fw-medium); color: var(--text-subtle); text-transform: uppercase; letter-spacing: var(--ls-wide); }
  .radio-row { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .radio-btn { padding: var(--space-2) var(--space-3); background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-muted); font-size: var(--fs-sm); font-family: inherit; cursor: pointer; min-height: 44px; transition: all var(--duration-micro) var(--ease-standard); }
  .radio-btn.selected { border-color: var(--primary); background: var(--primary-soft); color: var(--primary); }
  .select-input { padding: var(--space-2) var(--space-3); background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: var(--fs-sm); font-family: inherit; min-height: 44px; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='currentColor' d='M6 8L0 0h12z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: var(--space-8); }
  .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
  .goal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
  .goal-card, .cuisine-btn, .channel-card { padding: var(--space-3) var(--space-4); background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-muted); font-size: var(--fs-sm); font-family: inherit; cursor: pointer; min-height: 44px; transition: all var(--duration-micro) var(--ease-standard); display: flex; align-items: center; gap: var(--space-2); }
  .goal-card.selected, .cuisine-btn.selected, .channel-card.selected { border-color: var(--primary); background: var(--primary-soft); color: var(--primary); }
  .cuisine-grid { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .channel-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-3); }
  .channel-card { flex-direction: column; gap: var(--space-1); text-align: center; }
  .channel-icon { font-size: 2rem; }
  .channel-name { font-weight: var(--fw-semibold); }
  .channel-desc { font-size: var(--fs-xs); color: var(--text-faint); }
  .step-actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-6); }
  .error-msg { color: var(--danger); font-size: var(--fs-sm); margin-top: var(--space-3); }
  .back-link { display: block; text-align: center; margin-top: var(--space-4); font-size: var(--fs-xs); color: var(--text-faint); text-decoration: none; }
  .back-link:hover { color: var(--text-subtle); }
  .welcome-step { text-align: center; }
  .welcome-icon { font-size: 4rem; margin-bottom: var(--space-4); }
  .welcome-summary { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-6); }
  .summary-item { background: var(--surface-2); border-radius: var(--radius-md); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-1); }
  .summary-item span { font-size: var(--fs-xs); color: var(--text-subtle); }
  .summary-item strong { font-size: var(--fs-md); color: var(--text); }
  @media (max-width: 480px) {
    .row-2 { grid-template-columns: 1fr; }
    .goal-grid { grid-template-columns: 1fr; }
    .channel-grid { grid-template-columns: 1fr; }
    .welcome-summary { grid-template-columns: 1fr; }
  }
</style>
