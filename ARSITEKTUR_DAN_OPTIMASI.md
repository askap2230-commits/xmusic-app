# Dokumentasi Arsitektur, Perbaikan Bug, & Optimasi Ukuran APK

Dokumen ini merinci perubahan arsitektur dari versi sebelumnya menuju **nys Xmusic v2.0** berbasis **Tauri v2.12** dan **SvelteKit 3.2**.

---

## 1. Perbaikan Akar Masalah pada Versi Sebelumnya

Berdasarkan audit menyeluruh terhadap kode dan workflow versi sebelumnya, ditemukan dan diperbaiki 6 masalah utama:

1. **Masalah Icon Aplikasi Tidak Muncul di `.apk` (Tertimpa Icon Default Tauri)**:
   - **Penyebab**: Pada `.github/workflows/build-apk.yml` lama, perintah `npx tauri icon app-icon.png` dijalankan **sebelum** `npx tauri android init`. Akibatnya, saat `npx tauri android init` berjalan di langkah berikutnya, Tauri membuat folder `src-tauri/gen/android/app/src/main/res/` berisi icon vector bawaan Tauri (`drawable-v24/ic_launcher_foreground.xml`).
   - **Solusi**: Urutan dirombak sehingga `npx tauri android init` dijalankan **lebih dulu**, diikuti `npx tauri icon app-icon.png` ([Dokumentasi App Icons Tauri v2](https://v2.tauri.app/develop/icons/)) dan skrip `scripts/sync-android-icons.py` yang secara eksplisit menghapus vector bawaan Tauri, menulis seluruh resolusi `mipmap-mdpi` s/d `mipmap-xxxhdpi` (`ic_launcher.png`, `ic_launcher_round.png`, `ic_launcher_foreground.png`), serta memperbarui konfigurasi Adaptive Icon Android 8.0+ (`mipmap-anydpi-v26/ic_launcher.xml`) dengan warna latar `#05060A` ([Referensi Adaptive Icon Tauri Android](https://zenn.dev/tyto/articles/e1c0ce4da49bbb)).
2. **Masalah Waktu Build GitHub Actions Sangat Lama (>20 Menit) & Ukuran APK Membengkak**:
   - **Penyebab**: Perintah `npx tauri android build --apk` tanpa argumen `--target` memaksa Cargo mengompilasi seluruh crate Rust sebanyak **4 kali** (`aarch64-linux-android`, `armv7-linux-androideabi`, `i686-linux-android`, `x86_64-linux-android`) dan menggabungkan keempat file `.so` ke dalam satu APK universal. Selain itu, langkah setup Android selalu mengunduh ulang NDK meski sudah tersedia di runner GitHub.
   - **Solusi**: Default build kini menargetkan `aarch64` (`--target aarch64` / `arm64-v8a`), mendeteksi NDK yang sudah terpasang di runner `ubuntu-24.04`, serta menambahkan tiga lapis cache (`Swatinem/rust-cache@v2`, cache `~/.gradle`, dan cache `~/.npm`).
3. **Masalah Gagal Update APK (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`)**:
   - **Penyebab**: Workflow lama membuat keystore acak baru (`keytool -genkeypair`) setiap kali workflow dijalankan, sehingga sertifikat tanda tangan digital selalu berubah.
   - **Solusi**: Menyediakan keystore rilis tetap di `src-tauri/keystore/xmusic-release.jks` (serta mendukung override melalui secret `KEYSTORE_BASE64`).
4. **Tombol Mati (*Dead Buttons*) & Bug Navigasi pada UI Lama**:
   - Tombol `Shuffle` (`#shuffleBtn`) dan `Queue` (`#queueBtn`) sebelumnya tidak memiliki *event listener* sama sekali, dan panel `#nowplaying` kosong. Kini keduanya berfungsi penuh.
   - Handler tombol *Back* Android sebelumnya mencari `#editProfileModal` padahal ID elemennya `#editModal`. Kini seluruh modal ditangani secara konsisten oleh state reaktif.
5. **Visualizer Palsu (*Gimmick*)**:
   - Visualizer lama hanya menggambar gelombang sinus matematika acak (`Math.sin`) yang tidak berhubungan dengan suara musik. Kini menggunakan `AnalyserNode.getByteFrequencyData()` dari **Web Audio API** yang membaca frekuensi asli audio secara real-time.
6. **Beban GPU Berlebih di Android WebView**:
   - Tiga elemen `.blob` berukuran >50vw dengan `filter: blur(110px)` ditambah `backdrop-filter: blur(38px)` berlapis menyebabkan *frame drop* saat melakukan scroll di HP. Kini diganti dengan *multi-stop radial gradient* terakselerasi GPU (`will-change: transform` dan `contain: content`).

---

## 2. Migrasi ke SvelteKit 3.2 & Svelte 5 Runes

Sesuai spesifikasi resmi **[SvelteKit 3.0+](https://svelte.dev/blog/whats-new-in-svelte-october-2026)** ([Panduan Konfigurasi Vite SvelteKit 3](https://chornous.dev/blog/sveltekit-3-vite-config-lib-alias/)):

- **Konfigurasi Terpadu di `vite.config.js`**: File `svelte.config.js` telah dihentikan di SvelteKit 3; adapter statis (`@sveltejs/adapter-static@^4.0.1`) kini dikonfigurasi langsung di dalam `sveltekit({ adapter: adapter({ pages: 'dist', assets: 'dist', fallback: 'index.html' }) })` pada `vite.config.js` ([Dokumentasi Single-Page Apps SvelteKit](https://svelte.dev/docs/kit/single-page-apps)).
- **Node Subpath Imports (`#lib/*`)**: Alias `$lib` digantikan oleh standar Node subpath imports `#lib/*` yang dideklarasikan di `package.json` dengan ekstensi file eksplisit (`#lib/audio/engine.svelte.js`, `#lib/db/storage.js`, `#lib/api/services.js`, `#lib/data/presets.js`).
- **Svelte 5 Runes**: Seluruh state reaktif menggunakan `$state`, `$derived`, `$props`, dan `{#snippet}` tanpa sintaks warisan Svelte 4 ([Catatan Migrasi SvelteKit 3 & Vite 8](https://medium.com/@vasanthank29/sveltekit-3-migration-notes-node-22-vite-8-and-what-actually-breaks-f61f9e0a112f)).

---

## 3. Teknik Optimasi Ukuran APK Produksi

Untuk menghasilkan ukuran `.apk` sekecil dan seringan mungkin tanpa mengurangi fitur:

1. **Profil Kompilasi Rust (`src-tauri/Cargo.toml`)**:
   - `opt-level = "z"`: Menginstruksikan kompiler LLVM untuk memprioritaskan ukuran instruksi mesin terkecil.
   - `lto = "fat"` & `codegen-units = 1`: Melakukan *Link-Time Optimization* menyeluruh lintas seluruh crate dependensi untuk menghapus fungsi yang tidak terpakai (*dead code elimination*).
   - `panic = "abort"` & `strip = "symbols"`: Menghapus kode *stack unwinding* dan tabel simbol debug dari binary `.so` Android.
2. **Linker Flags Android (`src-tauri/.cargo/config.toml`)**:
   - Menambahkan `-C link-arg=-Wl,--gc-sections` dan `-C link-arg=-Wl,--strip-all` pada target Android.
3. **R8 Code & Resource Shrinking (`scripts/optimize-android-gradle.py`)**:
   - Mengaktifkan `isMinifyEnabled = true`, `isShrinkResources = true`, dan `android.enableR8.fullMode=true` pada Gradle Android sehingga kelas Java/Kotlin AndroidX dan resource bawaan yang tidak digunakan dibuang otomatis saat pembuatan APK rilis.
4. **Zero-Asset Audio Demo**:
   - Lagu uji coba bawaan (*Midnight Drive Synthwave*) tidak disimpan sebagai file `.mp3` statis berukuran beberapa megabyte di dalam APK, melainkan disintesis secara instan di memori menggunakan `OfflineAudioContext` menjadi `Blob` WAV stereo 44.1kHz saat pengguna menekan tombol *Putar Lagu Demo* (**0 KB** tambahan pada ukuran APK).
