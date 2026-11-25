<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { Block, BlockTitle, Button, Link, List, ListInput, Navbar, Page, Popup } from 'konsta/svelte';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import Icon from '../Icon.svelte';

  let name = $state<string>('');
  let handle = $state<string>('');
  let bio = $state<string>('');
  let imagePreview = $state<string | null>(null);
  let bannerImagePreview = $state<string | null>(null);
  let bannerVideoPreviewUrl = $state<string | null>(null);
  let bannerVideoFile = $state<File | null>(null);
  let clearBannerVideo = $state<boolean>(false);

  let spotifyClientId = $state<string>('');
  let spotifyClientSecret = $state<string>('');
  let rapidApiKey = $state<string>('');
  let ytApiKey = $state<string>('');
  let pipedInstance = $state<string>('');

  $effect(() => {
    if (appStore.editProfileOpen) {
      name = appStore.userProfile.name;
      handle = appStore.userProfile.handle;
      bio = appStore.userProfile.bio;
      imagePreview = appStore.userProfile.image;
      bannerImagePreview = appStore.userProfile.bannerImage ?? null;
      bannerVideoPreviewUrl = appStore.userProfile.bannerVideoUrl ?? null;
      bannerVideoFile = null;
      clearBannerVideo = false;
      spotifyClientId = appStore.apiConfig.spotifyClientId || '';
      spotifyClientSecret = appStore.apiConfig.spotifyClientSecret || '';
      rapidApiKey = appStore.apiConfig.rapidApiKey || '';
      ytApiKey = appStore.apiConfig.ytApiKey || '';
      pipedInstance = appStore.apiConfig.pipedInstance || '';
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

  function onBannerImageChange(event: Event): void {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      bannerImagePreview = typeof reader.result === 'string' ? reader.result : null;
      clearBannerVideo = true;
      bannerVideoFile = null;
      bannerVideoPreviewUrl = null;
    };
    reader.readAsDataURL(file);
  }

  function onBannerVideoChange(event: Event): void {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    bannerVideoFile = file;
    clearBannerVideo = false;
    bannerVideoPreviewUrl = URL.createObjectURL(file);
  }

  async function handleSave(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    await appStore.saveProfileSettings(
      {
        name,
        handle,
        bio,
        image: imagePreview,
        bannerImage: bannerImagePreview,
        bannerVideoUrl: bannerVideoPreviewUrl
      },
      { spotifyClientId, spotifyClientSecret, rapidApiKey, ytApiKey, pipedInstance },
      bannerVideoFile,
      clearBannerVideo
    );
  }
</script>

<Popup
  opened={appStore.editProfileOpen}
  onBackdropClick={() => (appStore.editProfileOpen = false)}
>
  <Page>
    <Navbar title="Profil, Banner & API Key">
      {#snippet right()}
        <Link iconOnly onclick={() => (appStore.editProfileOpen = false)} aria-label="Tutup">
          <Icon name="close" size={20} />
        </Link>
      {/snippet}
    </Navbar>

    <form onsubmit={handleSave}>
      <BlockTitle>Banner Video & Foto Sampul Profil (TikTok Mod Style)</BlockTitle>
      <Block class="space-y-3">
        <div class="relative h-36 w-full overflow-hidden rounded-2xl border border-black/15 bg-zinc-900 dark:border-white/15">
          {#if bannerVideoPreviewUrl}
            <video src={bannerVideoPreviewUrl} autoplay muted loop playsinline class="h-full w-full object-cover"></video>
          {:else if bannerImagePreview}
            <img src={bannerImagePreview} alt="Preview Banner" class="h-full w-full object-cover" />
          {:else}
            <div class="grid h-full w-full place-items-center text-xs font-semibold text-white/60">
              Belum ada banner video / gambar kustom
            </div>
          {/if}
        </div>

        <div class="flex flex-wrap justify-center gap-2">
          <label class="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-full bg-[#007aff] px-4 text-xs font-bold text-white">
            <Icon name="video" size={14} />
            <span>Pasang Video Banner (MP4)</span>
            <input type="file" accept="video/mp4,video/webm,video/*" class="sr-only" onchange={onBannerVideoChange} />
          </label>

          <label class="inline-flex min-h-[40px] cursor-pointer items-center justify-center rounded-full border border-black/15 bg-black/5 px-4 text-xs font-semibold text-zinc-950 dark:border-white/20 dark:bg-white/10 dark:text-white">
            Foto Banner
            <input type="file" accept="image/*" class="sr-only" onchange={onBannerImageChange} />
          </label>

          <label class="inline-flex min-h-[40px] cursor-pointer items-center justify-center rounded-full border border-black/15 bg-black/5 px-4 text-xs font-semibold text-zinc-950 dark:border-white/20 dark:bg-white/10 dark:text-white">
            Foto Profil
            <input type="file" accept="image/*" class="sr-only" onchange={onPhotoChange} />
          </label>
        </div>
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
        <ListInput
          label="Custom Piped Instance URL (Opsional)"
          type="url"
          placeholder="https://pipedapi.kavin.rocks (otomatis jika kosong)"
          value={pipedInstance}
          onInput={(e: Event) => (pipedInstance = (e.target as HTMLInputElement).value)}
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
