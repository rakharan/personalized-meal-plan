<script lang="ts">
  let {
    value = $bindable(''),
    type = 'text',
    placeholder = '',
    label = undefined as string | undefined,
    disabled = false,
    autofocus = false,
    oninput = undefined as ((e: Event) => void) | undefined,
  }: {
    value?: string;
    type?: string;
    placeholder?: string;
    label?: string;
    disabled?: boolean;
    autofocus?: boolean;
    oninput?: (e: Event) => void;
  } = $props();

  let inputEl: HTMLInputElement | undefined = $state();
  const inputId = `inp-${Math.random().toString(36).slice(2, 9)}`;

  $effect(() => {
    if (autofocus && inputEl) inputEl.focus();
  });
</script>

{#if label}<label class="input-label" for={inputId}>{label}</label>{/if}
<input
  bind:this={inputEl}
  bind:value
  {type}
  {placeholder}
  {disabled}
  {oninput}
  id={inputId}
  class="input"
/>

<style>
  .input-label {
    display: block;
    font-size: var(--fs-xs);
    font-weight: var(--fw-medium);
    color: var(--text-subtle);
    margin-bottom: var(--space-1);
    text-transform: uppercase;
    letter-spacing: var(--ls-wide);
  }
  .input {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: var(--fs-sm);
    font-family: inherit;
    transition: border-color var(--duration-micro) var(--ease-standard);
  }
  .input:focus-visible {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary-soft);
  }
  .input::placeholder {
    color: var(--text-faint);
  }
  .input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
