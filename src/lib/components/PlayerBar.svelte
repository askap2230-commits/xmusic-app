<script>
  import { engine } from '#lib/audio/engine.svelte.js';
  import { appStore } from '#lib/stores/library.svelte.js';
  import { formatTime, getTrackInitial } from '#lib/utils/format.js';
  import Icon from './Icon.svelte';

  const progressPct = $derived(
    engine.duration > 0 ? Math.min(100, (engine.position / engine.duration) * 100) : 0
  );

  function handleSeekClick(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width > 0) {
      engine.seekTo((event.clientX - rect.left) / rect.width);
    }
  }

  function handleSeekKeydown(event) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      engine.seekBySeconds(5);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      engine.seekBySeconds(-5);
    }
  }
</script>

<footer class="panel player" aria-label="Pemutar audio">
  <div class="np-left">
    <button
      type="button"
      class="np-track-trigger"
      disabled={!engine.current}
      onclick={() => engine.current && appStore.openTrackModal(engine.current, false)}
      aria-label={engine.current ? `Buka detail ${engine.current.title}` : 'Belum ada lagu diputar'}
    >
      <span
        class="np-art"
        style={engine.current?.imageUrl
          ? ''
          : `background:linear-gradient(135deg,${engine.current?.c1 || '#334155'},${engine.current?.c2 || '#0f172a'})`}
      >
        {#if engine.current?.imageUrl}
          <img src={engine.current.imageUrl} alt="" />
        {:else if engine.current}
          <span class="np-art-initial">{getTrackInitial(engine.current.title)}</span>
        {:else}
          <Icon name="music" size={18} />
        {/if}
      </span>
      <span class="np-meta">
        <span class="np-title">{engine.current?.title || 'Belum ada lagu diputar'}</span>
        <span class="np-artist">{engine.current?.artist || 'Ketuk 2x kartu untuk lirik'}</span>
      </span>
    </button>

    {#if engine.current}
      <button
        type="button"
        class="icon-btn d-only"
        class:liked={appStore.isLiked(engine.current.id)}
        aria-label={appStore.isLiked(engine.current.id) ? 'Hapus dari Favorit' : 'Tambah ke Favorit'}
        aria-pressed={appStore.isLiked(engine.current.id)}
        onclick={() => appStore.toggleLike(engine.current)}
      >
        <Icon name={appStore.isLiked(engine.current.id) ? 'heart-filled' : 'heart'} size={17} />
      </button>
    {/if}
  </div>

  <div class="np-center">
    <div class="controls">
      <button
        type="button"
        class="icon-btn"
        class:active={engine.shuffle}
        aria-label="Mode acak"
        aria-pressed={engine.shuffle}
        onclick={() => engine.toggleShuffle()}
      >
        <Icon name="shuffle" size={16} />
      </button>

      <button
        type="button"
        class="icon-btn"
        aria-label="Lagu sebelumnya"
        onclick={() => engine.prev()}
      >
        <Icon name="prev" size={16} />
      </button>

      <button
        type="button"
        class="play-btn"
        aria-label={engine.playing ? 'Jeda' : 'Putar'}
        onclick={() => engine.togglePlay()}
      >
        <Icon name={engine.playing ? 'pause' : 'play'} size={17} />
      </button>

      <button
        type="button"
        class="icon-btn"
        aria-label="Lagu berikutnya"
        onclick={() => engine.next(false)}
      >
        <Icon name="next" size={16} />
      </button>

      <button
        type="button"
        class="icon-btn repeat-btn"
        class:active={engine.repeat !== 'off'}
        aria-label="Mode ulangi: {engine.repeat}"
        onclick={() => engine.cycleRepeat()}
      >
        <Icon name="repeat" size={16} />
        {#if engine.repeat === 'one'}
          <span class="repeat-badge" aria-hidden="true">1</span>
        {/if}
      </button>
    </div>

    <div class="seek-row">
      <span class="time">{formatTime(engine.position)}</span>
      <div
        class="progress"
        role="slider"
        tabindex="0"
        aria-label="Posisi pemutaran"
        aria-valuemin={0}
        aria-valuemax={Math.round(engine.duration || 100)}
        aria-valuenow={Math.round(engine.position)}
        aria-valuetext="{formatTime(engine.position)} dari {formatTime(engine.duration)}"
        onclick={handleSeekClick}
        onkeydown={handleSeekKeydown}
      >
        <div class="progress-fill" style="width:{progressPct}%"></div>
      </div>
      <span class="time">{formatTime(engine.duration)}</span>
    </div>
  </div>

  <div class="np-right">
    <button
      type="button"
      class="play-btn m-only"
      aria-label={engine.playing ? 'Jeda' : 'Putar'}
      onclick={() => engine.togglePlay()}
    >
      <Icon name={engine.playing ? 'pause' : 'play'} size={16} />
    </button>

    <div class="volume-control d-only">
      <button
        type="button"
        class="icon-btn icon-btn-sm"
        aria-label={engine.muted || engine.volume === 0 ? 'Bunyikan audio' : 'Bisukan audio'}
        onclick={() => engine.toggleMute()}
      >
        <Icon name={engine.muted || engine.volume === 0 ? 'mute' : 'volume'} size={16} />
      </button>
      <input
        type="range"
        class="range-input volume-slider"
        min="0"
        max="1"
        step="0.02"
        aria-label="Volume audio"
        value={engine.muted ? 0 : engine.volume}
        oninput={(e) => engine.setVolume(e.currentTarget.value)}
      />
    </div>

    <button
      type="button"
      class="icon-btn"
      class:active={appStore.npDrawerOpen}
      aria-label="Buka antrean putar dan lirik"
      aria-expanded={appStore.npDrawerOpen}
      onclick={() => (appStore.npDrawerOpen = !appStore.npDrawerOpen)}
    >
      <Icon name="queue" size={18} />
    </button>
  </div>
</footer>
