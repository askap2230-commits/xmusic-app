<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import {
    Block,
    Button,
    Link,
    List,
    ListItem,
    Navbar,
    Page,
    Panel,
    Segmented,
    SegmentedButton
  } from 'konsta/svelte';
  import { engine } from '#lib/audio/engine.svelte.ts';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import { getTrackInitial } from '#lib/utils/format.ts';
  import Icon from './Icon.svelte';
</script>

<Panel
  side="right"
  opened={appStore.npDrawerOpen}
  onBackdropClick={() => (appStore.npDrawerOpen = false)}
>
  <Page>
    <Navbar title="Antrean & Lirik">
      {#snippet right()}
        <Link iconOnly onclick={() => (appStore.npDrawerOpen = false)} aria-label="Tutup panel">
          <Icon name="close" size={20} />
        </Link>
      {/snippet}
    </Navbar>

    <Block>
      <Segmented strong rounded>
        <SegmentedButton
          active={appStore.npTab === 'queue'}
          onclick={() => (appStore.npTab = 'queue')}
        >
          Antrean ({engine.queue.length})
        </SegmentedButton>
        <SegmentedButton
          active={appStore.npTab === 'lyrics'}
          onclick={() => (appStore.npTab = 'lyrics')}
        >
          Lirik
        </SegmentedButton>
      </Segmented>
    </Block>

    {#if appStore.npTab === 'queue'}
      {#if engine.queue.length > 0}
        <Block class="flex items-center justify-between">
          <span class="text-xs font-medium text-zinc-600 dark:text-zinc-300">Daftar Putar Berikutnya</span>
          <Button clear small inline onclick={() => (engine.queue = [])}>Bersihkan</Button>
        </Block>

        <List strong inset>
          {#each engine.queue as qTrack, idx (`${qTrack.id}_${idx}`)}
            <ListItem
              link
              title={qTrack.title}
              subtitle={qTrack.artist}
              onclick={() => engine.playTrack(qTrack)}
            >
              {#snippet media()}
                <span
                  class="grid h-10 w-10 place-items-center overflow-hidden rounded-lg text-xs font-bold text-white"
                  style={qTrack.imageUrl
                    ? ''
                    : `background: linear-gradient(135deg, ${qTrack.c1 || '#007aff'}, ${qTrack.c2 || '#1c1c1e'})`}
                >
                  {#if qTrack.imageUrl}
                    <img src={qTrack.imageUrl} alt="" class="h-full w-full object-cover" />
                  {:else}
                    {getTrackInitial(qTrack.title)}
                  {/if}
                </span>
              {/snippet}

              {#snippet after()}
                <button
                  type="button"
                  class="grid h-9 w-9 place-items-center rounded-full text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
                  aria-label="Hapus {qTrack.title} dari antrean"
                  onclick={(e: MouseEvent) => {
                    e.stopPropagation();
                    engine.queue = engine.queue.filter((_, i) => i !== idx);
                  }}
                >
                  <Icon name="close" size={14} />
                </button>
              {/snippet}
            </ListItem>
          {/each}
        </List>
      {:else}
        <Block strong inset>
          <p class="text-sm text-zinc-600 dark:text-zinc-300">Antrean kosong. Pilih lagu untuk mulai memutar.</p>
        </Block>
      {/if}
    {:else if engine.current}
      <Block strong inset class="space-y-3">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="truncate text-sm font-bold text-zinc-950 dark:text-white">{engine.current.title}</div>
            <div class="truncate text-xs text-zinc-600 dark:text-zinc-300">{engine.current.artist}</div>
          </div>
          <Button tonal rounded small inline onclick={() => engine.current && appStore.openEditTrack(engine.current)}>
            Edit
          </Button>
        </div>

        <div class="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-zinc-100 p-3 text-sm leading-relaxed text-zinc-900 dark:bg-black/40 dark:text-zinc-100">
          {engine.current.lyrics ||
            'Belum ada lirik. Ketuk 2x kartu lagu untuk mencari lirik otomatis dari LRCLIB atau tempel manual.'}
        </div>
      </Block>
    {:else}
      <Block strong inset>
        <p class="text-sm text-zinc-600 dark:text-zinc-300">Putar sebuah lagu untuk melihat liriknya.</p>
      </Block>
    {/if}
  </Page>
</Panel>
