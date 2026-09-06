<script lang="ts">
  let {
    data = [] as { label: string; value: number | string }[],
    max = undefined as number | undefined,
  }: {
    data: { label: string; value: number | string }[];
    max?: number;
  } = $props();

  const maxVal = $derived(max ?? Math.max(...data.map(d => Number(d.value) || 0), 1));
</script>

<div class="bar-list">
  {#each data as item}
    <div class="bar-row">
      <span class="lbl">{item.label}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width: {Math.min(100, (Number(item.value) / maxVal) * 100)}%"></div>
      </div>
      <span class="val">{item.value}</span>
    </div>
  {/each}
</div>

<style>
  .bar-list { display: flex; flex-direction: column; gap: var(--space-2); }
  .bar-row {
    display: flex; align-items: center; gap: var(--space-3);
    padding: var(--space-1) 0;
    border-bottom: 1px solid var(--border);
    font-size: var(--fs-sm);
  }
  .bar-row:last-child { border-bottom: none; }
  .lbl {
    color: var(--text-subtle);
    min-width: 80px;
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bar-track {
    flex: 1;
    height: 6px;
    background: var(--surface-2);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--primary), var(--primary-hover));
    border-radius: var(--radius-pill);
    transition: width var(--duration-large) var(--ease-standard);
  }
  .val {
    font-weight: var(--fw-semibold);
    color: var(--text);
    font-variant-numeric: tabular-nums;
    min-width: 30px;
    text-align: right;
  }
</style>
