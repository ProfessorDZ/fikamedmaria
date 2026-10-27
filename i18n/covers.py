#!/usr/bin/env python3
"""Blog covers in other languages.

Every cover in assets/blog/ has its headline drawn into the picture (a black
part and a red part on the cream paper at the left). This script finds that
headline, paints it out with matching paper, and sets the translated headline
from i18n/covers.json in the same place, size, weight and colours:

    python3 i18n/covers.py build [sv en pl]   -> assets/blog/<lang>/<cover>.webp
    python3 i18n/covers.py check              -> re-sets the Ukrainian headline and
                                                 writes a comparison sheet (font/size test)
    python3 i18n/covers.py sheet <lang> OUT   -> original vs. <lang> side by side

covers.json: {"<cover>.webp": {"uk": {"black": [lines], "red": [lines]}, "sv": {...}, ...}}
Each list is the headline's lines, top to bottom; black lines come first.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "assets", "blog")
SPEC = os.path.join(HERE, "covers.json")
LANGS = ["sv", "en", "pl"]

# Avenir Next (regular and condensed cuts) for the Latin languages; the weights
# are indexes inside the .ttc files that come with macOS.
WEIGHTS = {"Medium": 5, "Demi Bold": 2, "Bold": 0, "Heavy": 8}
FAMILIES = {
    "next": ("/System/Library/Fonts/Avenir Next.ttc", WEIGHTS),
    "cond": ("/System/Library/Fonts/Avenir Next Condensed.ttc", WEIGHTS),
}
# Avenir Next Cyr (installed in the user's fonts) is used to measure the
# Ukrainian originals and for the `check` command.
CYR_FILE = os.path.expanduser("~/Library/Fonts/AvenirNextCyr-{}.ttf")
CYR_NAMES = {"Medium": "Medium", "Demi Bold": "Demi", "Bold": "Bold", "Heavy": "Heavy"}


def luma(a):
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


# --------------------------------------------------------------------------
# Finding the headline
# --------------------------------------------------------------------------

def analyse(a):
    """Lines of the headline (boxes, baselines, colours), the ink to paint out,
    and the picture area that must stay untouched."""
    H, W, _ = a.shape
    L = luma(a)
    sat = a.max(2) - a.min(2)
    # local paper brightness: a high percentile over a wide window skips thin strokes
    bg = ndimage.percentile_filter(L[::4, ::4], 80, size=25)
    bgL = ndimage.zoom(bg, 4, order=1)[:H, :W]
    redish = (a[..., 0] - a[..., 1] > 45) & (a[..., 0] > 80)
    ink = ((bgL - L) > 60) | (redish & ((bgL - L) > 35))
    paper = ((bgL - L) < 18) & (sat < 60)

    # the picture: large areas of mid tones (photo, collage), holes filled
    mid = ndimage.binary_opening(~paper & ~ink, iterations=2)
    lab2, n2 = ndimage.label(mid)
    sizes = ndimage.sum(mid, lab2, range(1, n2 + 1))
    art = np.isin(lab2, 1 + np.where(sizes > 3000)[0])
    art = ndimage.binary_fill_holes(ndimage.binary_closing(art, iterations=6))
    art_near = ndimage.binary_dilation(art, iterations=10)

    left_ink = ink.copy()
    left_ink[:, int(W * 0.66):] = False
    lab, _ = ndimage.label(left_ink, structure=np.ones((3, 3)))
    comps = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        if sl is None:
            continue
        ys, xs = sl
        h, w = ys.stop - ys.start, xs.stop - xs.start
        if h > 200 or w > 400 or (h < 4 and w < 4):
            continue
        own = lab[sl] == i
        if art_near[sl][own].mean() > 0.5:
            continue
        y0, y1 = max(0, ys.start - 10), min(H, ys.stop + 10)
        x0, x1 = max(0, xs.start - 10), min(W, xs.stop + 10)
        inner = ndimage.binary_dilation(lab[y0:y1, x0:x1] == i, iterations=4)
        # around a letter there is only paper or other letters
        ring = (paper | ink)[y0:y1, x0:x1][~inner]
        if ring.size == 0 or ring.mean() < 0.85:
            continue
        comps.append({"y0": ys.start, "y1": ys.stop, "x0": xs.start, "x1": xs.stop, "id": i, "h": h})

    # lines: letters whose tops are close together (capital and small letters of one
    # line differ far less than two lines do)
    big = sorted((c for c in comps if c["h"] >= 25), key=lambda c: c["y0"])
    if not big:
        raise SystemExit("no headline found")
    cap_guess = np.median([c["h"] for c in big])
    groups = [[big[0]]]
    for c in big[1:]:
        if c["y0"] - groups[-1][-1]["y0"] > 0.45 * cap_guess:
            groups.append([c])
        else:
            groups[-1].append(c)
    groups = [g for g in groups if any(c["x0"] < 170 for c in g)]

    lines = []
    for g in groups:
        cand = sorted(g, key=lambda c: c["x0"])
        run, reach = [], None
        for c in cand:  # letters in a row from the left margin; stop at a wide gap
            if reach is None and c["x0"] > 170:
                break
            if reach is not None and c["x0"] > reach + 60:
                break
            run.append(c)
            reach = c["x1"] if reach is None else max(reach, c["x1"])
        if not run:
            continue
        ids = [c["id"] for c in run]
        X0, X1 = min(c["x0"] for c in run), max(c["x1"] for c in run)
        y0, y1 = min(c["y0"] for c in run), max(c["y1"] for c in run)
        # small marks of this line (dots, accents, commas, dashes): no taller than a
        # small letter, within the line's height (accents above, commas below) and
        # continuing the row of letters without a wide gap
        base_guess = float(np.median([c["y1"] for c in run]))
        xh_guess = base_guess - float(np.percentile([c["y0"] for c in run], 70))
        marks, reach = [], X1
        for c in sorted((c for c in comps if c["id"] not in ids), key=lambda c: c["x0"]):
            if (c["h"] > 1.2 * xh_guess or c["x0"] < X0 - 15 or
                    c["y0"] < y0 - 0.9 * xh_guess or c["y1"] > base_guess + 0.7 * xh_guess):
                continue
            if c["x0"] > X1:
                # after the last letter only punctuation: a comma or full stop
                # touching it, or a dash after a space ("Fika —"). Labels and
                # sketches of the picture often start just as close, so nothing else.
                gap = c["x0"] - reach
                mid = (c["y0"] + c["y1"]) / 2
                w = c["x1"] - c["x0"]
                dash = (w >= 2 * c["h"] and gap <= 0.7 * xh_guess and
                        abs(mid - (base_guess - 0.5 * xh_guess)) <= 0.3 * xh_guess)
                if not (dash or gap <= 0.25 * xh_guess):
                    break
            marks.append(c["id"])
            reach = max(reach, c["x1"])
        own = np.isin(lab[y0:y1, X0:X1], ids)
        red_share = redish[y0:y1, X0:X1][own].mean()
        px = a[y0:y1, X0:X1][own]
        dark = luma(px[None])[0]
        rgb = np.median(px[dark <= np.percentile(dark, 35)], 0)
        baseline = int(np.median([c["y1"] for c in run]))
        # x-height: most letters of a line are small letters, so their tops are the lowest
        xh = baseline - float(np.percentile([c["y0"] for c in run], 70))
        # stroke thickness: twice the deepest point inside each letter
        dist = ndimage.distance_transform_edt(own)
        stroke = float(2 * np.median([dist[lab[y0:y1, X0:X1] == c["id"]].max() for c in run]))
        lines.append({"x0": int(X0), "x1": int(reach), "top": int(min(c["y0"] for c in run)),
                      "baseline": baseline, "colour": "red" if red_share > 0.5 else "black",
                      "rgb": [int(v) for v in rgb], "stroke": stroke, "xh": xh,
                      "ids": ids + marks})
    if not lines:
        raise SystemExit("no headline found")

    # everything to paint out: the letters with their own marks, plus specks too
    # small to be letters right next to them. Nothing else in the headline area
    # is touched, so buds, stems and hair strands of the picture stay.
    own = np.isin(lab, [i for l in lines for i in l["ids"]])
    erase = own | (left_ink & ndimage.binary_dilation(own, iterations=12) & ~art_near)
    erase = ndimage.binary_dilation(erase, iterations=5)
    # Where the headline overlaps the picture, the letters have a light halo cut
    # into it. Left alone it would stay behind as a pale outline of the old words,
    # so it goes too (the picture is then rebuilt there, see paint_out).
    near = ndimage.binary_dilation(own, iterations=18)
    far_valid = (~near).astype(float)
    far = np.stack([ndimage.gaussian_filter(a[..., k] * far_valid, 16) for k in range(3)], -1)
    far /= np.maximum(ndimage.gaussian_filter(far_valid, 16), 1e-6)[..., None]
    far_l = luma(far)
    on_picture = ~((far_l > 200) & (far[..., 0] >= far[..., 2] - 2) & ((far.max(-1) - far.min(-1)) < 45))
    pale = luma(a) > far_l + 12
    erase |= ndimage.binary_dilation(own, iterations=16) & on_picture & pale
    erase = ndimage.binary_closing(erase, iterations=2)
    # the insides of letters (о, а, р …) are paper of the old letter shapes:
    # repaint them too, or they show as lighter dots where the new text is shorter
    holes = ndimage.binary_fill_holes(erase) & ~erase
    hl, hn = ndimage.label(holes)
    if hn:
        hsize = ndimage.sum(holes, hl, range(1, hn + 1))
        erase |= np.isin(hl, 1 + np.where(hsize < 6000)[0])

    # the picture again, now that the letters are known: every large area that is
    # not paper (dark jackets and hair included), so nothing of it gets painted over
    letters = ndimage.binary_dilation(np.isin(lab, [c["id"] for c in comps]), iterations=3)
    solid = ndimage.binary_opening(~paper & ~letters, iterations=3)
    lab3, n3 = ndimage.label(solid)
    sizes3 = ndimage.sum(solid, lab3, range(1, n3 + 1))
    art = art | np.isin(lab3, 1 + np.where(sizes3 > 6000)[0])
    art = ndimage.binary_fill_holes(ndimage.binary_closing(art, iterations=6))
    art_near = ndimage.binary_dilation(art, iterations=10)
    erase &= ~(art & ~ndimage.binary_dilation(own, iterations=5))
    return {"lines": lines, "erase": erase, "art": art, "art_near": art_near, "paper": paper}


# --------------------------------------------------------------------------
# Painting out
# --------------------------------------------------------------------------

def paint_out(a, info):
    """Repaints the old headline. Over paper: the paper's own tone around each
    letter plus real paper grain. Where a letter sat on the collage (lilac paper,
    a jacket, a sketch): the same shape copied from just next to it, from the
    spot whose surroundings match best, so the picture keeps its texture."""
    H, W, _ = a.shape
    m = info["erase"]

    def creamy(img):
        L = luma(img)
        return (L > 200) & (img[..., 0] >= img[..., 2] - 2) & ((img.max(-1) - img.min(-1)) < 45)

    def around(valid_mask):
        """Average colour of the valid pixels around each hole pixel, from the
        smallest window that has enough of them."""
        valid = valid_mask.astype(float)
        res = np.zeros_like(a)
        done = np.zeros((H, W), bool)
        for s in (6, 12, 24, 48, 96):
            num = np.stack([ndimage.gaussian_filter(a[..., k] * valid, s) for k in range(3)], -1)
            den = ndimage.gaussian_filter(valid, s)
            ok = (den > 0.25) & m & ~done
            res[ok] = (num / np.maximum(den, 1e-6)[..., None])[ok]
            done |= ok
        return res

    # what lies around each hole (paper or picture), and the paper's own tone
    # taken from paper only, so nearby dark picture cannot tint it grey
    bg_any = around(~m)
    bg = around(~m & creamy(a))
    # paper grain: fine detail of the plain paper in the left margin above the
    # headline (never from the picture, whose lines would show up as a sketch)
    ys = np.where(m.any(1))[0]
    top, band = ys.min(), ys.max() - ys.min() + 1
    detail = a - np.stack([ndimage.gaussian_filter(a[..., k], 3) for k in range(3)], -1)
    patch = detail[max(0, top - band - 20):max(1, top - 10), 10:400]
    if patch.shape[0] < 20:
        patch = detail[10:130, 10:400]
    rows_ = np.concatenate([patch if r % 2 == 0 else patch[::-1]
                            for r in range(int(np.ceil(H / patch.shape[0])) + 1)], 0)[:H]
    grain = np.concatenate([rows_ if r % 2 == 0 else rows_[:, ::-1]
                            for r in range(int(np.ceil(W / rows_.shape[1])) + 1)], 1)[:, :W]

    paperish = m & creamy(bg_any)
    out = a.copy()
    out[paperish] = (bg + grain)[paperish]

    rest = m & ~paperish
    if not rest.any():
        return out
    rest = ndimage.binary_dilation(rest, iterations=2) & m
    lab, _ = ndimage.label(rest)
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        if sl is None:
            continue
        y0, y1 = max(0, sl[0].start - 6), min(H, sl[0].stop + 6)
        x0, x1 = max(0, sl[1].start - 6), min(W, sl[1].stop + 6)
        M = lab[y0:y1, x0:x1] == i
        R = ndimage.binary_dilation(M, iterations=4) & ~M & ~(rest[y0:y1, x0:x1])
        if R.sum() < 12:
            out[y0:y1, x0:x1][M] = bg_any[y0:y1, x0:x1][M]
            continue
        T = out[y0:y1, x0:x1][R]
        h, w = y1 - y0, x1 - x0

        def score(dy, dx):
            sy, sx = y0 + dy, x0 + dx
            if sy < 0 or sx < 0 or sy + h > H or sx + w > W:
                return None
            if (m[sy:sy + h, sx:sx + w] & (M | R)).any():
                return None  # copy only untouched picture
            S = a[sy:sy + h, sx:sx + w][R]
            return float(((S - T) ** 2).mean() + 0.02 * (dy * dy + dx * dx))

        best = None
        for dy in range(-150, 151, 6):
            for dx in range(-150, 151, 6):
                if dy or dx:
                    sc = score(dy, dx)
                    if sc is not None and (best is None or sc < best[0]):
                        best = (sc, dy, dx)
        if best is None:
            out[y0:y1, x0:x1][M] = bg_any[y0:y1, x0:x1][M]
            continue
        _, by, bx = best
        for dy in range(by - 5, by + 6):
            for dx in range(bx - 5, bx + 6):
                if dy or dx:
                    sc = score(dy, dx)
                    if sc is not None and sc < best[0]:
                        best = (sc, dy, dx)
        _, dy, dx = best
        src = a[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
        region = out[y0:y1, x0:x1]
        region[M] = src[M]
    return out


# --------------------------------------------------------------------------
# Setting the new headline
# --------------------------------------------------------------------------

_fonts = {}
_cache = {}


def font(family, weight, size):
    key = (family, weight, size)
    if key not in _fonts:
        if family == "cyr":
            _fonts[key] = ImageFont.truetype(CYR_FILE.format(CYR_NAMES[weight]), size)
        else:
            path, index = FAMILIES[family]
            _fonts[key] = ImageFont.truetype(path, size, index=index[weight])
    return _fonts[key]


def width_of(f, text):
    b = f.getbbox(text, anchor="ls")
    return b[2] - b[0]


def cap_height(family, weight, size):
    b = font(family, weight, size).getbbox("H", anchor="ls")
    return b[3] - b[1]


def x_height(family, weight, size):
    b = font(family, weight, size).getbbox("x", anchor="ls")
    return b[3] - b[1]


def size_for(family, weight, xh, tall=None):
    """Font size for a line whose small letters are xh pixels tall and whose
    capitals/ascenders reach `tall` pixels (None: the line has no tall letters).
    Avenir's small letters are a little lower than the originals', so the size
    splits the difference between matching the small and the tall letters."""
    def fit(measure, target):
        size = 20
        while measure(family, weight, size + 1) <= target:
            size += 1
        return size
    by_x = fit(x_height, xh)
    if not tall:
        return by_x
    return int(round(np.sqrt(by_x * fit(cap_height, tall))))


def rendered_stroke(family, weight, rows, squeeze):
    """The same thickness measure as analyse() uses, taken on rendered text:
    rows = [(text, size)]."""
    vals = []
    for text, size in rows:
        f = font(family, weight, size)
        box = f.getbbox(text, anchor="ls")
        w, h = box[2] - box[0] + 6, box[3] - box[1] + 6
        im = Image.new("L", (w, h), 0)
        ImageDraw.Draw(im).text((3 - box[0], 3 - box[1]), text, font=f, fill=255, anchor="ls")
        if abs(squeeze - 1) > 0.005:
            im = im.resize((max(1, int(round(w * squeeze))), h), Image.LANCZOS)
        mask = np.asarray(im) > 127
        lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
        if not n:
            continue
        dist = ndimage.distance_transform_edt(mask)
        xh = x_height(family, weight, size)
        deep = [2 * dist[sl][lab[sl] == i].max() for i, sl in enumerate(ndimage.find_objects(lab), 1)
                if sl[0].stop - sl[0].start >= 0.45 * xh]
        if deep:
            vals.append(np.median(deep) / xh)
    return float(np.median(vals)) if vals else 0.0


def family_width(family, weight):
    """How wide this family sets text compared with Avenir Next (1.0)."""
    key = ("width", family, weight)
    if key not in _cache:
        sample = "Svenska ord och en kaffepaus"
        f, g = font(family, weight, 100), font("next", weight, 100)
        _cache[key] = (width_of(f, sample) / x_height(family, weight, 100)) / (
            width_of(g, sample) / x_height("next", weight, 100))
    return _cache[key]


def style_of(info, uk_rows):
    """Sizes, width and line spacing of the original headline. The covers were
    not all lettered in the same typeface: some are narrower than others, so the
    width is measured against the Ukrainian text (Avenir Next Cyr, same design
    as Avenir Next) and later matched with the regular or condensed cut plus a
    slight horizontal squeeze. Black and red lines may differ in size."""
    lines = info["lines"]
    for l in lines:
        tall = l["baseline"] - l["top"]
        l["tall"] = tall if tall > 1.15 * l["xh"] else None
    if len(uk_rows) == len(lines):
        wide = float(np.median([(l["x1"] - l["x0"]) / width_of(font("cyr", "Bold", size_for("cyr", "Bold", l["xh"], l["tall"])), t)
                                for t, l in zip(uk_rows, lines)]))
    else:
        wide = 1.0
    group = {}
    for colour in ("black", "red"):
        own = [l for l in lines if l["colour"] == colour]
        if own:
            talls = [l["tall"] for l in own if l["tall"]]
            group[colour] = {"xh": float(np.median([l["xh"] for l in own])),
                             "tall": float(np.median(talls)) if talls else None}
    group.setdefault("black", group.get("red"))
    group.setdefault("red", group.get("black"))
    steps = [(b["baseline"] - a["baseline"]) / b["xh"] for a, b in zip(lines, lines[1:])]
    return {"stroke": float(np.median([l["stroke"] / l["xh"] for l in lines])), "wide": wide,
            "group": group, "leading": float(np.median(steps)) if steps else 2.0}


def colours(info):
    black = [l["rgb"] for l in info["lines"] if l["colour"] == "black"]
    red = [l["rgb"] for l in info["lines"] if l["colour"] == "red"]
    return (tuple(black[0]) if black else (20, 16, 18)), (tuple(red[0]) if red else (130, 32, 28))


def room(info, top, bottom, W):
    """How far right text may go between rows top..bottom without touching the picture."""
    cols = np.where(info["art_near"][max(0, top):bottom].any(0))[0]
    cols = cols[cols > 300]
    return (int(cols.min()) - 20) if cols.size else int(W * 0.62)


def draw_line(im, text, f, x, baseline, rgb, squeeze):
    box = f.getbbox(text, anchor="ls")
    w, h = box[2] - box[0] + 4, box[3] - box[1] + 4
    tmp = Image.new("L", (w, h), 0)
    ImageDraw.Draw(tmp).text((2 - box[0], 2 - box[1]), text, font=f, fill=255, anchor="ls")
    if abs(squeeze - 1) > 0.005:
        tmp = tmp.resize((max(1, int(round(w * squeeze))), h), Image.LANCZOS)
    im.paste(Image.new("RGB", tmp.size, rgb), (int(round(x)) - 2, int(baseline + box[1] - 2)), tmp)


def set_headline(clean, info, headline, uk_rows, family=None):
    """family=None picks Avenir Next or Avenir Next Condensed (Latin languages);
    family="cyr" sets Cyrillic (used by the check)."""
    H, W, _ = clean.shape
    st = style_of(info, uk_rows)
    if family is None:
        family = min(FAMILIES, key=lambda fm: abs(np.log(st["wide"] / family_width(fm, "Bold"))))
        squeeze = float(np.clip(st["wide"] / family_width(family, "Bold"), 0.9, 1.1))
    else:
        squeeze = st["wide"]
    black_rgb, red_rgb = colours(info)

    def look(t):
        # a dash closing a line is drawn long, like the original covers' "Fika —";
        # Avenir's condensed en dash is so short that it reads as a hyphen
        return t[:-1] + "\u2014" if t.endswith(" \u2013") else t
    rows = ([(look(t), black_rgb, "black") for t in headline.get("black", [])] +
            [(look(t), red_rgb, "red") for t in headline.get("red", [])])
    old = info["lines"]
    x = min(l["x0"] for l in old)
    centre = (old[0]["top"] + old[-1]["baseline"]) / 2
    same_shape = [r[2] for r in rows] == [l["colour"] for l in old]

    def sizes(weight, scale):
        out = []
        for text, _, colour in rows:
            g = st["group"][colour]
            out.append(size_for(family, weight, g["xh"] * scale, g["tall"] * scale if g["tall"] else None))
        return out

    # the weight whose strokes, measured like the original's, come closest
    weight = min(WEIGHTS, key=lambda w: abs(
        rendered_stroke(family, w, [(r[0], s) for r, s in zip(rows, sizes(w, 1.0))], squeeze) - st["stroke"]))

    scale = 1.0
    while True:
        fonts = [font(family, weight, s) for s in sizes(weight, scale)]
        boxes = [f.getbbox(r[0], anchor="ls") for r, f in zip(rows, fonts)]
        if same_shape and scale == 1.0:
            bases = [float(l["baseline"]) for l in old]
        else:
            bases = [0.0]
            for r in rows[1:]:
                bases.append(bases[-1] + st["leading"] * st["group"][r[2]]["xh"] * scale)
        # Latin has more descenders than Ukrainian: never let two lines touch
        moved = not (same_shape and scale == 1.0)
        for i in range(1, len(rows)):
            gap = (bases[i] + boxes[i][1]) - (bases[i - 1] + boxes[i - 1][3])
            need = 0.12 * x_height(family, weight, fonts[i].size)
            if gap < need:
                for j in range(i, len(rows)):
                    bases[j] += need - gap
                moved = True
        if moved:
            shift = centre - ((bases[0] + boxes[0][1]) + bases[-1]) / 2
            bases = [b + shift for b in bases]
        bases = [int(round(b)) for b in bases]
        widest = 0.0
        fits = (bases[0] + boxes[0][1] >= 20 and bases[-1] + boxes[-1][3] <= H - 20)
        for r, f, b in zip(rows, fonts, bases):
            cap = cap_height(family, weight, f.size)
            right = x + width_of(f, r[0]) * squeeze
            limit = max(room(info, b - cap - 10, b + int(cap * 0.3), W), x + 10)
            near = [l for l in old if abs(l["baseline"] - b) < cap / 2]
            if near:  # the original line at this height reached this far, so may we
                limit = max(limit, near[0]["x1"] + 4)
            widest = max(widest, right / limit)
            if right > limit:
                fits = False
        if fits or scale <= 0.78:
            break
        scale -= 0.02

    im = Image.fromarray(np.clip(clean, 0, 255).astype("uint8"))
    for r, f, b in zip(rows, fonts, bases):
        draw_line(im, r[0], f, x, b, r[1], squeeze)
    return im, {"family": family, "weight": weight, "sizes": [f.size for f in fonts],
                "squeeze": round(squeeze, 2), "scale": round(scale, 2), "fits": fits, "fill": round(widest, 2)}


# --------------------------------------------------------------------------

def load_spec():
    with open(SPEC, encoding="utf-8") as fh:
        return json.load(fh)


def uk_rows(entry):
    return entry["uk"].get("black", []) + entry["uk"].get("red", [])


def prepare(name):
    a = np.asarray(Image.open(os.path.join(SRC, name)).convert("RGB")).astype(float)
    info = analyse(a)
    return a, info, paint_out(a, info)


def sheet(pairs, out_path, width=700):
    h = int(width * 941 / 1672)
    im = Image.new("RGB", (width * 2 + 12, (h + 8) * len(pairs)), "white")
    for i, (left, right) in enumerate(pairs):
        im.paste(left.convert("RGB").resize((width, h), Image.LANCZOS), (0, i * (h + 8)))
        im.paste(right.convert("RGB").resize((width, h), Image.LANCZOS), (width + 12, i * (h + 8)))
    im.save(out_path)


def has_lines(head):
    return bool(head) and any(t.strip() for t in head.get("black", []) + head.get("red", []))


def main(argv):
    cmd = argv[1] if len(argv) > 1 else "help"
    spec = load_spec()
    names = sorted(spec)
    if cmd == "build":
        langs = argv[2:] or LANGS
        problems = 0
        for name in names:
            try:
                a, info, clean = prepare(name)
            except SystemExit as e:
                print("  cannot read the headline of", name, "-", e)
                problems += 1
                continue
            for lang in langs:
                target = os.path.join(SRC, lang, name)
                head = spec[name].get(lang)
                if not has_lines(head):
                    print("  missing headline:", lang, name)
                    problems += 1
                    continue
                img, how = set_headline(clean, info, head, uk_rows(spec[name]))
                if not how["fits"]:
                    # no file: the site then shows the Ukrainian cover instead
                    print("  does not fit, not saved:", lang, name, how)
                    if os.path.exists(target):
                        os.remove(target)
                    problems += 1
                    continue
                os.makedirs(os.path.dirname(target), exist_ok=True)
                img.save(target, "WEBP", quality=86, method=6)
            print("ok", name)
        return 1 if problems else 0
    if cmd == "check":
        out = argv[2] if len(argv) > 2 else os.path.join(HERE, "covers-check.png")
        pairs = []
        for name in names:
            a, info, clean = prepare(name)
            img, how = set_headline(clean, info, spec[name]["uk"], uk_rows(spec[name]), family="cyr")
            print(name, how, [(l["colour"], l["x0"], l["baseline"]) for l in info["lines"]])
            pairs.append((Image.open(os.path.join(SRC, name)), img))
        sheet(pairs, out)
        print("sheet:", out)
        return 0
    if cmd == "sheet" and len(argv) > 3:
        lang, out = argv[2], argv[3]
        pairs = []
        for n in names:
            p = os.path.join(SRC, lang, n)
            if os.path.exists(p):
                pairs.append((Image.open(os.path.join(SRC, n)), Image.open(p)))
            else:
                print("  no", lang, "cover:", n)
        if pairs:
            sheet(pairs, out)
            print("sheet:", out)
        return 0
    print(__doc__)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
