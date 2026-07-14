#!/usr/bin/env python3
"""Generate PWA icons (pure Python, no dependencies).

Draws the Project Ascend mark: a dark night-sky square with a twin-peak
"ascent" silhouette and a rising star. Outputs 192px and 512px PNGs plus
maskable variants (same art, extra safe-zone padding).
"""
import struct, zlib, os

BG = (26, 28, 46)        # deep indigo
PEAK_A = (124, 108, 240) # violet
PEAK_B = (78, 205, 196)  # teal
STAR = (255, 209, 102)   # amber

def blend(c1, c2, t):
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))

def make(size, pad_frac):
    px = [[BG for _ in range(size)] for _ in range(size)]
    pad = int(size * pad_frac)
    w = size - 2 * pad
    base_y = pad + int(w * 0.86)

    def tri(apex_x, apex_y, half_w, color):
        for y in range(apex_y, base_y):
            t = (y - apex_y) / max(1, base_y - apex_y)
            half = int(half_w * t)
            for x in range(apex_x - half, apex_x + half + 1):
                if 0 <= x < size and 0 <= y < size:
                    shade = blend(color, BG, 0.25 * (x - (apex_x - half)) / max(1, 2 * half))
                    px[y][x] = shade

    # back peak (teal), front peak (violet)
    tri(pad + int(w * 0.62), pad + int(w * 0.30), int(w * 0.34), PEAK_B)
    tri(pad + int(w * 0.36), pad + int(w * 0.16), int(w * 0.40), PEAK_A)

    # rising star (filled diamond)
    sx, sy, r = pad + int(w * 0.78), pad + int(w * 0.12), max(3, int(w * 0.07))
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if abs(dx) + abs(dy) <= r:
                x, y = sx + dx, sy + dy
                if 0 <= x < size and 0 <= y < size:
                    px[y][x] = STAR
    return px

def write_png(path, px):
    size = len(px)
    raw = b"".join(b"\x00" + b"".join(bytes(c) for c in row) for row in px)
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c))
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)
    print(path, os.path.getsize(path), "bytes")

out = os.path.join(os.path.dirname(__file__), "..", "icons")
os.makedirs(out, exist_ok=True)
write_png(os.path.join(out, "icon-192.png"), make(192, 0.08))
write_png(os.path.join(out, "icon-512.png"), make(512, 0.08))
write_png(os.path.join(out, "maskable-512.png"), make(512, 0.20))
