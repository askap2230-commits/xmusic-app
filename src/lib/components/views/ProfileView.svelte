<script>
  import { appStore } from '#lib/stores/library.svelte.js';
  import { getTrackInitial } from '#lib/utils/format.js';
  import Icon from '../Icon.svelte';

  const hasSpotifyApi = $derived(
    Boolean(appStore.apiConfig.spotifyClientId && appStore.apiConfig.spotifyClientSecret)
  );
</script>

<section class="hero profile-hero" aria-labelledby="profile-heading">
  <div
    class="profile-avatar"
    class:has-image={Boolean(appStore.userProfile.image)}
    style={appStore.userProfile.image ? `background-image:url(${appStore.userProfile.image})` : ''}
    aria-hidden="true"
  >
    {appStore.userProfile.image ? '' : getTrackInitial(appStore.userProfile.name)}
  </div>

  <div class="profile-info">
    <h1 id="profile-heading">{appStore.userProfile.name}</h1>
    <div class="text-accent text-sm fw-semibold">{appStore.userProfile.handle}</div>
    <p class="hero-desc">{appStore.userProfile.bio}</p>
    <div class="hero-actions">
      <button type="button" class="pill-btn primary" onclick={() => (appStore.editProfileOpen = true)}>
        <Icon name="key" size={16} />
        <span>Edit Profil & API Key</span>
      </button>
      <button type="button" class="pill-btn ghost" onclick={() => (appStore.view = 'eq')}>
        <Icon name="eq" size={16} />
        <span>Pengaturan Equalizer</span>
      </button>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="system-heading">
  <div class="section-head">
    <h2 id="system-heading">Status API & Informasi Sistem</h2>
  </div>

  <div class="stats-grid">
    <div class="surface-card stat-card">
      <div class="text-muted text-xs">Spotify Web API v1</div>
      <div class="stat-value" class:text-spotify={hasSpotifyApi} class:text-amber={!hasSpotifyApi}>
        {hasSpotifyApi ? 'API Key Terpasang' : 'Mode Fallback (oEmbed)'}
      </div>
      <p class="text-muted text-xs">
        Klik "Edit Profil & API Key" untuk mengisi Spotify Client ID dan Client Secret.
      </p>
    </div>

    <div class="surface-card stat-card">
      <div class="text-muted text-xs">Koleksi & Playlist</div>
      <div class="stat-value">
        {appStore.localTracks.length} Lagu • {appStore.likedIds.length} Favorit
      </div>
      <p class="text-muted text-xs">
        {appStore.playlists.length} playlist tersimpan lokal di perangkat.
      </p>
    </div>

    <div class="surface-card stat-card">
      <div class="text-muted text-xs">Mesin Aplikasi</div>
      <div class="stat-value text-accent">{appStore.runtimeInfo.engine}</div>
      <p class="text-muted text-xs">
        Versi {appStore.runtimeInfo.version} Production ({appStore.runtimeInfo.platform} / {appStore.runtimeInfo.arch})
      </p>
    </div>
  </div>
</section>
