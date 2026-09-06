<script lang="ts">
  let {
    value = 0,
    label = '',
    trend = undefined as { value: string; positive: boolean } | undefined,
    highlight = false,
  }: {
    value: number | string;
    label: string;
    trend?: { value: string; positive: boolean };
    highlight?: boolean;
  } = $props();
</script>

<div class="stat-card" class:highlight>
  <div class="stat-num">{value}</div>
  <div class="stat-label">{label}</div>
  {#if trend}
    <div class="stat-trend" class:positive={trend.positive} class:negative={!trend.positive}>
      {trend.positive ? '↑' : '↓'} {trend.value}
    </div>
  {/if}
  {#if highlight}<div class="stat-accent-bar"></div>{/if}
</div>

<style>
  .stat-card {
    background: var(--surface);
    border-radius: var(--radius-md);
    padding: var(--space-5) var(--space-4);
    box-shadow: var(--shadow-elevation-1);
    transition: box-shadow var(--duration-small) var(--ease-standard), transform var(--duration-micro) var(--ease-standard);
    position: relative;
    overflow: hidden;
  }
  .stat-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--border-strong), transparent);
  }
  .stat-card:hover {
    box-shadow: var(--shadow-elevation-2);
  }
  .stat-card:active {
    transform: scale(0.98);
  }
  .stat-card.highlight {
    background: linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%);
    border: 1px solid var(--primary-soft);
  }
  .stat-card.highlight .stat-num {
    color: var(--primary);
  }
  .stat-num {
    font-size: var(--fs-2xl);
    font-weight: var(--fw-semibold);
    letter-spacing: var(--ls-tight);
    color: var(--text);
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }
  .stat-label {
    font-size: var(--fs-xs);
    color: var(--text-subtle);
    margin-top: var(--space-1);
  }
  .stat-trend {
    font-size: var(--fs-xs);
    font-weight: var(--fw-medium);
    margin-top: var(--space-1);
    font-variant-numeric: tabular-nums;
  }
  .stat-trend.positive { color: var(--success); }
  .stat-trend.negative { color: var(--danger); }
  .stat-accent-bar {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--primary), var(--accent));
  }
</style>
