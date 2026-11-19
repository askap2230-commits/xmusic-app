<script>
  import { engine } from '#lib/audio/engine.svelte.js';
  import { EQ_BANDS, EQ_PRESETS, SLEEP_OPTIONS, SPEED_OPTIONS } from '#lib/data/presets.js';
  import { formatTime } from '#lib/utils/format.js';
  import Icon from '../Icon.svelte';
</script>

<section class="section" aria-labelledby="eq-heading">
  <div class="section-head">
    <h1 id="eq-heading" class="view-title">Studio Equalizer 5-Band & Efek Audio</h1>
    <button
      type="button"
      class="pill-btn {engine.eqEnabled ? 'spotify' : 'ghost'}"
      aria-pressed={engine.eqEnabled}
      onclick={() => engine.toggleEq()}
    >
      {engine.eqEnabled ? 'Equalizer Aktif' : 'Equalizer Nonaktif'}
    </button>
  </div>

  <div class="surface-card eq-rack">
    <p class="text-muted text-sm">
      Diproses real-time menggunakan <strong>Web Audio API BiquadFilterNode</strong> tanpa distorsi.
    </p>

    <div class="chip-row" role="group" aria-label="Preset Equalizer">
      {#each Object.entries(EQ_PRESETS) as [key, preset]}
        <button
          type="button"
          class="chip"
          class:active={engine.eqPreset === key}
          aria-pressed={engine.eqPreset === key}
          onclick={() => engine.setPreset(key)}
        >
          {preset.name}
        </button>
      {/each}
    </div>

    <div class="eq-sliders-grid">
      <div class="eq-col">
        <span class="eq-db">{engine.preamp > 0 ? `+${engine.preamp}` : engine.preamp} dB</span>
        <input
          class="eq-range"
          type="range"
          min="-12"
          max="12"
          step="0.5"
          aria-label="Preamp Master Gain dalam desibel"
          value={engine.preamp}
          oninput={(e) => engine.setPreamp(e.currentTarget.value)}
        />
        <span class="eq-freq">Preamp</span>
        <span class="eq-sub">Master Gain</span>
      </div>

      {#each EQ_BANDS as band, idx}
        <div class="eq-col">
          <span class="eq-db">{engine.gains[idx] > 0 ? `+${engine.gains[idx]}` : engine.gains[idx]} dB</span>
          <input
            class="eq-range"
            type="range"
            min="-12"
            max="12"
            step="0.5"
            aria-label="Frekuensi {band.label} ({band.sub}) dalam desibel"
            value={engine.gains[idx]}
            oninput={(e) => engine.setBandGain(idx, e.currentTarget.value)}
          />
          <span class="eq-freq">{band.label}</span>
          <span class="eq-sub">{band.sub}</span>
        </div>
      {/each}
    </div>

    <div class="eq-extras-grid">
      <div class="sub-panel">
        <div class="sub-panel-head">
          <span>Keseimbangan Stereo (Balance L/R)</span>
          <span class="text-accent">
            {engine.pan === 0
              ? 'Center'
              : engine.pan < 0
                ? `L ${Math.round(Math.abs(engine.pan) * 100)}%`
                : `R ${Math.round(engine.pan * 100)}%`}
          </span>
        </div>
        <input
          type="range"
          class="range-input full-w"
          min="-1"
          max="1"
          step="0.05"
          aria-label="Keseimbangan stereo kiri dan kanan"
          value={engine.pan}
          oninput={(e) => engine.setPan(e.currentTarget.value)}
        />
        <div class="sub-panel-foot">
          <span>Kiri (L)</span>
          <button type="button" class="text-btn" onclick={() => engine.setPan(0)}>Reset Center</button>
          <span>Kanan (R)</span>
        </div>
      </div>

      <div class="sub-panel">
        <div class="sub-panel-head">
          <span>Kecepatan Putar (Speed & Pitch)</span>
          <span class="text-spotify">{engine.playbackRate}x</span>
        </div>
        <div class="chip-row chip-row-tight">
          {#each SPEED_OPTIONS as spd}
            <button
              type="button"
              class="chip chip-sm"
              class:active={engine.playbackRate === spd}
              aria-pressed={engine.playbackRate === spd}
              onclick={() => engine.setSpeed(spd)}
            >
              {spd}x
            </button>
          {/each}
        </div>
        <label class="checkbox-label">
          <input
            type="checkbox"
            checked={engine.preservesPitch}
            onchange={() => engine.togglePreservesPitch()}
          />
          <span>Pertahankan Nada Vokal (Matikan untuk efek Slowed / Nightcore)</span>
        </label>
      </div>
    </div>
  </div>

  <div class="surface-card eq-rack">
    <div class="sleep-head">
      <div>
        <h2 class="sleep-title">
          <Icon name="moon" size={18} />
          <span>Sleep Timer</span>
        </h2>
        <p class="text-muted text-sm">
          Musik mengecil secara halus (fade-out) lalu berhenti otomatis.
        </p>
      </div>
      {#if engine.sleepMinutes !== 0}
        <span class="status-pill">
          Aktif: {engine.sleepMinutes === -1 ? 'Akhir Lagu' : formatTime(engine.sleepRemainingSec)}
        </span>
      {/if}
    </div>

    <div class="chip-row">
      {#each SLEEP_OPTIONS as opt}
        <button
          type="button"
          class="chip"
          class:active={engine.sleepMinutes === opt.minutes}
          aria-pressed={engine.sleepMinutes === opt.minutes}
          onclick={() => engine.setSleepTimer(opt.minutes)}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  </div>
</section>
