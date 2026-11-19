<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script>
  import { Block, BlockTitle, Preloader } from 'konsta/svelte';
  import { CATEGORIES } from '#lib/data/presets.js';
  import { appStore } from '#lib/stores/library.svelte.js';
  import TrackCard from '../TrackCard.svelte';
</script>

<BlockTitle>
  {appStore.searchQuery ? `Hasil Pencarian "${appStore.searchQuery}"` : 'Telusuri Genre & Suasana'}
</BlockTitle>

<Block class="!my-2">
  {#if !appStore.searchQuery.trim()}
    <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {#each CATEGORIES as cat}
        <button
          type="button"
          class="flex min-h-[72px] flex-col justify-center rounded-2xl border border-white/10 p-3.5 text-left transition-transform active:scale-[0.98]"
          style="background:{cat.bg}; border-left: 4px solid {cat.accent};"
          onclick={() => appStore.updateSearch(cat.q)}
        >
          <span class="text-sm font-bold text-white">{cat.label}</span>
          <span class="mt-0.5 text-xs text-zinc-300">{cat.sub}</span>
        </button>
      {/each}
    </div>
  {:else if appStore.searching}
    <div class="flex items-center gap-3 py-6 text-sm text-zinc-600 dark:text-zinc-300" role="status">
      <Preloader size="w-5 h-5" />
      <span>Mencari "{appStore.searchQuery}"...</span>
    </div>
  {:else if appStore.searchResults.length > 0}
    <div class="xmusic-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each appStore.searchResults as track (track.id)}
        <TrackCard {track} />
      {/each}
    </div>
  {:else}
    <Block strong inset class="!mx-0">
      <p class="text-sm text-zinc-600 dark:text-zinc-300">
        Tidak ditemukan lagu yang cocok dengan "{appStore.searchQuery}".
      </p>
    </Block>
  {/if}
</Block>
