"""Build public/assets/bond/elementShip.png from the PRTS branch icon (docs/research/17-element-bond.md §6).

The source is the 本源术师 (incantationmedic / 本源 caster) branch icon, a 128 px white-glyph-on-solid picture:
  https://media.prts.wiki/1/18/%E8%81%8C%E4%B8%9A%E5%88%86%E6%94%AF%E5%9B%BE%E6%A0%87_%E6%9C%AC%E6%BA%90%E6%9C%AF%E5%B8%88.png
Like the bond icons the project downloads (`bond/{bondId}.png`, white glyphs on transparency — data/assets.json
`bonds`), the client tints it in CSS/canvas.

Steps, in the order docs/ASSETS.md's icon notes and the task specify:
  1. white background → transparent (the source is opaque; if it were already transparent the step is a no-op),
  2. crop the transparent margin (alpha bounding box),
  3. scale so the LONG side is LONG_SIDE px, keeping the aspect ratio,
  4. save as an 8-bit RGBA PNG (one file, no intermediate).

Run: python tools/build-element-bond-icon.py            (writes public/assets/bond/elementShip.png)
     python tools/build-element-bond-icon.py --check    (only reports what it would write)
"""
import argparse
import io
import os
import sys
import urllib.request
from pathlib import Path

from PIL import Image

SRC_URL = ("https://media.prts.wiki/1/18/"
           "%E8%81%8C%E4%B8%9A%E5%88%86%E6%94%AF%E5%9B%BE%E6%A0%87_%E6%9C%AC%E6%BA%90%E6%9C%AF%E5%B8%88.png")
# The measured long side of the 24 shipped bond icons is 96–110 px (median 102); 104 matches 巴别塔's own icon.
LONG_SIDE = 104
OUT = Path(__file__).resolve().parent.parent / "public" / "assets" / "bond" / "elementShip.png"
CACHE = Path(__file__).resolve().parent.parent / ".cache" / "element-bond-icon-source.png"


def fetch(url: str) -> bytes:
    if CACHE.exists() and CACHE.stat().st_size > 0:
        return CACHE.read_bytes()
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    if proxy:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({"http": proxy, "https": proxy}))
    else:
        opener = urllib.request.build_opener()
    req = urllib.request.Request(url, headers={"User-Agent": "stronghold-protocol/1.0 (asset pipeline)"})
    with opener.open(req, timeout=60) as r:
        data = r.read()
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_bytes(data)
    return data


def white_to_alpha(img: Image.Image, tol: int = 12) -> Image.Image:
    """Opaque white/near-white pixels become transparent; the rest keeps its colour at full alpha.

    The source is a white glyph on a solid background (the bond icons the client tints), so a luminance-keyed alpha is
    the exact inverse: alpha = 255 - min(r,g,b) clamped by the tolerance. A picture that already carries transparency is
    returned untouched.
    """
    if img.mode == "RGBA" and img.getchannel("A").getextrema()[0] < 255:
        return img
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            lo = min(r, g, b)
            if lo >= 255 - tol:
                px[x, y] = (r, g, b, 0)
            elif lo > 255 - 64:
                # an anti-aliased edge: keep the colour, ramp the alpha so the glyph stays smooth
                px[x, y] = (r, g, b, max(0, min(255, 255 - lo)))
            else:
                px[x, y] = (r, g, b, 255)
    return img


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="report the result without writing it")
    args = ap.parse_args()

    raw = fetch(SRC_URL)
    src = Image.open(io.BytesIO(raw))
    print(f"source: {len(raw)} B, {src.size[0]}x{src.size[1]}, mode {src.mode}")
    img = white_to_alpha(src)
    bbox = img.getchannel("A").getbbox()
    if bbox:
        img = img.crop(bbox)
    print(f"after alpha crop: {img.size[0]}x{img.size[1]}")
    w, h = img.size
    scale = LONG_SIDE / max(w, h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    img = img.resize((nw, nh), Image.LANCZOS)
    print(f"final: {nw}x{nh}")
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    data = buf.getvalue()
    print(f"png: {len(data)} B")
    if args.check:
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(data)
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
