#!/usr/bin/env python3
"""Generate the HRM Software app icon for Android and iOS.

Run from the project root:
    python3 scripts/generate-icons.py

Masters are written to assets/icon/ so the design can be tweaked and re-run.
Requires Pillow (`pip install pillow`).
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets" / "icon"
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"
IOS_ICONS = (
    ROOT / "ios" / "HRMSoftware" / "Images.xcassets" / "AppIcon.appiconset"
)

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
GRADIENT_TOP = (10, 42, 67)      # deep navy
GRADIENT_BOTTOM = (14, 124, 134)  # teal
GOLD = (245, 184, 61, 255)
WHITE = (255, 255, 255, 255)
MIST = (207, 233, 234, 235)

MASTER = 1024


def gradient(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        colour = tuple(
            round(GRADIENT_TOP[i] + (GRADIENT_BOTTOM[i] - GRADIENT_TOP[i]) * t)
            for i in range(3)
        )
        draw.line([(0, y), (size, y)], fill=colour)
    return img.convert("RGBA")


def apply_mask(img: Image.Image, mask: Image.Image) -> Image.Image:
    out = img.copy()
    out.putalpha(mask)
    return out


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=radius, fill=255
    )
    return mask


def circle_mask(size: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
    return mask


def tracked_text(
    draw: ImageDraw.ImageDraw,
    centre_x: int,
    y: int,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill,
    tracking: int,
) -> None:
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = centre_x - total / 2
    for ch, width in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill, anchor="lm")
        x += width + tracking


def draw_mark(
    img: Image.Image,
    font_size: int,
    bar_width: int,
    bar_y: int,
    sub_size: int,
    sub_y: int,
    colour=WHITE,
    sub_colour=MIST,
    bar_colour=GOLD,
) -> None:
    draw = ImageDraw.Draw(img)
    centre = img.size[0] // 2
    font = ImageFont.truetype(FONT_BOLD, font_size)
    draw.text(
        (centre, bar_y - int(font_size * 0.78)),
        "HRM",
        font=font,
        fill=colour,
        anchor="mm",
    )

    bar_height = max(8, int(bar_width * 0.06))
    draw.rounded_rectangle(
        [
            centre - bar_width // 2,
            bar_y,
            centre + bar_width // 2,
            bar_y + bar_height,
        ],
        radius=bar_height // 2,
        fill=bar_colour,
    )

    sub_font = ImageFont.truetype(FONT_BOLD, sub_size)
    tracked_text(draw, centre, sub_y, "SOFTWARE", sub_font, sub_colour, sub_size // 4)


def master_square() -> Image.Image:
    img = gradient(MASTER)
    draw_mark(img, 300, 380, 620, 58, 708)
    return img


def master_rounded() -> Image.Image:
    img = gradient(MASTER)
    draw_mark(img, 300, 380, 620, 58, 708)
    return apply_mask(img, rounded_mask(MASTER, 220))


def master_round() -> Image.Image:
    img = gradient(MASTER)
    draw_mark(img, 300, 380, 620, 58, 708)
    return apply_mask(img, circle_mask(MASTER))


def master_foreground() -> Image.Image:
    img = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    # Keep the mark inside the adaptive-icon safe zone (centre 66%).
    draw_mark(img, 230, 300, 610, 46, 678)
    return img


def master_monochrome() -> Image.Image:
    img = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    draw_mark(
        img,
        230,
        300,
        610,
        46,
        678,
        colour=(255, 255, 255, 255),
        sub_colour=(255, 255, 255, 255),
        bar_colour=(255, 255, 255, 255),
    )
    return img


def save_resized(img: Image.Image, path: Path, size: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.resize((size, size), Image.LANCZOS).save(path, "PNG", optimize=True)


def write_android(square, rounded, circle, foreground, monochrome) -> None:
    legacy = {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192,
    }
    adaptive = {
        "mdpi": 108,
        "hdpi": 162,
        "xhdpi": 216,
        "xxhdpi": 324,
        "xxxhdpi": 432,
    }
    for density, size in legacy.items():
        base = ANDROID_RES / f"mipmap-{density}"
        save_resized(rounded, base / "ic_launcher.png", size)
        save_resized(circle, base / "ic_launcher_round.png", size)
    for density, size in adaptive.items():
        base = ANDROID_RES / f"mipmap-{density}"
        save_resized(foreground, base / "ic_launcher_foreground.png", size)
        save_resized(monochrome, base / "ic_launcher_monochrome.png", size)

    # Android 13+ themed icon fallback also needs a legacy monochrome bitmap.
    save_resized(monochrome, ANDROID_RES / "drawable" / "ic_launcher_monochrome.png", 432)


def write_android_xml() -> None:
    drawable = ANDROID_RES / "drawable"
    drawable.mkdir(parents=True, exist_ok=True)
    (drawable / "ic_launcher_background.xml").write_text(
        """<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <gradient
        android:angle="270"
        android:endColor="#0E7C86"
        android:startColor="#0A2A43" />
</shape>
""",
        encoding="utf-8",
    )

    anydpi = ANDROID_RES / "mipmap-anydpi-v26"
    anydpi.mkdir(parents=True, exist_ok=True)
    adaptive = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
"""
    (anydpi / "ic_launcher.xml").write_text(adaptive, encoding="utf-8")
    (anydpi / "ic_launcher_round.xml").write_text(adaptive, encoding="utf-8")


def write_ios(square) -> None:
    specs = [
        ("20x20", "2x", 40, "AppIcon-20@2x.png"),
        ("20x20", "3x", 60, "AppIcon-20@3x.png"),
        ("29x29", "2x", 58, "AppIcon-29@2x.png"),
        ("29x29", "3x", 87, "AppIcon-29@3x.png"),
        ("40x40", "2x", 80, "AppIcon-40@2x.png"),
        ("40x40", "3x", 120, "AppIcon-40@3x.png"),
        ("60x60", "2x", 120, "AppIcon-60@2x.png"),
        ("60x60", "3x", 180, "AppIcon-60@3x.png"),
        ("1024x1024", "1x", 1024, "AppIcon-1024.png"),
    ]
    images = []
    for size, scale, pixels, filename in specs:
        save_resized(square, IOS_ICONS / filename, pixels)
        images.append(
            {
                "filename": filename,
                "idiom": "ios-marketing" if size == "1024x1024" else "iphone",
                "scale": scale,
                "size": size,
            }
        )

    import json

    (IOS_ICONS / "Contents.json").write_text(
        json.dumps({"images": images, "info": {"author": "xcode", "version": 1}}, indent=2)
        + "\n",
        encoding="utf-8",
    )


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)

    square = master_square()
    rounded = master_rounded()
    circle = master_round()
    foreground = master_foreground()
    monochrome = master_monochrome()

    for name, img in {
        "icon-square-1024.png": square,
        "icon-rounded-1024.png": rounded,
        "icon-round-1024.png": circle,
        "icon-foreground-1024.png": foreground,
        "icon-monochrome-1024.png": monochrome,
    }.items():
        img.save(ASSETS / name, "PNG", optimize=True)

    write_android(square, rounded, circle, foreground, monochrome)
    write_android_xml()
    write_ios(square)
    print(f"Icons written to {ANDROID_RES} and {IOS_ICONS}")


if __name__ == "__main__":
    main()
