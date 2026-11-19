// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CategoryItem, EqBand, EqPreset, SleepOption, SpotifyChart } from '#lib/types/music';

export const EQ_BANDS: EqBand[] = [
  { freq: 60, label: '60 Hz', sub: 'Sub Bass', type: 'lowshelf' },
  { freq: 230, label: '230 Hz', sub: 'Warmth', type: 'peaking' },
  { freq: 910, label: '910 Hz', sub: 'Vocal', type: 'peaking' },
  { freq: 3600, label: '3.6 kHz', sub: 'Presence', type: 'peaking' },
  { freq: 14000, label: '14 kHz', sub: 'Treble Air', type: 'highshelf' }
];

export const EQ_PRESETS: Record<string, EqPreset> = {
  flat: { name: 'Flat (Lossless)', preamp: 0, gains: [0, 0, 0, 0, 0] },
  bass: { name: 'Bass Boost', preamp: -1, gains: [6.5, 4.5, 0, 0.5, 1.0] },
  superbass: { name: 'Super Bass', preamp: -2, gains: [9.0, 6.0, -1.0, 1.0, 2.0] },
  vocal: { name: 'Vocal Presence', preamp: 0, gains: [-2.0, -1.0, 4.5, 5.0, 1.5] },
  treble: { name: 'Treble Sparkle', preamp: -1, gains: [0, 0, 1.5, 5.0, 7.5] },
  electronic: { name: 'Electronic / EDM', preamp: -1.5, gains: [6.0, 2.5, -1.5, 3.5, 6.0] },
  acoustic: { name: 'Acoustic Warm', preamp: 0, gains: [3.0, 2.0, 1.0, 3.0, 4.0] },
  lofi: { name: 'Night / Lo-Fi', preamp: 0, gains: [4.5, 3.0, -1.0, -3.5, -5.5] },
  custom: { name: 'Kustom', preamp: 0, gains: [0, 0, 0, 0, 0] }
};

export const CATEGORIES: CategoryItem[] = [
  { label: 'Lagu Indonesia', sub: 'Pop & Indie Lokal', accent: '#dc2626', bg: '#2b1014', q: 'indonesia' },
  { label: 'Lo-Fi & Chill', sub: 'Fokus & Santai', accent: '#0891b2', bg: '#0c242d', q: 'lofi chill' },
  { label: 'Electronic & EDM', sub: 'Bass & Club', accent: '#7c3aed', bg: '#1e1233', q: 'electronic' },
  { label: 'Pop Hits', sub: 'Top Global', accent: '#db2777', bg: '#2c1021', q: 'pop' },
  { label: 'Lagu Galau & Sad', sub: 'Malam & Hujan', accent: '#4f46e5', bg: '#141736', q: 'sad acoustic' },
  { label: 'Hip-Hop & R&B', sub: 'Beats & Groove', accent: '#d97706', bg: '#2b1b0a', q: 'hiphop rnb' },
  { label: 'Acoustic & Indie', sub: 'Gitar & Vokal', accent: '#059669', bg: '#0b261e', q: 'acoustic indie' },
  { label: 'Synthwave & Night', sub: 'Retro Cyber', accent: '#2563eb', bg: '#101d38', q: 'synthwave' }
];

export const SPOTIFY_CHARTS: SpotifyChart[] = [
  { id: '37i9dQZEVXbObFQZ3JLcXt', title: 'Top 50 Indonesia' },
  { id: '37i9dQZEVXbMDoHDwVN2tF', title: 'Top 50 Global' },
  { id: '37i9dQZF1DXcBWIGoYBM5M', title: "Today's Top Hits" }
];

export const SPEED_OPTIONS: number[] = [0.5, 0.75, 0.9, 1.0, 1.15, 1.25, 1.5, 2.0];

export const SLEEP_OPTIONS: SleepOption[] = [
  { label: 'Matikan Timer', minutes: 0 },
  { label: '5 Menit', minutes: 5 },
  { label: '15 Menit', minutes: 15 },
  { label: '30 Menit', minutes: 30 },
  { label: '45 Menit', minutes: 45 },
  { label: '60 Menit', minutes: 60 },
  { label: 'Akhir Lagu Ini', minutes: -1 }
];

/**
 * Generates a lossless 44.1kHz 16-bit PCM stereo WAV track in memory (0 KB APK bloat).
 */
export async function generateDemoSynthBlob(durationSec = 24): Promise<Blob> {
  const sampleRate = 44100;
  const numFrames = sampleRate * durationSec;
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineCtx) {
    throw new Error('OfflineAudioContext tidak didukung pada perangkat ini.');
  }
  const offlineCtx = new OfflineCtx(2, numFrames, sampleRate);

  const chords: number[][] = [
    [110.0, 220.0, 261.63, 329.63, 392.0, 493.88],
    [87.31, 174.61, 220.0, 261.63, 329.63, 440.0],
    [130.81, 261.63, 329.63, 392.0, 493.88, 587.33],
    [98.0, 196.0, 246.94, 293.66, 392.0, 440.0]
  ];

  const master = offlineCtx.createGain();
  master.gain.setValueAtTime(0.32, 0);
  master.connect(offlineCtx.destination);

  const chordDur = durationSec / chords.length;
  chords.forEach((notes, idx) => {
    const start = idx * chordDur;
    const stop = start + chordDur;

    notes.forEach((freq, noteIdx) => {
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      const filter = offlineCtx.createBiquadFilter();

      osc.type = noteIdx === 0 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);
      osc.detune.setValueAtTime((noteIdx % 2 === 0 ? 1 : -1) * 6, start);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(noteIdx === 0 ? 180 : 1200, start);
      filter.frequency.exponentialRampToValueAtTime(noteIdx === 0 ? 140 : 2800, start + chordDur * 0.5);
      filter.frequency.exponentialRampToValueAtTime(noteIdx === 0 ? 110 : 900, stop);

      const amp = noteIdx === 0 ? 0.45 : 0.12;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(amp, start + 0.4);
      gain.gain.setValueAtTime(amp, stop - 0.5);
      gain.gain.linearRampToValueAtTime(0.001, stop);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);

      osc.start(start);
      osc.stop(stop);
    });

    const step = 0.25;
    for (let t = start; t < stop - 0.05; t += step) {
      const stepIdx = Math.floor((t - start) / step);
      const arpFreq = notes[1 + (stepIdx % (notes.length - 1))] * (stepIdx % 4 === 0 ? 2 : 1);
      const osc = offlineCtx.createOscillator();
      const g = offlineCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(arpFreq, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + step * 0.9);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + step);
    }
  });

  const rendered = await offlineCtx.startRendering();
  return audioBufferToWavBlob(rendered);
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length * numChannels * 2 + 44;
  const out = new ArrayBuffer(length);
  const view = new DataView(out);
  const channels: Float32Array[] = [];
  let offset = 0;
  let pos = 0;

  const setUint16 = (data: number): void => {
    view.setUint16(pos, data, true);
    pos += 2;
  };
  const setUint32 = (data: number): void => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  setUint32(0x46464952); // RIFF
  setUint32(length - 8);
  setUint32(0x45564157); // WAVE
  setUint32(0x20746d66); // fmt
  setUint32(16);
  setUint16(1); // PCM
  setUint16(numChannels);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numChannels);
  setUint16(numChannels * 2);
  setUint16(16);
  setUint32(0x61746164); // data
  setUint32(length - pos - 4);

  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length) {
    for (let i = 0; i < numChannels; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out], { type: 'audio/wav' });
}
