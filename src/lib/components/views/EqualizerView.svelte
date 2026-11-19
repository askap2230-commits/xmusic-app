<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script>
  import {
    Block,
    BlockTitle,
    Button,
    Chip,
    List,
    ListItem,
    Range,
    Toggle
  } from 'konsta/svelte';
  import { engine } from '#lib/audio/engine.svelte.js';
  import { EQ_BANDS, EQ_PRESETS, SLEEP_OPTIONS, SPEED_OPTIONS } from '#lib/data/presets.js';
  import { formatTime } from '#lib/utils/format.js';
</script>

<BlockTitle>5-Band Web Audio Equalizer</BlockTitle>
<List strong inset>
  <ListItem
    label
    title="Aktifkan Equalizer"
    subtitle="BiquadFilterNode real-time tanpa distorsi"
  >
    {#snippet after()}
      <Toggle
        component="div"
        checked={engine.eqEnabled}
        onChange={() => engine.toggleEq()}
      />
    {/snippet}
  </ListItem>
</List>

<Block strong inset class="space-y-4">
  <div class="flex flex-wrap gap-2" role="group" aria-label="Preset Equalizer">
    {#each Object.entries(EQ_PRESETS) as [key, preset]}
      <Chip
        outline={engine.eqPreset !== key}
        class="cursor-pointer {engine.eqPreset === key ? '!bg-[#007aff] !text-white dark:!bg-[#0a84ff]' : ''}"
        onclick={() => engine.setPreset(key)}
      >
        {preset.name}
      </Chip>
    {/each}
  </div>

  <div class="grid grid-cols-6 gap-2 rounded-2xl border border-black/10 bg-zinc-100 dark:border-white/10 dark:bg-black/40 px-2 py-4">
    <div class="flex flex-col items-center gap-1.5">
      <span class="text-[11px] font-bold text-[#007aff] dark:text-[#64d2ff]">
        {engine.preamp > 0 ? `+${engine.preamp}` : engine.preamp} dB
      </span>
      <input
        class="xmusic-eq-slider"
        type="range"
        min="-12"
        max="12"
        step="0.5"
        aria-label="Preamp Master Gain dalam desibel"
        value={engine.preamp}
        oninput={(e) => engine.setPreamp(e.currentTarget.value)}
      />
      <span class="text-[11px] font-semibold text-zinc-950 dark:text-white">Preamp</span>
      <span class="text-center text-[10px] text-zinc-600 dark:text-zinc-300">Master</span>
    </div>

    {#each EQ_BANDS as band, idx}
      <div class="flex flex-col items-center gap-1.5">
        <span class="text-[11px] font-bold text-[#007aff] dark:text-[#64d2ff]">
          {engine.gains[idx] > 0 ? `+${engine.gains[idx]}` : engine.gains[idx]} dB
        </span>
        <input
          class="xmusic-eq-slider"
          type="range"
          min="-12"
          max="12"
          step="0.5"
          aria-label="Frekuensi {band.label} ({band.sub})"
          value={engine.gains[idx]}
          oninput={(e) => engine.setBandGain(idx, e.currentTarget.value)}
        />
        <span class="text-[11px] font-semibold text-zinc-950 dark:text-white">{band.label}</span>
        <span class="text-center text-[10px] text-zinc-600 dark:text-zinc-300">{band.sub}</span>
      </div>
    {/each}
  </div>
</Block>

<BlockTitle>Keseimbangan Stereo & Kecepatan Putar</BlockTitle>
<List strong inset>
  <ListItem
    title="Balance Kiri / Kanan"
    after={engine.pan === 0
      ? 'Center'
      : engine.pan < 0
        ? `L ${Math.round(Math.abs(engine.pan) * 100)}%`
        : `R ${Math.round(engine.pan * 100)}%`}
  />
  <ListItem>
    {#snippet inner()}
      <div class="flex w-full items-center gap-3">
        <span class="text-xs font-semibold text-zinc-600 dark:text-zinc-300">L</span>
        <Range
          min={-1}
          max={1}
          step={0.05}
          value={engine.pan}
          onInput={(e) => engine.setPan(e.target.value)}
        />
        <span class="text-xs font-semibold text-zinc-600 dark:text-zinc-300">R</span>
        <Button clear small inline onclick={() => engine.setPan(0)}>Reset</Button>
      </div>
    {/snippet}
  </ListItem>

  <ListItem
    label
    title="Pertahankan Nada Vokal"
    subtitle="Matikan untuk efek Slowed / Nightcore"
  >
    {#snippet after()}
      <Toggle
        component="div"
        checked={engine.preservesPitch}
        onChange={() => engine.togglePreservesPitch()}
      />
    {/snippet}
  </ListItem>
</List>

<Block strong inset class="space-y-3">
  <div class="flex items-center justify-between text-sm font-semibold">
    <span>Kecepatan Pemutaran</span>
    <span class="text-[#248a3d] dark:text-[#30d158]">{engine.playbackRate}x</span>
  </div>
  <div class="flex flex-wrap gap-2">
    {#each SPEED_OPTIONS as spd}
      <Chip
        outline={engine.playbackRate !== spd}
        class="cursor-pointer {engine.playbackRate === spd ? '!bg-[#007aff] !text-white dark:!bg-[#0a84ff]' : ''}"
        onclick={() => engine.setSpeed(spd)}
      >
        {spd}x
      </Chip>
    {/each}
  </div>
</Block>

<BlockTitle>
  Sleep Timer {engine.sleepMinutes !== 0
    ? `• ${engine.sleepMinutes === -1 ? 'Akhir Lagu' : formatTime(engine.sleepRemainingSec)}`
    : ''}
</BlockTitle>
<Block strong inset class="space-y-3">
  <p class="text-xs text-zinc-600 dark:text-zinc-300">
    Volume mengecil halus (fade-out 5 detik terakhir) lalu berhenti otomatis.
  </p>
  <div class="flex flex-wrap gap-2">
    {#each SLEEP_OPTIONS as opt}
      <Chip
        outline={engine.sleepMinutes !== opt.minutes}
        class="cursor-pointer {engine.sleepMinutes === opt.minutes ? '!bg-[#007aff] !text-white dark:!bg-[#0a84ff]' : ''}"
        onclick={() => engine.setSleepTimer(opt.minutes)}
      >
        {opt.label}
      </Chip>
    {/each}
  </div>
</Block>
