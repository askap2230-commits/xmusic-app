<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script>
  import { Block, Button, Link, List, ListInput, Navbar, Page, Popup } from 'konsta/svelte';
  import { fetchSyncedLyrics } from '#lib/api/services.js';
  import { appStore } from '#lib/stores/library.svelte.js';
  import Icon from '../Icon.svelte';

  let title = $state('');
  let artist = $state('');
  let album = $state('');
  let lyrics = $state('');
  let searchingLrc = $state(false);

  $effect(() => {
    if (appStore.editTrackOpen && appStore.editingTrack) {
      title = appStore.editingTrack.title || '';
      artist = appStore.editingTrack.artist || '';
      album = appStore.editingTrack.album || '';
      lyrics = appStore.editingTrack.lyrics || '';
    }
  });

  async function autoFindLrc() {
    if (!appStore.editingTrack || searchingLrc) return;
    searchingLrc = true;
    const found = await fetchSyncedLyrics(title, artist, appStore.editingTrack.dur || 0);
    searchingLrc = false;
    if (found) {
      lyrics = found;
      appStore.showToast('Lirik LRC ditemukan.');
    } else {
      appStore.showToast('Lirik tidak ditemukan di LRCLIB.');
    }
  }

  function handleSave(event) {
    event.preventDefault();
    appStore.saveEditedTrack({ title, artist, album, lyrics });
  }
</script>

<Popup
  opened={appStore.editTrackOpen && Boolean(appStore.editingTrack)}
  onBackdropClick={() => (appStore.editTrackOpen = false)}
>
  <Page>
    <Navbar title="Edit Detail & Lirik">
      {#snippet right()}
        <Link iconOnly onclick={() => (appStore.editTrackOpen = false)} aria-label="Tutup">
          <Icon name="close" size={20} />
        </Link>
      {/snippet}
    </Navbar>

    <form onsubmit={handleSave}>
      <List strong inset>
        <ListInput
          label="Judul Lagu"
          type="text"
          required
          value={title}
          onInput={(e) => (title = e.target.value)}
        />
        <ListInput
          label="Nama Artis"
          type="text"
          value={artist}
          onInput={(e) => (artist = e.target.value)}
        />
        <ListInput
          label="Album / Kategori"
          type="text"
          value={album}
          onInput={(e) => (album = e.target.value)}
        />
        <ListInput
          label="Lirik LRC ([mm:ss.xx] Baris)"
          type="textarea"
          inputClass="!h-36 resize-y"
          placeholder="[00:12.50] Contoh lirik sinkron..."
          value={lyrics}
          onInput={(e) => (lyrics = e.target.value)}
        />
      </List>

      <Block class="space-y-2.5">
        <Button tonal rounded disabled={searchingLrc} onclick={autoFindLrc}>
          {searchingLrc ? 'Mencari di LRCLIB...' : 'Auto-Cari Lirik LRCLIB'}
        </Button>
        <Button type="submit" rounded large class="!bg-[#248a3d] !text-white font-bold dark:!bg-[#30d158] dark:!text-black">
          Simpan Perubahan
        </Button>
      </Block>
    </form>
  </Page>
</Popup>
