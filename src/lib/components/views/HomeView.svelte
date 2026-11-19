<script>
  import { CATEGORIES, SPOTIFY_CHARTS } from '#lib/data/presets.js';
  import { appStore } from '#lib/stores/library.svelte.js';
  import { getTimeGreeting } from '#lib/utils/format.js';
  import Icon from '../Icon.svelte';
  import TrackCard from '../TrackCard.svelte';
</script>

<section class="hero" aria-labelledby="hero-heading">
  <div class="hero-eyebrow">
    nys Xmusic v{appStore.runtimeInfo.version} • {getTimeGreeting()}, {appStore.userProfile.name}
  </div>
  <h1 id="hero-heading">Audio Jernih, Tanpa Kompromi.</h1>
  <p class="hero-desc">
    Ketuk <strong>2x kartu lagu</strong> untuk membalik dan melihat lirik sinkron sesuai irama. Tempel tautan Spotify di Hub Musik untuk deteksi sampul dan artis otomatis.
  </p>
  <div class="hero-actions">
    <button type="button" class="pill-btn primary" onclick={() => (appStore.uploadModalOpen = true)}>
      <Icon name="upload" size={16} />
      <span>Upload MP3 / URL</span>
    </button>
    <button type="button" class="pill-btn spotify" onclick={() => appStore.createBuiltInSynthDemo()}>
      <Icon name="spark" size={16} />
      <span>Putar Lagu Demo (0 KB)</span>
    </button>
    <button type="button" class="pill-btn ghost" onclick={() => (appStore.hubModalOpen = true)}>
      <Icon name="link" size={16} />
      <span>Hub Spotify & YT</span>
    </button>
    <button type="button" class="pill-btn ghost" onclick={() => (appStore.view = 'eq')}>
      <Icon name="eq" size={16} />
      <span>Equalizer</span>
    </button>
  </div>
</section>

{#if appStore.localTracks.length > 0}
  <section class="section" aria-labelledby="offline-heading">
    <div class="section-head">
      <h2 id="offline-heading">Koleksi Offline Kamu ({appStore.localTracks.length})</h2>
      <button
        type="button"
        class="chip"
        onclick={() => {
          appStore.view = 'library';
          appStore.libFilter = 'local';
        }}
      >
        Lihat Semua
      </button>
    </div>
    <div class="grid">
      {#each appStore.localTracks.slice(0, 6) as track (track.id)}
        <TrackCard {track} />
      {/each}
    </div>
  </section>
{/if}

<section class="section" aria-labelledby="genre-heading">
  <div class="section-head">
    <h2 id="genre-heading">Eksplorasi Genre & Suasana</h2>
  </div>
  <div class="category-grid">
    {#each CATEGORIES as cat}
      <button
        type="button"
        class="category-card"
        style="--cat-bg:{cat.bg}; --cat-accent:{cat.accent};"
        onclick={() => appStore.updateSearch(cat.q)}
      >
        <span class="category-title">{cat.label}</span>
        <span class="category-sub">{cat.sub}</span>
      </button>
    {/each}
  </div>
</section>

<section class="section" aria-labelledby="trending-heading">
  <div class="section-head">
    <h2 id="trending-heading">Trending Streaming (Audius Global)</h2>
  </div>
  {#if appStore.loadingHome}
    <p class="text-muted text-sm" role="status">Memuat daftar lagu trending...</p>
  {:else if appStore.trendingTracks.length > 0}
    <div class="grid">
      {#each appStore.trendingTracks.slice(0, 24) as track (track.id)}
        <TrackCard {track} />
      {/each}
    </div>
  {:else}
    <p class="text-muted text-sm">
      Sedang offline atau server streaming tidak terjangkau. Gunakan koleksi offline atau tombol
      <strong>Putar Lagu Demo</strong> di atas.
    </p>
  {/if}
</section>

{#if appStore.ytTracks.length > 0}
  <section class="section" aria-labelledby="yt-heading">
    <div class="section-head">
      <h2 id="yt-heading">Trending YouTube Music Indonesia</h2>
    </div>
    <div class="grid">
      {#each appStore.ytTracks as track (track.id)}
        <TrackCard {track} />
      {/each}
    </div>
  </section>
{/if}

<section class="section" aria-labelledby="charts-heading">
  <div class="section-head">
    <h2 id="charts-heading">Chart Resmi Spotify</h2>
  </div>
  <div class="charts-grid">
    {#each SPOTIFY_CHARTS as chart}
      <iframe
        title={chart.title}
        class="spotify-embed"
        src="https://open.spotify.com/embed/playlist/{chart.id}?theme=0"
        width="100%"
        height="352"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      ></iframe>
    {/each}
  </div>
</section>
