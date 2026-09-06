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
  let copiedRef = $state(false);

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

  function copyRefLink() {
    const refLink = `https://t.me/personalized_meal_planner_bot?start=ref_${profile?.id || ''}`;
    navigator.clipboard.writeText(refLink).then(() => {
      copiedRef = true;
      setTimeout(() => copiedRef = false, 2000);
    });
  }

  onMount(() => {
    if (!auth.isAuthed) { window.location.hash = '#/login'; return; }
    loadProfile();
  });
</script>

{#if profile}
<UserLayout current="#/settings">
  <div class="settings-main">
    <div class="settings-header">
      <h1>Pengaturan</h1>
      <p>Atur channel, jadwal, dan preferensi kamu</p>
    </div>

    <!-- ═══ Channel connections ═══ -->
    <section class="card card-channels">
      <div class="card-header">
        <h3>📱 Channel Pengiriman</h3>
        <span class="card-badge">Wajib</span>
      </div>

      <div class="channel-grid">
        <!-- Telegram -->
        <div class="channel-card" class:connected={profile.telegram_chat_id}>
          <div class="channel-top">
            <div class="channel-icon-wrap"><span>📱</span></div>
            <div>
              <div class="channel-name">Telegram</div>
              <div class="channel-status">
                {#if profile.telegram_chat_id}
                  <span class="status-ok">✅ Terhubung</span>
                {:else}
                  <span class="status-pending">Belum terhubung</span>
                {/if}
              </div>
            </div>
          </div>
          {#if profile.telegram_chat_id}
            <div class="channel-detail">Chat ID: {profile.telegram_chat_id}</div>
          {:else}
            <Button variant="secondary" size="sm" onclick={connectTelegram}>Hubungkan</Button>
            {#if tgLink}
              <div class="tg-link-box">
                <p>Buka link ini di browser:</p>
                <a href={tgLink} target="_blank">{tgLink}</a>
              </div>
            {/if}
          {/if}
        </div>

        <!-- WhatsApp -->
        <div class="channel-card" class:connected={profile.whatsapp_verified}>
          <div class="channel-top">
            <div class="channel-icon-wrap"><span>💬</span></div>
            <div>
              <div class="channel-name">WhatsApp</div>
              <div class="channel-status">
                {#if profile.whatsapp_verified}
                  <span class="status-ok">✅ Terhubung ({profile.whatsapp_phone})</span>
                {:else}
                  <span class="status-pending">Belum terhubung</span>
                {/if}
              </div>
            </div>
          </div>
          {#if !profile.whatsapp_verified}
            {#if waStep === 0}
              <Input label="Nomor HP" type="tel" placeholder="08xxx atau +628xxx" bind:value={waPhone} />
              <Button variant="secondary" size="sm" onclick={sendOTP}>Kirim Kode</Button>
            {:else if waStep === 2}
              <p class="otp-hint">Masukkan kode 6-digit yang dikirim ke WhatsApp-mu</p>
              {#if waDevCode}<div class="dev-code">Dev mode — kode: <strong>{waDevCode}</strong></div>{/if}
              <Input label="Kode Verifikasi" placeholder="123456" bind:value={waCode} />
              <Button variant="secondary" size="sm" onclick={verifyOTP}>Verifikasi</Button>
            {:else if waStep === 3}
              <span class="status-ok">✅ Berhasil diverifikasi!</span>
            {/if}
          {/if}
        </div>
      </div>

      <!-- Delivery channel selector -->
      <div class="delivery-select">
        <label class="select-label">Channel aktif untuk terima rencana:</label>
        <div class="channel-buttons">
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
      </div>
    </section>

    <!-- ═══ Push schedule ═══ -->
    <section class="card">
      <div class="card-header">
        <h3>⏰ Jadwal Kirim Harian</h3>
      </div>
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
        <button class="quick-btn" onclick={() => { pushHour = '6'; pushMin = '0'; }}>🌅 06:00</button>
        <button class="quick-btn" onclick={() => { pushHour = '7'; pushMin = '0'; }}>☀️ 07:00</button>
        <button class="quick-btn" onclick={() => { pushHour = '8'; pushMin = '0'; }}>🍳 08:00</button>
        <button class="quick-btn" onclick={() => { pushHour = '12'; pushMin = '0'; }}>🍴 12:00</button>
        <button class="quick-btn" onclick={() => { pushHour = '18'; pushMin = '0'; }}>🌆 18:00</button>
        <button class="quick-btn" onclick={() => { pushHour = '19'; pushMin = '30'; }}>🌙 19:30</button>
      </div>
    </section>

    <!-- ═══ Subscription toggle ═══ -->
    <section class="card">
      <div class="card-header">
        <h3>📬 Langganan Harian</h3>
      </div>
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

    <!-- ═══ Referral ═══ -->
    <section class="card card-referral">
      <div class="card-header">
        <h3>🔗 Ajak Teman</h3>
        <span class="card-badge badge-amber">Gratis</span>
      </div>
      <p class="referral-desc">Bagikan link ini ke teman. Tiap yang daftar pakai link kamu, kamu dapet 1 minggu Premium gratis!</p>
      <div class="referral-link-box">
        <span class="referral-link">https://t.me/personalized_meal_planner_bot?start=ref_{profile?.id || ''}</span>
        <button class="copy-btn" onclick={copyRefLink}>{copiedRef ? '✅ Copied!' : '📋 Copy'}</button>
      </div>
    </section>

    <div class="save-bar">
      <Button variant="primary" size="lg" loading={saving} onclick={saveProfile}>Simpan Pengaturan</Button>
      {#if saved}<span class="saved-msg">✅ Tersimpan!</span>{/if}
    </div>
    {#if error}<Alert variant="danger">{error}</Alert>{/if}
  </div>
</UserLayout>
{/if}

<style>
  .settings-main { max-width: 640px; margin: 0 auto; }

  .settings-header { margin-bottom: var(--space-6); }
  .settings-header h1 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-1); }
  .settings-header p { color: var(--text-subtle); font-size: var(--fs-sm); }

  .card {
    background: var(--surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    box-shadow: var(--shadow-elevation-1);
    margin-bottom: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    border: 1px solid var(--border);
  }

  .card-header { display: flex; justify-content: space-between; align-items: center; }
  .card-header h3 { font-size: var(--fs-md); font-weight: var(--fw-semibold); color: var(--text); }
  .card-badge {
    font-size: var(--fs-xs);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--surface-3);
    color: var(--text-subtle);
  }
  .badge-amber { background: var(--accent-soft); color: var(--accent); }

  /* Channel cards */
  .channel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
  .channel-card {
    background: var(--surface-2);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .channel-card.connected { border-color: var(--primary); }
  .channel-top { display: flex; gap: var(--space-3); align-items: flex-start; }
  .channel-icon-wrap {
    width: 40px; height: 40px;
    background: var(--surface-3);
    border-radius: var(--radius-md);
    display: flex; align-items: center; justify-content: center;
    font-size: var(--fs-md);
    flex-shrink: 0;
  }
  .channel-card.connected .channel-icon-wrap { background: var(--primary-soft); }
  .channel-name { font-size: var(--fs-sm); font-weight: var(--fw-semibold); color: var(--text); }
  .channel-status { font-size: var(--fs-xs); margin-top: 2px; }
  .status-ok { color: var(--success); }
  .status-pending { color: var(--text-faint); }
  .channel-detail { font-size: var(--fs-xs); color: var(--text-subtle); font-family: var(--font-mono); }
  .tg-link-box { background: var(--surface); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); }
  .tg-link-box p { font-size: var(--fs-xs); color: var(--text-subtle); margin-bottom: var(--space-1); }
  .tg-link-box a { font-size: var(--fs-xs); word-break: break-all; color: var(--primary); }
  .otp-hint { font-size: var(--fs-sm); color: var(--text-muted); }
  .dev-code { font-size: var(--fs-xs); color: var(--accent); background: var(--accent-soft); padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); }

  /* Delivery channel selector */
  .delivery-select { margin-top: var(--space-2); }
  .select-label { display: block; font-size: var(--fs-sm); color: var(--text-subtle); margin-bottom: var(--space-2); }
  .channel-buttons { display: flex; gap: var(--space-2); }
  .channel-opt {
    flex: 1;
    padding: var(--space-3);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    font-family: inherit;
    cursor: pointer;
    min-height: 44px;
    display: flex; align-items: center; justify-content: center; gap: var(--space-2);
    font-size: var(--fs-sm);
    transition: all var(--duration-micro) var(--ease-standard);
  }
  .channel-opt.selected { border-color: var(--primary); background: var(--primary-soft); color: var(--primary); }

  /* Time picker */
  .time-row { display: flex; gap: var(--space-3); }
  .time-group { flex: 1; display: flex; flex-direction: column; gap: var(--space-1); }
  .input-label { font-size: var(--fs-sm); color: var(--text-subtle); }
  .select-input {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
    color: var(--text);
    font-family: inherit;
    font-size: var(--fs-sm);
    min-height: 44px;
  }
  .quick-times { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .quick-btn {
    padding: var(--space-2) var(--space-3);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    color: var(--text-muted);
    font-family: inherit;
    cursor: pointer;
    min-height: 36px;
    font-size: var(--fs-sm);
    transition: all var(--duration-micro) var(--ease-standard);
  }
  .quick-btn:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-soft); }

  /* Toggle */
  .toggle-row { display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); }
  .toggle-label { font-size: var(--fs-sm); font-weight: var(--fw-medium); color: var(--text); }
  .toggle-desc { font-size: var(--fs-xs); color: var(--text-subtle); margin-top: 2px; }
  .toggle-switch {
    width: 48px; height: 28px;
    border-radius: var(--radius-pill);
    background: var(--surface-3);
    border: none; cursor: pointer;
    position: relative;
    transition: background var(--duration-micro) var(--ease-standard);
    flex-shrink: 0;
  }
  .toggle-switch.on { background: var(--primary); }
  .toggle-knob {
    position: absolute; top: 3px; left: 3px;
    width: 22px; height: 22px;
    border-radius: var(--radius-pill);
    background: var(--white);
    transition: transform var(--duration-micro) var(--ease-standard);
  }
  .toggle-switch.on .toggle-knob { transform: translateX(20px); }

  /* Referral */
  .card-referral { border-color: rgba(245, 158, 11, 0.15); background: linear-gradient(135deg, var(--surface) 0%, var(--surface) 60%, var(--accent-soft) 100%); }
  .referral-desc { font-size: var(--fs-sm); color: var(--text-muted); line-height: var(--lh-normal); }
  .referral-link-box {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--surface-2);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
  }
  .referral-link {
    flex: 1;
    font-size: var(--fs-xs);
    color: var(--text-subtle);
    font-family: var(--font-mono);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .copy-btn {
    background: var(--primary);
    color: var(--bg);
    border: none;
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-3);
    font-size: var(--fs-xs);
    font-weight: var(--fw-medium);
    cursor: pointer;
    flex-shrink: 0;
    transition: background var(--duration-micro) var(--ease-standard);
  }
  .copy-btn:hover { background: var(--primary-hover); }

  /* Save bar */
  .save-bar { display: flex; align-items: center; gap: var(--space-3); margin-top: var(--space-2); }
  .saved-msg { color: var(--success); font-size: var(--fs-sm); }

  @media (max-width: 768px) {
    .channel-grid { grid-template-columns: 1fr; }
    .channel-buttons { flex-direction: column; }
  }
</style>
