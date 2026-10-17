# Builds dark-background NDA logos from the official white-background files (~human/nda logo/).
# White field -> transparent, black lettering -> white, orange pixel grid kept exactly (opaque).
# Also a colour version for light backgrounds: white field -> transparent, everything else unchanged.
# usage: python3 scripts/sponsor-logos.py
import os
from PIL import Image

SRC = '~human/nda logo'
OUT = 'public/assets/sponsors'
JOBS = [('Asset 3@3x.png', 'nda-h-dark.png'), ('Asset 2@3x.png', 'nda-v-dark.png')]

def convert(src, dst, dark=True):
    im = Image.open(src).convert('RGB')
    out = Image.new('RGBA', im.size)
    px, po = im.load(), out.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            sat = max(r, g, b) - min(r, g, b)
            if sat <= 10:
                # neutral: white field / black text / anti-aliased text edge -> white with coverage alpha
                a = 255 - min(r, g, b)
                v = 255 if dark else 0
                po[x, y] = (v, v, v, a if a > 6 else 0)
            else:
                po[x, y] = (r, g, b, 255)  # brand orange tile, untouched
    out.save(dst, optimize=True)
    print(dst, out.size, os.path.getsize(dst))

for s, d in JOBS:
    convert(os.path.join(SRC, s), os.path.join(OUT, d))
convert(os.path.join(SRC, 'Asset 3@3x.png'), os.path.join(OUT, 'nda-h-color.png'), dark=False)
