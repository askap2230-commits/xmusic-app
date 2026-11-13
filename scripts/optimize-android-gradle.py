#!/usr/bin/env python3
"""
Optimasi Proyek Android Tauri v2 (Ukuran APK Kecil, Build Gradle Cepat, & Kompatibilitas Instalasi):
1. Memastikan AndroidManifest.xml mengizinkan cleartext/streaming & memakai @mipmap/ic_launcher.
2. Mengaktifkan R8 Minification (isMinifyEnabled = true) & Resource Shrinking (isShrinkResources = true)
   pada build.gradle.kts agar ukuran APK rilis sangat kecil dan tidak bloated.
3. Mengoptimalkan gradle.properties untuk caching paralel di GitHub Actions.
"""
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ANDROID_DIR = os.path.join(ROOT, "src-tauri", "gen", "android")

def patch_manifest():
    manifest_path = os.path.join(ANDROID_DIR, "app", "src", "main", "AndroidManifest.xml")
    if not os.path.exists(manifest_path):
        print(f"[Android Optimize] Manifest belum ada: {manifest_path}")
        return

    with open(manifest_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Pastikan usesCleartextTraffic="true"
    content = content.replace(
        'android:usesCleartextTraffic="${usesCleartextTraffic}"',
        'android:usesCleartextTraffic="true"'
    )
    if "android:usesCleartextTraffic" not in content:
        content = content.replace(
            "<application",
            '<application android:usesCleartextTraffic="true"',
            1
        )

    # Pastikan android:icon dan android:roundIcon mengarah ke @mipmap/ic_launcher
    if 'android:roundIcon=' not in content:
        content = content.replace(
            'android:icon="@mipmap/ic_launcher"',
            'android:icon="@mipmap/ic_launcher"\n        android:roundIcon="@mipmap/ic_launcher_round"'
        )

    with open(manifest_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[Android Optimize] AndroidManifest.xml berhasil dioptimalkan.")

def patch_build_gradle():
    gradle_kts = os.path.join(ANDROID_DIR, "app", "build.gradle.kts")
    if not os.path.exists(gradle_kts):
        print(f"[Android Optimize] build.gradle.kts belum ada: {gradle_kts}")
        return

    with open(gradle_kts, "r", encoding="utf-8") as f:
        content = f.read()

    # Aktifkan R8 minification & shrinkResources pada blok release
    content = re.sub(
        r'isMinifyEnabled\s*=\s*false',
        'isMinifyEnabled = true\n            isShrinkResources = true',
        content
    )

    with open(gradle_kts, "w", encoding="utf-8") as f:
        f.write(content)
    print("[Android Optimize] R8 Minify & ShrinkResources diaktifkan pada app/build.gradle.kts.")

def patch_gradle_properties():
    prop_path = os.path.join(ANDROID_DIR, "gradle.properties")
    if not os.path.exists(prop_path):
        return

    with open(prop_path, "r", encoding="utf-8") as f:
        content = f.read()

    optimizations = """
# Optimasi Kecepatan Build & Ukuran APK Xmusic
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.daemon=true
org.gradle.configureondemand=true
org.gradle.jvmargs=-Xmx4096m -XX:+UseParallelGC -Dfile.encoding=UTF-8
kotlin.incremental=true
android.enableR8.fullMode=true
"""
    if "org.gradle.caching=true" not in content:
        content = content.rstrip() + "\n" + optimizations

    with open(prop_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[Android Optimize] gradle.properties berhasil dioptimalkan untuk build cepat.")

if __name__ == "__main__":
    patch_manifest()
    patch_build_gradle()
    patch_gradle_properties()
