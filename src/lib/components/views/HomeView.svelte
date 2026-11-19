<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { Block, BlockTitle, Button, Chip, List, ListItem, Preloader } from 'konsta/svelte';
  import { CATEGORIES, ERA_PRESETS, SPOTIFY_CHARTS } from '#lib/data/presets.ts';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import { getTimeGreeting } from '#lib/utils/format.ts';
  import Icon from '../Icon.svelte';
  import TrackCard from '../TrackCard.svelte';

  const MODE_LABELS: Record<string, string> = {
    viral: 'Viral',
    balanced: 'Seimbang',
    discovery: 'Eksplorasi',
    nostalgia: 'Nostalgia'
  };
</script>

<!-- Compact, Intuitive iOS Header Card -->
<Block strong inset class="space-y-3.5">
  <div class="flex items-center justify-between gap-2">
    <div class="min-w-0">
      <div class="text-xs font-semibold text-[#007aff] dark:text-[#64d2ff]">
        {getTimeGreeting()}, {appStore.userProfile.name}
      </div>
      <h2 class="truncate text-xl font-bold tracking-tight text-black dark:text-white">
        Dengarkan Tanpa Batas
      </h2>
    </div>
    <Button
      tonal
      rounded
      small
      inline
      disabled={appStore.refreshing}
      onclick={() => appStore.refreshOnlineFeeds(true)}
    >
      {#if appStore.refreshing}
        <Preloader class="w-4 h-4" />
      {:else}
        <span class="inline-flex items-center gap-1.5">
          <Icon name="refresh" size={14} />
          <span>Segarkan</span>
        </span>
      {/if}
    </Button>
  </div>

  <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
    <Button rounded small onclick={() => (appStore.uploadModalOpen = true)}>
      Upload Lagu
    </Button>
    <Button
      rounded
      small
      class="!bg-[#248a3d] !text-white font-semibold dark:!bg-[#30d158] dark:!text-black"
      onclick={() => appStore.createBuiltInSynthDemo()}
    >
      Lagu Demo
    </Button>
    <Button tonal rounded small onclick={() => (appStore.hubModalOpen = true)}>
      Hub Link
    </Button>
    <Button tonal rounded small onclick={() => (appStore.view = 'profile')}>
      Algoritma
    </Button>
  </div>
</Block>

<!-- 1. User's Local Offline Collection (Always Instant) -->
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
      Semua
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

<!-- 2. Primary Full-Length Feed: YouTube Music (Pure Music Songs, Zero Videos/Livestreams) -->
<BlockTitle class="flex items-center justify-between">
  <span class="truncate">
    YouTube Music • {appStore.activeRegionOption.label} ({MODE_LABELS[appStore.algoConfig.mode] || 'Seimbang'})
  </span>
  <Button
    clear
    small
    inline
    disabled={appStore.refreshing}
    onclick={() => appStore.refreshOnlineFeeds(true)}
  >
    Segarkan
  </Button>
</BlockTitle>

{#if !appStore.isOnline || (!appStore.loadingHome && !appStore.refreshing && !appStore.networkReachable)}
  <Block strong inset class="space-y-3">
    <div class="flex items-center gap-3">
      <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#007aff]/15 text-[#007aff] dark:bg-[#0a84ff]/20 dark:text-[#64d2ff]">
        <Icon name="wifi-off" size={20} />
      </span>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-bold text-black dark:text-white">Mode Offline Aktif</div>
        <p class="text-xs text-black/65 dark:text-white/65">
          Hubungkan internet untuk streaming penuh. Koleksi lokal & lagu demo tetap siap diputar offline.
        </p>
      </div>
    </div>
    <div class="flex flex-wrap gap-2">
      <Button tonal rounded small inline onclick={() => appStore.refreshOnlineFeeds(true)}>
        Coba Lagi
      </Button>
      <Button rounded small inline onclick={() => (appStore.view = 'library')}>
        Koleksi Offline
      </Button>
    </div>
  </Block>
{:else if appStore.loadingHome || appStore.refreshing}
  <Block>
    <div class="flex items-center gap-3 py-4 text-sm text-black/65 dark:text-white/65" role="status">
      <Preloader class="w-5 h-5" />
      <span>Menyegarkan lagu penuh {appStore.activeRegionOption.label}...</span>
    </div>
  </Block>
{:else if appStore.rankedYtFeed.length > 0}
  <Block>
    <div class="xmusic-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each appStore.rankedYtFeed.slice(0, 12) as track (track.id)}
        <TrackCard {track} />
      {/each}
    </div>
  </Block>
{/if}

<!-- 3. Full-Length Free Streaming: Audius Global -->
{#if appStore.isOnline && appStore.networkReachable && appStore.trendingTracks.length > 0}
  <BlockTitle>Streaming Penuh (Audius Global)</BlockTitle>
  <Block>
    <div class="xmusic-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each appStore.trendingTracks.slice(0, 12) as track (track.id)}
        <TrackCard {track} />
      {/each}
    </div>
  </Block>
{/if}

<!-- 4. Clean Compact Quick-Browse Chips (Era 1900-2026 & Genre — Zero Clutter) -->
<BlockTitle>Jelajah Era (1900–2026)</BlockTitle>
<Block class="flex flex-wrap gap-2">
  {#each ERA_PRESETS as era (era.id)}
    <Chip outline class="cursor-pointer" onclick={() => appStore.exploreEra(era.id)}>
      {era.label}
    </Chip>
  {/each}
</Block>

<BlockTitle>Genre & Suasana</BlockTitle>
<Block class="flex flex-wrap gap-2">
  {#each CATEGORIES as cat}
    <Chip outline class="cursor-pointer" onclick={() => appStore.updateSearch(cat.q, true)}>
      {cat.label}
    </Chip>
  {/each}
</Block>

<!-- 5. Native Playable Spotify Charts (Zero Broken In-App WebView Embeds!) -->
<BlockTitle>Chart Populer Spotify (Putar Langsung)</BlockTitle>
{#if appStore.isOnline && appStore.networkReachable}
  <List strong inset>
    {#each SPOTIFY_CHARTS as chart}
      {@const isActive = appStore.activeSpotifyChartTitle === chart.title}
      <ListItem
        title={chart.title}
        subtitle={isActive ? 'Menampilkan lagu penuh di bawah' : 'Putar langsung di Xmusic tanpa web embed'}
      >
        {#snippet after()}
          <Button
            tonal={!isActive}
            rounded
            small
            inline
            onclick={() => appStore.openSpotifyChart(chart.title)}
          >
            {isActive ? 'Tutup' : 'Buka'}
          </Button>
        {/snippet}
      </ListItem>
    {/each}
  </List>

  {#if appStore.loadingSpotifyChart}
    <Block>
      <div class="flex items-center gap-3 py-3 text-sm text-black/65 dark:text-white/65" role="status">
        <Preloader class="w-5 h-5" />
        <span>Memuat daftar lagu {appStore.activeSpotifyChartTitle}...</span>
      </div>
    </Block>
  {:else if appStore.spotifyChartTracks.length > 0}
    <Block>
      <div class="xmusic-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {#each appStore.spotifyChartTracks as track (track.id)}
          <TrackCard {track} />
        {/each}
      </div>
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
          Hubungkan internet untuk memutar Chart Top 50 Indonesia & Global secara langsung.
        </p>
      </div>
    </div>
  </Block>
{/if}

<!-- 6. Bottom Section: 30-Second Public Catalog Previews (Always Below Full-Length Feeds) -->
{#if appStore.isOnline && appStore.networkReachable && appStore.recommendedFeed.length > 0}
  <BlockTitle>Pratinjau Katalog 1900–2026 (30d)</BlockTitle>
  <Block>
    <div class="xmusic-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {#each appStore.recommendedFeed.slice(0, 10) as track (track.id)}
        <TrackCard {track} />
      {/each}
    </div>
  </Block>
{/if}
