#!/usr/bin/env python3
"""
Android Build & APK Size Optimization Script for Tauri v2.12+.

Operations:
1. Configures AndroidManifest.xml with cleartext streaming support and round launcher icons.
2. Enables R8 code minification (isMinifyEnabled = true) and resource shrinking
   (isShrinkResources = true) in app/build.gradle.kts to minimize release APK size.
3. Appends parallel execution, caching, and R8 full-mode flags to gradle.properties.
"""
from __future__ import annotations

import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ANDROID_DIR = os.path.join(ROOT, "src-tauri", "gen", "android")


def patch_manifest() -> None:
    manifest_path = os.path.join(ANDROID_DIR, "app", "src", "main", "AndroidManifest.xml")
    if not os.path.exists(manifest_path):
        print(f"[Android Optimize] Manifest not found yet: {manifest_path}")
        return

    with open(manifest_path, "r", encoding="utf-8") as fh:
        content = fh.read()

    content = content.replace(
        'android:usesCleartextTraffic="${usesCleartextTraffic}"',
        'android:usesCleartextTraffic="true"',
    )
    if "android:usesCleartextTraffic" not in content:
        content = content.replace(
            "<application",
            '<application android:usesCleartextTraffic="true"',
            1,
        )

    if "android:roundIcon=" not in content:
        content = content.replace(
            'android:icon="@mipmap/ic_launcher"',
            'android:icon="@mipmap/ic_launcher"\n        android:roundIcon="@mipmap/ic_launcher_round"',
        )

    with open(manifest_path, "w", encoding="utf-8") as fh:
        fh.write(content)
    print("[Android Optimize] Patched AndroidManifest.xml.")


def patch_build_gradle() -> None:
    gradle_kts = os.path.join(ANDROID_DIR, "app", "build.gradle.kts")
    if not os.path.exists(gradle_kts):
        print(f"[Android Optimize] build.gradle.kts not found yet: {gradle_kts}")
        return

    with open(gradle_kts, "r", encoding="utf-8") as fh:
        content = fh.read()

    if "isShrinkResources = true" not in content:
        content = re.sub(
            r"isMinifyEnabled\s*=\s*false",
            "isMinifyEnabled = true\n            isShrinkResources = true",
            content,
        )

    with open(gradle_kts, "w", encoding="utf-8") as fh:
        fh.write(content)
    print("[Android Optimize] Enabled R8 minification and resource shrinking in app/build.gradle.kts.")


def patch_gradle_properties() -> None:
    prop_path = os.path.join(ANDROID_DIR, "gradle.properties")
    if not os.path.exists(prop_path):
        print(f"[Android Optimize] gradle.properties not found yet: {prop_path}")
        return

    with open(prop_path, "r", encoding="utf-8") as fh:
        content = fh.read()

    optimizations = """
# Xmusic Tauri v2.12 Build Speed & APK Size Optimizations
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.daemon=true
org.gradle.configureondemand=true
org.gradle.jvmargs=-Xmx4096m -XX:+UseParallelGC -Dfile.encoding=UTF-8
kotlin.incremental=true
android.enableR8.fullMode=true
"""
    if "android.enableR8.fullMode=true" not in content:
        content = content.rstrip() + "\n" + optimizations

    with open(prop_path, "w", encoding="utf-8") as fh:
        fh.write(content)
    print("[Android Optimize] Updated gradle.properties for fast cached CI builds.")


if __name__ == "__main__":
    patch_manifest()
    patch_build_gradle()
    patch_gradle_properties()
