#!/usr/bin/env python3
# Copyright 2026 Azka Putra
# SPDX-License-Identifier: AGPL-3.0-or-later

"""
Full Android Adaptive Icon & Mipmap Synchronization Script for Tauri v2.
"""
from __future__ import annotations

import glob
import os
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ICON_SRC = os.path.join(ROOT, "app-icon.png")
ANDROID_RES = os.path.join(ROOT, "src-tauri", "gen", "android", "app", "src", "main", "res")
BG_HEX = "#000000"
BG_RGBA = (0, 0, 0, 255)


def make_round_icon(img: Image.Image, size: int) -> Image.Image:
    resized = img.resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(resized, (0, 0), mask)
    return out


def make_foreground_icon(img: Image.Image, canvas_size: int) -> Image.Image:
    """Centers the logo inside the 66dp safe zone of a 108dp Adaptive Icon canvas."""
    fg = Image.new("RGBA", (canvas_size, canvas_size), BG_RGBA)
    inner = int(canvas_size * 0.76)
    logo = img.resize((inner, inner), Image.Resampling.LANCZOS)
    offset = (canvas_size - inner) // 2
    fg.paste(logo, (offset, offset), logo)
    return fg


def main() -> None:
    if not os.path.exists(ICON_SRC):
        raise FileNotFoundError(f"Master icon not found: {ICON_SRC}")

    im = Image.open(ICON_SRC).convert("RGBA")
    im.save(ICON_SRC, "PNG", optimize=True)
    print(f"[Icon Sync] Verified 32-bit RGBA master icon: {ICON_SRC} ({im.size}, {im.mode})")

    if not os.path.exists(ANDROID_RES):
        print(f"[Icon Sync] Android project not initialized ({ANDROID_RES}); skipping res injection.")
        return

    densities = {
        "mipmap-mdpi": (48, 108),
        "mipmap-hdpi": (72, 162),
        "mipmap-xhdpi": (96, 216),
        "mipmap-xxhdpi": (144, 324),
        "mipmap-xxxhdpi": (192, 432),
    }

    for folder, (launcher_px, fg_px) in densities.items():
        target_dir = os.path.join(ANDROID_RES, folder)
        os.makedirs(target_dir, exist_ok=True)
        for webp_file in glob.glob(os.path.join(target_dir, "ic_launcher*.webp")):
            os.remove(webp_file)

        im.resize((launcher_px, launcher_px), Image.Resampling.LANCZOS).save(
            os.path.join(target_dir, "ic_launcher.png"), "PNG", optimize=True
        )
        make_round_icon(im, launcher_px).save(
            os.path.join(target_dir, "ic_launcher_round.png"), "PNG", optimize=True
        )
        make_foreground_icon(im, fg_px).save(
            os.path.join(target_dir, "ic_launcher_foreground.png"), "PNG", optimize=True
        )

    for pattern in (
        os.path.join(ANDROID_RES, "drawable*", "ic_launcher*.xml"),
        os.path.join(ANDROID_RES, "drawable*", "ic_launcher*.png"),
        os.path.join(ANDROID_RES, "drawable*", "ic_launcher*.webp"),
    ):
        for stale in glob.glob(pattern):
            os.remove(stale)

    anydpi_dir = os.path.join(ANDROID_RES, "mipmap-anydpi-v26")
    os.makedirs(anydpi_dir, exist_ok=True)
    adaptive_xml = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
"""
    for xml_name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        with open(os.path.join(anydpi_dir, xml_name), "w", encoding="utf-8") as fh:
            fh.write(adaptive_xml)

    values_dir = os.path.join(ANDROID_RES, "values")
    os.makedirs(values_dir, exist_ok=True)
    with open(os.path.join(values_dir, "ic_launcher_background.xml"), "w", encoding="utf-8") as fh:
        fh.write(
            f"""<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">{BG_HEX}</color>
</resources>
"""
        )

    print("[Icon Sync] Synchronized all Android mipmap densities and Adaptive Icon v26 XML.")


if __name__ == "__main__":
    main()
