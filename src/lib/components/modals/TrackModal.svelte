<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { Button, Card, Link, Navbar, Page, Popup, Preloader, Range } from 'konsta/svelte';
  import { engine } from '#lib/audio/engine.svelte.ts';
  import { parseLrcLyrics } from '#lib/api/services.ts';
  import { EQ_PRESETS } from '#lib/data/presets.ts';
  import { i18n } from '#lib/i18n/index.svelte.ts';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import { findActiveLyricIndex, formatTime, getTrackInitial } from '#lib/utils/format.ts';
  import Icon from '../Icon.svelte';

  let vizCanvas = $state<HTMLCanvasElement | null>(null);
  let lyricsScrollEl = $state<HTMLDivElement | null>(null);
  let imgFailed = $state<boolean>(false);
  let showVideoFallback = $state<boolean>(false);
  let artTransitionKey = $state<number>(0);
  let manualScrollUntil = 0;

  function pauseAutoScroll(): void {
    manualScrollUntil = Date.now() + 4500;
  }

  const track = $derived(appStore.activeModalTrack);
  const parsedLyrics = $derived(track ? parseLrcLyrics(track.lyrics || '') : []);
  const activeLyricIdx = $derived(
    track && engine.current?.id === track.id
      ? findActiveLyricIndex(parsedLyrics, engine.position)
      : -1
  );

  $effect(() => {
    const active = track;
    void active?.id;
    imgFailed = false;
    showVideoFallback = false;
    artTransitionKey += 1;
    if (appStore.trackModalOpen && appStore.modalFlipped && active && !active.lyrics) {
      void appStore.autoFetchLyricsForTrack(active);
    }
  });

  $effect(() => {
    if (!appStore.modalFlipped || activeLyricIdx < 0 || !lyricsScrollEl) return;
    if (Date.now() < manualScrollUntil) return;
    const target = lyricsScrollEl.querySelector<HTMLElement>(`[data-lrc-idx="${activeLyricIdx}"]`);
    if (!target) return;
    const containerRect = lyricsScrollEl.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const targetTop =
      lyricsScrollEl.scrollTop +
      (targetRect.top - containerRect.top) -
      (lyricsScrollEl.clientHeight - targetRect.height) / 2;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    lyricsScrollEl.scrollTo({
      top: Math.max(0, targetTop),
      behavior: reduced ? 'auto' : 'smooth'
    });
  });

  // Throttled 30fps visualizer confined to its own clean strip (0% CPU when paused)
  $effect(() => {
    if (!appStore.trackModalOpen || !vizCanvas || !engine.playing || appStore.modalFlipped) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let rafId = 0;
    let lastDraw = 0;
    const render = (now: number): void => {
      if (!appStore.trackModalOpen || !vizCanvas || !engine.playing || appStore.modalFlipped) return;
      if (!document.hidden && now - lastDraw >= 33) {
        lastDraw = now;
        const ctx = vizCanvas.getContext('2d');
        if (ctx) {
          const w = vizCanvas.clientWidth || 260;
          const h = vizCanvas.clientHeight || 20;
          if (vizCanvas.width !== w || vizCanvas.height !== h) {
            vizCanvas.width = w;
            vizCanvas.height = h;
          }
          ctx.clearRect(0, 0, w, h);
          const bars = engine.getSpectrum(28, now);
          const barWidth = w / bars.length;
          for (let i = 0; i < bars.length; i++) {
            const val = bars[i];
            const barHeight = Math.max(3, val * h);
            ctx.fillStyle = `rgba(100, 210, 255, ${0.45 + val * 0.55})`;
            ctx.fillRect(i * barWidth + 1.5, h - barHeight, Math.max(2, barWidth - 3), barHeight);
          }
        }
      }
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  });

  function handleDoubleTap(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, input, textarea, .lyric-line')) return;
    appStore.toggleModalFlip();
  }

  function handleStopAndClose(): void {
    engine.stopTrack();
    appStore.closeTrackModal();
  }
</script>

<Popup
  opened={appStore.trackModalOpen && Boolean(track)}
  onBackdropClick={() => appStore.closeTrackModal()}
>
  {#if track}
    <Page>
      <Navbar title={appStore.modalFlipped ? i18n.t('player.syncedLyrics') : i18n.t('player.nowPlaying')}>
        {#snippet left()}
          <Link iconOnly onclick={() => appStore.toggleModalFlip()} aria-label="Balik kartu lirik">
            <Icon name="flip" size={20} />
          </Link>
        {/snippet}
        {#snippet right()}
          <Link iconOnly onclick={() => appStore.closeTrackModal()} aria-label="Tutup jendela pemutar">
            <Icon name="close" size={20} />
          </Link>
        {/snippet}
      </Navbar>

      <div class="mx-auto w-full max-w-md px-4 pt-2 pb-6">
        <div class="xmusic-flip-scene">
          <div
            role="presentation"
            class="xmusic-flip-inner"
            class:is-flipped={appStore.modalFlipped}
            ondblclick={handleDoubleTap}
          >
            <!-- FRONT FACE: FULL-BLEED ARTWORK OVERLAY CARD WITH SMOOTH TRANSITION FOR ALL TRACKS -->
            <div class="xmusic-flip-face" aria-hidden={appStore.modalFlipped}>
              <Card
                contentWrap={false}
                class="!m-0 overflow-hidden rounded-3xl border border-black/15 shadow-2xl dark:border-white/15"
              >
                <div class="relative flex min-h-[540px] flex-col justify-between overflow-hidden bg-zinc-950 text-white">
                  <!-- Full-Card Cover Artwork Layer (fills 100% of card with smooth crossfade/scale transition) -->
                  {#key artTransitionKey}
                    <div
                      class="xmusic-art-transition pointer-events-none absolute inset-0"
                      style={track.imageUrl && !imgFailed
                        ? ''
                        : `background: linear-gradient(155deg, ${track.c1 || '#007aff'} 0%, ${track.c2 || '#111827'} 65%, #09090b 100%)`}
                    >
                      {#if track.imageUrl && !imgFailed}
                        <img
                          src={track.imageUrl}
                          alt="Sampul {track.title}"
                          class="h-full w-full object-cover object-center transition-transform duration-700 ease-out {engine.playing && engine.current?.id === track.id
                            ? 'scale-[1.03]'
                            : 'scale-100'}"
                          onerror={() => (imgFailed = true)}
                        />
                      {:else}
                        <div class="flex h-full w-full items-start justify-center pt-16">
                          <span class="text-8xl font-black tracking-tight text-white/30 select-none">
                            {getTrackInitial(track.title)}
                          </span>
                        </div>
                      {/if}
                    </div>
                  {/key}

                  <!-- Legibility Scrim Overlay (top subtle vignette + bottom rich dark gradient for WCAG contrast) -->
                  <div
                    class="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-black/25 to-black/95"
                    aria-hidden="true"
                  ></div>

                  <!-- Top Overlay Row (Video fallback or Spotify quick badge + double-tap hint) -->
                  <div class="relative z-10 flex flex-col gap-2 p-4">
                    {#if showVideoFallback && track.videoId && appStore.isOnline}
                      <div class="aspect-video w-full overflow-hidden rounded-2xl border border-white/15 bg-black shadow-lg">
                        <iframe
                          title={track.title}
                          class="h-full w-full border-0"
                          src="https://www.youtube.com/embed/{track.videoId}?autoplay=1&playsinline=1&rel=0"
                          allow="autoplay; encrypted-media; picture-in-picture"
                          allowfullscreen
                        ></iframe>
                      </div>
                    {:else}
                      <div class="flex items-center justify-between gap-2">
                        <span class="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white/90">
                          {track.album || (track.source === 'youtube' ? 'YouTube Music' : 'nys Xmusic')}
                        </span>
                        {#if track.releaseYear}
                          <span class="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white/90">
                            {track.releaseYear}
                          </span>
                        {/if}
                      </div>
                    {/if}
                  </div>

                  <!-- Bottom Overlay Controls Panel (Docked cleanly over full-bleed cover) -->
                  <div class="relative z-10 mt-auto flex flex-col gap-3 p-5 pt-24">
                    {#if track.spotifyId}
                      <div class="flex flex-col items-center gap-2.5 rounded-2xl border border-white/15 bg-black/55 p-4 text-center">
                        <p class="text-xs text-white/85">
                          {i18n.t('player.spotifyNativeDesc')}
                        </p>
                        <Button
                          rounded
                          small
                          inline
                          class="!bg-[#30d158] !text-black font-bold"
                          onclick={() => appStore.findFullVersion(track)}
                        >
                          {i18n.t('player.playFullInApp')}
                        </Button>
                      </div>
                    {:else if !showVideoFallback}
                      <div class="h-[20px] w-full">
                        <canvas
                          class="h-full w-full"
                          bind:this={vizCanvas}
                          aria-hidden="true"
                        ></canvas>
                      </div>
                    {/if}

                    <!-- Audio stream resolving / fallback notice -->
                    {#if engine.resolvingAudio && engine.current?.id === track.id}
                      <div class="flex items-center justify-center gap-2 rounded-xl bg-black/55 px-3 py-2 text-xs font-medium text-[#64d2ff]" role="status">
                        <Preloader class="w-4 h-4" />
                        <span>{i18n.t('player.resolvingAudio')}</span>
                      </div>
                    {:else if engine.audioResolveFailed && track.videoId && !showVideoFallback && engine.current?.id === track.id}
                      <div class="flex flex-col items-center gap-2 rounded-xl bg-black/65 px-3 py-2.5 text-center">
                        <span class="text-xs font-medium text-white/90">
                          {i18n.t('player.audioFailed')}
                        </span>
                        <div class="flex flex-wrap justify-center gap-2">
                          <Button tonal rounded small inline onclick={() => engine.retryYoutubeAudio()}>
                            {i18n.t('player.retryAudio')}
                          </Button>
                          <Button tonal rounded small inline onclick={() => (showVideoFallback = true)}>
                            {i18n.t('player.videoFallback')}
                          </Button>
                        </div>
                      </div>
                    {/if}

                    <!-- Title, Artist & Favorite Button -->
                    <div class="flex items-center justify-between gap-3">
                      <div class="min-w-0 flex-1">
                        <h2 class="truncate text-xl font-bold tracking-tight text-white">
                          {track.title}
                        </h2>
                        <p class="truncate text-sm font-medium text-white/75">
                          {track.artist}
                        </p>
                      </div>
                      <button
                        type="button"
                        class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15 active:scale-95 {appStore.isLiked(track.id)
                          ? 'text-[#ff375f]'
                          : 'text-white'}"
                        aria-label={appStore.isLiked(track.id) ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                        aria-pressed={appStore.isLiked(track.id)}
                        onclick={() => appStore.toggleLike(track)}
                      >
                        <Icon name={appStore.isLiked(track.id) ? 'heart-filled' : 'heart'} size={18} />
                      </button>
                    </div>

                    {#if !showVideoFallback && !track.spotifyId}
                      <!-- Seekbar & Time -->
                      <div class="space-y-1">
                        <Range
                          min={0}
                          max={Math.max(1, Math.round(engine.duration || 100))}
                          step={1}
                          value={Math.round(engine.position)}
                          onInput={(e: Event) => {
                            const d = engine.duration || 1;
                            engine.seekTo(Number((e.target as HTMLInputElement).value) / d);
                          }}
                        />
                        <div class="flex justify-between text-xs font-medium tabular-nums text-white/75">
                          <span>{formatTime(engine.position)}</span>
                          <span>-{formatTime(Math.max(0, (engine.duration || 0) - engine.position))}</span>
                        </div>
                      </div>

                      <!-- Primary Transport Controls -->
                      <div class="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          class="grid h-11 w-11 place-items-center rounded-full active:scale-95 {engine.shuffle
                            ? 'text-[#64d2ff]'
                            : 'text-white/70'}"
                          aria-label="Mode acak"
                          aria-pressed={engine.shuffle}
                          onclick={() => engine.toggleShuffle()}
                        >
                          <Icon name="shuffle" size={19} />
                        </button>

                        <button
                          type="button"
                          class="grid h-11 w-11 place-items-center rounded-full text-white active:scale-95"
                          aria-label="Lagu sebelumnya"
                          onclick={() => engine.prev()}
                        >
                          <Icon name="prev" size={20} />
                        </button>

                        <button
                          type="button"
                          class="grid h-14 w-14 place-items-center rounded-full bg-white text-black shadow-lg active:scale-95"
                          aria-label={engine.current?.id === track.id && engine.playing ? 'Jeda' : 'Putar'}
                          onclick={() => {
                            if (engine.current?.id === track.id) {
                              engine.togglePlay();
                            } else {
                              engine.playTrack(track, appStore.allTracks);
                            }
                          }}
                        >
                          {#if engine.current?.id === track.id && (engine.resolvingAudio || engine.buffering)}
                            <Preloader class="w-5 h-5" />
                          {:else}
                            <Icon name={engine.current?.id === track.id && engine.playing ? 'pause' : 'play'} size={24} />
                          {/if}
                        </button>

                        <button
                          type="button"
                          class="grid h-11 w-11 place-items-center rounded-full text-white active:scale-95"
                          aria-label="Lagu berikutnya"
                          onclick={() => engine.next(false)}
                        >
                          <Icon name="next" size={20} />
                        </button>

                        <button
                          type="button"
                          class="relative grid h-11 w-11 place-items-center rounded-full active:scale-95 {engine.repeat !== 'off'
                            ? 'text-[#64d2ff]'
                            : 'text-white/70'}"
                          aria-label="Mode ulangi: {engine.repeat}"
                          onclick={() => engine.cycleRepeat()}
                        >
                          <Icon name="repeat" size={19} />
                          {#if engine.repeat === 'one'}
                            <span class="absolute top-1.5 right-1.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-[#0a84ff] text-[9px] font-bold text-white">
                              1
                            </span>
                          {/if}
                        </button>
                      </div>

                      <!-- Volume Slider -->
                      <div class="flex items-center gap-3 text-white/75">
                        <Icon name="mute" size={16} />
                        <Range
                          min={0}
                          max={1}
                          step={0.02}
                          value={engine.volume}
                          onInput={(e: Event) => engine.setVolume((e.target as HTMLInputElement).value)}
                        />
                        <Icon name="volume" size={16} />
                      </div>
                    {/if}

                    <!-- Quick Action Buttons -->
                    <div class="grid grid-cols-2 gap-2 pt-1">
                      <Button
                        rounded
                        small
                        class="!bg-white/15 !text-white font-semibold"
                        onclick={() => appStore.toggleModalFlip()}
                      >
                        {i18n.t('player.lyricsBtn')}
                      </Button>
                      <Button
                        rounded
                        small
                        class="!bg-white/15 !text-white font-semibold"
                        onclick={() => {
                          appStore.targetTrackForPlaylist = track;
                          appStore.playlistModalOpen = true;
                        }}
                      >
                        {i18n.t('player.playlistBtn')}
                      </Button>
                      <Button
                        rounded
                        small
                        class="!bg-white/15 !text-white font-semibold"
                        onclick={() => {
                          appStore.closeTrackModal();
                          appStore.view = 'eq';
                        }}
                      >
                        EQ: {EQ_PRESETS[engine.eqPreset]?.name || 'Custom'}
                      </Button>
                      <Button
                        rounded
                        small
                        class="!bg-[#ff453a]/30 !text-[#ff857d] font-semibold"
                        onclick={handleStopAndClose}
                      >
                        {i18n.t('player.stopBtn')}
                      </Button>
                    </div>

                    {#if track.isPreview}
                      <Button
                        rounded
                        small
                        class="!bg-[#30d158] !text-black font-bold"
                        onclick={() => appStore.findFullVersion(track)}
                      >
                        {i18n.t('player.findFullBtn')}
                      </Button>
                    {/if}

                    {#if track.videoId}
                      <Button
                        rounded
                        small
                        class="!bg-white/12 !text-white/90 font-medium"
                        onclick={() => {
                          appStore.closeTrackModal();
                          appStore.openDownloaderWithUrl(`https://youtu.be/${track.videoId}`);
                        }}
                      >
                        {i18n.t('player.downloadMp3Btn')}
                      </Button>
                    {/if}
                  </div>
                </div>
              </Card>
            </div>

            <!-- BACK FACE (SYNCED LYRICS) -->
            <div class="xmusic-flip-face xmusic-flip-back" aria-hidden={!appStore.modalFlipped}>
              <Card
                contentWrap={false}
                class="!m-0 flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-[#007aff] shadow-xl dark:border-[#0a84ff]"
              >
                <div class="flex h-full min-h-0 flex-col p-5">
                  <div class="mb-3 flex shrink-0 items-center justify-between gap-2">
                    <div class="min-w-0">
                      <div class="truncate text-sm font-bold text-black dark:text-white">{track.title}</div>
                      <div class="truncate text-xs text-[#007aff] dark:text-[#64d2ff]">{track.artist} • Lirik LRC</div>
                    </div>
                    <div class="flex gap-1.5">
                      <Button tonal rounded small inline onclick={() => appStore.autoFetchLyricsForTrack(track)}>
                        Cari
                      </Button>
                      <Button tonal rounded small inline onclick={() => appStore.openEditTrack(track)}>
                        Edit
                      </Button>
                    </div>
                  </div>

                  <div
                    class="xmusic-vscroll min-h-0 flex-1 space-y-1.5 py-1 pr-1"
                    bind:this={lyricsScrollEl}
                    ontouchstart={pauseAutoScroll}
                    onwheel={pauseAutoScroll}
                    onpointerdown={pauseAutoScroll}
                  >
                    {#if appStore.fetchingLyrics}
                      <p class="py-12 text-center text-sm text-[#007aff] dark:text-[#64d2ff]" role="status">
                        {i18n.t('player.fetchingLyrics')}
                      </p>
                    {:else if parsedLyrics.length > 0}
                      {#each parsedLyrics as line, idx}
                        <button
                          type="button"
                          class="lyric-line block w-full rounded-xl px-3 py-2 text-left text-sm transition-colors {idx === activeLyricIdx
                            ? 'bg-[#007aff]/15 font-bold text-black dark:bg-[#0a84ff]/25 dark:text-white'
                            : 'text-black/65 dark:text-white/65'}"
                          data-lrc-idx={idx}
                          onclick={() => {
                            manualScrollUntil = 0;
                            if (line.synced && line.time !== null && engine.duration > 0 && engine.current?.id === track.id) {
                              engine.seekTo(line.time / engine.duration);
                            }
                          }}
                        >
                          {#if line.synced && line.time !== null}
                            <span class="mr-2 text-[11px] tabular-nums opacity-70">
                              {formatTime(line.time)}
                            </span>
                          {/if}
                          {line.text}
                        </button>
                      {/each}
                    {:else}
                      <div class="flex flex-col items-center gap-3 py-12 text-center">
                        <p class="text-sm text-black/65 dark:text-white/65">{i18n.t('player.noLyrics')}</p>
                        <Button
                          rounded
                          small
                          inline
                          class="!bg-[#248a3d] !text-white font-bold dark:!bg-[#30d158] dark:!text-black"
                          onclick={() => appStore.autoFetchLyricsForTrack(track)}
                        >
                          {i18n.t('player.autoFindLyrics')}
                        </Button>
                      </div>
                    {/if}
                  </div>

                  <div class="mt-3 flex shrink-0 items-center justify-between border-t border-black/10 pt-3 dark:border-white/10">
                    <span class="text-xs tabular-nums text-black/60 dark:text-white/60">
                      {formatTime(engine.position)} / {formatTime(engine.duration)}
                    </span>
                    <Button tonal rounded small inline onclick={() => appStore.toggleModalFlip()}>
                      {i18n.t('player.backToCover')}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Page>
  {/if}
</Popup>
