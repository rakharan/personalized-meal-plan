<script lang="ts">
  // dotlottie-player wrapper — Svelte strips unknown attrs on custom elements,
  // so set them as properties after mount.
  let { src, size = 52 }: { src: string; size?: number } = $props();

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    if (!el) return;
    const p = el as any;
    p.src = src;
    p.autoplay = true;
    p.loop = true;
    // also set attributes for players that read attrs
    p.setAttribute('src', src);
    p.setAttribute('autoplay', '');
    p.setAttribute('loop', 'true');
  });
</script>

<dotlottie-player bind:this={el} style="width:{size}px;height:{size}px"></dotlottie-player>
