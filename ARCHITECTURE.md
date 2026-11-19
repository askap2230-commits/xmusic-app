# System Architecture — nys Xmusic v3.0

## 1. Architectural Overview

`nys Xmusic` uses a **unidirectional modular architecture** cleanly separating native shell integration, audio DSP, local persistence, external APIs, centralized reactive state, and presentation components.

```text
+-----------------------------------------------------------------------+
|                       Tauri v2.12 Native Shell                        |
|   src-tauri/src/lib.rs (get_runtime_info, Android WebView / Desktop)  |
+----------------------------------^------------------------------------+
                                   | @tauri-apps/api/core (invoke)
+----------------------------------v------------------------------------+
|                    SvelteKit 3 + Svelte 5 Frontend                    |
|                                                                       |
|  +-----------------------+          +------------------------------+  |
|  |  UI Layer (Modular)   | <------> |   Centralized State Store    |  |
|  |  - +page.svelte       |  Runes   |   src/lib/stores/            |  |
|  |  - components/        |          |   library.svelte.js          |  |
|  |  - views/ (5 views)   |          +--------------+---------------+  |
|  |  - modals/ (7 modals) |                         |                  |
|  +-----------+-----------+            +------------+------------+     |
|              |                        |                         |     |
|              v                        v                         v     |
|  +-----------------------+  +-------------------+  +---------------+  |
|  |  Audio DSP Engine     |  | Local Persistence |  | External APIs |  |
|  |  engine.svelte.js     |  | db/storage.js     |  | api/services  |  |
|  |  - 5-Band EQ          |  | - IndexedDB v2    |  | - Audius v1   |  |
|  |  - Stereo Panner      |  | - LocalStorage    |  | - Spotify v1  |  |
|  |  - FFT Analyser       |  | - ObjectURL Cache |  | - LRCLIB LRC  |  |
|  |  - Sleep Timer        |  +-------------------+  | - YouTube     |  |
|  |  - MediaSession API   |                         | - RapidAPI    |  |
|  +-----------------------+                         +---------------+  |
+-----------------------------------------------------------------------+
```

## 2. Layer Responsibilities

### Native Layer (`src-tauri/`)
- **`src/lib.rs`**: Shared entry point (`#[cfg_attr(mobile, tauri::mobile_entry_point)]`) exposing `get_runtime_info` IPC command.
- **`Cargo.toml` & `.cargo/config.toml`**: Enforces Rust edition `2024`, MSRV `1.90`, Cargo build pipelining, and maximum release size reduction (`opt-level = "z"`, `lto = "fat"`, `codegen-units = 1`, `panic = "abort"`, `strip = true`, plus `-Wl,--gc-sections` and `-Wl,--strip-all` for Android `.so` binaries) per [Tauri v2 App Size Guidelines](https://v2.tauri.app/concept/size/).

### Audio DSP Layer (`src/lib/audio/engine.svelte.js`)
- Signal chain: `MediaElementAudioSourceNode -> Preamp GainNode -> 5x BiquadFilterNode (60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz) -> StereoPannerNode -> AnalyserNode -> AudioContext.destination`.
- **CORS Failover**: Automatically detects CORS-blocked streams and retries playback without `crossOrigin="anonymous"` so third-party streams never stall silently.
- **Anti-Lag Throttling**: Reactive `position` updates run on a `150ms` interval (`~6.6Hz`) rather than 60fps `requestAnimationFrame`, preventing mobile WebView reactivity storms.

### Persistence Layer (`src/lib/db/storage.js`)
- Stores binary audio blobs and album cover blobs in IndexedDB v2 (`nys_xmusic_db`).
- Maintains singleton `Map` caches for `URL.createObjectURL` to prevent duplicate allocations and deterministically calls `URL.revokeObjectURL` on deletion and app teardown.

### State Store (`src/lib/stores/library.svelte.js`)
- Owns navigation (`view`, `libFilter`), collections (`localTracks`, `trendingTracks`, `ytTracks`, `searchResults`, `playlists`, `likedIds`), modal flags, profile/API configuration, and accessible toast messages.
- Keeps `src/routes/+page.svelte` under 110 lines by delegating all mutations to explicit store methods.

### Presentation & CSS Layer (`src/app.css` + `src/lib/components/`)
- **Zero Mobile GPU Overdraw**: Uses solid high-contrast layered obsidian surfaces (`#0a0b0f` → `#12151f` → `#181c28`) instead of stacked `backdrop-filter: blur(22px)` layers.
- **Scroll Virtualization**: Applies `content-visibility: auto; contain-intrinsic-size: auto 260px;` on track grids for smooth 60/120fps scrolling.
- **Android WebView 3D Flip Fix**: Explicitly toggles `pointer-events` and `aria-hidden` on front/back faces alongside `backface-visibility: hidden` and `transform: rotateY(0deg)` to prevent mirrored rendering glitches on Android Chromium WebView.
