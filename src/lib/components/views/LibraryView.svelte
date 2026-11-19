<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import {
    Badge,
    Block,
    BlockTitle,
    Button,
    Chip,
    List,
    ListItem,
    Segmented,
    SegmentedButton
  } from 'konsta/svelte';
  import { engine } from '#lib/audio/engine.svelte.ts';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import { formatTime, getTrackInitial } from '#lib/utils/format.ts';
  import Icon from '../Icon.svelte';
  import TrackCard from '../TrackCard.svelte';

  let layoutMode = $state<'list' | 'grid'>('list');
  let visibleCount = $state<number>(20);

  $effect(() => {
    void appStore.libFilter;
    visibleCount = 20;
  });

  const visibleTracks = $derived(appStore.filteredLibrary.slice(0, visibleCount));
  const activePlaylist = $derived(
    appStore.playlists.find((p) => p.id === appStore.libFilter) || null
  );

  function playAll(shuffled = false): void {
    const list = appStore.filteredLibrary;
    if (list.length === 0) return;
    const queue = shuffled ? [...list].sort(() => Math.random() - 0.5) : [...list];
    engine.playTrack(queue[0], queue);
    appStore.showToast(
      shuffled ? `Memutar acak ${queue.length} lagu.` : `Memutar ${queue.length} lagu.`
    );
  }
</script>

<!-- Premium iOS Library Header: Main Category Switcher + Quick Actions -->
<Block strong inset class="space-y-3">
  <Segmented strong rounded>
    <SegmentedButton
      active={appStore.libFilter === 'local'}
      onclick={() => (appStore.libFilter = 'local')}
    >
      Offline ({appStore.localTracks.length})
    </SegmentedButton>
    <SegmentedButton
      active={appStore.libFilter === 'liked'}
      onclick={() => (appStore.libFilter = 'liked')}
    >
      Favorit ({appStore.likedIds.length})
    </SegmentedButton>
    <SegmentedButton
      active={appStore.libFilter === 'history'}
      onclick={() => (appStore.libFilter = 'history')}
    >
      Riwayat ({engine.history.length})
    </SegmentedButton>
  </Segmented>

  <div class="grid grid-cols-2 gap-2">
    <Button rounded small onclick={() => (appStore.uploadModalOpen = true)}>
      + Upload Audio
    </Button>
    <Button tonal rounded small onclick={() => (appStore.playlistModalOpen = true)}>
      + Buat Playlist
    </Button>
  </div>
</Block>

<!-- Playlists Rail -->
{#if appStore.playlists.length > 0}
  <BlockTitle>Playlist Kamu ({appStore.playlists.length})</BlockTitle>
  <div class="xmusic-hscroll flex gap-2 px-4 py-1">
    {#each appStore.playlists as pl (pl.id)}
      <Chip
        outline={appStore.libFilter !== pl.id}
        class="shrink-0 cursor-pointer {appStore.libFilter === pl.id
          ? '!bg-[#007aff] !text-white font-semibold dark:!bg-[#0a84ff]'
          : ''}"
        onclick={() => (appStore.libFilter = pl.id)}
      >
        {pl.name} ({pl.trackIds.length})
      </Chip>
    {/each}
  </div>
{/if}

<!-- Collection Header with Play All, Shuffle, and List/Grid Switcher -->
<BlockTitle class="flex items-center justify-between gap-2">
  <span class="truncate">
    {activePlaylist
      ? `Playlist: ${activePlaylist.name}`
      : appStore.libFilter === 'liked'
        ? 'Lagu Favorit'
        : appStore.libFilter === 'history'
          ? 'Baru Diputar'
          : 'Koleksi Offline'} ({appStore.filteredLibrary.length})
  </span>
  {#if appStore.filteredLibrary.length > 0}
    <Button
      clear
      small
      inline
      onclick={() => (layoutMode = layoutMode === 'list' ? 'grid' : 'list')}
    >
      {layoutMode === 'list' ? 'Grid' : 'Daftar'}
    </Button>
  {/if}
</BlockTitle>

{#if appStore.filteredLibrary.length > 0}
  <Block class="!my-2 grid grid-cols-2 gap-2">
    <Button rounded small onclick={() => playAll(false)}>
      <span class="inline-flex items-center gap-1.5">
        <Icon name="play" size={14} />
        <span>Putar Semua</span>
      </span>
    </Button>
    <Button tonal rounded small onclick={() => playAll(true)}>
      <span class="inline-flex items-center gap-1.5">
        <Icon name="shuffle" size={14} />
        <span>Acak</span>
      </span>
    </Button>
  </Block>

  {#if layoutMode === 'list'}
    <List strong inset class="!my-2">
      {#each visibleTracks as track (track.id)}
        {@const isCurrent = engine.current?.id === track.id}
        <ListItem
          link
          title={track.title}
          subtitle={track.artist}
          onclick={() => {
            engine.playTrack(track, appStore.filteredLibrary);
            appStore.openTrackModal(track, false);
          }}
        >
          {#snippet media()}
            <span
              class="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl text-sm font-bold text-white"
              style={track.imageUrl
                ? ''
                : `background: linear-gradient(135deg, ${track.c1 || '#007aff'}, ${track.c2 || '#1c1c1e'})`}
            >
              {#if track.imageUrl}
                <img
                  src={track.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  class="h-full w-full object-cover"
                />
              {:else}
                {getTrackInitial(track.title)}
              {/if}
            </span>
          {/snippet}

          {#snippet after()}
            <div class="flex items-center gap-1.5">
              {#if isCurrent && engine.playing}
                <Badge class="bg-[#007aff] text-white text-[10px]">Diputar</Badge>
              {:else if track.dur > 0}
                <span class="text-xs tabular-nums text-black/50 dark:text-white/50">
                  {formatTime(track.dur)}
                </span>
              {/if}
              {#if track.source === 'local'}
                <button
                  type="button"
                  class="grid h-8 w-8 place-items-center rounded-full bg-black/5 text-black/70 active:scale-95 dark:bg-white/10 dark:text-white/75"
                  aria-label="Edit {track.title}"
                  onclick={(e: MouseEvent) => {
                    e.stopPropagation();
                    appStore.openEditTrack(track);
                  }}
                >
                  <Icon name="edit" size={14} />
                </button>
              {/if}
            </div>
          {/snippet}
        </ListItem>
      {/each}
    </List>
  {:else}
    <Block class="!my-2">
      <div class="xmusic-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {#each visibleTracks as track (track.id)}
          <TrackCard {track} />
        {/each}
      </div>
    </Block>
  {/if}

  {#if appStore.filteredLibrary.length > visibleCount}
    <Block class="flex justify-center !mt-2">
      <Button tonal rounded small inline onclick={() => (visibleCount += 20)}>
        Muat Lebih Banyak ({appStore.filteredLibrary.length - visibleCount} lagi)
      </Button>
    </Block>
  {/if}
{:else}
  <Block strong inset class="space-y-3 text-center">
    <h3 class="text-base font-bold text-black dark:text-white">Belum ada lagu di kategori ini</h3>
    <p class="text-sm text-black/60 dark:text-white/60">
      Unggah file MP3/M4A/WAV/FLAC dari perangkatmu atau buat lagu demo synthwave secara instan.
    </p>
    <div class="flex flex-wrap justify-center gap-2 pt-1">
      <Button rounded small inline onclick={() => (appStore.uploadModalOpen = true)}>
        Upload File Audio
      </Button>
      <Button
        rounded
        small
        inline
        class="!bg-[#248a3d] !text-white font-bold dark:!bg-[#30d158] dark:!text-black"
        onclick={() => appStore.createBuiltInSynthDemo()}
      >
        Buat Lagu Demo Offline
      </Button>
    </div>
  </Block>
{/if}
