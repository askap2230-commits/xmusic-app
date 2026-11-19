<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script>
  import { Block, BlockTitle, Button, Preloader } from 'konsta/svelte';
  import { CATEGORIES, SPOTIFY_CHARTS } from '#lib/data/presets.js';
  import { appStore } from '#lib/stores/library.svelte.js';
  import { getTimeGreeting } from '#lib/utils/format.js';
  import TrackCard from '../TrackCard.svelte';
</script>

<Block strong inset class="space-y-4">
  <div class="text-xs font-semibold tracking-wide text-[#007aff] dark:text-[#64d2ff]">
    nys Xmusic v{appStore.runtimeInfo.version} • {getTimeGreeting()}, {appStore.userProfile.name}
  </div>
  <h2 class="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">Audio Jernih, Tanpa Kompromi.</h2>
  <p class="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
    Ketuk <strong>2x kartu lagu</strong> untuk membalik dan melihat lirik sinkron sesuai irama. Tempel tautan Spotify di Hub Musik untuk deteksi sampul HD dan artis otomatis.
  </p>

  <div class="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
    <Button rounded onclick={() => (appStore.uploadModalOpen = true)}>Upload MP3 / URL</Button>
    <Button
      rounded
      class="!bg-[#248a3d] !text-white font-bold dark:!bg-[#30d158] dark:!text-black"
      onclick={() => appStore.createBuiltInSynthDemo()}
    >
      Lagu Demo (0 KB)
    </Button>
    <Button tonal rounded onclick={() => (appStore.hubModalOpen = true)}>Hub Spotify & YT</Button>
    <Button tonal rounded onclick={() => appStore.openDownloaderWithUrl()}>API Downloader</Button>
  </div>
</Block>

{#if appStore.localTracks.length > 0}
  <BlockTitle class="flex items-center justify-between">
    <span>Koleksi Offline ({appStore.localTracks.length})</span>
    <Button
      clear
      small
      inline
      onclick={() => {
        appStore.view = 'library';
        appStore.libFilter = 'local';
      }}
    >
      Lihat Semua
    </Button>
  </BlockTitle>
  <Block class="!my-2">
    <div class="xmusic-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each appStore.localTracks.slice(0, 6) as track (track.id)}
        <TrackCard {track} />
      {/each}
    </div>
  </Block>
{/if}

<BlockTitle>Eksplorasi Genre & Suasana</BlockTitle>
<Block class="!my-2">
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
</Block>

<BlockTitle>Trending Streaming (Audius Global)</BlockTitle>
<Block class="!my-2">
  {#if appStore.loadingHome}
    <div class="flex items-center gap-3 py-4 text-sm text-zinc-600 dark:text-zinc-300" role="status">
      <Preloader size="w-5 h-5" />
      <span>Memuat daftar lagu trending...</span>
    </div>
  {:else if appStore.trendingTracks.length > 0}
    <div class="xmusic-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each appStore.trendingTracks.slice(0, 24) as track (track.id)}
        <TrackCard {track} />
      {/each}
    </div>
  {:else}
    <Block strong inset class="!mx-0">
      <p class="text-sm text-zinc-600 dark:text-zinc-300">
        Sedang offline atau server streaming tidak terjangkau. Gunakan koleksi offline atau tombol
        <strong>Lagu Demo</strong> di atas.
      </p>
    </Block>
  {/if}
</Block>

{#if appStore.ytTracks.length > 0}
  <BlockTitle>Trending YouTube Music Indonesia</BlockTitle>
  <Block class="!my-2">
    <div class="xmusic-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each appStore.ytTracks as track (track.id)}
        <TrackCard {track} />
      {/each}
    </div>
  </Block>
{/if}

<BlockTitle>Chart Resmi Spotify</BlockTitle>
<Block class="!my-2">
  <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
    {#each SPOTIFY_CHARTS as chart}
      <iframe
        title={chart.title}
        class="w-full rounded-2xl border-0"
        src="https://open.spotify.com/embed/playlist/{chart.id}?theme=0"
        height="352"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      ></iframe>
    {/each}
  </div>
</Block>
