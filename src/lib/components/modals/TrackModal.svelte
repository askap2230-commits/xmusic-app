<script>
  import { engine } from '#lib/audio/engine.svelte.js';
  import { parseLrcLyrics } from '#lib/api/services.js';
  import { EQ_PRESETS } from '#lib/data/presets.js';
  import { appStore } from '#lib/stores/library.svelte.js';
  import { findActiveLyricIndex, formatTime, getTrackInitial } from '#lib/utils/format.js';
  import Icon from '../Icon.svelte';

  let vizCanvas = $state(null);
  let lyricsScrollEl = $state(null);

  const track = $derived(appStore.activeModalTrack);
  const parsedLyrics = $derived(track ? parseLrcLyrics(track.lyrics || '') : []);
  const activeLyricIdx = $derived(
    track && engine.current?.id === track.id
      ? findActiveLyricIndex(parsedLyrics, engine.position)
      : -1
  );
  const progressPct = $derived(
    engine.duration > 0 ? Math.min(100, (engine.position / engine.duration) * 100) : 0
  );

  // Auto-scroll active synced lyric line when card is flipped
  $effect(() => {
    if (appStore.modalFlipped && activeLyricIdx >= 0 && lyricsScrollEl) {
      const target = lyricsScrollEl.querySelector(`[data-lrc-idx="${activeLyricIdx}"]`);
      if (target) {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      }
    }
  });

  // 60fps FFT visualizer loop that automatically stops when closed, hidden, or reduced-motion
  $effect(() => {
    if (!appStore.trackModalOpen || !vizCanvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let rafId = 0;
    const render = (now) => {
      if (!appStore.trackModalOpen || !vizCanvas) return;
      if (!document.hidden && !appStore.modalFlipped) {
        const ctx = vizCanvas.getContext('2d');
        const w = vizCanvas.clientWidth || 320;
        const h = vizCanvas.clientHeight || 480;
        if (vizCanvas.width !== w || vizCanvas.height !== h) {
          vizCanvas.width = w;
          vizCanvas.height = h;
        }
        ctx.clearRect(0, 0, w, h);
        const bars = engine.getSpectrum(28, now);
        const barWidth = w / bars.length;
        for (let i = 0; i < bars.length; i++) {
          const val = bars[i];
          const barHeight = Math.max(3, val * (h * 0.24));
          ctx.fillStyle = `rgba(125, 211, 252, ${0.12 + val * 0.34})`;
          ctx.fillRect(i * barWidth + 2, h - barHeight, Math.max(2, barWidth - 4), barHeight);
        }
      }
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  });

  function handleDoubleTap(event) {
    if (event.target.closest('button, input, textarea, .progress, .lyric-line')) return;
    appStore.toggleModalFlip();
  }

  function handleSeekClick(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width > 0) {
      engine.seekTo((event.clientX - rect.left) / rect.width);
    }
  }
</script>

{#if appStore.trackModalOpen && track}
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="track-modal-title">
    <div class="modal-backdrop" onclick={() => appStore.closeTrackModal()} role="presentation"></div>

    <div class="flip-scene">
      <div class="flip-inner" class:is-flipped={appStore.modalFlipped} ondblclick={handleDoubleTap}>
        <!-- FRONT FACE -->
        <div class="track-card flip-face" aria-hidden={appStore.modalFlipped}>
          <div
            class="tc-bg-tint"
            style={track.imageUrl
              ? `background-image:url(${track.imageUrl})`
              : `background:linear-gradient(135deg,${track.c1 || '#3b82f6'},${track.c2 || '#172554'})`}
            aria-hidden="true"
          ></div>
          <canvas class="tc-viz" bind:this={vizCanvas} aria-hidden="true"></canvas>

          <div class="tc-content">
            <div class="tc-topbar">
              <span class="tc-hint">Ketuk 2x Kartu → Lirik Sinkron</span>
              <div class="row-gap-xs">
                <button
                  type="button"
                  class="icon-btn icon-btn-overlay"
                  aria-label="Balik kartu ke lirik"
                  onclick={() => appStore.toggleModalFlip()}
                >
                  <Icon name="flip" size={15} />
                </button>
                <button
                  type="button"
                  class="icon-btn icon-btn-overlay"
                  aria-label="Tambahkan ke playlist"
                  onclick={() => {
                    appStore.targetTrackForPlaylist = track;
                    appStore.playlistModalOpen = true;
                  }}
                >
                  <Icon name="folder" size={15} />
                </button>
                <button
                  type="button"
                  class="icon-btn icon-btn-overlay"
                  class:liked={appStore.isLiked(track.id)}
                  aria-label={appStore.isLiked(track.id) ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                  aria-pressed={appStore.isLiked(track.id)}
                  onclick={() => appStore.toggleLike(track)}
                >
                  <Icon name={appStore.isLiked(track.id) ? 'heart-filled' : 'heart'} size={15} />
                </button>
                <button
                  type="button"
                  class="icon-btn icon-btn-overlay"
                  aria-label="Tutup pemutar"
                  onclick={() => appStore.closeTrackModal()}
                >
                  <Icon name="close" size={15} />
                </button>
              </div>
            </div>

            {#if track.videoId}
              <div class="tc-embed-video">
                <iframe
                  title={track.title}
                  width="100%"
                  height="100%"
                  src="https://www.youtube.com/embed/{track.videoId}?autoplay=1&playsinline=1&rel=0"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowfullscreen
                ></iframe>
              </div>
            {:else if track.spotifyId}
              <div class="tc-embed-spotify">
                <iframe
                  title={track.title}
                  src="https://open.spotify.com/embed/{track.spotifyType || 'track'}/{track.spotifyId}?theme=0"
                  width="100%"
                  height="152"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                ></iframe>
              </div>
            {:else}
              <div
                class="tc-cover-wrapper"
                style={track.imageUrl
                  ? ''
                  : `background:linear-gradient(135deg,${track.c1 || '#3b82f6'},${track.c2 || '#172554'})`}
              >
                {#if track.imageUrl}
                  <img src={track.imageUrl} alt="Sampul {track.title}" />
                {:else}
                  <span class="local-cover-text local-cover-lg">{getTrackInitial(track.title)}</span>
                {/if}
              </div>
            {/if}

            <h2 id="track-modal-title" class="tc-title">{track.title}</h2>
            <div class="tc-artist">{track.artist}</div>

            {#if !track.videoId && !track.spotifyId}
              <div class="tc-seek-block">
                <div class="tc-time-row">
                  <span>{formatTime(engine.position)}</span>
                  <span>-{formatTime(Math.max(0, (engine.duration || 0) - engine.position))}</span>
                </div>
                <div
                  class="progress progress-lg"
                  role="slider"
                  tabindex="0"
                  aria-label="Posisi lagu"
                  aria-valuemin={0}
                  aria-valuemax={Math.round(engine.duration || 100)}
                  aria-valuenow={Math.round(engine.position)}
                  onclick={handleSeekClick}
                  onkeydown={(e) => {
                    if (e.key === 'ArrowRight') engine.seekBySeconds(5);
                    if (e.key === 'ArrowLeft') engine.seekBySeconds(-5);
                  }}
                >
                  <div class="progress-fill" style="width:{progressPct}%"></div>
                </div>
              </div>

              <div class="tc-controls">
                <button
                  type="button"
                  class="icon-btn"
                  class:active={engine.shuffle}
                  aria-label="Mode acak"
                  aria-pressed={engine.shuffle}
                  onclick={() => engine.toggleShuffle()}
                >
                  <Icon name="shuffle" size={18} />
                </button>
                <button type="button" class="icon-btn" aria-label="Lagu sebelumnya" onclick={() => engine.prev()}>
                  <Icon name="prev" size={18} />
                </button>
                <button
                  type="button"
                  class="play-btn play-btn-lg"
                  aria-label={engine.playing ? 'Jeda' : 'Putar'}
                  onclick={() => engine.togglePlay()}
                >
                  <Icon name={engine.playing ? 'pause' : 'play'} size={22} />
                </button>
                <button type="button" class="icon-btn" aria-label="Lagu berikutnya" onclick={() => engine.next(false)}>
                  <Icon name="next" size={18} />
                </button>
                <button
                  type="button"
                  class="icon-btn repeat-btn"
                  class:active={engine.repeat !== 'off'}
                  aria-label="Mode ulangi: {engine.repeat}"
                  onclick={() => engine.cycleRepeat()}
                >
                  <Icon name="repeat" size={18} />
                  {#if engine.repeat === 'one'}
                    <span class="repeat-badge" aria-hidden="true">1</span>
                  {/if}
                </button>
              </div>

              <div class="tc-volume-row">
                <Icon name="mute" size={15} />
                <input
                  type="range"
                  class="range-input flex-1"
                  min="0"
                  max="1"
                  step="0.02"
                  aria-label="Volume"
                  value={engine.volume}
                  oninput={(e) => engine.setVolume(e.currentTarget.value)}
                />
                <Icon name="volume" size={15} />
              </div>
            {/if}

            <div class="tc-footer-chips">
              <button type="button" class="chip" onclick={() => appStore.toggleModalFlip()}>
                <Icon name="flip" size={13} />
                <span>Lirik Sinkron</span>
              </button>
              <button
                type="button"
                class="chip"
                onclick={() => {
                  appStore.closeTrackModal();
                  appStore.view = 'eq';
                }}
              >
                <Icon name="eq" size={13} />
                <span>{EQ_PRESETS[engine.eqPreset]?.name || 'Custom'}</span>
              </button>
              {#if track.videoId}
                <button
                  type="button"
                  class="chip chip-spotify"
                  onclick={() => {
                    appStore.closeTrackModal();
                    appStore.openDownloaderWithUrl(`https://youtu.be/${track.videoId}`);
                  }}
                >
                  <Icon name="download" size={13} />
                  <span>Unduh MP3</span>
                </button>
              {/if}
            </div>
          </div>
        </div>

        <!-- BACK FACE (SYNCED LYRICS) -->
        <div class="track-card flip-face flip-face-back" aria-hidden={!appStore.modalFlipped}>
          <div class="tc-back-head">
            <div class="min-w-0">
              <div class="truncate fw-bold">{track.title}</div>
              <div class="text-accent text-xs truncate">{track.artist} • Lirik Sinkron</div>
            </div>
            <div class="row-gap-xs">
              <button
                type="button"
                class="icon-btn icon-btn-overlay"
                aria-label="Cari lirik otomatis di LRCLIB"
                onclick={() => appStore.autoFetchLyricsForTrack(track)}
              >
                <Icon name="search" size={15} />
              </button>
              <button
                type="button"
                class="icon-btn icon-btn-overlay"
                aria-label="Edit atau tempel lirik"
                onclick={() => appStore.openEditTrack(track)}
              >
                <Icon name="edit" size={15} />
              </button>
              <button
                type="button"
                class="icon-btn icon-btn-overlay"
                aria-label="Balik ke sampul depan"
                onclick={() => appStore.toggleModalFlip()}
              >
                <Icon name="flip" size={15} />
              </button>
            </div>
          </div>

          <div class="lyrics-scroll" bind:this={lyricsScrollEl}>
            {#if appStore.fetchingLyrics}
              <p class="lyrics-status" role="status">Mencari lirik sinkron dari LRCLIB...</p>
            {:else if parsedLyrics.length > 0}
              {#each parsedLyrics as line, idx}
                <button
                  type="button"
                  class="lyric-line"
                  class:active={idx === activeLyricIdx}
                  data-lrc-idx={idx}
                  onclick={() => {
                    if (line.synced && engine.duration > 0 && engine.current?.id === track.id) {
                      engine.seekTo(line.time / engine.duration);
                    }
                  }}
                >
                  {#if line.synced}
                    <span class="lyric-ts">{formatTime(line.time)}</span>
                  {/if}
                  <span>{line.text}</span>
                </button>
              {/each}
            {:else}
              <div class="lyrics-empty">
                <p>Belum ada lirik untuk lagu ini.</p>
                <button
                  type="button"
                  class="pill-btn spotify pill-btn-sm"
                  onclick={() => appStore.autoFetchLyricsForTrack(track)}
                >
                  <Icon name="search" size={14} />
                  <span>Cari Lirik Sinkron Otomatis</span>
                </button>
              </div>
            {/if}
          </div>

          <div class="tc-back-foot">
            <span class="text-muted text-xs">
              {formatTime(engine.position)} / {formatTime(engine.duration)}
            </span>
            <button type="button" class="chip" onclick={() => appStore.toggleModalFlip()}>
              <Icon name="flip" size={13} />
              <span>Kembali ke Sampul</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
