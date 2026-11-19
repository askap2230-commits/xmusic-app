#!/usr/bin/env python3
# Copyright 2026 Azka Putra
# SPDX-License-Identifier: AGPL-3.0-or-later

"""
Full Android Adaptive Icon & Mipmap Synchronization Script for Tauri v2.

100% Zero-Dependency by design: uses Pillow if already installed, otherwise falls
back automatically to the built-in pure Python 3 standard library PNG codec and
area-averaging resizer (struct + zlib + math). Never requires `apt-get` or `pip`
in GitHub Actions CI.
"""
from __future__ import annotations

import glob
import math
import os
import struct
import sys
import zlib
from typing import Tuple

try:
    from PIL import Image, ImageDraw  # type: ignore[import-not-found]

    _HAS_PIL = True
except ImportError:
    _HAS_PIL = False

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ICON_SRC = os.path.join(ROOT, "app-icon.png")
ANDROID_RES = os.path.join(ROOT, "src-tauri", "gen", "android", "app", "src", "main", "res")
BG_HEX = "#000000"
BG_RGBA = (0, 0, 0, 255)

DENSITIES = {
    "mipmap-mdpi": (48, 108),
    "mipmap-hdpi": (72, 162),
    "mipmap-xhdpi": (96, 216),
    "mipmap-xxhdpi": (144, 324),
    "mipmap-xxxhdpi": (192, 432),
}

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


# ---------------------------------------------------------------------------
# Pure Python Standard Library PNG Codec & Image Ops (Zero External Packages)
# ---------------------------------------------------------------------------

def _paeth_predictor(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa = abs(p - a)
    pb = abs(p - b)
    pc = abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def _read_png_rgba(path: str) -> Tuple[int, int, bytearray]:
    """Decode an 8-bit non-interlaced PNG (RGBA, RGB, L, or LA) into RGBA bytes."""
    with open(path, "rb") as fh:
        data = fh.read()

    if data[:8] != PNG_SIGNATURE:
        raise ValueError(f"Not a valid PNG file: {path}")

    pos = 8
    width = height = bit_depth = color_type = interlace = 0
    idat_chunks: list[bytes] = []

    while pos + 8 <= len(data):
        length, ctype = struct.unpack(">I4s", data[pos : pos + 8])
        pos += 8
        chunk = data[pos : pos + length]
        pos += length + 4  # skip CRC
        if ctype == b"IHDR":
            width, height, bit_depth, color_type, _comp, _flt, interlace = struct.unpack(
                ">IIBBBBB", chunk
            )
        elif ctype == b"IDAT":
            idat_chunks.append(chunk)
        elif ctype == b"IEND":
            break

    if bit_depth != 8 or interlace != 0:
        raise ValueError(
            f"Unsupported PNG format ({width}x{height}, bit_depth={bit_depth}, interlace={interlace})"
        )

    channels_map = {0: 1, 2: 3, 4: 2, 6: 4}
    if color_type not in channels_map:
        raise ValueError(f"Unsupported PNG color_type={color_type}; expected 0, 2, 4, or 6")

    bpp = channels_map[color_type]
    stride = width * bpp
    raw = zlib.decompress(b"".join(idat_chunks))

    recon = bytearray(height * stride)
    src_off = 0
    for y in range(height):
        flt = raw[src_off]
        src_off += 1
        row_start = y * stride
        prev_start = (y - 1) * stride

        if flt == 0:  # None
            recon[row_start : row_start + stride] = raw[src_off : src_off + stride]
        elif flt == 1:  # Sub
            for x in range(stride):
                left = recon[row_start + x - bpp] if x >= bpp else 0
                recon[row_start + x] = (raw[src_off + x] + left) & 0xFF
        elif flt == 2:  # Up
            for x in range(stride):
                up = recon[prev_start + x] if y > 0 else 0
                recon[row_start + x] = (raw[src_off + x] + up) & 0xFF
        elif flt == 3:  # Average
            for x in range(stride):
                left = recon[row_start + x - bpp] if x >= bpp else 0
                up = recon[prev_start + x] if y > 0 else 0
                recon[row_start + x] = (raw[src_off + x] + ((left + up) >> 1)) & 0xFF
        elif flt == 4:  # Paeth
            for x in range(stride):
                left = recon[row_start + x - bpp] if x >= bpp else 0
                up = recon[prev_start + x] if y > 0 else 0
                up_left = recon[prev_start + x - bpp] if (y > 0 and x >= bpp) else 0
                recon[row_start + x] = (
                    raw[src_off + x] + _paeth_predictor(left, up, up_left)
                ) & 0xFF
        else:
            raise ValueError(f"Unknown PNG filter type: {flt}")

        src_off += stride

    if color_type == 6:
        return width, height, recon

    rgba = bytearray(width * height * 4)
    out_i = 0
    if color_type == 2:  # RGB -> RGBA
        for i in range(0, len(recon), 3):
            rgba[out_i] = recon[i]
            rgba[out_i + 1] = recon[i + 1]
            rgba[out_i + 2] = recon[i + 2]
            rgba[out_i + 3] = 255
            out_i += 4
    elif color_type == 0:  # Grayscale -> RGBA
        for v in recon:
            rgba[out_i] = v
            rgba[out_i + 1] = v
            rgba[out_i + 2] = v
            rgba[out_i + 3] = 255
            out_i += 4
    elif color_type == 4:  # Grayscale+Alpha -> RGBA
        for i in range(0, len(recon), 2):
            v = recon[i]
            rgba[out_i] = v
            rgba[out_i + 1] = v
            rgba[out_i + 2] = v
            rgba[out_i + 3] = recon[i + 1]
            out_i += 4
    return width, height, rgba


def _png_chunk(ctype: bytes, payload: bytes) -> bytes:
    crc = zlib.crc32(ctype)
    crc = zlib.crc32(payload, crc) & 0xFFFFFFFF
    return struct.pack(">I", len(payload)) + ctype + payload + struct.pack(">I", crc)


def _write_png_rgba(path: str, width: int, height: int, rgba: bytes | bytearray) -> None:
    """Encode 32-bit RGBA bytes to a deterministic, compressed PNG file."""
    stride = width * 4
    raw = bytearray((stride + 1) * height)
    dst = 0
    for y in range(height):
        raw[dst] = 0  # Filter type 0 (None)
        dst += 1
        src = y * stride
        raw[dst : dst + stride] = rgba[src : src + stride]
        dst += stride

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    compressed = zlib.compress(bytes(raw), level=9)
    with open(path, "wb") as fh:
        fh.write(PNG_SIGNATURE)
        fh.write(_png_chunk(b"IHDR", ihdr))
        fh.write(_png_chunk(b"IDAT", compressed))
        fh.write(_png_chunk(b"IEND", b""))


def _resize_rgba_stdlib(
    src_w: int, src_h: int, src: bytes | bytearray, dst_w: int, dst_h: int
) -> bytearray:
    """High-quality area-averaging downscale / bilinear upscale in pure Python."""
    if src_w == dst_w and src_h == dst_h:
        return bytearray(src)

    out = bytearray(dst_w * dst_h * 4)
    scale_x = src_w / dst_w
    scale_y = src_h / dst_h

    if scale_x >= 1.0 and scale_y >= 1.0:
        # Area averaging (box filter) for crisp, alias-free downscaling
        x_ranges = [
            (int(x * scale_x), max(int(x * scale_x) + 1, min(src_w, int((x + 1) * scale_x))))
            for x in range(dst_w)
        ]
        y_ranges = [
            (int(y * scale_y), max(int(y * scale_y) + 1, min(src_h, int((y + 1) * scale_y))))
            for y in range(dst_h)
        ]
        for dy, (y0, y1) in enumerate(y_ranges):
            row_out = dy * dst_w * 4
            y_offsets = [sy * src_w * 4 for sy in range(y0, y1)]
            for dx, (x0, x1) in enumerate(x_ranges):
                r_sum = g_sum = b_sum = a_sum = 0
                count = (y1 - y0) * (x1 - x0)
                for y_off in y_offsets:
                    p = y_off + x0 * 4
                    end = y_off + x1 * 4
                    while p < end:
                        r_sum += src[p]
                        g_sum += src[p + 1]
                        b_sum += src[p + 2]
                        a_sum += src[p + 3]
                        p += 4
                idx = row_out + dx * 4
                out[idx] = r_sum // count
                out[idx + 1] = g_sum // count
                out[idx + 2] = b_sum // count
                out[idx + 3] = a_sum // count
        return out

    # Bilinear fallback when upscaling
    for dy in range(dst_h):
        sy = (dy + 0.5) * scale_y - 0.5
        y0 = max(0, min(src_h - 1, int(math.floor(sy))))
        y1 = min(src_h - 1, y0 + 1)
        wy = max(0.0, sy - y0)
        for dx in range(dst_w):
            sx = (dx + 0.5) * scale_x - 0.5
            x0 = max(0, min(src_w - 1, int(math.floor(sx))))
            x1 = min(src_w - 1, x0 + 1)
            wx = max(0.0, sx - x0)
            p00 = (y0 * src_w + x0) * 4
            p10 = (y0 * src_w + x1) * 4
            p01 = (y1 * src_w + x0) * 4
            p11 = (y1 * src_w + x1) * 4
            idx = (dy * dst_w + dx) * 4
            for c in range(4):
                top = src[p00 + c] * (1.0 - wx) + src[p10 + c] * wx
                bot = src[p01 + c] * (1.0 - wx) + src[p11 + c] * wx
                out[idx + c] = int(round(top * (1.0 - wy) + bot * wy))
    return out


def _make_round_stdlib(
    src_w: int, src_h: int, src: bytes | bytearray, size: int
) -> bytearray:
    """Resize and apply an anti-aliased circular alpha mask."""
    resized = _resize_rgba_stdlib(src_w, src_h, src, size, size)
    cx = (size - 1) * 0.5
    cy = (size - 1) * 0.5
    radius = size * 0.5
    for y in range(size):
        dy = y - cy
        dy2 = dy * dy
        row = y * size * 4
        for x in range(size):
            dx = x - cx
            dist = math.sqrt(dx * dx + dy2)
            if dist >= radius + 0.5:
                resized[row + x * 4 + 3] = 0
            elif dist > radius - 0.5:
                cov = (radius + 0.5) - dist
                a_idx = row + x * 4 + 3
                resized[a_idx] = int(resized[a_idx] * cov)
    return resized


def _make_foreground_stdlib(
    src_w: int, src_h: int, src: bytes | bytearray, canvas_size: int
) -> bytearray:
    """Center the logo inside the 66dp safe zone of a 108dp Adaptive Icon canvas."""
    fg = bytearray(BG_RGBA) * (canvas_size * canvas_size)
    inner = int(canvas_size * 0.76)
    logo = _resize_rgba_stdlib(src_w, src_h, src, inner, inner)
    offset = (canvas_size - inner) // 2

    for y in range(inner):
        dst_row = (y + offset) * canvas_size * 4
        src_row = y * inner * 4
        for x in range(inner):
            sp = src_row + x * 4
            alpha = logo[sp + 3]
            if alpha == 0:
                continue
            dp = dst_row + (x + offset) * 4
            if alpha == 255:
                fg[dp] = logo[sp]
                fg[dp + 1] = logo[sp + 1]
                fg[dp + 2] = logo[sp + 2]
                fg[dp + 3] = 255
            else:
                inv = 255 - alpha
                fg[dp] = (logo[sp] * alpha + fg[dp] * inv) // 255
                fg[dp + 1] = (logo[sp + 1] * alpha + fg[dp + 1] * inv) // 255
                fg[dp + 2] = (logo[sp + 2] * alpha + fg[dp + 2] * inv) // 255
                fg[dp + 3] = 255
    return fg


# ---------------------------------------------------------------------------
# Optional Pillow Fast-Path (Used Only If Already Installed)
# ---------------------------------------------------------------------------

def _make_round_pil(img: "Image.Image", size: int) -> "Image.Image":
    resized = img.resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(resized, (0, 0), mask)
    return out


def _make_foreground_pil(img: "Image.Image", canvas_size: int) -> "Image.Image":
    fg = Image.new("RGBA", (canvas_size, canvas_size), BG_RGBA)
    inner = int(canvas_size * 0.76)
    logo = img.resize((inner, inner), Image.Resampling.LANCZOS)
    offset = (canvas_size - inner) // 2
    fg.paste(logo, (offset, offset), logo)
    return fg


# ---------------------------------------------------------------------------
# Main Synchronization Entrypoint
# ---------------------------------------------------------------------------

def _write_adaptive_xml() -> None:
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


def main() -> None:
    force_stdlib = "--stdlib-only" in sys.argv or os.environ.get("XMUSIC_ICON_STDLIB") == "1"
    use_pil = _HAS_PIL and not force_stdlib

    if not os.path.exists(ICON_SRC):
        raise FileNotFoundError(f"Master icon not found: {ICON_SRC}")

    if use_pil:
        im = Image.open(ICON_SRC).convert("RGBA")
        im.save(ICON_SRC, "PNG", optimize=True)
        print(
            f"[Icon Sync] Verified 32-bit RGBA master icon (Pillow): {ICON_SRC} ({im.size}, {im.mode})"
        )
    else:
        src_w, src_h, src_rgba = _read_png_rgba(ICON_SRC)
        print(
            f"[Icon Sync] Verified 32-bit RGBA master icon (stdlib): {ICON_SRC} ({src_w}x{src_h}, RGBA)"
        )

    if not os.path.exists(ANDROID_RES):
        print(f"[Icon Sync] Android project not initialized ({ANDROID_RES}); skipping res injection.")
        return

    for folder, (launcher_px, fg_px) in DENSITIES.items():
        target_dir = os.path.join(ANDROID_RES, folder)
        os.makedirs(target_dir, exist_ok=True)
        for webp_file in glob.glob(os.path.join(target_dir, "ic_launcher*.webp")):
            os.remove(webp_file)

        if use_pil:
            im.resize((launcher_px, launcher_px), Image.Resampling.LANCZOS).save(
                os.path.join(target_dir, "ic_launcher.png"), "PNG", optimize=True
            )
            _make_round_pil(im, launcher_px).save(
                os.path.join(target_dir, "ic_launcher_round.png"), "PNG", optimize=True
            )
            _make_foreground_pil(im, fg_px).save(
                os.path.join(target_dir, "ic_launcher_foreground.png"), "PNG", optimize=True
            )
        else:
            launcher_rgba = _resize_rgba_stdlib(src_w, src_h, src_rgba, launcher_px, launcher_px)
            round_rgba = _make_round_stdlib(src_w, src_h, src_rgba, launcher_px)
            fg_rgba = _make_foreground_stdlib(src_w, src_h, src_rgba, fg_px)
            _write_png_rgba(
                os.path.join(target_dir, "ic_launcher.png"), launcher_px, launcher_px, launcher_rgba
            )
            _write_png_rgba(
                os.path.join(target_dir, "ic_launcher_round.png"),
                launcher_px,
                launcher_px,
                round_rgba,
            )
            _write_png_rgba(
                os.path.join(target_dir, "ic_launcher_foreground.png"), fg_px, fg_px, fg_rgba
            )

    _write_adaptive_xml()
    engine_label = "Pillow" if use_pil else "pure-Python stdlib"
    print(
        f"[Icon Sync] Synchronized all Android mipmap densities and Adaptive Icon v26 XML ({engine_label})."
    )


if __name__ == "__main__":
    main()
