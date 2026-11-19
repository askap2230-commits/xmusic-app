<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { Block, Button, Card, Link, Navbar, Page, Popup, Preloader, Range } from 'konsta/svelte';
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

  const track = $derived(appStore.activeModalTrack);
  const parsedLyrics = $derived(track ? parseLrcLyrics(track.lyrics || '') : []);
  const activeLyricIdx = $derived(
    track && engine.current?.id === track.id
      ? findActiveLyricIndex(parsedLyrics, engine.position)
      : -1
  );

  $effect(() => {
    void track?.id;
    imgFailed = false;
    showVideoFallback = false;
  });

  $effect(() => {
    if (appStore.modalFlipped && activeLyricIdx >= 0 && lyricsScrollEl) {
      const target = lyricsScrollEl.querySelector(`[data-lrc-idx="${activeLyricIdx}"]`);
      if (target) {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      }
    }
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
          const h = vizCanvas.clientHeight || 22;
          if (vizCanvas.width !== w || vizCanvas.height !== h) {
            vizCanvas.width = w;
            vizCanvas.height = h;
          }
          ctx.clearRect(0, 0, w, h);
          const bars = engine.getSpectrum(24, now);
          const barWidth = w / bars.length;
          for (let i = 0; i < bars.length; i++) {
            const val = bars[i];
            const barHeight = Math.max(3, val * h);
            ctx.fillStyle = appStore.isDark
              ? `rgba(10, 132, 255, ${0.4 + val * 0.6})`
              : `rgba(0, 122, 255, ${0.35 + val * 0.65})`;
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

      <Block class="mx-auto max-w-md">
        <div class="xmusic-flip-scene">
          <div
            role="presentation"
            class="xmusic-flip-inner"
            class:is-flipped={appStore.modalFlipped}
            ondblclick={handleDoubleTap}
          >
            <!-- FRONT FACE (PURE AUDIO PLAYER UI — NEVER AUTO-MOUNTS YOUTUBE VIDEO) -->
            <div class="xmusic-flip-face" aria-hidden={appStore.modalFlipped}>
              <Card
                contentWrapPadding="p-5"
                class="!m-0 rounded-3xl border border-black/10 shadow-xl dark:border-white/10"
              >
                <div class="flex flex-col">
                  {#if showVideoFallback && track.videoId && appStore.isOnline}
                    <div class="mb-4 aspect-video w-full overflow-hidden rounded-2xl bg-black">
                      <iframe
                        title={track.title}
                        class="h-full w-full border-0"
                        src="https://www.youtube.com/embed/{track.videoId}?autoplay=1&playsinline=1&rel=0"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowfullscreen
                      ></iframe>
                    </div>
                  {:else if track.spotifyId}
                    <div class="mb-4 flex flex-col items-center gap-3 rounded-2xl border border-black/10 bg-black/5 p-5 text-center dark:border-white/10 dark:bg-white/5">
                      {#if track.imageUrl && !imgFailed}
                        <img
                          src={track.imageUrl}
                          alt="Sampul {track.title}"
                          class="h-36 w-36 rounded-2xl object-cover shadow-md"
                          onerror={() => (imgFailed = true)}
                        />
                      {/if}
                      <p class="text-xs text-black/65 dark:text-white/65">
                        {i18n.t('player.spotifyNativeDesc')}
                      </p>
                      <Button
                        rounded
                        small
                        inline
                        class="!bg-[#248a3d] !text-white font-bold dark:!bg-[#30d158] dark:!text-black"
                        onclick={() => appStore.findFullVersion(track)}
                      >
                        {i18n.t('player.playFullInApp')}
                      </Button>
                    </div>
                  {:else}
                    <div
                      class="mx-auto mb-3 grid aspect-square w-full max-w-[248px] place-items-center overflow-hidden rounded-2xl shadow-lg"
                      style={track.imageUrl && !imgFailed
                        ? ''
                        : `background: linear-gradient(135deg, ${track.c1 || '#007aff'}, ${track.c2 || '#1c1c1e'})`}
                    >
                      {#if track.imageUrl && !imgFailed}
                        <img
                          src={track.imageUrl}
                          alt="Sampul {track.title}"
                          class="h-full w-full object-cover"
                          onerror={() => (imgFailed = true)}
                        />
                      {:else}
                        <span class="text-6xl font-extrabold text-white/95">
                          {getTrackInitial(track.title)}
                        </span>
                      {/if}
                    </div>

                    <!-- Dedicated non-overlapping compact spectrum strip -->
                    <div class="mx-auto mb-4 h-[22px] w-full max-w-[248px]">
                      <canvas
                        class="h-full w-full"
                        bind:this={vizCanvas}
                        aria-hidden="true"
                      ></canvas>
                    </div>
                  {/if}

                  <!-- Audio stream resolving status (audio-only YouTube Music) -->
                  {#if engine.resolvingAudio && engine.current?.id === track.id}
                    <div class="mb-3 flex items-center justify-center gap-2 rounded-xl bg-[#007aff]/10 px-3 py-2 text-xs font-medium text-[#007aff] dark:bg-[#0a84ff]/15 dark:text-[#64d2ff]" role="status">
                      <Preloader class="w-4 h-4" />
                      <span>{i18n.t('player.resolvingAudio')}</span>
                    </div>
                  {:else if engine.audioResolveFailed && track.videoId && !showVideoFallback && engine.current?.id === track.id}
                    <div class="mb-3 flex flex-col items-center gap-2 rounded-xl bg-[#ff9f0a]/15 px-3 py-2.5 text-center">
                      <span class="text-xs font-medium text-black/80 dark:text-white/85">
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

                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                      <h2 class="truncate text-lg font-bold text-black dark:text-white">{track.title}</h2>
                      <p class="truncate text-sm text-black/60 dark:text-white/65">{track.artist}</p>
                    </div>
                    <button
                      type="button"
                      class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/5 active:scale-95 dark:bg-white/10 {appStore.isLiked(track.id)
                        ? 'text-[#ff2d55] dark:text-[#ff375f]'
                        : 'text-black dark:text-white'}"
                      aria-label={appStore.isLiked(track.id) ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                      aria-pressed={appStore.isLiked(track.id)}
                      onclick={() => appStore.toggleLike(track)}
                    >
                      <Icon name={appStore.isLiked(track.id) ? 'heart-filled' : 'heart'} size={18} />
                    </button>
                  </div>

                  {#if !showVideoFallback && !track.spotifyId}
                    <div class="mt-4 space-y-1">
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
                      <div class="flex justify-between text-xs tabular-nums text-black/60 dark:text-white/60">
                        <span>{formatTime(engine.position)}</span>
                        <span>-{formatTime(Math.max(0, (engine.duration || 0) - engine.position))}</span>
                      </div>
                    </div>

                    <div class="mt-4 flex items-center justify-between">
                      <button
                        type="button"
                        class="grid h-11 w-11 place-items-center rounded-full active:scale-95 {engine.shuffle
                          ? 'text-[#007aff] dark:text-[#0a84ff]'
                          : 'text-black/60 dark:text-white/60'}"
                        aria-label="Mode acak"
                        aria-pressed={engine.shuffle}
                        onclick={() => engine.toggleShuffle()}
                      >
                        <Icon name="shuffle" size={19} />
                      </button>

                      <button
                        type="button"
                        class="grid h-11 w-11 place-items-center rounded-full text-black active:scale-95 dark:text-white"
                        aria-label="Lagu sebelumnya"
                        onclick={() => engine.prev()}
                      >
                        <Icon name="prev" size={20} />
                      </button>

                      <button
                        type="button"
                        class="grid h-14 w-14 place-items-center rounded-full bg-black text-white shadow-lg active:scale-95 dark:bg-white dark:text-black"
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
                        class="grid h-11 w-11 place-items-center rounded-full text-black active:scale-95 dark:text-white"
                        aria-label="Lagu berikutnya"
                        onclick={() => engine.next(false)}
                      >
                        <Icon name="next" size={20} />
                      </button>

                      <button
                        type="button"
                        class="relative grid h-11 w-11 place-items-center rounded-full active:scale-95 {engine.repeat !== 'off'
                          ? 'text-[#007aff] dark:text-[#0a84ff]'
                          : 'text-black/60 dark:text-white/60'}"
                        aria-label="Mode ulangi: {engine.repeat}"
                        onclick={() => engine.cycleRepeat()}
                      >
                        <Icon name="repeat" size={19} />
                        {#if engine.repeat === 'one'}
                          <span class="absolute top-1.5 right-1.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-[#007aff] text-[9px] font-bold text-white">
                            1
                          </span>
                        {/if}
                      </button>
                    </div>

                    <div class="mt-4 flex items-center gap-3 text-black/60 dark:text-white/60">
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

                  <div class="mt-5 grid grid-cols-2 gap-2">
                    <Button tonal rounded small onclick={() => appStore.toggleModalFlip()}>
                      {i18n.t('player.lyricsBtn')}
                    </Button>
                    <Button
                      tonal
                      rounded
                      small
                      onclick={() => {
                        appStore.targetTrackForPlaylist = track;
                        appStore.playlistModalOpen = true;
                      }}
                    >
                      {i18n.t('player.playlistBtn')}
                    </Button>
                    <Button
                      tonal
                      rounded
                      small
                      onclick={() => {
                        appStore.closeTrackModal();
                        appStore.view = 'eq';
                      }}
                    >
                      EQ: {EQ_PRESETS[engine.eqPreset]?.name || 'Custom'}
                    </Button>
                    <Button
                      tonal
                      rounded
                      small
                      class="!bg-[#ff3b30]/15 !text-[#d70015] dark:!bg-[#ff453a]/20 dark:!text-[#ff6961]"
                      onclick={handleStopAndClose}
                    >
                      {i18n.t('player.stopBtn')}
                    </Button>
                  </div>

                  {#if track.isPreview}
                    <div class="mt-2">
                      <Button
                        rounded
                        small
                        class="!bg-[#248a3d] !text-white font-bold dark:!bg-[#30d158] dark:!text-black"
                        onclick={() => appStore.findFullVersion(track)}
                      >
                        {i18n.t('player.findFullBtn')}
                      </Button>
                    </div>
                  {/if}

                  {#if track.videoId}
                    <div class="mt-2">
                      <Button
                        tonal
                        rounded
                        small
                        onclick={() => {
                          appStore.closeTrackModal();
                          appStore.openDownloaderWithUrl(`https://youtu.be/${track.videoId}`);
                        }}
                      >
                        {i18n.t('player.downloadMp3Btn')}
                      </Button>
                    </div>
                  {/if}
                </div>
              </Card>
            </div>

            <!-- BACK FACE (SYNCED LYRICS) -->
            <div class="xmusic-flip-face xmusic-flip-back" aria-hidden={!appStore.modalFlipped}>
              <Card
                contentWrapPadding="p-5"
                class="!m-0 flex h-full flex-col rounded-3xl border border-[#007aff] shadow-xl dark:border-[#0a84ff]"
              >
                <div class="mb-3 flex items-center justify-between gap-2">
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

                <div class="flex-1 space-y-1.5 overflow-y-auto py-1" bind:this={lyricsScrollEl}>
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

                <div class="mt-3 flex items-center justify-between border-t border-black/10 pt-3 dark:border-white/10">
                  <span class="text-xs tabular-nums text-black/60 dark:text-white/60">
                    {formatTime(engine.position)} / {formatTime(engine.duration)}
                  </span>
                  <Button tonal rounded small inline onclick={() => appStore.toggleModalFlip()}>
                    {i18n.t('player.backToCover')}
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </Block>
    </Page>
  {/if}
</Popup>
