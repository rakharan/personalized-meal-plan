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
  let tgLink = $state('');
  let waStep = $state(0);
  let waPhone = $state('');
  let waCode = $state('');
  let pushHour = $state('8');
  let pushMin = $state('0');
  let subscribed = $state(false);

  let waDevCode = $state('');

  async function loadProfile() {
    await auth.fetchMe();
    profile = auth.user;
    if (profile) {
      pushHour = String(profile.push_hour ?? 8);
      pushMin = String(profile.push_min ?? 0);
      subscribed = !!profile.subscribed;
    }
  }

  async function saveProfile() {
    saving = true;
    error = '';
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth.authHeaders() },
        body: JSON.stringify({
          ...profile,
          push_hour: Number(pushHour),
          push_min: Number(pushMin),
          subscribed,
        }),
      });
      if (!res.ok) throw new Error('Gagal simpan');
      saved = true;
      setTimeout(() => saved = false, 3000);
    } catch (e: any) { error = e.message; }
    finally { saving = false; }
  }

  async function connectTelegram() {
    try {
      const res = await fetch('/api/profile/connect-telegram', { method: 'POST', headers: auth.authHeaders() });
      const data = await res.json();
      tgLink = data.link;
    } catch (e: any) { error = e.message; }
  }

  async function sendOTP() {
    try {
      const res = await fetch('/api/profile/connect-whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth.authHeaders() }, body: JSON.stringify({ phone: waPhone }) });
      const data = await res.json();
      if (data.devCode) waDevCode = data.devCode;
      waStep = 2;
    } catch (e: any) { error = e.message; }
  }

  async function verifyOTP() {
    try {
      const res = await fetch('/api/profile/verify-whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth.authHeaders() }, body: JSON.stringify({ phone: waPhone, code: waCode }) });
      if (res.ok) { waStep = 3; await loadProfile(); }
      else { const d = await res.json(); throw new Error(d.error); }
    } catch (e: any) { error = e.message; }
  }

  onMount(() => {
    if (!auth.isAuthed) { window.location.hash = '#/login'; return; }
    loadProfile();
  });
</script>

{#if profile}
<UserLayout current="#/settings">
  <div class="settings-main">
    <h1>Pengaturan</h1>

    <section class="card">
      <h3>📱 Telegram</h3>
      {#if profile.telegram_chat_id}
        <p class="status connected">✅ Terhubung (Chat ID: {profile.telegram_chat_id})</p>
      {:else}
        <p class="status not-connected">Belum terhubung</p>
        <Button variant="secondary" onclick={connectTelegram}>Hubungkan Telegram</Button>
        {#if tgLink}
          <div class="tg-link-box">
            <p>Buka link ini di browser, nanti bot bakal connect ke akunmu:</p>
            <a href={tgLink} target="_blank">{tgLink}</a>
          </div>
        {/if}
      {/if}
    </section>

    <section class="card">
      <h3>💬 WhatsApp</h3>
      {#if profile.whatsapp_verified}
        <p class="status connected">✅ Terhubung ({profile.whatsapp_phone})</p>
      {:else if waStep === 0}
        <p class="status not-connected">Belum terhubung</p>
        <Input label="Nomor HP" type="tel" placeholder="08xxx atau +628xxx" bind:value={waPhone} />
        <Button variant="secondary" onclick={sendOTP}>Kirim Kode Verifikasi</Button>
      {:else if waStep === 1}
        <p>Mengirim kode...</p>
      {:else if waStep === 2}
        <p>Masukkan kode 6-digit yang dikirim ke WhatsApp-mu</p>
        {#if waDevCode}<p class="dev-code">Dev mode — kode: <strong>{waDevCode}</strong></p>{/if}
        <Input label="Kode Verifikasi" placeholder="123456" bind:value={waCode} />
        <Button variant="secondary" onclick={verifyOTP}>Verifikasi</Button>
      {:else if waStep === 3}
        <p class="status connected">✅ Berhasil diverifikasi!</p>
      {/if}
    </section>

    <section class="card">
      <h3>📨 Channel Pengiriman</h3>
      <div class="channel-select">
        <button class="channel-opt" class:selected={profile.delivery_channel === 'telegram'} onclick={() => { profile.delivery_channel = 'telegram'; }}>
          <span>📱</span> Telegram
        </button>
        <button class="channel-opt" class:selected={profile.delivery_channel === 'whatsapp'} onclick={() => { profile.delivery_channel = 'whatsapp'; }}>
          <span>💬</span> WhatsApp
        </button>
        <button class="channel-opt" class:selected={profile.delivery_channel === 'both'} onclick={() => { profile.delivery_channel = 'both'; }}>
          <span>📬</span> Keduanya
        </button>
      </div>
    </section>

    <section class="card">
      <h3>⏰ Jadwal Kirim Harian</h3>
      <p class="status">Atur jam kirim rencana makan otomatis tiap hari.</p>
      <div class="time-row">
        <div class="time-group">
          <label class="input-label" for="push-hour">Jam</label>
          <select id="push-hour" bind:value={pushHour} class="select-input">
            {#each Array(24) as _, i}
              <option value={String(i)}>{String(i).padStart(2, '0')}</option>
            {/each}
          </select>
        </div>
        <div class="time-group">
          <label class="input-label" for="push-min">Menit</label>
          <select id="push-min" bind:value={pushMin} class="select-input">
            <option value="0">00</option>
            <option value="15">15</option>
            <option value="30">30</option>
            <option value="45">45</option>
          </select>
        </div>
      </div>
      <div class="quick-times">
        <button class="quick-btn" onclick={() => { pushHour = '7'; pushMin = '0'; }}>🌅 07:00</button>
        <button class="quick-btn" onclick={() => { pushHour = '8'; pushMin = '0'; }}>☀️ 08:00</button>
        <button class="quick-btn" onclick={() => { pushHour = '12'; pushMin = '0'; }}>🍴 12:00</button>
        <button class="quick-btn" onclick={() => { pushHour = '18'; pushMin = '0'; }}>🌆 18:00</button>
      </div>
    </section>

    <section class="card">
      <h3>📬 Langganan Harian</h3>
      <div class="toggle-row">
        <div>
          <p class="toggle-label">Kirim rencana makan otomatis tiap hari</p>
          <p class="toggle-desc">Rencana baru dikirim jam yang kamu pilih di atas</p>
        </div>
        <button class="toggle-switch" class:on={subscribed} onclick={() => subscribed = !subscribed} role="switch" aria-checked={subscribed} aria-label="Langganan harian">
          <span class="toggle-knob"></span>
        </button>
      </div>
    </section>

    <Button variant="primary" loading={saving} onclick={saveProfile}>Simpan Pengaturan</Button>

    {#if saved}<div class="saved-msg">✅ Tersimpan!</div>{/if}
    {#if error}<Alert variant="danger">{error}</Alert>{/if}
  </div>
</UserLayout>
{/if}

<style>
  .settings-main { max-width: 600px; margin: 0 auto; }
  h1 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-6); }
  .card { background: var(--surface); border-radius: var(--radius-md); padding: var(--space-5); box-shadow: var(--shadow-elevation-1); margin-bottom: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); }
  .card h3 { font-size: var(--fs-md); font-weight: var(--fw-semibold); color: var(--text); }
  .status { font-size: var(--fs-sm); }
  .status.connected { color: var(--success); }
  .status.not-connected { color: var(--text-faint); }
  .tg-link-box { background: var(--surface-2); border-radius: var(--radius-sm); padding: var(--space-3); }
  .tg-link-box p { font-size: var(--fs-xs); color: var(--text-subtle); margin-bottom: var(--space-1); }
  .tg-link-box a { font-size: var(--fs-xs); word-break: break-all; }
  .dev-code { font-size: var(--fs-xs); color: var(--accent); }
  .channel-select { display: flex; gap: var(--space-2); }
  .channel-opt { flex: 1; padding: var(--space-3); background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-muted); font-family: inherit; cursor: pointer; min-height: 44px; display: flex; align-items: center; justify-content: center; gap: var(--space-2); }
  .channel-opt.selected { border-color: var(--primary); background: var(--primary-soft); color: var(--primary); }
  .saved-msg { color: var(--success); font-size: var(--fs-sm); margin-top: var(--space-2); }
  .time-row { display: flex; gap: var(--space-3); }
  .time-group { flex: 1; display: flex; flex-direction: column; gap: var(--space-1); }
  .quick-times { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-2); }
  .quick-btn { padding: var(--space-2) var(--space-3); background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-muted); font-family: inherit; cursor: pointer; min-height: 44px; font-size: var(--fs-sm); }
  .quick-btn:hover { border-color: var(--primary); color: var(--primary); }
  .toggle-row { display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); }
  .toggle-label { font-size: var(--fs-sm); font-weight: var(--fw-medium); color: var(--text); }
  .toggle-desc { font-size: var(--fs-xs); color: var(--text-subtle); margin-top: 2px; }
  .toggle-switch { width: 48px; height: 28px; border-radius: var(--radius-pill); background: var(--surface-3); border: none; cursor: pointer; position: relative; transition: background var(--duration-micro) var(--ease-standard); flex-shrink: 0; }
  .toggle-switch.on { background: var(--primary); }
  .toggle-knob { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: var(--radius-pill); background: var(--white); transition: transform var(--duration-micro) var(--ease-standard); }
  .toggle-switch.on .toggle-knob { transform: translateX(20px); }
  @media (max-width: 768px) { .channel-select { flex-direction: column; } }
</style>
