#!/usr/bin/env python3
"""Build Android adaptive + legacy launcher icons from store/play/icon-512.png.

The store art is a full-bleed canvas. Corner padding (white fans around a
baked squircle) is flood-filled so Android's mask never shows a white frame.
The sampled edge color is written as ic_launcher_background.
"""
from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "store" / "play" / "icon-512.png"

DENSITIES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}
FG_DENSITIES = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}

BG_XML = """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">{color}</color>
</resources>
"""

DRAWABLE_BG_XML = """<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="{color}"
        android:pathData="M0,0h108v108h-108z" />
</vector>
"""


def luminance(p):
    r, g, b, _a = p
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def sample_body_rgb(im):
    w, h = im.size
    pts = [
        im.getpixel((w // 2, 0)),
        im.getpixel((w // 2, h - 1)),
        im.getpixel((0, h // 2)),
        im.getpixel((w - 1, h // 2)),
        im.getpixel((max(0, w // 12), max(0, h // 12))),
    ]
    dark = min(pts, key=luminance)
    if luminance(dark) >= 80:
        return (0, 0, 0)
    return (dark[0], dark[1], dark[2])


def fill_corner_padding(im, luma_min=28):
    """Replace light pixels connected to the canvas corners with the body color.

    Stops at the dark icon body so inner whites (the moon behind the dog) stay.
    """
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    fill_rgb = sample_body_rgb(im)
    fill = (fill_rgb[0], fill_rgb[1], fill_rgb[2], 255)
    seen = set()
    q = deque([(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)])
    while q:
        x, y = q.popleft()
        if (x, y) in seen or x < 0 or y < 0 or x >= w or y >= h:
            continue
        seen.add((x, y))
        if luminance(px[x, y]) < luma_min:
            continue
        px[x, y] = fill
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im


def scale_cover(im, size):
    im = im.convert("RGBA")
    ratio = max(size / im.width, size / im.height)
    resized = im.resize((max(1, int(im.width * ratio)), max(1, int(im.height * ratio))), Image.Resampling.LANCZOS)
    left = (resized.width - size) // 2
    top = (resized.height - size) // 2
    return resized.crop((left, top, left + size, top + size))


def hex_color(p):
    r, g, b, _a = p
    return f"#{r:02X}{g:02X}{b:02X}"


def write_bg(path, color, template):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(template.format(color=color), encoding="utf-8")


def main():
    src = fill_corner_padding(Image.open(SRC))
    color = hex_color(src.getpixel((0, 0)))
    android_res = ROOT / "android" / "app" / "src" / "main" / "res"
    native_res = ROOT / "native-src" / "android" / "res"
    assets = ROOT / "assets"

    src.save(SRC, "PNG")
    scale_cover(src, 512).save(assets / "icon-512.png", "PNG", optimize=True)
    scale_cover(src, 192).save(assets / "icon-192.png", "PNG", optimize=True)
    scale_cover(src, 180).save(assets / "icon-180.png", "PNG", optimize=True)

    for name, size in DENSITIES.items():
        folder = android_res / f"mipmap-{name}"
        folder.mkdir(parents=True, exist_ok=True)
        legacy = scale_cover(src, size)
        legacy.save(folder / "ic_launcher.png", "PNG")
        legacy.save(folder / "ic_launcher_round.png", "PNG")
        scale_cover(src, FG_DENSITIES[name]).save(folder / "ic_launcher_foreground.png", "PNG")

    fg = scale_cover(src, 432)
    (android_res / "drawable").mkdir(parents=True, exist_ok=True)
    fg.save(android_res / "drawable" / "ic_launcher_foreground.png", "PNG")
    (native_res / "drawable").mkdir(parents=True, exist_ok=True)
    fg.save(native_res / "drawable" / "ic_launcher_foreground.png", "PNG")

    write_bg(android_res / "values" / "ic_launcher_background.xml", color, BG_XML)
    write_bg(native_res / "values" / "ic_launcher_background.xml", color, BG_XML)
    write_bg(android_res / "drawable" / "ic_launcher_background.xml", color, DRAWABLE_BG_XML)
    write_bg(native_res / "drawable" / "ic_launcher_background.xml", color, DRAWABLE_BG_XML)
    print(f"launcher icons written, background {color}")


if __name__ == "__main__":
    main()
