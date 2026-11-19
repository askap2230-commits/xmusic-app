<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { Block, Button, Chip, Link, Navbar, Page, Popup, Range } from 'konsta/svelte';
  import { engine } from '#lib/audio/engine.svelte.ts';
  import { parseLrcLyrics } from '#lib/api/services.ts';
  import { EQ_PRESETS } from '#lib/data/presets.ts';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import { findActiveLyricIndex, formatTime, getTrackInitial } from '#lib/utils/format.ts';
  import Icon from '../Icon.svelte';

  let vizCanvas = $state<HTMLCanvasElement | null>(null);
  let lyricsScrollEl = $state<HTMLDivElement | null>(null);

  const track = $derived(appStore.activeModalTrack);
  const parsedLyrics = $derived(track ? parseLrcLyrics(track.lyrics || '') : []);
  const activeLyricIdx = $derived(
    track && engine.current?.id === track.id
      ? findActiveLyricIndex(parsedLyrics, engine.position)
      : -1
  );

  $effect(() => {
    if (appStore.modalFlipped && activeLyricIdx >= 0 && lyricsScrollEl) {
      const target = lyricsScrollEl.querySelector(`[data-lrc-idx="${activeLyricIdx}"]`);
      if (target) {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      }
    }
  });

  $effect(() => {
    if (!appStore.trackModalOpen || !vizCanvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let rafId = 0;
    const render = (now: number): void => {
      if (!appStore.trackModalOpen || !vizCanvas) return;
      if (!document.hidden && !appStore.modalFlipped) {
        const ctx = vizCanvas.getContext('2d');
        if (ctx) {
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
            const barHeight = Math.max(3, val * (h * 0.22));
            ctx.fillStyle = `rgba(10, 132, 255, ${0.14 + val * 0.36})`;
            ctx.fillRect(i * barWidth + 2, h - barHeight, Math.max(2, barWidth - 4), barHeight);
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
</script>

<Popup
  opened={appStore.trackModalOpen && Boolean(track)}
  onBackdropClick={() => appStore.closeTrackModal()}
>
  {#if track}
    <Page>
      <Navbar title={appStore.modalFlipped ? 'Lirik Sinkron' : 'Sedang Diputar'}>
        {#snippet left()}
          <Link iconOnly onclick={() => appStore.toggleModalFlip()} aria-label="Balik kartu lirik">
            <Icon name="flip" size={20} />
          </Link>
        {/snippet}
        {#snippet right()}
          <div class="flex items-center gap-1.5 px-1">
            <Link
              iconOnly
              onclick={() => {
                appStore.targetTrackForPlaylist = track;
                appStore.playlistModalOpen = true;
              }}
              aria-label="Tambahkan ke playlist"
            >
              <Icon name="folder" size={20} />
            </Link>
            <Link iconOnly onclick={() => appStore.closeTrackModal()} aria-label="Tutup pemutar">
              <Icon name="close" size={20} />
            </Link>
          </div>
        {/snippet}
      </Navbar>

      <Block class="mx-auto max-w-md">
        <div class="xmusic-flip-scene">
          <div
            class="xmusic-flip-inner"
            class:is-flipped={appStore.modalFlipped}
            ondblclick={handleDoubleTap}
          >
            <!-- FRONT FACE -->
            <div
              class="xmusic-flip-face relative overflow-hidden rounded-3xl border border-black/10 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#1c1c1e]"
              aria-hidden={appStore.modalFlipped}
            >
              <canvas
                class="pointer-events-none absolute inset-0 h-full w-full"
                bind:this={vizCanvas}
                aria-hidden="true"
              ></canvas>

              <div class="relative z-10 flex flex-col">
                {#if track.videoId}
                  {#if appStore.isOnline}
                    <div class="mb-4 aspect-video w-full overflow-hidden rounded-2xl bg-black">
                      <iframe
                        title={track.title}
                        class="h-full w-full border-0"
                        src="https://www.youtube.com/embed/{track.videoId}?autoplay=1&playsinline=1&rel=0"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowfullscreen
                      ></iframe>
                    </div>
                  {:else}
                    <div class="mb-4 flex flex-col items-center gap-2 rounded-2xl border border-black/10 bg-zinc-100 p-6 text-center dark:border-white/10 dark:bg-black/40">
                      <Icon name="wifi-off" size={28} />
                      <p class="text-xs text-zinc-600 dark:text-zinc-300">
                        Video YouTube memerlukan koneksi internet.
                      </p>
                    </div>
                  {/if}
                {:else if track.spotifyId}
                  {#if appStore.isOnline}
                    <div class="mb-4 overflow-hidden rounded-2xl">
                      <iframe
                        title={track.title}
                        class="w-full border-0"
                        src="https://open.spotify.com/embed/{track.spotifyType || 'track'}/{track.spotifyId}?theme=0"
                        height="152"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      ></iframe>
                    </div>
                  {:else}
                    <div class="mb-4 flex flex-col items-center gap-2 rounded-2xl border border-black/10 bg-zinc-100 p-6 text-center dark:border-white/10 dark:bg-black/40">
                      <Icon name="wifi-off" size={28} />
                      <p class="text-xs text-zinc-600 dark:text-zinc-300">
                        Pemutar Spotify Embed memerlukan koneksi internet.
                      </p>
                    </div>
                  {/if}
                {:else}
                  <div
                    class="mx-auto mb-5 grid aspect-square w-full max-w-[260px] place-items-center overflow-hidden rounded-2xl shadow-xl"
                    style={track.imageUrl
                      ? ''
                      : `background: linear-gradient(135deg, ${track.c1 || '#007aff'}, ${track.c2 || '#1c1c1e'})`}
                  >
                    {#if track.imageUrl}
                      <img src={track.imageUrl} alt="Sampul {track.title}" class="h-full w-full object-cover" />
                    {:else}
                      <span class="text-6xl font-extrabold text-white/95">
                        {getTrackInitial(track.title)}
                      </span>
                    {/if}
                  </div>
                {/if}

                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <h2 class="truncate text-xl font-bold text-zinc-950 dark:text-white">{track.title}</h2>
                    <p class="truncate text-sm text-zinc-600 dark:text-zinc-300">{track.artist}</p>
                  </div>
                  <button
                    type="button"
                    class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/5 dark:bg-white/10 {appStore.isLiked(track.id)
                      ? 'text-[#ff2d55] dark:text-[#ff375f]'
                      : 'text-zinc-900 dark:text-white'}"
                    aria-label={appStore.isLiked(track.id) ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                    aria-pressed={appStore.isLiked(track.id)}
                    onclick={() => appStore.toggleLike(track)}
                  >
                    <Icon name={appStore.isLiked(track.id) ? 'heart-filled' : 'heart'} size={18} />
                  </button>
                </div>

                {#if !track.videoId && !track.spotifyId}
                  <div class="mt-5 space-y-1">
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
                    <div class="flex justify-between text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
                      <span>{formatTime(engine.position)}</span>
                      <span>-{formatTime(Math.max(0, (engine.duration || 0) - engine.position))}</span>
                    </div>
                  </div>

                  <div class="mt-4 flex items-center justify-between">
                    <button
                      type="button"
                      class="grid h-11 w-11 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 {engine.shuffle
                        ? 'text-[#007aff] dark:text-[#0a84ff]'
                        : 'text-zinc-600 dark:text-zinc-300'}"
                      aria-label="Mode acak"
                      aria-pressed={engine.shuffle}
                      onclick={() => engine.toggleShuffle()}
                    >
                      <Icon name="shuffle" size={19} />
                    </button>

                    <button
                      type="button"
                      class="grid h-11 w-11 place-items-center rounded-full text-zinc-900 hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
                      aria-label="Lagu sebelumnya"
                      onclick={() => engine.prev()}
                    >
                      <Icon name="prev" size={20} />
                    </button>

                    <button
                      type="button"
                      class="grid h-14 w-14 place-items-center rounded-full bg-zinc-950 text-white shadow-lg active:scale-95 dark:bg-white dark:text-black"
                      aria-label={engine.playing ? 'Jeda' : 'Putar'}
                      onclick={() => engine.togglePlay()}
                    >
                      <Icon name={engine.playing ? 'pause' : 'play'} size={24} />
                    </button>

                    <button
                      type="button"
                      class="grid h-11 w-11 place-items-center rounded-full text-zinc-900 hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
                      aria-label="Lagu berikutnya"
                      onclick={() => engine.next(false)}
                    >
                      <Icon name="next" size={20} />
                    </button>

                    <button
                      type="button"
                      class="relative grid h-11 w-11 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 {engine.repeat !== 'off'
                        ? 'text-[#007aff] dark:text-[#0a84ff]'
                        : 'text-zinc-600 dark:text-zinc-300'}"
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

                  <div class="mt-4 flex items-center gap-3 text-zinc-600 dark:text-zinc-300">
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

                <div class="mt-5 flex flex-wrap justify-center gap-2">
                  <Chip outline class="cursor-pointer" onclick={() => appStore.toggleModalFlip()}>
                    Lirik Sinkron (2x Ketuk)
                  </Chip>
                  <Chip
                    outline
                    class="cursor-pointer"
                    onclick={() => {
                      appStore.closeTrackModal();
                      appStore.view = 'eq';
                    }}
                  >
                    EQ: {EQ_PRESETS[engine.eqPreset]?.name || 'Custom'}
                  </Chip>
                  {#if track.videoId}
                    <Chip
                      class="cursor-pointer !bg-[#248a3d] !text-white font-bold dark:!bg-[#30d158] dark:!text-black"
                      onclick={() => {
                        appStore.closeTrackModal();
                        appStore.openDownloaderWithUrl(`https://youtu.be/${track.videoId}`);
                      }}
                    >
                      Unduh MP3
                    </Chip>
                  {/if}
                </div>
              </div>
            </div>

            <!-- BACK FACE (SYNCED LYRICS) -->
            <div
              class="xmusic-flip-face xmusic-flip-back flex flex-col rounded-3xl border border-[#007aff] bg-white p-5 shadow-2xl dark:border-[#0a84ff] dark:bg-[#1c1c1e]"
              aria-hidden={!appStore.modalFlipped}
            >
              <div class="mb-3 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="truncate text-sm font-bold text-zinc-950 dark:text-white">{track.title}</div>
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
                    Mencari lirik sinkron dari LRCLIB...
                  </p>
                {:else if parsedLyrics.length > 0}
                  {#each parsedLyrics as line, idx}
                    <button
                      type="button"
                      class="lyric-line block w-full rounded-xl px-3 py-2 text-left text-sm transition-colors {idx === activeLyricIdx
                        ? 'bg-[#007aff]/15 font-bold text-zinc-950 dark:bg-[#0a84ff]/25 dark:text-white'
                        : 'text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5'}"
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
                    <p class="text-sm text-zinc-600 dark:text-zinc-300">Belum ada lirik untuk lagu ini.</p>
                    <Button
                      rounded
                      small
                      inline
                      class="!bg-[#248a3d] !text-white font-bold dark:!bg-[#30d158] dark:!text-black"
                      onclick={() => appStore.autoFetchLyricsForTrack(track)}
                    >
                      Cari Lirik Otomatis (LRCLIB)
                    </Button>
                  </div>
                {/if}
              </div>

              <div class="mt-3 flex items-center justify-between border-t border-black/10 pt-3 dark:border-white/10">
                <span class="text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
                  {formatTime(engine.position)} / {formatTime(engine.duration)}
                </span>
                <Button tonal rounded small inline onclick={() => appStore.toggleModalFlip()}>
                  Kembali ke Sampul
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Block>
    </Page>
  {/if}
</Popup>
