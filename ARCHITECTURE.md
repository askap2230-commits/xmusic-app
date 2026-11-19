# System Architecture — nys Xmusic v4.0

## 1. Layered Architecture

```text
+-----------------------------------------------------------------------+
|                       Tauri v2.12 Native Shell                        |
|   src-tauri/tauri.conf.json ("version": "../package.json")            |
|   src-tauri/src/lib.rs (get_runtime_info via app.package_info())      |
+----------------------------------^------------------------------------+
                                   | @tauri-apps/api/core
+----------------------------------v------------------------------------+
|       Konsta UI v5.5 (iOS Theme) + Tailwind CSS v4 + SvelteKit 3      |
|  +layout.svelte (<App theme="ios" safeAreas dark>)                    |
|  +page.svelte   (<Page>, <Navbar>, <Tabbar>, <Fab>, <Toast>)          |
|  ├── views/     HomeView, SearchView, LibraryView, Equalizer, Profile |
|  ├── modals/    TrackModal, Upload, Hub, Downloader, Edit, Playlist,  |
|  │              ProfileModal (all Konsta <Popup> + <ListInput>)       |
|  └── components DynamicBar, PlayerBar, QueueDrawer (<Panel>),         |
|                 TrackCard (<Card> + 3D flip), Icon                    |
+-------------------+-------------------------+-------------------------+
                    |                         |
       +------------v-----------+   +---------v----------+
       | Centralized Runes Store|   | Web Audio DSP      |
       | library.svelte.js      |   | engine.svelte.js   |
       | - Tracks & Playlists   |   | - 5-Band EQ        |
       | - Search & Modals      |   | - 150ms Sync Loop  |
       | - Profile & API Config |   | - FFT & MediaSess. |
       +------------+-----------+   +--------------------+
                    |
       +------------v-----------+   +--------------------+
       | IndexedDB v2 Storage   |   | External APIs      |
       | db/storage.js          |   | api/services.js    |
       | - Blob & ObjectURL Map |   | - Audius / Spotify |
       +------------------------+   | - LRCLIB / YouTube |
                                    +--------------------+
```

## 2. Single Source of Truth Versioning

- **`package.json`** owns the canonical SemVer `"version": "4.0.0"`.
- **`src-tauri/tauri.conf.json`** declares `"version": "../package.json"`, which Tauri v2 resolves automatically during Android and Desktop bundling ([Tauri Configuration Reference](https://v2.tauri.app/reference/config/)).
- **`src-tauri/src/lib.rs`** exposes `app.package_info().version.to_string()` via `get_runtime_info`.
- **`.github/workflows/build-apk.yml`** reads `require('./package.json').version` to construct the dynamic release APK filename `Xmusic-v<version>-android-<abi>-release.apk` and default GitHub Release tag `v<version>`.

## 3. Reproducible Build Architecture

1. **Deterministic Rust Compilation**:
   - `Cargo.toml` release profile sets `codegen-units = 1`, `lto = "fat"`, `opt-level = "z"`, `panic = "abort"`, `strip = true`, `incremental = false`.
   - CI exports `RUSTFLAGS="--remap-path-prefix=$PWD=. --remap-path-prefix=$HOME=/home/builder"` so absolute runner paths never leak into `.so` binaries.
2. **Deterministic Android Gradle Packaging**:
   - `scripts/optimize-android-gradle.py` configures `isPreserveFileTimestamps = false` and `isReproducibleFileOrder = true` on all `AbstractArchiveTask` instances ([Gradle User Manual](https://docs.gradle.org/current/kotlin-dsl/gradle/org.gradle.api.tasks.bundling/-abstract-archive-task/is-reproducible-file-order.html)).
   - Disables `dependenciesInfo { includeInApk = false; includeInBundle = false }` to eliminate Google Play's non-reproducible signing block.
   - Enforces `TZ=UTC`, `LC_ALL=C.UTF-8`, and `SOURCE_DATE_EPOCH` from the latest Git commit timestamp.
3. **Cryptographic Verification**:
   - Every build outputs `Xmusic-v<version>-android-<abi>-release.apk` alongside `Xmusic-v<version>-android-<abi>-release.apk.sha256`.
