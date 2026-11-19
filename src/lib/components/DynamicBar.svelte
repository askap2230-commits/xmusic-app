<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { engine } from '#lib/audio/engine.svelte';
  import { EQ_PRESETS } from '#lib/data/presets';
  import { appStore } from '#lib/stores/library.svelte';
  import { getTrackInitial } from '#lib/utils/format';
  import Icon from './Icon.svelte';
</script>

{#if engine.current && !appStore.dynamicBarDismissed && !appStore.trackModalOpen}
  <div
    class="fixed top-[calc(env(safe-area-inset-top,0px)+8px)] left-1/2 -translate-x-1/2 z-50 flex w-[min(340px,calc(100vw-24px))] items-center gap-2 rounded-full border border-black/10 bg-white/95 px-2 py-1.5 shadow-xl dark:border-white/15 dark:bg-[#1c1c1e]/95 dark:shadow-2xl"
    role="region"
    aria-label="Status pemutaran cepat"
  >
    <button
      type="button"
      class="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      onclick={() => engine.current && appStore.openTrackModal(engine.current, false)}
      aria-label="Buka pemutar penuh untuk {engine.current.title}"
    >
      <span
        class="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-bold text-white"
        style={engine.current.imageUrl
          ? ''
          : `background: linear-gradient(135deg, ${engine.current.c1 || '#007aff'}, ${engine.current.c2 || '#1c1c1e'})`}
      >
        {#if engine.current.imageUrl}
          <img src={engine.current.imageUrl} alt="" class="h-full w-full object-cover" />
        {:else}
          {getTrackInitial(engine.current.title)}
        {/if}
      </span>

      <span class="min-w-0 flex-1">
        <span class="block truncate text-xs font-semibold text-zinc-950 dark:text-white">
          {engine.current.title}
        </span>
        <span class="block truncate text-[11px] text-zinc-600 dark:text-zinc-300">
          {engine.current.artist}{engine.eqEnabled && engine.eqPreset !== 'flat'
            ? ` • ${EQ_PRESETS[engine.eqPreset]?.name || 'Custom'}`
            : ''}
        </span>
      </span>
    </button>

    <button
      type="button"
      class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-950 text-white dark:bg-white dark:text-black"
      onclick={() => engine.togglePlay()}
      aria-label={engine.playing ? 'Jeda lagu' : 'Putar lagu'}
    >
      <Icon name={engine.playing ? 'pause' : 'play'} size={14} />
    </button>

    <button
      type="button"
      class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
      onclick={() => (appStore.dynamicBarDismissed = true)}
      aria-label="Tutup bilah status cepat"
    >
      <Icon name="close" size={14} />
    </button>
  </div>
{/if}
