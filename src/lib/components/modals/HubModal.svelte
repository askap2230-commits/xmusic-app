<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { Block, Button, Link, List, ListInput, Navbar, Page, Popup } from 'konsta/svelte';
  import {
    extractSpotifyEmbed,
    extractYouTubeId,
    fetchOEmbedMeta,
    fetchSpotifyMetadata,
    fetchSyncedLyrics,
    fetchYtSearch
  } from '#lib/api/services.ts';
  import { engine } from '#lib/audio/engine.svelte.ts';
  import { saveLocalTrack } from '#lib/db/storage.ts';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import type { HubMeta, SpotifyEmbedRef, Track } from '#lib/types/music.ts';
  import Icon from '../Icon.svelte';

  let hubUrlInput = $state<string>('');
  let hubEmbedType = $state<'spotify' | 'youtube' | null>(null);
  let hubVideoId = $state<string>('');
  let hubSpotify = $state<SpotifyEmbedRef | null>(null);
  let hubMeta = $state<HubMeta | null>(null);
  let hubDetecting = $state<boolean>(false);
  let hubMessage = $state<string>('');
  let hubSaving = $state<boolean>(false);

  async function processHubLink(): Promise<void> {
    if (!appStore.isOnline) {
      hubMessage = 'Mode Offline: Hub Spotify & YouTube memerlukan koneksi internet.';
      return;
    }
    const url = hubUrlInput.trim();
    if (!url) {
      appStore.showToast('Masukkan tautan Spotify atau YouTube.');
      return;
    }

    hubEmbedType = null;
    hubVideoId = '';
    hubSpotify = null;
    hubMeta = null;
    hubMessage = '';

    const sp = extractSpotifyEmbed(url);
    if (sp) {
      hubSpotify = sp;
      hubEmbedType = 'spotify';
      hubDetecting = true;
      hubMessage = 'Mendeteksi gambar sampul, judul lagu, dan artis dari Spotify...';
      const meta = await fetchSpotifyMetadata(sp.type, sp.id, url);
      hubDetecting = false;
      if (meta) {
        hubMeta = meta;
        hubMessage = `Terdeteksi (${meta.via}): ${meta.title} — ${meta.artist}`;
      } else {
        hubMessage = 'Pemutar Spotify dimuat. Isi Spotify API Key di Profil untuk deteksi penuh.';
      }
      return;
    }

    const ytId = extractYouTubeId(url);
    if (ytId) {
      hubVideoId = ytId;
      hubEmbedType = 'youtube';
      hubDetecting = true;
      const oembed = await fetchOEmbedMeta(url, false);
      hubDetecting = false;
      hubMeta = {
        via: 'YouTube oEmbed',
        title: oembed?.title || 'YouTube Music',
        artist: oembed?.author_name || 'YouTube',
        album: 'YouTube Hub',
        dur: 0,
        imageUrl: oembed?.thumbnail_url || `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
      };
      hubMessage = `Terdeteksi: ${hubMeta.title} — ${hubMeta.artist}`;
      return;
    }

    hubMessage = 'Tautan tidak dikenali. Gunakan URL Spotify atau YouTube.';
  }

  async function saveHubToLibrary(): Promise<void> {
    const url = hubUrlInput.trim();
    if (!url) return;
    hubSaving = true;

    const isSpotify = hubEmbedType === 'spotify';
    let meta = hubMeta;
    if (!meta && isSpotify && hubSpotify) {
      meta = await fetchSpotifyMetadata(hubSpotify.type, hubSpotify.id, url);
    }

    const title = meta?.title || (isSpotify ? `Spotify ${hubSpotify?.type || 'track'}` : 'YouTube Music');
    const artist = meta?.artist || (isSpotify ? 'Spotify' : 'YouTube');
    const imageUrl =
      meta?.imageUrl || (hubVideoId ? `https://img.youtube.com/vi/${hubVideoId}/hqdefault.jpg` : null);

    const syncedLyrics = appStore.isOnline
      ? await fetchSyncedLyrics(title, artist, meta?.dur || 0)
      : null;

    let resolvedVideoId = hubVideoId || undefined;
    let resolvedDur = meta?.dur || 0;
    if (isSpotify && !resolvedVideoId && appStore.isOnline) {
      const ytMatches = await fetchYtSearch(`${title} ${artist}`);
      if (ytMatches.length > 0 && ytMatches[0].videoId) {
        resolvedVideoId = ytMatches[0].videoId;
        resolvedDur = ytMatches[0].dur || resolvedDur;
      }
    }

    const track: Track = {
      id: `embed_${Date.now()}`,
      title,
      artist,
      album: meta?.album || (isSpotify ? 'Spotify (Audio Penuh)' : 'YouTube Music'),
      imageUrl,
      c1: isSpotify ? '#248a3d' : '#dc2626',
      c2: '#1c1c1e',
      dur: resolvedDur,
      source: 'local',
      createdAt: Date.now(),
      lyrics: syncedLyrics || '',
      videoId: resolvedVideoId,
      spotifyId: resolvedVideoId ? undefined : hubSpotify?.id || undefined,
      spotifyType: resolvedVideoId ? undefined : hubSpotify?.type || undefined
    };

    await saveLocalTrack(track);
    await appStore.refreshLocalTracks();
    hubSaving = false;
    appStore.hubModalOpen = false;
    appStore.view = 'library';
    engine.playTrack(track, appStore.allTracks);
    appStore.openTrackModal(track, false);
    appStore.showToast(
      syncedLyrics
        ? 'Lagu, sampul, dan lirik sinkron disimpan.'
        : 'Lagu dan sampul disimpan ke Koleksi.'
    );
  }
</script>

<Popup opened={appStore.hubModalOpen} onBackdropClick={() => (appStore.hubModalOpen = false)}>
  <Page>
    <Navbar title="Hub Spotify & YouTube">
      {#snippet right()}
        <Link iconOnly onclick={() => (appStore.hubModalOpen = false)} aria-label="Tutup">
          <Icon name="close" size={20} />
        </Link>
      {/snippet}
    </Navbar>

    {#if !appStore.isOnline}
      <Block strong inset class="flex items-center gap-3">
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#007aff]/15 text-[#007aff] dark:bg-[#0a84ff]/20 dark:text-[#64d2ff]">
          <Icon name="wifi-off" size={18} />
        </span>
        <p class="text-xs text-zinc-600 dark:text-zinc-300">
          Sedang offline. Hubungkan ke internet untuk mendeteksi tautan Spotify atau YouTube.
        </p>
      </Block>
    {/if}

    <List strong inset>
      <ListInput
        label="Tautan Spotify / YouTube"
        type="url"
        placeholder="https://open.spotify.com/track/... atau https://youtu.be/..."
        value={hubUrlInput}
        onInput={(e: Event) => (hubUrlInput = (e.target as HTMLInputElement).value)}
      />
    </List>

    <Block class="grid grid-cols-2 gap-2">
      <Button rounded disabled={hubDetecting || !appStore.isOnline} onclick={processHubLink}>
        {hubDetecting ? 'Mendeteksi...' : 'Deteksi & Muat'}
      </Button>
      <Button
        tonal
        rounded
        onclick={() => {
          appStore.hubModalOpen = false;
          appStore.editProfileOpen = true;
        }}
      >
        Atur API Key
      </Button>
    </Block>

    {#if hubMeta}
      <Block strong inset class="flex items-center gap-3">
        {#if hubMeta.imageUrl}
          <img
            src={hubMeta.imageUrl}
            alt="Sampul {hubMeta.title}"
            class="h-14 w-14 shrink-0 rounded-xl object-cover"
          />
        {/if}
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-bold text-zinc-950 dark:text-white">{hubMeta.title}</div>
          <div class="truncate text-xs text-[#007aff] dark:text-[#64d2ff]">{hubMeta.artist}</div>
          <div class="text-[11px] text-zinc-600 dark:text-zinc-300">Via {hubMeta.via}</div>
        </div>
      </Block>
    {/if}

    {#if hubMessage}
      <Block>
        <p class="text-xs text-[#007aff] dark:text-[#64d2ff]" role="status">{hubMessage}</p>
      </Block>
    {/if}

    {#if appStore.isOnline && hubEmbedType === 'spotify' && hubSpotify}
      <Block strong inset class="space-y-1.5">
        <div class="text-xs font-bold text-[#248a3d] dark:text-[#30d158]">
          Siap Diputar Penuh Secara Native (Tanpa Web Embed)
        </div>
        <p class="text-xs text-black/65 dark:text-white/65">
          Metadata & sampul HD Spotify terdeteksi. Ketuk <strong>Simpan & Putar Penuh</strong> di bawah untuk memutar lagu ini langsung di pemutar Xmusic dengan 5-Band EQ & lirik sinkron.
        </p>
      </Block>
    {:else if appStore.isOnline && hubEmbedType === 'youtube' && hubVideoId}
      <Block>
        <iframe
          title="YouTube Preview"
          class="w-full rounded-2xl border-0"
          height="200"
          src="https://www.youtube.com/embed/{hubVideoId}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </Block>
    {/if}

    {#if hubEmbedType}
      <Block class="space-y-2">
        <Button
          rounded
          large
          disabled={hubSaving}
          class="!bg-[#248a3d] !text-white font-bold dark:!bg-[#30d158] dark:!text-black"
          onclick={saveHubToLibrary}
        >
          {hubSaving ? 'Menyimpan Sampul & Lirik...' : 'Simpan & Putar Penuh'}
        </Button>
        {#if hubVideoId}
          <Button
            tonal
            rounded
            onclick={() => {
              appStore.hubModalOpen = false;
              appStore.openDownloaderWithUrl(`https://youtu.be/${hubVideoId}`);
            }}
          >
            Konversi & Unduh MP3 via API
          </Button>
        {/if}
      </Block>
    {/if}
  </Page>
</Popup>
