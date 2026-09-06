#!/usr/bin/env python3
"""Build Android adaptive + legacy launcher icons from store/play/icon-512.png.

The store art is already a full-bleed purple squircle with the book inset.
Use that for legacy mipmaps and as a full-canvas adaptive foreground so the
system mask never sees a white margin (which looked like an empty icon).
"""
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


def scale_cover(im, size):
    im = im.convert("RGBA")
    ratio = max(size / im.width, size / im.height)
    resized = im.resize((max(1, int(im.width * ratio)), max(1, int(im.height * ratio))), Image.Resampling.LANCZOS)
    left = (resized.width - size) // 2
    top = (resized.height - size) // 2
    return resized.crop((left, top, left + size, top + size))


def main():
    src = Image.open(SRC).convert("RGBA")
    android_res = ROOT / "android" / "app" / "src" / "main" / "res"
    native_res = ROOT / "native-src" / "android" / "res"

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
    print("launcher icons written")


if __name__ == "__main__":
    main()
