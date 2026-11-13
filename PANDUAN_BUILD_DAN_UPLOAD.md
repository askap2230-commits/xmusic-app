# Panduan Upload ke GitHub & Build APK Cepat (GitHub Actions)

Dokumen ini menjelaskan langkah praktis untuk mengunggah proyek **nys Xmusic v2.0** ke GitHub, menjalankan workflow build Android otomatis, mengunduh file `Xmusic.apk`, dan menginstalnya di HP Android tanpa kendala.

---

## 1. Persiapan Izin Repository GitHub

Agar GitHub Actions dapat menyimpan hasil build ke halaman **Releases**, aktifkan izin tulis pada repository kamu:

1. Buat repository baru di GitHub (atau gunakan repository yang sudah ada).
2. Buka tab **Settings** > **Actions** > **General** ([Panduan CI/CD Tauri](https://dev.to/tomtomdu73/ship-your-tauri-v2-app-like-a-pro-github-actions-and-release-automation-part-22-2ef7)).
3. Gulir ke bagian bawah **Workflow permissions**.
4. Pilih **Read and write permissions**, lalu klik **Save**.

---

## 2. Cara Upload Proyek ke GitHub

### Metode A: Menggunakan Git CLI (Direkomendasikan — Semua File Hidden `.github` Ikut Terunggah)

Ekstrak file `.zip` proyek ini ke sebuah folder di komputer atau Termux, lalu jalankan:

```bash
git init
git branch -M main
git add .
git commit -m "Upgrade Xmusic v2.0: SvelteKit 3.2 + Tauri v2.12 + Fast APK Build"
git remote add origin https://github.com/USERNAME_KAMU/NAMA_REPO_KAMU.git
git push -u origin main --force
```

### Metode B: Upload Lewat Browser Web GitHub (HP / Tanpa Git CLI)

Saat mengunggah folder melalui antarmuka web GitHub (*Add file > Upload files*), browser sering mengabaikan folder yang diawali titik seperti `.github`. Jika kamu mengunggah lewat browser:

1. Ekstrak seluruh isi `.zip` dan unggah semua file/folder (`src`, `src-tauri`, `scripts`, `static`, `dist`, `package.json`, `vite.config.js`, `app-icon.png`) ke halaman utama repository, lalu klik **Commit changes**.
2. Jika tab **Actions** belum menampilkan workflow **Build Optimized Android APK**, klik **Add file** > **Create new file**.
3. Ketik nama file: `.github/workflows/build-apk.yml`
4. Salin seluruh isi file `workflow-copy/build-apk.yml` yang ada di dalam zip ini, tempelkan ke editor GitHub, lalu klik **Commit changes**.

---

## 3. Menjalankan Build APK di GitHub Actions

1. Buka tab **Actions** di repository GitHub kamu.
2. Klik workflow **Build Optimized Android APK (Tauri v2 + SvelteKit 3)** di panel kiri.
3. Klik tombol **Run workflow** di sebelah kanan.
4. Pada pilihan **Arsitektur CPU APK (`target_arch`)**:
   - Pilih **`aarch64`** (Default & sangat disarankan): Membangun khusus untuk CPU 64-bit (`arm64-v8a`) yang digunakan oleh 99%+ smartphone Android modern. Waktu kompilasi Rust **4x lebih cepat** dan ukuran file APK jauh lebih ramping (~4–7 MB).
   - Pilih **`universal`**: Hanya jika kamu ingin menginstal APK pada emulator PC x86_64 atau perangkat Android 32-bit lawas (`armeabi-v7a`).
5. Klik tombol hijau **Run workflow**.

### Estimasi Waktu Eksekusi Build
- **Run Pertama (Membuat Cache Baru)**: ~6–9 menit (sebelumnya >22 menit karena mengompilasi 4 arsitektur sekaligus dan mengunduh ulang NDK).
- **Run Berikutnya (Cache Rust + Gradle + NPM Aktif)**: **~2,5–4 menit**.

---

## 4. Mengunduh & Menginstal `Xmusic.apk` di HP Android

Setelah status workflow berubah menjadi centang hijau (**Success**):

1. **Melalui Artifacts**: Buka rincian run workflow tersebut, gulir ke bagian bawah **Artifacts**, lalu unduh **`Xmusic-apk`** (ekstrak untuk mendapatkan `Xmusic.apk`).
2. **Melalui Releases**: Atau buka halaman **Releases** di halaman utama repository kamu dan unduh langsung file **`Xmusic.apk`** tanpa perlu ekstrak zip.
3. **Instalasi di Android**:
   - Ketuk file `Xmusic.apk` di HP Android kamu.
   - Icon peluncur **Xmusic** (huruf X gradasi biru-ungu dengan not musik putih di atas latar hitam `#05060A`) akan langsung tampil saat proses instalasi maupun di layar utama HP.
   - Karena proyek ini menyertakan keystore rilis tetap (`src-tauri/keystore/xmusic-release.jks`) dan menandatangani APK menggunakan skema **v1 + v2 + v3** ([Dokumentasi Penandatanganan Android Tauri](https://v2.tauri.app/distribute/sign/android/)), kamu dapat menginstal versi pembaruan berikutnya secara langsung di atas aplikasi lama tanpa perlu *uninstall* terlebih dahulu.
