<script>
  import { appStore } from '#lib/stores/library.svelte.js';

  let name = $state('');
  let handle = $state('');
  let bio = $state('');
  let imagePreview = $state(null);

  let spotifyClientId = $state('');
  let spotifyClientSecret = $state('');
  let rapidApiKey = $state('');
  let ytApiKey = $state('');

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

  function onPhotoChange(event) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      imagePreview = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function handleSave(event) {
    event.preventDefault();
    appStore.saveProfileSettings(
      { name, handle, bio, image: imagePreview },
      { spotifyClientId, spotifyClientSecret, rapidApiKey, ytApiKey }
    );
  }
</script>

{#if appStore.editProfileOpen}
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
    <div class="modal-backdrop" onclick={() => (appStore.editProfileOpen = false)} role="presentation"></div>
    <div class="modal-card">
      <h2 id="profile-modal-title" class="modal-title">Edit Profil & Konfigurasi API</h2>

      <form onsubmit={handleSave}>
        <div class="avatar-picker-row">
          <label class="pill-btn ghost pill-btn-sm">
            <span>Pilih Foto Profil</span>
            <input type="file" accept="image/*" class="sr-only" onchange={onPhotoChange} />
          </label>
        </div>

        <div class="field-group">
          <label class="field-label" for="pr-name">Nama Tampilan</label>
          <input id="pr-name" class="field-input" type="text" bind:value={name} />
        </div>
        <div class="field-group">
          <label class="field-label" for="pr-handle">Username</label>
          <input id="pr-handle" class="field-input" type="text" bind:value={handle} />
        </div>
        <div class="field-group">
          <label class="field-label" for="pr-bio">Bio Singkat</label>
          <input id="pr-bio" class="field-input" type="text" bind:value={bio} />
        </div>

        <h3 class="form-section-title text-spotify">Spotify Web API (Sampul HD, Judul & Artis)</h3>
        <div class="field-group">
          <label class="field-label" for="api-sp-id">Spotify Client ID</label>
          <input
            id="api-sp-id"
            class="field-input"
            type="text"
            placeholder="Client ID dari developer.spotify.com"
            bind:value={spotifyClientId}
          />
        </div>
        <div class="field-group">
          <label class="field-label" for="api-sp-sec">Spotify Client Secret</label>
          <input
            id="api-sp-sec"
            class="field-input"
            type="password"
            placeholder="Client Secret Spotify"
            bind:value={spotifyClientSecret}
          />
        </div>

        <h3 class="form-section-title text-accent">API Tambahan (YouTube & Downloader)</h3>
        <div class="field-group">
          <label class="field-label" for="api-rapid">RapidAPI Key (youtube-mp36)</label>
          <input
            id="api-rapid"
            class="field-input"
            type="password"
            placeholder="Opsional — untuk fitur konversi MP3"
            bind:value={rapidApiKey}
          />
        </div>
        <div class="field-group">
          <label class="field-label" for="api-yt">YouTube Data API v3 Key (Opsional)</label>
          <input
            id="api-yt"
            class="field-input"
            type="password"
            placeholder="AIzaSy..."
            bind:value={ytApiKey}
          />
        </div>

        <div class="modal-actions-row">
          <button type="button" class="pill-btn ghost flex-1" onclick={() => (appStore.editProfileOpen = false)}>
            Batal
          </button>
          <button type="submit" class="pill-btn spotify flex-1">Simpan Pengaturan</button>
        </div>
      </form>
    </div>
  </div>
{/if}
