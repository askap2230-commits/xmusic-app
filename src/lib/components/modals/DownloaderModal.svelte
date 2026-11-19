<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { Block, Button, Link, List, ListInput, Navbar, Page, Popup, Preloader } from 'konsta/svelte';
  import { extractYouTubeId, rapidDownloadMp3 } from '#lib/api/services.ts';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import type { DownloadResult } from '#lib/types/music.ts';
  import Icon from '../Icon.svelte';

  let urlInput = $state<string>('');
  let loading = $state<boolean>(false);
  let result = $state<DownloadResult | null>(null);

  $effect(() => {
    if (appStore.dlModalOpen && appStore.dlPrefillUrl) {
      urlInput = appStore.dlPrefillUrl;
      appStore.dlPrefillUrl = '';
    }
  });

  async function runDownloader(): Promise<void> {
    if (!appStore.isOnline) {
      appStore.showToast('Mode Offline: API Downloader memerlukan koneksi internet.');
      return;
    }
    const videoId = extractYouTubeId(urlInput) || urlInput.trim();
    if (!videoId) {
      appStore.showToast('Masukkan tautan YouTube yang valid.');
      return;
    }

    loading = true;
    result = null;
    const res = await rapidDownloadMp3(videoId);
    loading = false;

    if (res.ok) {
      result = res;
      appStore.showToast('Tautan unduhan MP3 siap.');
    } else {
      appStore.showToast(`Gagal: ${res.msg || 'Kesalahan tidak diketahui'}`);
    }
  }
</script>

<Popup opened={appStore.dlModalOpen} onBackdropClick={() => (appStore.dlModalOpen = false)}>
  <Page>
    <Navbar title="API Downloader MP3">
      {#snippet right()}
        <Link iconOnly onclick={() => (appStore.dlModalOpen = false)} aria-label="Tutup">
          <Icon name="close" size={20} />
        </Link>
      {/snippet}
    </Navbar>

    {#if !appStore.isOnline}
      <Block strong inset class="flex items-center gap-3">
        <Icon name="wifi-off" size={18} />
        <p class="text-xs text-zinc-600 dark:text-zinc-300">
          Sedang offline. Hubungkan ke internet untuk menggunakan API Downloader.
        </p>
      </Block>
    {/if}

    <List strong inset>
      <ListInput
        label="Tautan YouTube"
        type="url"
        placeholder="https://youtube.com/watch?v=..."
        value={urlInput}
        onInput={(e: Event) => (urlInput = (e.target as HTMLInputElement).value)}
      />
    </List>

    <Block>
      <Button
        rounded
        large
        disabled={loading || !appStore.isOnline}
        class="!bg-[#248a3d] !text-white font-bold dark:!bg-[#30d158] dark:!text-black"
        onclick={runDownloader}
      >
        Proses Konversi MP3
      </Button>
    </Block>

    {#if loading}
      <Block class="flex items-center justify-center gap-3 text-sm text-[#007aff] dark:text-[#64d2ff]" role="status">
        <Preloader size="w-5 h-5" />
        <span>Menghubungi endpoint RapidAPI...</span>
      </Block>
    {/if}

    {#if result?.ok && result.link}
      <Block strong inset class="space-y-3">
        <div class="text-sm font-bold text-zinc-950 dark:text-white">{result.title}</div>
        <a
          href={result.link}
          target="_blank"
          rel="noopener noreferrer"
          class="flex min-h-[44px] w-full items-center justify-center rounded-full bg-[#248a3d] px-4 text-sm font-bold text-white no-underline dark:bg-[#30d158] dark:text-black"
        >
          Klik untuk Download MP3
        </a>
      </Block>
    {/if}
  </Page>
</Popup>
