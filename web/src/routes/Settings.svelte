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
  let copiedRef = $state('');
  let openSection = $state('channels');

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
    saving = true; error = '';
    try {
      const res = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth.authHeaders() }, body: JSON.stringify({ ...profile, push_hour: Number(pushHour), push_min: Number(pushMin), subscribed }) });
      if (!res.ok) throw new Error('Gagal simpan');
      saved = true; setTimeout(() => saved = false, 3000);
    } catch (e: any) { error = e.message; }
    finally { saving = false; }
  }

  async function connectTelegram() {
    try {
      const res = await fetch('/api/profile/connect-telegram', { method: 'POST', headers: auth.authHeaders() });
      tgLink = (await res.json()).link;
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
      else { throw new Error((await res.json()).error); }
    } catch (e: any) { error = e.message; }
  }

  function copyRefLink() {
    const refLink = `https://t.me/personalized_meal_planner_bot?start=ref_${profile?.id || ''}`;
    navigator.clipboard.writeText(refLink).then(() => {
      copiedRef = refLink;
      setTimeout(() => copiedRef = '', 2000);
    });
  }

  function toggleSection(id: string) {
    openSection = openSection === id ? '' : id;
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

    <!-- Accordion sections -->
    <div class="accordion">
      <!-- Channels -->
      <div class="acc-item" class:open={openSection === 'channels'}>
        <button class="acc-header" onclick={() => toggleSection('channels')} class:has-status={!!profile.telegram_chat_id || !!profile.whatsapp_verified}>
          <span class="acc-status-dot" class:ok={!!profile.telegram_chat_id || !!profile.whatsapp_verified}></span>
          <span class="acc-title">Channel Pengiriman</span>
          <span class="acc-chevron">{openSection === 'channels' ? '−' : '+'}</span>
        </button>
        {#if openSection === 'channels'}
          <div class="acc-body">
            <div class="channel-row">
              <div class="channel-info">
                <span class="ch-name">Telegram</span>
                {#if profile.telegram_chat_id}
                  <span class="ch-status ok">Terhubung ({profile.telegram_chat_id})</span>
                {:else}
                  <span class="ch-status pending">Belum terhubung</span>
                {/if}
              </div>
              {#if !profile.telegram_chat_id}
                <Button variant="secondary" size="sm" onclick={connectTelegram}>Hubungkan</Button>
              {/if}
            </div>
            {#if tgLink}
              <div class="link-box"><a href={tgLink} target="_blank">{tgLink}</a></div>
            {/if}

            <div class="channel-row">
              <div class="channel-info">
                <span class="ch-name">WhatsApp</span>
                {#if profile.whatsapp_verified}
                  <span class="ch-status ok">Terhubung ({profile.whatsapp_phone})</span>
                {:else}
                  <span class="ch-status pending">Belum terhubung</span>
                {/if}
              </div>
            </div>
            {#if !profile.whatsapp_verified}
              {#if waStep === 0}
                <div class="wa-flow">
                  <Input type="tel" placeholder="08xxx atau +628xxx" bind:value={waPhone} />
                  <Button variant="secondary" size="sm" onclick={sendOTP}>Kirim Kode</Button>
                </div>
              {:else if waStep === 2}
                <div class="wa-flow">
                  {#if waDevCode}<div class="dev-code">Dev kode: <strong>{waDevCode}</strong></div>{/if}
                  <Input placeholder="123456" bind:value={waCode} />
                  <Button variant="secondary" size="sm" onclick={verifyOTP}>Verifikasi</Button>
                </div>
              {/if}
            {/if}

            <div class="delivery-select">
              <label class="ds-label">Channel aktif:</label>
              <div class="ch-buttons">
                <button class="ch-opt" class:selected={profile.delivery_channel === 'telegram'} onclick={() => { profile.delivery_channel = 'telegram'; }}>Telegram</button>
                <button class="ch-opt" class:selected={profile.delivery_channel === 'whatsapp'} onclick={() => { profile.delivery_channel = 'whatsapp'; }}>WhatsApp</button>
                <button class="ch-opt" class:selected={profile.delivery_channel === 'both'} onclick={() => { profile.delivery_channel = 'both'; }}>Keduanya</button>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Push schedule -->
      <div class="acc-item" class:open={openSection === 'schedule'}>
        <button class="acc-header" onclick={() => toggleSection('schedule')}>
          <span class="acc-status-dot" class:ok={subscribed}></span>
          <span class="acc-title">Jadwal Kirim Harian</span>
          <span class="acc-chevron">{openSection === 'schedule' ? '−' : '+'}</span>
        </button>
        {#if openSection === 'schedule'}
          <div class="acc-body">
            <div class="time-row">
              <div class="time-group">
                <label class="t-label" for="ph">Jam</label>
                <select id="ph" bind:value={pushHour} class="sel">
                  {#each Array(24) as _, i}<option value={String(i)}>{String(i).padStart(2, '0')}</option>{/each}
                </select>
              </div>
              <div class="time-group">
                <label class="t-label" for="pm">Menit</label>
                <select id="pm" bind:value={pushMin} class="sel">
                  <option value="0">00</option><option value="15">15</option><option value="30">30</option><option value="45">45</option>
                </select>
              </div>
            </div>
            <div class="quick-times">
              <button class="qt" onclick={() => { pushHour = '6'; pushMin = '0'; }}>06:00</button>
              <button class="qt" onclick={() => { pushHour = '7'; pushMin = '0'; }}>07:00</button>
              <button class="qt" onclick={() => { pushHour = '8'; pushMin = '0'; }}>08:00</button>
              <button class="qt" onclick={() => { pushHour = '12'; pushMin = '0'; }}>12:00</button>
              <button class="qt" onclick={() => { pushHour = '18'; pushMin = '0'; }}>18:00</button>
              <button class="qt" onclick={() => { pushHour = '19'; pushMin = '30'; }}>19:30</button>
            </div>
          </div>
        {/if}
      </div>

      <!-- Subscription -->
      <div class="acc-item" class:open={openSection === 'subscription'}>
        <button class="acc-header" onclick={() => toggleSection('subscription')}>
          <span class="acc-status-dot" class:ok={subscribed}></span>
          <span class="acc-title">Langganan Harian</span>
          <span class="acc-chevron">{openSection === 'subscription' ? '−' : '+'}</span>
        </button>
        {#if openSection === 'subscription'}
          <div class="acc-body">
            <div class="toggle-row">
              <div>
                <p class="t-label-main">Kirim rencana otomatis tiap hari</p>
                <p class="t-desc">Rencana baru dikirim jam yang kamu pilih</p>
              </div>
              <button class="toggle" class:on={subscribed} onclick={() => subscribed = !subscribed} role="switch" aria-checked={subscribed}>
                <span class="knob"></span>
              </button>
            </div>
          </div>
        {/if}
      </div>

      <!-- Referral -->
      <div class="acc-item" class:open={openSection === 'referral'}>
        <button class="acc-header referral-header" onclick={() => toggleSection('referral')}>
          <span class="acc-status-dot amber"></span>
          <span class="acc-title">Ajak Teman</span>
          <span class="acc-chevron">{openSection === 'referral' ? '−' : '+'}</span>
        </button>
        {#if openSection === 'referral'}
          <div class="acc-body referral-body">
            <p class="ref-desc">Bagikan link ini. Tiap teman yang daftar, kamu dapet 1 minggu Premium gratis!</p>
            <div class="ref-link-box">
              <span class="ref-link">t.me/personalized_meal_planner_bot?start=ref_{profile?.id || ''}</span>
              <button class="copy-btn" onclick={copyRefLink}>{copiedRef ? 'Copied!' : 'Copy'}</button>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Sticky save bar -->
    <div class="save-bar">
      <Button variant="primary" size="lg" loading={saving} onclick={saveProfile}>Simpan</Button>
      {#if saved}<span class="saved">Tersimpan</span>{/if}
    </div>
    {#if error}<Alert variant="danger">{error}</Alert>{/if}
  </div>
</UserLayout>
{/if}

<style>
  .settings-main { max-width: 600px; margin: 0 auto; padding-bottom: 80px; }
  .settings-header { margin-bottom: var(--space-6); }
  .settings-header h1 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-1); }
  .settings-header p { color: var(--text-subtle); font-size: var(--fs-sm); }

  /* Accordion */
  .accordion { display: flex; flex-direction: column; gap: var(--space-2); }
  .acc-item {
    background: var(--surface);
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    overflow: hidden;
  }
  .acc-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-4) var(--space-5);
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    min-height: 56px;
    transition: background var(--duration-micro) var(--ease-standard);
  }
  .acc-header:hover { background: var(--surface-2); }
  .acc-status-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--surface-3);
    flex-shrink: 0;
  }
  .acc-status-dot.ok { background: var(--primary); }
  .acc-status-dot.amber { background: var(--accent); }
  .acc-title { flex: 1; font-size: var(--fs-md); font-weight: var(--fw-semibold); color: var(--text); }
  .acc-chevron { font-size: var(--fs-lg); color: var(--text-subtle); font-weight: var(--fw-light); }

  .acc-body {
    padding: var(--space-4) var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    border-top: 1px solid var(--border);
  }

  /* Channel rows */
  .channel-row { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); }
  .channel-info { display: flex; flex-direction: column; gap: 2px; }
  .ch-name { font-size: var(--fs-sm); font-weight: var(--fw-medium); color: var(--text); }
  .ch-status { font-size: var(--fs-xs); }
  .ch-status.ok { color: var(--success); }
  .ch-status.pending { color: var(--text-faint); }
  .link-box { background: var(--surface-2); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); }
  .link-box a { font-size: var(--fs-xs); word-break: break-all; color: var(--primary); }
  .wa-flow { display: flex; gap: var(--space-2); flex-wrap: wrap; align-items: flex-end; }
  .dev-code { font-size: var(--fs-xs); color: var(--accent); background: var(--accent-soft); padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); }

  /* Delivery selector */
  .delivery-select { margin-top: var(--space-2); }
  .ds-label { display: block; font-size: var(--fs-sm); color: var(--text-subtle); margin-bottom: var(--space-2); }
  .ch-buttons { display: flex; gap: var(--space-2); }
  .ch-opt {
    flex: 1; padding: var(--space-2) var(--space-3);
    background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm);
    color: var(--text-muted); font-family: inherit; cursor: pointer; min-height: 40px; font-size: var(--fs-sm);
    transition: all var(--duration-micro) var(--ease-standard);
  }
  .ch-opt.selected { border-color: var(--primary); background: var(--primary-soft); color: var(--primary); }

  /* Time picker */
  .time-row { display: flex; gap: var(--space-3); }
  .time-group { flex: 1; display: flex; flex-direction: column; gap: var(--space-1); }
  .t-label { font-size: var(--fs-xs); color: var(--text-subtle); }
  .sel { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); color: var(--text); font-family: inherit; font-size: var(--fs-sm); min-height: 40px; }
  .quick-times { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .qt { padding: var(--space-1) var(--space-3); background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-pill); color: var(--text-muted); font-family: inherit; cursor: pointer; font-size: var(--fs-sm); min-height: 32px; transition: all var(--duration-micro) var(--ease-standard); }
  .qt:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-soft); }

  /* Toggle */
  .toggle-row { display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); }
  .t-label-main { font-size: var(--fs-sm); font-weight: var(--fw-medium); color: var(--text); }
  .t-desc { font-size: var(--fs-xs); color: var(--text-subtle); margin-top: 2px; }
  .toggle { width: 44px; height: 26px; border-radius: var(--radius-pill); background: var(--surface-3); border: none; cursor: pointer; position: relative; transition: background var(--duration-micro) var(--ease-standard); flex-shrink: 0; }
  .toggle.on { background: var(--primary); }
  .knob { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: var(--white); transition: transform var(--duration-micro) var(--ease-standard); }
  .toggle.on .knob { transform: translateX(18px); }

  /* Referral */
  .referral-header { border-left: 3px solid var(--accent); }
  .referral-body { background: linear-gradient(135deg, var(--surface) 0%, var(--surface) 70%, var(--accent-soft) 100%); }
  .ref-desc { font-size: var(--fs-sm); color: var(--text-muted); line-height: var(--lh-normal); }
  .ref-link-box { display: flex; align-items: center; gap: var(--space-2); background: var(--surface-2); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); border: 1px solid var(--border); }
  .ref-link { flex: 1; font-size: var(--fs-xs); color: var(--text-subtle); font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .copy-btn { background: var(--primary); color: var(--bg); border: none; border-radius: var(--radius-sm); padding: var(--space-1) var(--space-3); font-size: var(--fs-xs); font-weight: var(--fw-medium); cursor: pointer; flex-shrink: 0; }
  .copy-btn:hover { background: var(--primary-hover); }

  /* Sticky save bar */
  .save-bar {
    position: sticky;
    bottom: 0;
    left: 0; right: 0;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-5);
    background: color-mix(in srgb, var(--surface) 85%, transparent);
    backdrop-filter: blur(8px);
    border-top: 1px solid var(--border);
    z-index: 10;
    margin: var(--space-4) -var(--space-5) 0;
    padding-left: var(--space-5);
    padding-right: var(--space-5);
  }
  .saved { color: var(--success); font-size: var(--fs-sm); }

  @media (max-width: 768px) {
    .ch-buttons { flex-direction: column; }
  }
</style>
