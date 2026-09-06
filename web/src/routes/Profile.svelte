<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import UserLayout from '$lib/components/UserLayout.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import Alert from '$lib/components/Alert.svelte';

  let profile = $state<any>(null);
  let saving = $state(false);
  let error = $state('');
  let saved = $state(false);

  async function loadProfile() {
    await auth.fetchMe();
    profile = { ...auth.user };
  }

  async function save() {
    saving = true; error = '';
    try {
      const res = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth.authHeaders() }, body: JSON.stringify(profile) });
      if (!res.ok) throw new Error('Gagal simpan');
      saved = true; setTimeout(() => saved = false, 3000);
    } catch (e: any) { error = e.message; }
    finally { saving = false; }
  }

  onMount(() => { if (!auth.isAuthed) { window.location.hash = '#/login'; return; } loadProfile(); });
</script>

{#if profile}
<UserLayout current="#/profile">
  <div class="profile-main">
    <h1>Edit Profil</h1>

    <section class="card">
      <h3>Personal</h3>
      <div class="grid-2">
        <Input label="Nama" bind:value={profile.full_name} />
        <Input label="Umur" type="number" bind:value={profile.age} />
      </div>
      <div class="grid-2">
        <Input label="Tinggi (cm)" type="number" bind:value={profile.height_cm} />
        <Input label="Berat (kg)" type="number" bind:value={profile.weight_kg} />
      </div>
      <div class="field-group">
        <label class="input-label" for="prof-gender">Gender</label>
        <select id="prof-gender" bind:value={profile.gender} class="select-input">
          <option value="male">Pria</option>
          <option value="female">Wanita</option>
          <option value="other">Lainnya</option>
        </select>
      </div>
    </section>

    <section class="card">
      <h3>Goal & Target</h3>
      <div class="field-group">
        <label class="input-label" for="prof-goal">Goal</label>
        <select id="prof-goal" bind:value={profile.goal} class="select-input">
          <option value="weight_loss">Turun berat badan</option>
          <option value="muscle_gain">Naik mass otot</option>
          <option value="maintenance">Maintenance</option>
          <option value="general_health">Makan sehat</option>
        </select>
      </div>
      <div class="grid-2">
        <Input label="Target Kalori" type="number" bind:value={profile.target_calories} />
        <Input label="Target Protein (g)" type="number" bind:value={profile.target_protein} />
      </div>
    </section>

    <section class="card">
      <h3>Kesehatan</h3>
      <Input label="Alergi" bind:value={profile.allergies} />
      <Input label="Pantangan Diet" bind:value={profile.dietary_restrictions} />
      <Input label="Kondisi Kesehatan" bind:value={profile.health_conditions} />
      <Input label="Bahan yang Dihindari" bind:value={profile.disliked_ingredients} />
    </section>

    <section class="card">
      <h3>Preferensi</h3>
      <div class="field-group">
        <label class="input-label" for="prof-cuisine">Masakan</label>
        <select id="prof-cuisine" bind:value={profile.cuisine_rotation} class="select-input">
          <option value="rotate">Putar tiap hari</option>
          <option value="Indonesian">Indonesia</option>
          <option value="Japanese">Jepang</option>
          <option value="Korean">Korea</option>
          <option value="Mediterranean">Mediterania</option>
        </select>
      </div>
      <div class="grid-2">
        <Input label="Makan per Hari" type="number" bind:value={profile.meals_per_day} />
        <div class="field-group">
          <label class="input-label" for="prof-budget">Budget</label>
          <select id="prof-budget" bind:value={profile.budget_tier} class="select-input">
            <option value="frugal">Hemat</option>
            <option value="moderate">Sedang</option>
            <option value="premium">Premium</option>
          </select>
        </div>
      </div>
    </section>

    {#if saved}<div class="saved-msg">✅ Tersimpan!</div>{/if}
    {#if error}<Alert variant="danger">{error}</Alert>{/if}
    <Button variant="primary" loading={saving} onclick={save}>Simpan Profil</Button>
  </div>
</UserLayout>
{/if}

<style>
  .profile-main { max-width: 600px; margin: 0 auto; }
  h1 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-6); }
  .card { background: var(--surface); border-radius: var(--radius-md); padding: var(--space-5); box-shadow: var(--shadow-elevation-1); margin-bottom: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); }
  .card h3 { font-size: var(--fs-md); font-weight: var(--fw-semibold); color: var(--text); }
  .field-group { display: flex; flex-direction: column; gap: var(--space-1); }
  .input-label { font-size: var(--fs-xs); font-weight: var(--fw-medium); color: var(--text-subtle); text-transform: uppercase; letter-spacing: var(--ls-wide); }
  .select-input { padding: var(--space-2) var(--space-3); background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: var(--fs-sm); font-family: inherit; min-height: 44px; appearance: none; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
  .saved-msg { color: var(--success); font-size: var(--fs-sm); margin-bottom: var(--space-3); }
  @media (max-width: 768px) { .grid-2 { grid-template-columns: 1fr; } }
</style>
