<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { Block, BlockTitle, Button, Chip } from 'konsta/svelte';
  import { engine } from '#lib/audio/engine.svelte.ts';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import TrackCard from '../TrackCard.svelte';
</script>

<Block class="flex flex-wrap items-center justify-between gap-3">
  <div class="flex flex-wrap gap-2" role="tablist" aria-label="Filter perpustakaan">
    <Chip
      outline={appStore.libFilter !== 'local'}
      class="cursor-pointer {appStore.libFilter === 'local' ? '!bg-[#007aff] !text-white dark:!bg-[#0a84ff]' : ''}"
      onclick={() => (appStore.libFilter = 'local')}
    >
      Lagu Offline ({appStore.localTracks.length})
    </Chip>

    <Chip
      outline={appStore.libFilter !== 'liked'}
      class="cursor-pointer {appStore.libFilter === 'liked' ? '!bg-[#007aff] !text-white dark:!bg-[#0a84ff]' : ''}"
      onclick={() => (appStore.libFilter = 'liked')}
    >
      Favorit ({appStore.likedIds.length})
    </Chip>

    <Chip
      outline={appStore.libFilter !== 'history'}
      class="cursor-pointer {appStore.libFilter === 'history' ? '!bg-[#007aff] !text-white dark:!bg-[#0a84ff]' : ''}"
      onclick={() => (appStore.libFilter = 'history')}
    >
      Riwayat ({engine.history.length})
    </Chip>

    {#each appStore.playlists as pl (pl.id)}
      <Chip
        outline={appStore.libFilter !== pl.id}
        class="cursor-pointer {appStore.libFilter === pl.id ? '!bg-[#007aff] !text-white dark:!bg-[#0a84ff]' : ''}"
        onclick={() => (appStore.libFilter = pl.id)}
      >
        {pl.name} ({pl.trackIds.length})
      </Chip>
    {/each}
  </div>

  <div class="flex gap-2">
    <Button tonal rounded small inline onclick={() => (appStore.playlistModalOpen = true)}>
      + Playlist
    </Button>
    <Button rounded small inline onclick={() => (appStore.uploadModalOpen = true)}>
      + Upload
    </Button>
  </div>
</Block>

<BlockTitle>Koleksi Lagu ({appStore.filteredLibrary.length})</BlockTitle>
<Block>
  {#if appStore.filteredLibrary.length > 0}
    <div class="xmusic-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each appStore.filteredLibrary as track (track.id)}
        <TrackCard {track} />
      {/each}
    </div>
  {:else}
    <Block strong inset class="!mx-0 space-y-3 text-center">
      <h3 class="text-base font-bold text-zinc-950 dark:text-white">Belum ada lagu di kategori ini</h3>
      <p class="text-sm text-zinc-600 dark:text-zinc-300">
        Unggah file MP3/M4A/WAV/FLAC dari perangkatmu atau buat lagu demo synthwave secara instan.
      </p>
      <div class="flex flex-wrap justify-center gap-2 pt-1">
        <Button rounded inline onclick={() => (appStore.uploadModalOpen = true)}>
          Upload File Audio
        </Button>
        <Button
          rounded
          inline
          class="!bg-[#248a3d] !text-white font-bold dark:!bg-[#30d158] dark:!text-black"
          onclick={() => appStore.createBuiltInSynthDemo()}
        >
          Buat Lagu Demo Offline
        </Button>
      </div>
    </Block>
  {/if}
</Block>
