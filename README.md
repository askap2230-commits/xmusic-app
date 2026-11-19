# nys Xmusic v3.0 — Production Music Player (Tauri v2.12 + SvelteKit 3)

**nys Xmusic** is a lightweight, offline-first Android and Desktop music player built with [Tauri v2.12](https://v2.tauri.app/blog/tauri-2.12/), SvelteKit 3 (Svelte 5 Runes), Vite 8, and Web Audio API. Version `3.0.0` is a complete production refactor focused on modular engineering, zero-lag mobile performance, strict WCAG 2.2 AA accessibility, and manual-trigger 2026 CI/CD builds.

## Key Features

- **Offline-First Audio Library**: Import local `MP3`, `M4A`, `WAV`, `OGG`, `FLAC`, `AAC`, and `OPUS` files with custom cover art, persisted in IndexedDB v2 with deterministic `ObjectURL` lifecycle management.
- **5-Band Web Audio Studio Equalizer**: Real-time `BiquadFilterNode` processing (`60 Hz`, `230 Hz`, `910 Hz`, `3.6 kHz`, `14 kHz`), master preamp gain, stereo L/R panner, playback speed (`0.5x–2.0x`) with pitch preservation toggle, and smooth fade-out Sleep Timer.
- **3D Flip Cards & Time-Synced LRC Lyrics**: Double-tap any track card or full player modal to flip and view synced LRC lyrics auto-fetched from LRCLIB, with tap-to-seek and inline LRC editor.
- **Real-Time FFT Spectrum Visualizer**: Pull-based 60fps canvas visualizer that pauses automatically when hidden, flipped, or when `prefers-reduced-motion: reduce` is enabled.
- **Music Hub & Streaming**: Audius v1 streaming with multi-host failover, Spotify Web API v1 metadata & HD cover detection (with automatic oEmbed fallback), YouTube Music integration, and optional user-configured RapidAPI MP3 converter.
- **Zero-Bloat Demo Synth**: Built-in 44.1kHz stereo procedural WAV synthesizer (`0 KB` APK overhead) to test offline playback, EQ, and visualizer immediately.
- **Strict WCAG 2.2 AA Compliance**: High-contrast Studio Obsidian palette (`>= 7:1` primary text), `>= 44px` mobile touch targets, pinch-to-zoom enabled, semantic landmarks, keyboard navigation, and screen-reader live regions.

## Tech Stack (2026 Production Baseline)

| Layer | Technology | Version / Standard |
| :--- | :--- | :--- |
| Native Shell | [Tauri v2](https://v2.tauri.app/blog/tauri-2.12/) | `2.12.x` (Rust Edition `2024`, MSRV `1.90`) |
| Frontend | SvelteKit 3 + Svelte 5 Runes + Vite 8 | `@sveltejs/kit ^3.2.0`, `svelte ^5.57.3`, `vite ^8.0.12` |
| Audio Engine | Web Audio API + MediaSession API | 5-Band BiquadFilter, StereoPanner, AnalyserNode |
| Persistence | IndexedDB v2 + LocalStorage | Deterministic `ObjectURL` caching & cleanup |
| Android Build | Gradle 9.x + Kotlin 2.x + R8 Full Mode | `minSdkVersion 24`, LTO Fat + Strip Symbols |
| CI/CD | GitHub Actions (Manual-Only) | Node 24 native actions (`checkout@v7`, `setup-node@v6`, `setup-java@v6`, `setup-gradle@v6`, `upload-artifact@v7`) |

## Project Structure

```text
.
├── .github/workflows/
│   ├── build-apk.yml          # Manual-only production Android APK build & release
│   └── ci-verify.yml          # Manual-only fast frontend + Rust quality check
├── scripts/
│   ├── build-frontend.mjs     # Fail-fast Vite/SvelteKit static bundle builder
│   ├── optimize-android-gradle.py # Enables R8 full mode, shrinkResources, Gradle cache
│   └── sync-android-icons.py  # Generates 32-bit RGBA mipmap & Adaptive Icon v26 XML
├── src/
│   ├── app.html               # WCAG-compliant HTML shell (zoom enabled)
│   ├── app.css                # Studio Obsidian WCAG 2.2 AA design system
│   ├── routes/                # Thin SvelteKit 3 SPA shell (+layout, +page)
│   └── lib/
│       ├── api/services.js    # Audius, Spotify API/oEmbed, LRCLIB, YouTube, RapidAPI
│       ├── audio/engine.svelte.js # Throttled Svelte 5 reactive Web Audio engine
│       ├── components/        # Modular UI components, views/, and modals/
│       ├── data/presets.js    # EQ presets, categories, charts, procedural synth
│       ├── db/storage.js      # IndexedDB v2 + ObjectURL lifecycle manager
│       ├── stores/library.svelte.js # Centralized application state store
│       └── utils/format.js    # Pure time, greeting, and LRC sync utilities
├── src-tauri/
│   ├── .cargo/config.toml     # Cargo pipelining & Android linker dead-code stripping
│   ├── Cargo.toml             # Tauri v2.12 + aggressive [profile.release] size profile
│   ├── tauri.conf.json        # Tauri v2 app & Android bundle configuration
│   ├── capabilities/default.json
│   ├── keystore/xmusic-release.jks
│   └── src/{lib.rs, main.rs}
└── static/                    # PWA manifest, Service Worker, and PNG icons
```

## Quick Start (Local Development)

```bash
# 1. Install frontend dependencies (Node.js >= 22.17 or 24 LTS)
npm install

# 2. Run web dev server
npm run dev

# 3. Build static production bundle
npm run build

# 4. Run Tauri desktop app (requires Rust >= 1.90)
npx tauri dev
```

## Manual APK Build (GitHub Actions)

Automatic builds on `git push` are **disabled by design** to save CI minutes and prevent unwanted releases. Trigger builds manually whenever you are ready:

1. **Via GitHub Website**: Open **Actions** → **Build Optimized Android APK (Manual)** → **Run workflow** → choose `aarch64` (recommended, smallest APK) or `universal` → click **Run workflow**.
2. **Via GitHub CLI**:
   ```bash
   gh workflow run build-apk.yml -f target_arch=aarch64 -f publish_release=true
   ```

## Documentation Index

- **[AGENTS.md](./AGENTS.md)** — Strict rules & conventions for AI coding agents and vibe coding.
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Module boundaries, reactive state flow, and performance architecture.
- **[CI_CD_GUIDE.md](./CI_CD_GUIDE.md)** — Step-by-step GitHub Web UI & CLI build guide with verified 2026 action versions.
- **[WCAG_ACCESSIBILITY.md](./WCAG_ACCESSIBILITY.md)** — WCAG 2.2 AA contrast, focus, ARIA, and touch target specifications.
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — Engineering guidelines, naming rules, and security policy.
- **[CHANGELOG.md](./CHANGELOG.md)** — Release history and v3.0.0 migration summary.
