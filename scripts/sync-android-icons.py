#!/usr/bin/env python3
"""
Sinkronisasi Penuh Icon Aplikasi Xmusic untuk Tauri v2 (Desktop & Android Adaptive Icons).
Menjamin icon aplikasi muncul dengan tajam di launcher Android (API 24 s/d API 35+)
dan tidak tertimpa oleh vector drawable bawaan template Tauri.
"""
import os
import glob
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ICON_SRC = os.path.join(ROOT, "app-icon.png")
ANDROID_RES = os.path.join(ROOT, "src-tauri", "gen", "android", "app", "src", "main", "res")

def make_round_icon(img: Image.Image, size: int) -> Image.Image:
    resized = img.resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(resized, (0, 0), mask)
    return out

def make_foreground_icon(img: Image.Image, canvas_size: int) -> Image.Image:
    # Safe zone Android Adaptive Icon (66dp di dalam 108dp canvas)
    fg = Image.new("RGBA", (canvas_size, canvas_size), (5, 6, 10, 255))
    inner = int(canvas_size * 0.76)
    logo = img.resize((inner, inner), Image.Resampling.LANCZOS)
    offset = (canvas_size - inner) // 2
    fg.paste(logo, (offset, offset), logo)
    return fg

def main():
    if not os.path.exists(ICON_SRC):
        raise FileNotFoundError(f"File icon utama tidak ditemukan: {ICON_SRC}")

    im = Image.open(ICON_SRC).convert("RGBA")
    im.save(ICON_SRC, "PNG", optimize=True)
    print(f"[Icon Sync] Master icon terverifikasi: {ICON_SRC} ({im.size}, {im.mode})")

    if not os.path.exists(ANDROID_RES):
        print(f"[Icon Sync] Direktori Android belum diinisialisasi ({ANDROID_RES}), melewati injeksi res Android.")
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
        # Hapus file .webp bawaan jika ada agar tidak bentrok dengan .png
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

    # Hapus drawable vector bawaan Tauri yang sering menimpa ic_launcher_foreground
    for pattern in [
        os.path.join(ANDROID_RES, "drawable*", "ic_launcher*.xml"),
        os.path.join(ANDROID_RES, "drawable*", "ic_launcher*.png"),
        os.path.join(ANDROID_RES, "drawable*", "ic_launcher*.webp"),
    ]:
        for f in glob.glob(pattern):
            os.remove(f)
            print(f"[Icon Sync] Menghapus icon template bawaan: {f}")

    # Tulis konfigurasi Adaptive Icon Android 8.0+ (mipmap-anydpi-v26)
    anydpi_dir = os.path.join(ANDROID_RES, "mipmap-anydpi-v26")
    os.makedirs(anydpi_dir, exist_ok=True)
    adaptive_xml = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
"""
    for xml_name in ["ic_launcher.xml", "ic_launcher_round.xml"]:
        with open(os.path.join(anydpi_dir, xml_name), "w", encoding="utf-8") as f:
            f.write(adaptive_xml)

    # Pastikan warna background adaptive icon sesuai dengan warna dasar Xmusic (#05060A)
    values_dir = os.path.join(ANDROID_RES, "values")
    os.makedirs(values_dir, exist_ok=True)
    bg_xml_path = os.path.join(values_dir, "ic_launcher_background.xml")
    with open(bg_xml_path, "w", encoding="utf-8") as f:
        f.write("""<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#05060A</color>
</resources>
""")

    print("[Icon Sync] Seluruh icon Android (mipmap-mdpi s/d xxxhdpi + Adaptive Icon v26) berhasil dipasang!")

if __name__ == "__main__":
    main()
