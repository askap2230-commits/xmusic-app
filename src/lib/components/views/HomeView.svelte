<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { Block, BlockTitle, Button, List, ListItem, Preloader } from 'konsta/svelte';
  import { CATEGORIES, SPOTIFY_CHARTS } from '#lib/data/presets.ts';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import { getTimeGreeting } from '#lib/utils/format.ts';
  import Icon from '../Icon.svelte';
  import TrackCard from '../TrackCard.svelte';

  let activeChartId = $state<string | null>(null);
</script>

<Block strong inset class="space-y-4">
  <div class="text-xs font-semibold tracking-wide text-[#007aff] dark:text-[#64d2ff]">
    nys Xmusic v{appStore.runtimeInfo.version} • {getTimeGreeting()}, {appStore.userProfile.name}
  </div>
  <h2 class="text-2xl font-bold tracking-tight text-black dark:text-white">
    Audio Jernih, Tanpa Kompromi.
  </h2>
  <p class="max-w-2xl text-sm leading-relaxed text-black/65 dark:text-white/65">
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
  <Block>
    <div class="xmusic-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each appStore.localTracks.slice(0, 6) as track (track.id)}
        <TrackCard {track} />
      {/each}
    </div>
  </Block>
{/if}

<BlockTitle>Eksplorasi Genre & Suasana</BlockTitle>
<Block>
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
</Block>

<BlockTitle>Trending Streaming (Audius Global)</BlockTitle>
{#if !appStore.isOnline || (!appStore.loadingHome && !appStore.networkReachable)}
  <Block strong inset class="space-y-3">
    <div class="flex items-center gap-3">
      <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#007aff]/15 text-[#007aff] dark:bg-[#0a84ff]/20 dark:text-[#64d2ff]">
        <Icon name="wifi-off" size={20} />
      </span>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-bold text-black dark:text-white">Mode Offline Aktif</div>
        <p class="text-xs text-black/65 dark:text-white/65">
          Streaming Audius memerlukan koneksi internet. Koleksi lokal dan lagu demo tetap siap diputar 100% offline.
        </p>
      </div>
    </div>
    <div class="flex flex-wrap gap-2">
      <Button tonal rounded small inline onclick={() => appStore.refreshOnlineFeeds()}>
        Coba Muat Ulang
      </Button>
      <Button rounded small inline onclick={() => (appStore.view = 'library')}>
        Buka Koleksi Offline
      </Button>
    </div>
  </Block>
{:else if appStore.loadingHome}
  <Block>
    <div class="flex items-center gap-3 py-4 text-sm text-black/65 dark:text-white/65" role="status">
      <Preloader class="w-5 h-5" />
      <span>Memuat daftar lagu trending...</span>
    </div>
  </Block>
{:else}
  <Block>
    <div class="xmusic-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each appStore.trendingTracks.slice(0, 24) as track (track.id)}
        <TrackCard {track} />
      {/each}
    </div>
  </Block>
{/if}

{#if appStore.isOnline && appStore.networkReachable && appStore.ytTracks.length > 0}
  <BlockTitle>Trending YouTube Music Indonesia</BlockTitle>
  <Block>
    <div class="xmusic-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each appStore.ytTracks as track (track.id)}
        <TrackCard {track} />
      {/each}
    </div>
  </Block>
{/if}

<BlockTitle>Chart Resmi Spotify</BlockTitle>
{#if appStore.isOnline && appStore.networkReachable}
  <!-- On-demand Konsta iOS list prevents slow iframe startup and offline WebView error pages -->
  <List strong inset>
    {#each SPOTIFY_CHARTS as chart}
      <ListItem
        title={chart.title}
        subtitle={activeChartId === chart.id ? 'Pemutar aktif di bawah' : 'Ketuk untuk memuat pratinjau Spotify'}
      >
        {#snippet after()}
          <Button
            tonal={activeChartId !== chart.id}
            rounded
            small
            inline
            onclick={() => (activeChartId = activeChartId === chart.id ? null : chart.id)}
          >
            {activeChartId === chart.id ? 'Tutup' : 'Muat'}
          </Button>
        {/snippet}
      </ListItem>
    {/each}
  </List>

  {#if activeChartId}
    <Block>
      <iframe
        title="Chart Resmi Spotify"
        class="w-full rounded-2xl border-0"
        src="https://open.spotify.com/embed/playlist/{activeChartId}?theme={appStore.isDark ? '0' : '1'}"
        height="352"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      ></iframe>
    </Block>
  {/if}
{:else}
  <Block strong inset>
    <div class="flex items-center gap-3">
      <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#248a3d]/15 text-[#248a3d] dark:bg-[#30d158]/20 dark:text-[#30d158]">
        <Icon name="wifi-off" size={20} />
      </span>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-bold text-black dark:text-white">Chart Spotify Tidak Tersedia Offline</div>
        <p class="text-xs text-black/65 dark:text-white/65">
          Hubungkan perangkat ke internet untuk memuat Chart Resmi Spotify (Top 50 Indonesia & Global).
        </p>
      </div>
    </div>
  </Block>
{/if}
