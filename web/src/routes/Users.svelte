<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/stores/api.svelte';
  import DashboardLayout from '$lib/components/DashboardLayout.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import Alert from '$lib/components/Alert.svelte';

  let data = $state<any>(null);
  let error = $state('');
  let loading = $state(true);
  let page = $state(1);
  let searchQuery = $state('');
  let searchTimeout: ReturnType<typeof setTimeout>;
  let expandedRow = $state<number | null>(null);

  async function load(p = 1, search = '') {
    loading = true;
    page = p;
    error = '';
    expandedRow = null;
    try {
      data = await api.getUsers(p, search);
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function onSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => load(1, searchQuery), 400);
  }

  onMount(() => load(1));

  function rowKey(u: any): number {
    return u.profileId || u.chatId || 0;
  }

  function toggleRow(u: any) {
    const key = rowKey(u);
    expandedRow = expandedRow === key ? null : key;
  }

  function fmtDate(d: string) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function goalLabel(goal: string): string {
    const map: Record<string, string> = {
      weight_loss: 'Turun berat badan',
      muscle_gain: 'Naik mass otot',
      maintenance: 'Maintenance',
    };
    return map[goal] || goal || '—';
  }

  function activityLabel(level: string): string {
    const map: Record<string, string> = {
      sedentary: 'Jarang gerak',
      light: 'Ringan',
      moderate: 'Sedang',
      active: 'Aktif',
      very_active: 'Sangat aktif',
    };
    return map[level] || level || '—';
  }

  function cookingLabel(skill: string): string {
    const map: Record<string, string> = {
      beginner: 'Pemula',
      intermediate: 'Menengah',
      advanced: 'Mahir',
    };
    return map[skill] || skill || '—';
  }

  function budgetLabel(tier: string): string {
    const map: Record<string, string> = {
      low: 'Hemat',
      moderate: 'Sedang',
      high: 'Flexing',
    };
    return map[tier] || tier || '—';
  }

  function deliveryLabel(ch: string): string {
    const map: Record<string, string> = {
      telegram: 'Telegram',
      whatsapp: 'WhatsApp',
    };
    return map[ch] || ch || '—';
  }

  function bmi(heightCm: number, weightKg: number): string {
    if (!heightCm || !weightKg) return '—';
    const m = heightCm / 100;
    const bmi = weightKg / (m * m);
    return bmi.toFixed(1);
  }

  function bmiCategory(heightCm: number, weightKg: number): string {
    if (!heightCm || !weightKg) return '';
    const m = heightCm / 100;
    const val = weightKg / (m * m);
    if (val < 18.5) return 'Kurang';
    if (val < 25) return 'Normal';
    if (val < 30) return 'Berlebih';
    return 'Obesitas';
  }
</script>

<DashboardLayout title="Users" current="#/admin/users">
  <!-- Search bar -->
  <div class="search-bar">
    <input
      type="text"
      placeholder="Cari nama, email, chat ID, goal, tier..."
      bind:value={searchQuery}
      oninput={onSearchInput}
      class="search-input"
    />
    {#if searchQuery}
      <button class="search-clear" onclick={() => { searchQuery = ''; load(1, ''); }}>&times;</button>
    {/if}
  </div>

  {#if loading}
    <Skeleton rows={10} cols={6} />
  {:else if error}
    <Alert variant="danger" title="Error">{error}</Alert>
  {:else if data}
    <p class="result-count">{data.total} user{data.total !== 1 ? 's' : ''} ditemukan · Page {page}/{data.totalPages}</p>

    {#if data.rows.length === 0}
      <div class="empty">
        <p>Tidak ada user yang cocok.</p>
      </div>
    {:else}
      <div class="users-table">
        <!-- Header -->
        <div class="table-header">
          <span class="col-name">Nama</span>
          <span class="col-contact">Kontak</span>
          <span class="col-goal">Goal</span>
          <span class="col-tier">Tier</span>
          <span class="col-streak">Streak</span>
          <span class="col-pushed">Push</span>
          <span class="col-created">Daftar</span>
        </div>

        <!-- Rows -->
        {#each data.rows as u}
          {@const key = rowKey(u)}
          <div class="table-row-wrap" class:expanded={expandedRow === key}>
            <button class="table-row" onclick={() => toggleRow(u)}>
              <span class="col-name">
                <span class="row-expand">{expandedRow === key ? '▾' : '▸'}</span>
                <span class="name-block">
                  <span class="name">{u.fullName || 'Tanpa profil'}</span>
                  <span class="chat-id">ID: {u.chatId}</span>
                </span>
              </span>
              <span class="col-contact">
                {#if u.email}
                  <span class="contact-email">{u.email}</span>
                {:else}
                  <span class="contact-na">—</span>
                {/if}
              </span>
              <span class="col-goal">
                {#if u.goal}
                  <span class="goal-tag">{goalLabel(u.goal)}</span>
                {:else}
                  <span class="contact-na">—</span>
                {/if}
              </span>
              <span class="col-tier">
                <Badge variant={u.tier === 'premium' ? 'accent' : 'neutral'}>{u.tier}</Badge>
              </span>
              <span class="col-streak">
                {#if u.streak > 0}<span class="streak">🔥 {u.streak}</span>{:else}—{/if}
              </span>
              <span class="col-pushed">
                {#if u.pushHour !== null}
                  <span class="push-time">{String(u.pushHour).padStart(2,'0')}:{String(u.pushMin).padStart(2,'0')}</span>
                {:else}
                  <span class="contact-na">default</span>
                {/if}
              </span>
              <span class="col-created">{fmtDate(u.createdAt)}</span>
            </button>

            <!-- Expanded profile -->
            {#if expandedRow === key}
              <div class="profile-detail">
                {#if u.profileId}
                  <!-- Identity -->
                  <div class="detail-group">
                    <h4>Identitas</h4>
                    <div class="detail-grid">
                      <div class="detail-item"><span class="d-label">Nama lengkap</span><span class="d-value">{u.fullName}</span></div>
                      <div class="detail-item"><span class="d-label">Email</span><span class="d-value">{u.email}</span></div>
                      <div class="detail-item"><span class="d-label">Umur</span><span class="d-value">{u.age || '—'} tahun</span></div>
                      <div class="detail-item"><span class="d-label">Gender</span><span class="d-value">{u.gender || '—'}</span></div>
                      <div class="detail-item"><span class="d-label">Tinggi</span><span class="d-value">{u.heightCm || '—'} cm</span></div>
                      <div class="detail-item"><span class="d-label">Berat</span><span class="d-value">{u.weightKg || '—'} kg</span></div>
                      <div class="detail-item"><span class="d-label">BMI</span><span class="d-value">{bmi(u.heightCm, u.weightKg)} {#if u.heightCm && u.weightKg}<span class="bmi-cat">{bmiCategory(u.heightCm, u.weightKg)}</span>{/if}</span></div>
                    </div>
                  </div>

                  <!-- Nutrition goals -->
                  <div class="detail-group">
                    <h4>Target Gizi</h4>
                    <div class="detail-grid">
                      <div class="detail-item"><span class="d-label">Goal</span><span class="d-value">{goalLabel(u.goal)}</span></div>
                      <div class="detail-item"><span class="d-label">Target kalori</span><span class="d-value">{u.targetCalories || '—'} kal/hari</span></div>
                      <div class="detail-item"><span class="d-label">Target protein</span><span class="d-value">{u.targetProtein || '—'}g/hari</span></div>
                      <div class="detail-item"><span class="d-label">Meals per hari</span><span class="d-value">{u.mealsPerDay || '—'}</span></div>
                      <div class="detail-item"><span class="d-label">Rotasi masakan</span><span class="d-value">{u.cuisineRotation || '—'}</span></div>
                    </div>
                  </div>

                  <!-- Lifestyle -->
                  <div class="detail-group">
                    <h4>Gaya Hidup</h4>
                    <div class="detail-grid">
                      <div class="detail-item"><span class="d-label">Aktivitas</span><span class="d-value">{activityLabel(u.activityLevel)}</span></div>
                      <div class="detail-item"><span class="d-label">Skill masak</span><span class="d-value">{cookingLabel(u.cookingSkill)}</span></div>
                      <div class="detail-item"><span class="d-label">Ukuran rumah</span><span class="d-value">{u.householdSize || '—'} orang</span></div>
                      <div class="detail-item"><span class="d-label">Budget</span><span class="d-value">{budgetLabel(u.budgetTier)}</span></div>
                    </div>
                  </div>

                  <!-- Restrictions -->
                  <div class="detail-group">
                    <h4>Pembatasan</h4>
                    <div class="detail-grid">
                      <div class="detail-item"><span class="d-label">Alergi</span><span class="d-value">{u.allergies || 'Tidak ada'}</span></div>
                      <div class="detail-item"><span class="d-label">Diet khusus</span><span class="d-value">{u.dietaryRestrictions || 'Tidak ada'}</span></div>
                      <div class="detail-item"><span class="d-label">Kondisi kesehatan</span><span class="d-value">{u.healthConditions || 'Tidak ada'}</span></div>
                      <div class="detail-item"><span class="d-label">Bahan dihindari</span><span class="d-value">{u.dislikedIngredients || 'Tidak ada'}</span></div>
                    </div>
                  </div>

                  <!-- Delivery -->
                  <div class="detail-group">
                    <h4>Delivery</h4>
                    <div class="detail-grid">
                      <div class="detail-item"><span class="d-label">Channel</span><span class="d-value">{deliveryLabel(u.deliveryChannel)}</span></div>
                      <div class="detail-item"><span class="d-label">Push time</span><span class="d-value">{#if u.pushHour !== null}{String(u.pushHour).padStart(2,'0')}:{String(u.pushMin).padStart(2,'0')}{:else}Default{/if}</span></div>
                      <div class="detail-item"><span class="d-label">WhatsApp</span><span class="d-value">{u.whatsappPhone || '—'}</span></div>
                      <div class="detail-item"><span class="d-label">Locale</span><span class="d-value">{u.profileLocale || '—'}</span></div>
                      <div class="detail-item"><span class="d-label">Feedback</span><span class="d-value">{u.lastFeedback || '—'}</span></div>
                      <div class="detail-item"><span class="d-label">Profil dibuat</span><span class="d-value">{fmtDate(u.profileCreated)}</span></div>
                    </div>
                  </div>
                {:else}
                  <div class="no-profile">
                    <span>👤</span>
                    <p>User ini terdaftar via Telegram bot, belum bikin profil web.</p>
                    <div class="detail-grid">
                      <div class="detail-item"><span class="d-label">Chat ID</span><span class="d-value">{u.chatId}</span></div>
                      <div class="detail-item"><span class="d-label">Locale</span><span class="d-value">{u.locale}</span></div>
                      <div class="detail-item"><span class="d-label">Subscribed</span><span class="d-value">{u.subscribed ? 'Ya' : 'Tidak'}</span></div>
                      <div class="detail-item"><span class="d-label">Last pushed</span><span class="d-value">{u.lastPushed || '—'}</span></div>
                      <div class="detail-item"><span class="d-label">Feedback</span><span class="d-value">{u.lastFeedback || '—'}</span></div>
                      <div class="detail-item"><span class="d-label">Daftar</span><span class="d-value">{fmtDate(u.createdAt)}</span></div>
                    </div>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Pagination -->
      {#if data.totalPages > 1}
        <div class="pagination">
          <button disabled={page <= 1} onclick={() => load(page - 1, searchQuery)}>← Prev</button>
          <span class="page-info">Page {page} / {data.totalPages}</span>
          <button disabled={page >= data.totalPages} onclick={() => load(page + 1, searchQuery)}>Next →</button>
        </div>
      {/if}
    {/if}
  {/if}
</DashboardLayout>

<style>
  .search-bar {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
    position: relative;
  }
  .search-input {
    flex: 1;
    padding: var(--space-2) var(--space-4);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: var(--fs-sm);
    color: var(--text);
    outline: none;
    transition: border-color var(--duration-micro) var(--ease-standard);
  }
  .search-input:focus { border-color: var(--primary); }
  .search-input::placeholder { color: var(--text-faint); }
  .search-clear {
    position: absolute;
    right: var(--space-2);
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    font-size: var(--fs-lg);
    color: var(--text-subtle);
    cursor: pointer;
    padding: var(--space-1);
  }
  .search-clear:hover { color: var(--text); }

  .result-count { font-size: var(--fs-sm); color: var(--text-subtle); margin-bottom: var(--space-3); }
  .empty { text-align: center; padding: var(--space-8); color: var(--text-subtle); }

  /* Table */
  .users-table {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .table-header {
    display: grid;
    grid-template-columns: 2fr 2fr 1.2fr 0.8fr 0.6fr 0.7fr 1fr;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    background: var(--surface-2);
    font-size: var(--fs-xs);
    font-weight: var(--fw-semibold);
    color: var(--text-subtle);
    text-transform: uppercase;
    letter-spacing: var(--ls-wide);
  }
  .table-row-wrap {
    border-top: 1px solid var(--border);
  }
  .table-row-wrap.expanded { background: var(--surface-2); }
  .table-row {
    display: grid;
    grid-template-columns: 2fr 2fr 1.2fr 0.8fr 0.6fr 0.7fr 1fr;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    width: 100%;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    font-size: var(--fs-sm);
    color: var(--text);
    align-items: center;
    transition: background var(--duration-micro) var(--ease-standard);
  }
  .table-row:hover { background: var(--surface-2); }

  .col-name { display: flex; align-items: center; gap: var(--space-2); }
  .row-expand { color: var(--text-faint); font-size: var(--fs-xs); width: 14px; flex-shrink: 0; }
  .name-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .name { font-weight: var(--fw-medium); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chat-id { font-size: var(--fs-xs); color: var(--text-faint); font-family: var(--font-mono); }
  .contact-email { color: var(--text-muted); font-size: var(--fs-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .contact-na { color: var(--text-faint); }
  .goal-tag {
    padding: 2px var(--space-2); border-radius: var(--radius-pill);
    background: var(--primary-soft); color: var(--primary);
    font-size: var(--fs-xs); font-weight: var(--fw-medium);
  }
  .streak { color: var(--accent); font-size: var(--fs-xs); font-weight: var(--fw-medium); }
  .push-time { font-variant-numeric: tabular-nums; color: var(--text-muted); font-size: var(--fs-xs); }
  .col-created { color: var(--text-subtle); font-size: var(--fs-xs); }

  /* Expanded profile */
  .profile-detail {
    padding: var(--space-5) var(--space-4);
    border-top: 1px solid var(--border);
    background: var(--surface);
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-6);
  }
  .detail-group h4 {
    font-size: var(--fs-xs); font-weight: var(--fw-semibold); color: var(--primary);
    text-transform: uppercase; letter-spacing: var(--ls-wide);
    margin-bottom: var(--space-3); padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--border);
  }
  .detail-grid { display: flex; flex-direction: column; gap: var(--space-2); }
  .detail-item { display: flex; justify-content: space-between; gap: var(--space-3); }
  .d-label { font-size: var(--fs-xs); color: var(--text-subtle); flex-shrink: 0; }
  .d-value { font-size: var(--fs-xs); color: var(--text-muted); text-align: right; word-break: break-word; }
  .bmi-cat { color: var(--accent); font-size: 0.6rem; margin-left: var(--space-1); }

  .no-profile {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-items: center;
    text-align: center;
    padding: var(--space-4);
  }
  .no-profile span { font-size: 2rem; }
  .no-profile p { color: var(--text-subtle); font-size: var(--fs-sm); }
  .no-profile .detail-grid { width: 100%; max-width: 500px; }

  /* Pagination */
  .pagination {
    display: flex; justify-content: center; align-items: center;
    gap: var(--space-4); margin-top: var(--space-5);
  }
  .pagination button {
    padding: var(--space-2) var(--space-4);
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm);
    font-family: inherit; font-size: var(--fs-sm); color: var(--text-muted);
    cursor: pointer; transition: all var(--duration-micro) var(--ease-standard);
  }
  .pagination button:hover:not(:disabled) { border-color: var(--primary); color: var(--text); }
  .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
  .page-info { font-size: var(--fs-sm); color: var(--text-subtle); }

  @media (max-width: 1024px) {
    .table-header, .table-row {
      grid-template-columns: 2fr 1fr 0.8fr 0.8fr 0.6fr;
    }
    .col-contact, .col-pushed, .col-created { display: none; }
    .profile-detail { grid-template-columns: 1fr; }
  }
  @media (max-width: 768px) {
    .table-header, .table-row {
      grid-template-columns: 2fr 0.8fr 0.6fr;
    }
    .col-goal, .col-pushed, .col-created, .col-contact { display: none; }
  }
</style>
