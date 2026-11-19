<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { Block, BlockTitle, Preloader, Searchbar } from 'konsta/svelte';
  import { CATEGORIES } from '#lib/data/presets';
  import { appStore } from '#lib/stores/library.svelte';
  import Icon from '../Icon.svelte';
  import TrackCard from '../TrackCard.svelte';
</script>

<Block>
  <Searchbar
    placeholder="Cari lagu, artis, atau genre..."
    value={appStore.searchQuery}
    onInput={(e: Event) => appStore.updateSearch((e.target as HTMLInputElement).value)}
    onClear={() => appStore.updateSearch('')}
  />
</Block>

{#if !appStore.isOnline}
  <Block strong inset class="flex items-center gap-3">
    <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#007aff]/15 text-[#007aff] dark:bg-[#0a84ff]/20 dark:text-[#64d2ff]">
      <Icon name="wifi-off" size={18} />
    </span>
    <p class="text-xs text-zinc-600 dark:text-zinc-300">
      Sedang offline: pencarian hanya menampilkan lagu dari koleksi lokal perangkatmu.
    </p>
  </Block>
{/if}

<BlockTitle>
  {appStore.searchQuery ? `Hasil Pencarian "${appStore.searchQuery}"` : 'Telusuri Genre & Suasana'}
</BlockTitle>

<Block>
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
          <span class="mt-0.5 text-xs text-white/80">{cat.sub}</span>
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
