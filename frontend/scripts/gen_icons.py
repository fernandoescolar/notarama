"""Generates Notarama's app icons: a violet-to-fuchsia gradient rounded
square with a white sparkle glyph. Run once with `python3 scripts/gen_icons.py`;
output is checked into public/ since it's a design asset, not a build output.
"""
from PIL import Image, ImageDraw

GRADIENT_START = (139, 92, 246)  # violet-500
GRADIENT_END = (217, 70, 239)  # fuchsia-500
FG = (255, 255, 255)


def diagonal_gradient(size):
    """Top-left -> bottom-right linear gradient."""
    base = Image.new("RGB", (size, size), GRADIENT_START)
    top = Image.new("RGB", (size, size), GRADIENT_END)
    mask = Image.new("L", (size, size))
    mask_data = []
    denom = max(1, 2 * (size - 1))
    for y in range(size):
        for x in range(size):
            t = (x + y) / denom
            mask_data.append(int(255 * min(1.0, max(0.0, t))))
    mask.putdata(mask_data)
    return Image.composite(top, base, mask)


def rounded_mask(size, radius_ratio):
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    r = int(size * radius_ratio)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    return mask


def sparkle_polygon(cx, cy, r, inner_ratio=0.42):
    """A 4-pointed sparkle/star shape, matching the lucide 'sparkles' glyph."""
    inner = r * inner_ratio
    pts = []
    import math

    for i in range(4):
        angle = i * (math.pi / 2)
        # outer point
        pts.append((cx + r * math.cos(angle - math.pi / 2), cy + r * math.sin(angle - math.pi / 2)))
        # inner point (between this outer point and the next)
        mid_angle = angle - math.pi / 2 + math.pi / 4
        pts.append((cx + inner * math.cos(mid_angle), cy + inner * math.sin(mid_angle)))
    return pts


def make_icon(size, path, maskable=False):
    radius_ratio = 0.0 if maskable else 0.24
    bg = diagonal_gradient(size)
    mask = rounded_mask(size, radius_ratio)
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    img.paste(bg, (0, 0), mask)

    draw = ImageDraw.Draw(img)
    scale = 0.62 if maskable else 0.86
    cx, cy = size / 2, size / 2
    r = size * 0.30 * scale
    draw.polygon(sparkle_polygon(cx, cy, r), fill=FG)
    # small companion sparkle, upper-right
    r2 = r * 0.32
    draw.polygon(sparkle_polygon(cx + r * 0.95, cy - r * 0.85, r2), fill=FG)

    img.save(path)


make_icon(192, "public/pwa-192.png")
make_icon(512, "public/pwa-512.png")
make_icon(512, "public/maskable-512.png", maskable=True)
make_icon(180, "public/apple-touch-icon.png")

# Favicon (multi-size .ico) — built from the 192px source so each embedded
# size is a clean downscale rather than an upscaled blur.
source = Image.open("public/pwa-192.png")
source.save("public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

print("icons written")
