<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import {
    Badge,
    Block,
    BlockTitle,
    Button,
    Link,
    List,
    ListInput,
    ListItem,
    Navbar,
    Page,
    Popup
  } from 'konsta/svelte';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import Icon from '../Icon.svelte';

  let newName = $state<string>('');

  function closeModal(): void {
    appStore.playlistModalOpen = false;
    appStore.targetTrackForPlaylist = null;
  }

  function handleCreate(event: SubmitEvent): void {
    event.preventDefault();
    if (appStore.createPlaylist(newName)) {
      newName = '';
    }
  }
</script>

<Popup opened={appStore.playlistModalOpen} onBackdropClick={closeModal}>
  <Page>
    <Navbar title="Kelola Playlist">
      {#snippet right()}
        <Link iconOnly onclick={closeModal} aria-label="Tutup">
          <Icon name="close" size={20} />
        </Link>
      {/snippet}
    </Navbar>

    {#if appStore.targetTrackForPlaylist}
      <BlockTitle>Pilih Playlist untuk "{appStore.targetTrackForPlaylist.title}"</BlockTitle>
      <List strong inset>
        {#each appStore.playlists as pl (pl.id)}
          {@const inPlaylist = pl.trackIds.includes(appStore.targetTrackForPlaylist.id)}
          <ListItem
            link
            title={pl.name}
            subtitle="{pl.trackIds.length} lagu"
            onclick={() => appStore.toggleTrackInPlaylist(pl.id, appStore.targetTrackForPlaylist)}
          >
            {#snippet after()}
              <Badge
                class={inPlaylist
                  ? 'bg-[#248a3d] text-white font-bold dark:bg-[#30d158] dark:!text-black'
                  : 'bg-black/10 text-zinc-900 dark:bg-white/15 dark:text-white'}
              >
                {inPlaylist ? 'Terdaftar' : '+ Tambah'}
              </Badge>
            {/snippet}
          </ListItem>
        {/each}
      </List>
    {/if}

    <BlockTitle>Buat Playlist Baru</BlockTitle>
    <form onsubmit={handleCreate}>
      <List strong inset>
        <ListInput
          label="Nama Playlist"
          type="text"
          placeholder="Contoh: Fokus Kerja / Senja"
          value={newName}
          onInput={(e: Event) => (newName = (e.target as HTMLInputElement).value)}
        />
      </List>
      <Block>
        <Button type="submit" rounded large>Buat Playlist</Button>
      </Block>
    </form>
  </Page>
</Popup>
