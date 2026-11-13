/**
 * Preset Equalizer 5-Band Web Audio API, Kategori Musik, & Generator Demo Synth Offline
 * Frekuensi: 60Hz (Sub/Bass), 230Hz (Low-Mid), 910Hz (Mid/Vocal), 3.6kHz (Presence), 14kHz (Air/Treble)
 */

export const EQ_BANDS = [
  { freq: 60, label: '60 Hz', sub: 'Sub Bass', type: 'lowshelf' },
  { freq: 230, label: '230 Hz', sub: 'Warmth', type: 'peaking' },
  { freq: 910, label: '910 Hz', sub: 'Vocal', type: 'peaking' },
  { freq: 3600, label: '3.6 kHz', sub: 'Presence', type: 'peaking' },
  { freq: 14000, label: '14 kHz', sub: 'Treble Air', type: 'highshelf' }
];

export const EQ_PRESETS = {
  flat: { name: 'Flat (Studio)', preamp: 0, gains: [0, 0, 0, 0, 0] },
  bass: { name: 'Bass Boost', preamp: -1, gains: [6.5, 4.5, 0, 0.5, 1.0] },
  superbass: { name: 'Super Bass', preamp: -2, gains: [9.0, 6.0, -1.0, 1.0, 2.0] },
  vocal: { name: 'Vocal Presence', preamp: 0, gains: [-2.0, -1.0, 4.5, 5.0, 1.5] },
  treble: { name: 'Treble Sparkle', preamp: -1, gains: [0, 0, 1.5, 5.0, 7.5] },
  electronic: { name: 'Electronic / EDM', preamp: -1.5, gains: [6.0, 2.5, -1.5, 3.5, 6.0] },
  acoustic: { name: 'Acoustic Warm', preamp: 0, gains: [3.0, 2.0, 1.0, 3.0, 4.0] },
  lofi: { name: 'Night / Lo-Fi', preamp: 0, gains: [4.5, 3.0, -1.0, -3.5, -5.5] },
  custom: { name: 'Kustom', preamp: 0, gains: [0, 0, 0, 0, 0] }
};

export const CATEGORIES = [
  { label: 'Lagu Indonesia', sub: 'Pop & Indie Lokal', g1: '#ef4444', g2: '#450a0a', q: 'indonesia' },
  { label: 'Lo-Fi & Chill', sub: 'Fokus & Santai', g1: '#06b6d4', g2: '#083344', q: 'lofi chill' },
  { label: 'Electronic & EDM', sub: 'Bass & Club', g1: '#8b5cf6', g2: '#2e1065', q: 'electronic' },
  { label: 'Pop Hits', sub: 'Top Global', g1: '#ec4899', g2: '#500724', q: 'pop' },
  { label: 'Lagu Galau & Sad', sub: 'Malam & Hujan', g1: '#6366f1', g2: '#1e1b4b', q: 'sad acoustic' },
  { label: 'Hip-Hop & R&B', sub: 'Beats & Groove', g1: '#f59e0b', g2: '#451a03', q: 'hiphop rnb' },
  { label: 'Acoustic & Indie', sub: 'Gitar & Vokal', g1: '#10b981', g2: '#064e3b', q: 'acoustic indie' },
  { label: 'Synthwave & Night', sub: 'Retro Cyber', g1: '#3b82f6', g2: '#172554', q: 'synthwave' }
];

export const SPOTIFY_CHARTS = [
  { id: '37i9dQZEVXbObFQZ3JLcXt', title: 'Top 50 Indonesia' },
  { id: '37i9dQZEVXbMDoHDwVN2tF', title: 'Top 50 Global' },
  { id: '37i9dQZF1DXcBWIGoYBM5M', title: "Today's Top Hits" }
];

export const SPEED_OPTIONS = [0.5, 0.75, 0.9, 1.0, 1.15, 1.25, 1.5, 2.0];

export const SLEEP_OPTIONS = [
  { label: 'Matikan Timer', minutes: 0 },
  { label: '5 Menit', minutes: 5 },
  { label: '15 Menit', minutes: 15 },
  { label: '30 Menit', minutes: 30 },
  { label: '45 Menit', minutes: 45 },
  { label: '60 Menit', minutes: 60 },
  { label: 'Akhir Lagu Ini', minutes: -1 }
];

/**
 * Menghasilkan file WAV stereo (44.1kHz, 16-bit PCM) secara prosedural di memori
 * agar pengguna bisa langsung menguji pemutaran offline, 5-Band Equalizer, dan FFT Visualizer
 * tanpa menambah beban ukuran APK sepeser pun (0 KB bloat).
 */
export async function generateDemoSynthBlob(durationSec = 24) {
  const sampleRate = 44100;
  const numFrames = sampleRate * durationSec;
  const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, numFrames, sampleRate);

  // Chord progression: Am9 -> Fmaj7 -> Cmaj7 -> G6
  const chords = [
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

    // Warm Pad + Sub Bass
    notes.forEach((freq, nIdx) => {
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      const filter = offlineCtx.createBiquadFilter();

      osc.type = nIdx === 0 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);
      osc.detune.setValueAtTime((nIdx % 2 === 0 ? 1 : -1) * 6, start);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(nIdx === 0 ? 180 : 1200, start);
      filter.frequency.exponentialRampToValueAtTime(nIdx === 0 ? 140 : 2800, start + chordDur * 0.5);
      filter.frequency.exponentialRampToValueAtTime(nIdx === 0 ? 110 : 900, stop);

      const amp = nIdx === 0 ? 0.45 : 0.12;
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

    // Arpeggio pulse (120 BPM -> 0.25s steps)
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

function audioBufferToWavBlob(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new ArrayBuffer(length);
  const view = new DataView(out);
  const channels = [];
  let sample = 0;
  let offset = 0;
  let pos = 0;

  const setUint16 = (data) => { view.setUint16(pos, data, true); pos += 2; };
  const setUint32 = (data) => { view.setUint32(pos, data, true); pos += 4; };

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt "
  setUint32(16);
  setUint16(1); // PCM
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);

  for (let i = 0; i < numOfChan; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out], { type: 'audio/wav' });
}
