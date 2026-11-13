# nys Xmusic v2.0 — Tauri v2.12 + SvelteKit 3.2 (Svelte 5 Runes)

Aplikasi pemutar musik lintas platform (**Android APK** & **Desktop**) berbasis **[Tauri v2.12](https://docs.rs/crate/tauri/latest)** dan **[SvelteKit 3.2](https://www.npmjs.com/package/@sveltejs/kit)** ([Svelte 5 Runes](https://www.npmjs.com/package/svelte) + [Vite 8 Rolldown](https://medium.com/@vasanthank29/sveltekit-3-migration-notes-node-22-vite-8-and-what-actually-breaks-f61f9e0a112f)). Dirancang agar berjalan mulus (60/120fps) di Android WebView, memiliki fitur pemrosesan audio nyata tanpa fitur palsu (*no gimmick*), ukuran APK produksi yang kecil (~4–7 MB untuk `aarch64`), serta pipeline **GitHub Actions** yang cepat dan siap langsung di-install.

---

## Daftar Fitur Utama (Berfungsi Penuh)

| Modul Fitur | Implementasi Teknis | Status |
| :--- | :--- | :--- |
| **5-Band Web Audio Equalizer** | `AudioContext` + 5 `BiquadFilterNode` (`60Hz`, `230Hz`, `910Hz`, `3.6kHz`, `14kHz`) + `GainNode` Preamp (`-12dB` s/d `+12dB`) + `StereoPannerNode` (Balance L/R) dan 8 preset studio | Aktif |
| **Real-Time FFT Visualizer** | `AnalyserNode` (`getByteFrequencyData`, 128 FFT bins) yang merender spektrum frekuensi aktual 60fps pada `<canvas>` | Aktif |
| **Built-in Synth Demo (0 KB Bloat)** | Generator WAV PCM stereo 44.1kHz prosedural berbasis `OfflineAudioContext` untuk menguji pemutaran lokal & Equalizer secara instan saat offline | Aktif |
| **Pemutar Offline (IndexedDB v2)** | Menyimpan file `MP3`, `M4A`, `WAV`, `OGG`, `FLAC`, `AAC` beserta sampul album di perangkat, ekstraksi durasi otomatis, dan caching `URL.createObjectURL` bebas *memory leak* | Aktif |
| **Kontrol Pemutaran Lengkap** | `Shuffle` (acak antrean), `Repeat` 3-mode (`Off`, `All`, `One`), `Playback Speed` (`0.5x`–`2.0x`), dan `Pitch Lock` (`preservesPitch` untuk mode normal atau Slowed/Nightcore) | Aktif |
| **Sleep Timer Fade-Out** | Timer tidur (`5m`, `15m`, `30m`, `45m`, `60m`, atau `Akhir Lagu Ini`) dengan penurunan volume bertahap (*smooth fade-out*) 5 detik sebelum berhenti | Aktif |
| **Manajemen Antrean, Playlist & Lirik** | Panel samping *Up Next Queue*, pembuatan Playlist Kustom, daftar lagu Favorit (♥), Riwayat Putar, serta editor metadata & lirik lagu | Aktif |
| **Streaming Audius Multi-Host** | Streaming katalog musik penuh dari API Audius v1 dengan *auto-failover* ke *discovery node* cadangan jika server utama sibuk | Aktif |
| **Hub Spotify & YouTube + Downloader** | Pemutar *embed* langsung dengan pengambilan judul/sampul otomatis via oEmbed serta konverter YouTube-ke-MP3 dengan API Key yang dapat diubah langsung dari menu Pengaturan | Aktif |

---

## Versi Pustaka & Toolchain (Rilis Terbaru)

| Paket / Crate | Versi | Fungsi Utama |
| :--- | :--- | :--- |
| [`@sveltejs/kit`](https://www.npmjs.com/package/@sveltejs/kit) | `^3.2.0` | Framework utama dengan konfigurasi terpadu di `vite.config.js` dan *subpath import* `#lib/*` ([Dokumentasi SPA SvelteKit](https://svelte.dev/docs/kit/single-page-apps)) |
| [`svelte`](https://www.npmjs.com/package/svelte) | `^5.57.3` | Compiler UI reaktif berbasis *Runes* (`$state`, `$derived`, `$props`, `{#snippet}`) |
| [`@sveltejs/adapter-static`](https://www.npmjs.com/package/@sveltejs/adapter-static) | `^4.0.1` | Prerender SPA statis ke direktori `dist/` untuk WebView Tauri |
| [`@sveltejs/vite-plugin-svelte`](https://www.npmjs.com/package/@sveltejs/vite-plugin-svelte) & `vite` | `^7.3.1` / `^8.0.12` | Bundler produksi berkecepatan tinggi berbasis Rust Rolldown |
| [`@tauri-apps/cli`](https://v2.tauri.app/release/@tauri-apps/cli/v2.12.0/) & [`@tauri-apps/api`](https://v2.tauri.app/release/) | `^2.12.0` / `^2.12.3` | CLI pembuatan paket Android APK & jembatan IPC frontend-backend |
| [`tauri`](https://docs.rs/crate/tauri/latest) & `tauri-build` (Rust) | `2.12.5` / `2.7.4` | Core engine native Rust untuk Android (JNI/WRY) dan Desktop |

---

## Struktur Direktori Proyek

```text
xmusic-tauri-v2/
├── .github/workflows/
│   └── build-apk.yml              # Workflow CI/CD GitHub Actions cepat & teroptimasi
├── workflow-copy/
│   └── build-apk.yml              # Salinan cadangan workflow jika upload via web GitHub
├── scripts/
│   ├── build-frontend.mjs         # Builder SvelteKit 3 + verifikasi aset dist/
│   ├── sync-android-icons.py      # Generator mipmap-mdpi s/d xxxhdpi & Adaptive Icon v26
│   └── optimize-android-gradle.py # Pengaktif R8 Minify, ShrinkResources & Cleartext Traffic
├── src/
│   ├── app.html                   # HTML shell SvelteKit 3
│   ├── app.css                    # Desain Liquid Glass GPU-accelerated (60/120fps)
│   ├── lib/
│   │   ├── audio/engine.svelte.js # Engine Web Audio API 5-Band EQ, FFT & kontrol putar
│   │   ├── db/storage.js          # Penyimpanan IndexedDB v2 & manajemen ObjectURL
│   │   ├── api/services.js        # Klien Audius v1, YouTube v3, oEmbed & RapidAPI
│   │   └── data/presets.js        # Preset EQ, kategori & generator synthwave WAV 0-KB
│   └── routes/
│       ├── +layout.js             # Konfigurasi SPA (ssr = false, prerender = true)
│       ├── +layout.svelte         # Root layout Svelte 5
│       └── +page.svelte           # Antarmuka lengkap aplikasi Xmusic
├── static/                        # Aset PWA (manifest.json, sw.js, icon.png)
├── dist/                          # Bundle produksi siap pakai
├── src-tauri/
│   ├── .cargo/config.toml         # Flag linker Rust (--gc-sections, --strip-all)
│   ├── capabilities/default.json  # Izin keamanan Tauri v2
│   ├── icons/                     # Icon aplikasi multi-resolusi (Desktop & Android)
│   ├── keystore/
│   │   └── xmusic-release.jks     # Keystore rilis deterministik agar update APK tidak bentrok
│   ├── src/
│   │   ├── lib.rs                 # Entry point mobile/desktop & command IPC
│   │   └── main.rs                # Entry point executable
│   ├── Cargo.toml                 # Profil rilis LTO fat, opt-level="z", strip="symbols"
│   └── tauri.conf.json            # Konfigurasi aplikasi & bundle Tauri v2
├── app-icon.png                   # Master icon 1024x1024 RGBA
├── package.json                   # Dependensi SvelteKit 3.2 & skrip npm
├── vite.config.js                 # Konfigurasi terpadu SvelteKit 3 + Vite 8
├── PANDUAN_BUILD_DAN_UPLOAD.md    # Langkah demi langkah upload ke GitHub & build APK
└── ARSITEKTUR_DAN_OPTIMASI.md     # Penjelasan teknis optimasi ukuran APK & icon Android
```

---

## Cara Menjalankan Secara Lokal (Opsional)

Pastikan **Node.js >= 22.17 / 24 LTS** ([Catatan Migrasi SvelteKit 3](https://medium.com/@vasanthank29/sveltekit-3-migration-notes-node-22-vite-8-and-what-actually-breaks-f61f9e0a112f)) dan **Rust stable** telah terpasang:

```bash
# 1. Pasang dependensi frontend
npm install --legacy-peer-deps

# 2. Jalankan mode pengembangan di browser (port 5173)
npm run dev

# 3. Build bundle statis produksi ke folder dist/
npm run build

# 4. Jalankan sebagai aplikasi Desktop atau Android via Tauri CLI
npx tauri dev
```

Untuk membangun file `.apk` secara otomatis di cloud tanpa menginstal Android Studio di perangkat lokal, ikuti panduan di **[`PANDUAN_BUILD_DAN_UPLOAD.md`](./PANDUAN_BUILD_DAN_UPLOAD.md)**.
