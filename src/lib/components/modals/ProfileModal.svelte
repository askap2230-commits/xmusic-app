<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { Block, BlockTitle, Button, Link, List, ListInput, Navbar, Page, Popup } from 'konsta/svelte';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import Icon from '../Icon.svelte';

  let name = $state<string>('');
  let handle = $state<string>('');
  let bio = $state<string>('');
  let imagePreview = $state<string | null>(null);

  let spotifyClientId = $state<string>('');
  let spotifyClientSecret = $state<string>('');
  let rapidApiKey = $state<string>('');
  let ytApiKey = $state<string>('');

  $effect(() => {
    if (appStore.editProfileOpen) {
      name = appStore.userProfile.name;
      handle = appStore.userProfile.handle;
      bio = appStore.userProfile.bio;
      imagePreview = appStore.userProfile.image;
      spotifyClientId = appStore.apiConfig.spotifyClientId || '';
      spotifyClientSecret = appStore.apiConfig.spotifyClientSecret || '';
      rapidApiKey = appStore.apiConfig.rapidApiKey || '';
      ytApiKey = appStore.apiConfig.ytApiKey || '';
    }
  });

  function onPhotoChange(event: Event): void {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      imagePreview = typeof reader.result === 'string' ? reader.result : null;
    };
    reader.readAsDataURL(file);
  }

  function handleSave(event: SubmitEvent): void {
    event.preventDefault();
    appStore.saveProfileSettings(
      { name, handle, bio, image: imagePreview },
      { spotifyClientId, spotifyClientSecret, rapidApiKey, ytApiKey }
    );
  }
</script>

<Popup
  opened={appStore.editProfileOpen}
  onBackdropClick={() => (appStore.editProfileOpen = false)}
>
  <Page>
    <Navbar title="Profil & API Key">
      {#snippet right()}
        <Link iconOnly onclick={() => (appStore.editProfileOpen = false)} aria-label="Tutup">
          <Icon name="close" size={20} />
        </Link>
      {/snippet}
    </Navbar>

    <form onsubmit={handleSave}>
      <Block class="flex justify-center">
        <label class="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-full border border-black/15 bg-black/5 px-5 text-sm font-semibold text-zinc-950 dark:border-white/20 dark:bg-white/10 dark:text-white">
          Pilih Foto Profil
          <input type="file" accept="image/*" class="sr-only" onchange={onPhotoChange} />
        </label>
      </Block>

      <BlockTitle>Identitas Profil</BlockTitle>
      <List strong inset>
        <ListInput
          label="Nama Tampilan"
          type="text"
          value={name}
          onInput={(e: Event) => (name = (e.target as HTMLInputElement).value)}
        />
        <ListInput
          label="Username"
          type="text"
          value={handle}
          onInput={(e: Event) => (handle = (e.target as HTMLInputElement).value)}
        />
        <ListInput
          label="Bio Singkat"
          type="text"
          value={bio}
          onInput={(e: Event) => (bio = (e.target as HTMLInputElement).value)}
        />
      </List>

      <BlockTitle>Spotify Web API (Sampul HD & Metadata)</BlockTitle>
      <List strong inset>
        <ListInput
          label="Spotify Client ID"
          type="text"
          placeholder="Client ID dari developer.spotify.com"
          value={spotifyClientId}
          onInput={(e: Event) => (spotifyClientId = (e.target as HTMLInputElement).value)}
        />
        <ListInput
          label="Spotify Client Secret"
          type="password"
          placeholder="Client Secret Spotify"
          value={spotifyClientSecret}
          onInput={(e: Event) => (spotifyClientSecret = (e.target as HTMLInputElement).value)}
        />
      </List>

      <BlockTitle>API Tambahan (Opsional)</BlockTitle>
      <List strong inset>
        <ListInput
          label="RapidAPI Key (youtube-mp36)"
          type="password"
          placeholder="Untuk fitur konversi MP3"
          value={rapidApiKey}
          onInput={(e: Event) => (rapidApiKey = (e.target as HTMLInputElement).value)}
        />
        <ListInput
          label="YouTube Data API v3 Key"
          type="password"
          placeholder="AIzaSy..."
          value={ytApiKey}
          onInput={(e: Event) => (ytApiKey = (e.target as HTMLInputElement).value)}
        />
      </List>

      <Block>
        <Button
          type="submit"
          rounded
          large
          class="!bg-[#248a3d] !text-white font-bold dark:!bg-[#30d158] dark:!text-black"
        >
          Simpan Pengaturan
        </Button>
      </Block>
    </form>
  </Page>
</Popup>
