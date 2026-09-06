<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '$lib/components/Button.svelte';
  import StatCard from '$lib/components/StatCard.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import BarList from '$lib/components/BarList.svelte';
  import ChartCard from '$lib/components/ChartCard.svelte';

  type TokenDef = { name: string; var: string; type: 'color' | 'number' | 'text'; group: string };
  type TokenValue = { value: string };

  const tokenDefs: TokenDef[] = [
    // Colors
    { name: 'bg', var: '--bg', type: 'color', group: 'Surfaces' },
    { name: 'surface', var: '--surface', type: 'color', group: 'Surfaces' },
    { name: 'surface-2', var: '--surface-2', type: 'color', group: 'Surfaces' },
    { name: 'surface-3', var: '--surface-3', type: 'color', group: 'Surfaces' },
    { name: 'text', var: '--text', type: 'color', group: 'Text' },
    { name: 'text-muted', var: '--text-muted', type: 'color', group: 'Text' },
    { name: 'text-subtle', var: '--text-subtle', type: 'color', group: 'Text' },
    { name: 'text-faint', var: '--text-faint', type: 'color', group: 'Text' },
    { name: 'primary', var: '--primary', type: 'color', group: 'Actions' },
    { name: 'primary-hover', var: '--primary-hover', type: 'color', group: 'Actions' },
    { name: 'accent', var: '--accent', type: 'color', group: 'Actions' },
    { name: 'accent-soft', var: '--accent-soft', type: 'color', group: 'Actions' },
    { name: 'danger', var: '--danger', type: 'color', group: 'Actions' },
    { name: 'success', var: '--success', type: 'color', group: 'Actions' },
    { name: 'border', var: '--border', type: 'color', group: 'Surfaces' },
    { name: 'border-strong', var: '--border-strong', type: 'color', group: 'Surfaces' },
    // Spacing
    { name: 'space-1', var: '--space-1', type: 'number', group: 'Spacing' },
    { name: 'space-2', var: '--space-2', type: 'number', group: 'Spacing' },
    { name: 'space-3', var: '--space-3', type: 'number', group: 'Spacing' },
    { name: 'space-4', var: '--space-4', type: 'number', group: 'Spacing' },
    { name: 'radius-sm', var: '--radius-sm', type: 'number', group: 'Radius' },
    { name: 'radius-md', var: '--radius-md', type: 'number', group: 'Radius' },
    { name: 'radius-lg', var: '--radius-lg', type: 'number', group: 'Radius' },
  ];

  // Load current values from :root — NOT reactive, just reads once
  let tokenValues = $state<Record<string, string>>({});
  let loaded = false;

  function loadTokens() {
    if (loaded) return; // prevent re-entrant calls
    const root = getComputedStyle(document.documentElement);
    for (const def of tokenDefs) {
      tokenValues[def.name] = root.getPropertyValue(def.var).trim();
    }
    loaded = true;
    tokenValues = { ...tokenValues };
  }

  function updateToken(def: TokenDef, value: string) {
    tokenValues[def.name] = value;
    document.documentElement.style.setProperty(def.var, value);
    tokenValues = { ...tokenValues };
  }

  function getGroups(): string[] {
    return [...new Set(tokenDefs.map(d => d.group))];
  }

  function exportTokens() {
    const exportObj: Record<string, string> = {};
    for (const def of tokenDefs) {
      exportObj[def.name] = tokenValues[def.name];
    }
    const json = JSON.stringify({ exported: exportObj, timestamp: new Date().toISOString() }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'saji-tokens-export.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    const styleEl = document.documentElement.style;
    for (const def of tokenDefs) {
      styleEl.removeProperty(def.var);
    }
    loaded = false;
    loadTokens();
  }

  // Init once on mount, clean up on unmount
  onMount(() => {
    loadTokens();
    return () => {
      const styleEl = document.documentElement.style;
      for (const def of tokenDefs) {
        styleEl.removeProperty(def.var);
      }
    };
  });

  const previewBarData = [
    { label: 'Free', value: 42 },
    { label: 'Premium', value: 8 },
  ];
</script>

<div class="theme-editor">
  <header>
    <div>
      <h1>Theme Editor</h1>
      <p>Edit tokens live. Export when satisfied. Dev-only — not shipped to users.</p>
    </div>
    <div class="actions">
      <a href="#/admin" class="back-link">← Back to Dashboard</a>
      <Button variant="ghost" onclick={reset}>Reset</Button>
      <Button variant="primary" onclick={exportTokens}>Export tokens.json</Button>
    </div>
  </header>

  <div class="editor-layout">
    <!-- Token controls -->
    <div class="token-controls">
      {#each getGroups() as group}
        <div class="token-group">
          <h3>{group}</h3>
          {#each tokenDefs.filter(d => d.group === group) as def}
            <div class="token-row">
              <label for={`tok-${def.name}`}>{def.name}</label>
              {#if def.type === 'color'}
                <div class="color-input">
                  <input
                    id={`tok-${def.name}`}
                    type="color"
                    value={tokenValues[def.name]?.startsWith('#') ? tokenValues[def.name] : '#000000'}
                    oninput={(e) => updateToken(def, e.currentTarget.value)}
                  />
                  <input
                    id={`tok-${def.name}-text`}
                    type="text"
                    value={tokenValues[def.name] || ''}
                    oninput={(e) => updateToken(def, e.currentTarget.value)}
                  />
                </div>
              {:else if def.type === 'number'}
                <input
                  id={`tok-${def.name}`}
                  type="text"
                  value={tokenValues[def.name] || ''}
                  oninput={(e) => updateToken(def, e.currentTarget.value)}
                />
              {/if}
            </div>
          {/each}
        </div>
      {/each}
    </div>

    <!-- Live preview -->
    <div class="preview-panel">
      <h3>Live Preview</h3>
      <div class="preview-section">
        <Button>Primary Button</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </div>
      <div class="preview-section">
        <Badge variant="primary">free</Badge>
        <Badge variant="accent">premium</Badge>
        <Badge variant="danger">bad</Badge>
      </div>
      <div class="preview-section">
        <div class="stats-preview">
          <StatCard value={42} label="Users" />
          <StatCard value={7} label="Day Streak" />
        </div>
      </div>
      <div class="preview-section">
        <ChartCard title="Tier Distribution">
          <BarList data={previewBarData} />
        </ChartCard>
      </div>
      <div class="preview-section">
        <div class="preview-card">
          <div class="preview-text">Body text — lorem ipsum dolor sit amet, consectetur adipiscing elit.</div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .theme-editor { padding: var(--space-8) var(--space-10); max-width: 1400px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-6); }
  header h1 { font-size: var(--fs-xl); font-weight: var(--fw-semibold); margin-bottom: var(--space-1); }
  header p { color: var(--text-subtle); font-size: var(--fs-sm); }
  .actions { display: flex; gap: var(--space-2); align-items: center; }
  .back-link { font-size: var(--fs-sm); color: var(--text-subtle); text-decoration: none; padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); transition: color var(--duration-micro) var(--ease-standard); }
  .back-link:hover { color: var(--primary); }
  .editor-layout { display: grid; grid-template-columns: 400px 1fr; gap: var(--space-6); }
  .token-controls { display: flex; flex-direction: column; gap: var(--space-6); }
  .token-group {
    background: var(--surface);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    box-shadow: var(--shadow-elevation-1);
  }
  .token-group h3 {
    font-size: var(--fs-xs); font-weight: var(--fw-semibold); text-transform: uppercase;
    letter-spacing: var(--ls-wide); color: var(--text-subtle); margin-bottom: var(--space-3);
  }
  .token-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2); }
  .token-row label { font-size: var(--fs-sm); color: var(--text-muted); font-family: var(--font-mono); }
  .color-input { display: flex; gap: var(--space-1); align-items: center; }
  .color-input input[type="color"] { width: 28px; height: 28px; border: none; border-radius: var(--radius-sm); cursor: pointer; background: none; padding: 0; }
  .color-input input[type="text"], .token-row input[type="text"] {
    width: 120px; padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm);
    background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
    font-size: var(--fs-xs); font-family: var(--font-mono);
  }
  .preview-panel {
    background: var(--bg); border-radius: var(--radius-md); padding: var(--space-5);
    box-shadow: var(--shadow-elevation-1);
  }
  .preview-panel h3 {
    font-size: var(--fs-xs); font-weight: var(--fw-semibold); text-transform: uppercase;
    letter-spacing: var(--ls-wide); color: var(--text-subtle); margin-bottom: var(--space-4);
  }
  .preview-section { margin-bottom: var(--space-5); display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .stats-preview { display: flex; gap: var(--space-3); }
  .preview-card {
    background: var(--surface); border-radius: var(--radius-md); padding: var(--space-4);
    box-shadow: var(--shadow-elevation-1); width: 100%;
  }
  .preview-text { color: var(--text-muted); font-size: var(--fs-sm); }
  @media (max-width: 900px) { .editor-layout { grid-template-columns: 1fr; } }
</style>
