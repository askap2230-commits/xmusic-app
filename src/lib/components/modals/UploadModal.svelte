<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import {
    Block,
    Button,
    Link,
    List,
    ListInput,
    Navbar,
    Page,
    Popup,
    Segmented,
    SegmentedButton
  } from 'konsta/svelte';
  import { appStore } from '#lib/stores/library.svelte';
  import Icon from '../Icon.svelte';

  let uploadTab = $state<'file' | 'url'>('file');
  let urlInput = $state<string>('');
  let urlTitle = $state<string>('');
  let urlArtist = $state<string>('');
  let pendingCoverFile = $state<File | null>(null);
  let coverFileName = $state<string>('Belum ada gambar sampul');

  async function onFilesSelected(files: FileList | null): Promise<void> {
    if (!files?.length) return;
    const ok = await appStore.importLocalFiles(files, pendingCoverFile);
    if (ok) {
      pendingCoverFile = null;
      coverFileName = 'Belum ada gambar sampul';
    }
  }

  async function onSubmitUrl(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const ok = await appStore.importStreamUrl({
      url: urlInput,
      title: urlTitle,
      artist: urlArtist
    });
    if (ok) {
      urlInput = '';
      urlTitle = '';
      urlArtist = '';
    }
  }
</script>

<Popup
  opened={appStore.uploadModalOpen}
  onBackdropClick={() => (appStore.uploadModalOpen = false)}
>
  <Page>
    <Navbar title="Tambah Musik">
      {#snippet right()}
        <Link iconOnly onclick={() => (appStore.uploadModalOpen = false)} aria-label="Tutup">
          <Icon name="close" size={20} />
        </Link>
      {/snippet}
    </Navbar>

    <Block>
      <Segmented strong rounded>
        <SegmentedButton active={uploadTab === 'file'} onclick={() => (uploadTab = 'file')}>
          File Lokal
        </SegmentedButton>
        <SegmentedButton active={uploadTab === 'url'} onclick={() => (uploadTab = 'url')}>
          URL Stream
        </SegmentedButton>
      </Segmented>
    </Block>

    {#if uploadTab === 'file'}
      <Block strong inset class="space-y-3">
        <label class="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-black/20 bg-zinc-100 p-6 text-center dark:border-white/25 dark:bg-black/30">
          <span class="text-sm font-bold text-zinc-950 dark:text-white">Pilih File Audio (Bisa Banyak Sekaligus)</span>
          <span class="text-xs text-zinc-600 dark:text-zinc-300">MP3, M4A, WAV, OGG, FLAC, AAC, OPUS</span>
          <input
            type="file"
            accept="audio/*"
            multiple
            class="sr-only"
            onchange={(e: Event) => onFilesSelected((e.currentTarget as HTMLInputElement).files)}
          />
        </label>

        <label class="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border border-dashed border-black/15 bg-zinc-50 p-4 text-center dark:border-white/20 dark:bg-black/20">
          <span class="text-xs font-bold text-[#007aff] dark:text-[#64d2ff]">+ Gambar Sampul Album (Opsional)</span>
          <span class="text-xs text-zinc-600 dark:text-zinc-300">{coverFileName}</span>
          <input
            type="file"
            accept="image/*"
            class="sr-only"
            onchange={(e: Event) => {
              const files = (e.currentTarget as HTMLInputElement).files;
              if (files?.length) {
                pendingCoverFile = files[0];
                coverFileName = pendingCoverFile.name;
              }
            }}
          />
        </label>
      </Block>
    {:else}
      <form onsubmit={onSubmitUrl}>
        <List strong inset>
          <ListInput
            label="URL Audio Langsung"
            type="url"
            required
            placeholder="https://example.com/song.mp3"
            value={urlInput}
            onInput={(e: Event) => (urlInput = (e.target as HTMLInputElement).value)}
          />
          <ListInput
            label="Judul Lagu"
            type="text"
            placeholder="Judul lagu"
            value={urlTitle}
            onInput={(e: Event) => (urlTitle = (e.target as HTMLInputElement).value)}
          />
          <ListInput
            label="Nama Artis"
            type="text"
            placeholder="Nama artis"
            value={urlArtist}
            onInput={(e: Event) => (urlArtist = (e.target as HTMLInputElement).value)}
          />
        </List>
        <Block>
          <Button
            type="submit"
            rounded
            large
            class="!bg-[#248a3d] !text-white font-bold dark:!bg-[#30d158] dark:!text-black"
          >
            Simpan URL ke Perpustakaan
          </Button>
        </Block>
      </form>
    {/if}
  </Page>
</Popup>
