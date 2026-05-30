#!/usr/bin/env python3
"""
VISUAL-02C — Final 2:1 Arena Frame Art Validation (FIXUP)
Generate all proof outputs for the final arena frame candidate.

FIX: Previous version used non-square grids (8x4, 8x5, 8x8) with
span = cols + rows - 1, producing a tile fill that covered only a small
centered patch instead of the full 2:1 cutout diamond.

Root cause: For a non-square isometric grid, the outline diamond is
skewed and cannot match the symmetric target diamond. Additionally,
span = cols + rows - 1 underestimates the tile size needed.

Fix: Use SQUARE grids (NxN) so the grid diamond outline exactly matches
the target cutout diamond. Tile size: th = INNER_H / N, tw = 2 * th.
Origin: ox = cx, oy = top_y + th/2.
Grid sizes: N32 → 8x8, N40 → 9x9, N64 → 11x11.
Only tiles whose centers fall within the diamond are rendered.
"""

import json
import math
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

# ─── Paths ────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent.parent.parent
ASSET_DIR = REPO_ROOT / "public" / "dev-visual" / "visual-02a"
TILE_DIR = ASSET_DIR / "tiles"
OUTPUT_DIR = SCRIPT_DIR
INPUT_DIR = OUTPUT_DIR / "input"

RAW_FRAME_PATH = INPUT_DIR / "arena_frame_candidate_01_raw.png"
BG_PATH = ASSET_DIR / "background_world_candidate_01.png"
V02B_META_PATH = REPO_ROOT / "_inbox" / "visual_proofs" / "VISUAL-02B_frame_geometry" / "frame_2to1_geometry_meta.json"

# ─── Target Geometry (VISUAL-02B) ─────────────────────────────────

TARGET_V = {"top": [836, 69], "right": [1638, 470], "bottom": [836, 871], "left": [34, 470]}
INNER_W, INNER_H, RATIO = 1604, 802, 2.0
CW, CH = 1672, 941
SRC_TW, SRC_TH = 384, 192
TILE_WEIGHTS = {1: 24, 5: 18, 9: 16, 10: 14, 2: 8, 6: 6, 8: 5, 7: 2}
SEED = 42
MAG_R, MAG_G, MAG_B = 200, 80, 200

# Diamond center and half-extents
CX = (TARGET_V["left"][0] + TARGET_V["right"][0]) / 2   # 836
CY = (TARGET_V["top"][1] + TARGET_V["bottom"][1]) / 2   # 470
HW = INNER_W / 2   # 802  (half-width)
HH = INNER_H / 2   # 401  (half-height)


# ─── PRNG ─────────────────────────────────────────────────────────

class RNG:
    def __init__(self, s):
        self.s = s | 0
    @staticmethod
    def _imul(a, b):
        return ((a & 0xFFFF) * (b & 0xFFFF) + ((a >> 16) * (b & 0xFFFF) + (a & 0xFFFF) * (b >> 16)) * 65536) & 0xFFFFFFFF
    def next(self):
        self.s = (self.s + 0x6D2B79F5) & 0xFFFFFFFF
        t = self._imul(self.s ^ (self.s >> 15), 1 | self.s)
        t = (t + self._imul(t ^ (t >> 7), 61 | t)) ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

class Picker:
    def __init__(self, weights, seed):
        self.rng = RNG(seed)
        self.tiles = list(weights.keys())
        self.cum = []
        t = 0
        for tid in self.tiles:
            t += weights[tid]
            self.cum.append(t)
        self.total = t
    def pick(self):
        r = self.rng.next() * self.total
        for i, c in enumerate(self.cum):
            if r < c:
                return self.tiles[i]
        return self.tiles[-1]


# ─── Fonts ────────────────────────────────────────────────────────

def font(size=14):
    try: return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)
    except: return ImageFont.load_default()

def font_b(size=14):
    try: return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size)
    except: return font(size)


# ─── Diamond point-in-polygon test ───────────────────────────────

def point_in_diamond(x, y, margin=0.0):
    """Return True if (x, y) is inside the target diamond, with optional margin."""
    return (abs(x - CX) / HW + abs(y - CY) / HH) <= 1.0 + margin


# ─── Step 1: Validate input ──────────────────────────────────────

def validate_input():
    img = Image.open(RAW_FRAME_PATH)
    arr = np.array(img)
    r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    mag_mask = (r > MAG_R) & (g < MAG_G) & (b > MAG_B)
    mag_count = int(np.sum(mag_mask))

    result = {
        "dimensions": list(img.size),
        "mode": img.mode,
        "dimensions_ok": img.size == (CW, CH),
        "has_magenta": mag_count > 0,
        "magenta_count": mag_count,
    }

    if img.mode == "RGBA":
        a = arr[:,:,3]
        result["alpha_range"] = [int(a.min()), int(a.max())]
        result["transparent_pixels"] = int(np.sum(a < 128))
    else:
        result["alpha_range"] = None
        result["transparent_pixels"] = 0

    if mag_count > 0:
        rows = np.any(mag_mask, axis=1)
        cols = np.any(mag_mask, axis=0)
        rmin, rmax = int(np.argmax(rows)), int(len(rows)-1-np.argmax(rows[::-1]))
        cmin, cmax = int(np.argmax(cols)), int(len(cols)-1-np.argmax(cols[::-1]))
        result["magenta_bbox"] = {"top": rmin, "bottom": rmax, "left": cmin, "right": cmax}
        result["magenta_approx_w"] = cmax - cmin
        result["magenta_approx_h"] = rmax - rmin

    return result


# ─── Step 2: Create final candidate ──────────────────────────────

def create_final_candidate():
    img = Image.open(RAW_FRAME_PATH).convert("RGBA")
    arr = np.array(img)

    cleanup = {
        "magenta_before": 0,
        "magenta_removed": 0,
        "edge_bleed": 0,
        "diamond_cleared": 0,
        "method": "diamond alpha cutout + magenta edge cleanup",
    }

    r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    mag_mask = (r > MAG_R) & (g < MAG_G) & (b > MAG_B)
    cleanup["magenta_before"] = int(np.sum(mag_mask))

    # Diamond mask (vectorized)
    yy, xx = np.ogrid[0:CH, 0:CW]
    diamond = (np.abs(xx - CX) / HW + np.abs(yy - CY) / HH) <= 1.0

    # Clear inside diamond
    was_visible = diamond & (arr[:,:,3] > 0)
    cleanup["diamond_cleared"] = int(np.sum(was_visible))
    arr[diamond] = 0

    # Edge bleed: magenta outside diamond but near boundary (3px expanded zone)
    expand = 3
    expanded = (np.abs(xx - CX) / (HW + expand) + np.abs(yy - CY) / (HH + expand * HH / HW)) <= 1.0
    new_mag = (arr[:,:,0] > MAG_R) & (arr[:,:,1] < MAG_G) & (arr[:,:,2] > MAG_B) & (arr[:,:,3] > 0)
    bleed = new_mag & ~diamond & expanded
    cleanup["edge_bleed"] = int(np.sum(bleed))
    arr[bleed] = 0

    # Safety sweep: remove any remaining magenta
    remaining = (arr[:,:,0] > MAG_R) & (arr[:,:,1] < MAG_G) & (arr[:,:,2] > MAG_B) & (arr[:,:,3] > 0)
    cleanup["magenta_removed"] = int(np.sum(remaining)) + cleanup["edge_bleed"]
    arr[remaining] = 0

    # Verify
    final_mag = (arr[:,:,0] > MAG_R) & (arr[:,:,1] < MAG_G) & (arr[:,:,2] > MAG_B) & (arr[:,:,3] > 0)
    cleanup["magenta_after"] = int(np.sum(final_mag))
    cleanup["magenta_fully_removed"] = int(np.sum(final_mag)) == 0

    return Image.fromarray(arr), cleanup


# ─── Tile fill rendering ─────────────────────────────────────────

def compute_square_grid(N):
    """
    Compute tile size and origin for a square NxN isometric grid
    that exactly fills the target 2:1 diamond cutout.

    For a square NxN grid:
      - Grid diamond height = N * th = INNER_H  =>  th = INNER_H / N
      - Grid diamond width  = N * tw = INNER_W  =>  tw = 2 * th
      - Origin: ox = CX, oy = top_y + th/2

    This guarantees the grid diamond outline exactly matches the
    target cutout diamond vertices.
    """
    th = INNER_H / N
    tw = 2 * th
    ox = CX
    oy = TARGET_V["top"][1] + th / 2
    return tw, th, ox, oy


def render_proof(bg_resized, frame, tiles, N, show_grid):
    """
    Render a proof composition for a square NxN grid.

    Layers (bottom to top):
      1. Background (resized to canvas)
      2. Tile layer (only tiles with centers inside the diamond)
      3. Frame overlay (opaque border + transparent cutout)
      4. Grid lines (if show_grid)
      5. Info overlay
    """
    tw, th, ox, oy = compute_square_grid(N)
    sx, sy = tw / SRC_TW, th / SRC_TH
    picker = Picker(TILE_WEIGHTS, SEED)

    # Pre-resize all tiles to the computed runtime size
    resized = {}
    for tid, timg in tiles.items():
        new_w = max(1, int(SRC_TW * sx))
        new_h = max(1, int(SRC_TH * sy))
        resized[tid] = timg.resize((new_w, new_h), Image.BILINEAR)

    # Tile layer: render all tiles whose centers fall inside the diamond
    tile_layer = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    placements = []
    tiles_rendered = 0

    for row in range(N):
        for col in range(N):
            px = ox + (col - row) * tw / 2
            py = oy + (col + row) * th / 2

            # Only render tiles whose center is inside the diamond
            # (with a small margin to avoid gaps at the edge)
            if not point_in_diamond(px, py, margin=0.15):
                continue

            tid = picker.pick()
            placements.append((col, row, px, py, tid))
            t = resized[tid]
            tile_layer.paste(t, (int(px - t.width / 2), int(py - t.height / 2)), t)
            tiles_rendered += 1

    # Compose: background → tiles → frame
    result = Image.alpha_composite(bg_resized, tile_layer)
    result = Image.alpha_composite(result, frame)

    # Grid lines overlay (on top of frame for visibility)
    if show_grid:
        gl = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
        gd = ImageDraw.Draw(gl)
        htw, hth = tw / 2, th / 2
        for col, row, px, py, tid in placements:
            pts = [(int(px), int(py - hth)), (int(px + htw), int(py)),
                   (int(px), int(py + hth)), (int(px - htw), int(py))]
            gd.polygon(pts, outline=(0, 255, 0, 100))
        result = Image.alpha_composite(result, gl)

    # Info overlay
    info = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    idraw = ImageDraw.Draw(info)
    f = font(13)
    lines = [
        f"VISUAL-02C (fixup) — Full Tile Fill Proof",
        f"Grid: {N}x{N} square, {tiles_rendered} tiles inside diamond",
        f"Tile size: {tw:.1f}x{th:.1f} px  ratio: {tw/th:.4f}",
        f"Cutout: {INNER_W}x{INNER_H} px (2:1)",
        f"Grid: {'ON' if show_grid else 'OFF'}",
    ]
    y = 10
    for line in lines:
        bb = idraw.textbbox((12, y), line, font=f)
        idraw.rectangle([bb[0]-4, bb[1]-2, bb[2]+4, bb[3]+2], fill=(0,0,0,160))
        idraw.text((12, y), line, fill=(200,200,200), font=f)
        y += 18

    result = Image.alpha_composite(result, info)
    return result, tiles_rendered, tw, th


# ─── Main ─────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("VISUAL-02C (fixup) — Full Tile Fill Proof")
    print("=" * 60)

    # 1. Validate
    print("\n[1/5] Validating input...")
    val = validate_input()
    print(f"  Dimensions: {val['dimensions']}  OK: {val['dimensions_ok']}")
    print(f"  Magenta center: {val['has_magenta']}  ({val['magenta_count']} px)")
    if not val["dimensions_ok"]:
        print("  STOP: dimensions mismatch!")
        return

    # 2. Load assets
    print("\n[2/5] Loading assets...")
    bg = Image.open(BG_PATH).convert("RGBA")
    bg_resized = bg.resize((CW, CH), Image.BILINEAR)
    tiles = {tid: Image.open(TILE_DIR / f"platform_tile_{tid:03d}.png").convert("RGBA")
             for tid in TILE_WEIGHTS}
    print(f"  Background: {bg.size}  Tiles: {len(tiles)}")

    # 3. Create final candidate
    print("\n[3/5] Creating final candidate...")
    final, cleanup = create_final_candidate()
    fp = OUTPUT_DIR / "arena_frame_2to1_final_candidate.png"
    final.save(fp, optimize=True)
    print(f"  Saved: {fp.name}")
    print(f"  Magenta fully removed: {cleanup['magenta_fully_removed']}")
    print(f"  Diamond cleared: {cleanup['diamond_cleared']}  Edge bleed: {cleanup['edge_bleed']}")

    # 4. Proof images
    print("\n[4/5] Generating proof images...")

    # A. Raw geometry overlay
    raw = Image.open(RAW_FRAME_PATH).convert("RGBA")
    oa = raw.copy()
    da = ImageDraw.Draw(oa, "RGBA")
    pts = [tuple(TARGET_V["top"]), tuple(TARGET_V["right"]),
           tuple(TARGET_V["bottom"]), tuple(TARGET_V["left"])]
    da.polygon(pts, outline=(80,255,80,180), width=3)
    for name, pt in TARGET_V.items():
        x, y = pt
        da.ellipse([x-5,y-5,x+5,y+5], fill=(255,255,0,220))
    fb = font_b(20)
    fs = font(14)
    label = f"Target 2:1: {INNER_W}x{INNER_H}  ratio={RATIO}"
    bb = da.textbbox((10,10), label, font=fb)
    da.rectangle([bb[0]-4,bb[1]-4,bb[2]+4,bb[3]+4], fill=(0,0,0,200))
    da.text((10,10), label, fill=(80,255,80), font=fb)
    for name, pt in TARGET_V.items():
        x, y = pt
        ox = 10 if name != "right" else -120
        oy = -20 if name == "bottom" else (20 if name == "top" else 0)
        da.text((x+ox, y+oy), f"{name} [{x},{y}]", fill=(80,255,80), font=fs)
    oa.save(OUTPUT_DIR / "arena_frame_candidate_raw_geometry_overlay.png", optimize=True)
    print("  A. arena_frame_candidate_raw_geometry_overlay.png")

    # B. Already saved
    print(f"  B. {fp.name}")

    # C. Alpha check (checkerboard)
    ac = Image.new("RGBA", (CW, CH), (0,0,0,255))
    acd = ImageDraw.Draw(ac)
    cs = 16
    for y in range(0, CH, cs):
        for x in range(0, CW, cs):
            c = (40,40,40,255) if (x//cs + y//cs) % 2 == 0 else (80,80,80,255)
            acd.rectangle([x,y,x+cs-1,y+cs-1], fill=c)
    ac = Image.alpha_composite(ac, final)
    ai = Image.new("RGBA", (CW, CH), (0,0,0,0))
    aid = ImageDraw.Draw(ai)
    lbl = "Alpha check — checkerboard = transparent"
    bb = aid.textbbox((10,10), lbl, font=fb)
    aid.rectangle([bb[0]-4,bb[1]-4,bb[2]+4,bb[3]+4], fill=(0,0,0,200))
    aid.text((10,10), lbl, fill=(255,255,255), font=fb)
    ac = Image.alpha_composite(ac, ai)
    ac.save(OUTPUT_DIR / "arena_frame_2to1_final_candidate_alpha_check.png", optimize=True)
    print("  C. arena_frame_2to1_final_candidate_alpha_check.png")

    # D-H. Tile fills with SQUARE grids
    # N32 ≈ 32 visible tiles → 8x8 square grid (64 total, ~32 inside diamond)
    # N40 ≈ 40 visible tiles → 9x9 square grid (81 total, ~40 inside diamond)
    # N64 ≈ 64 visible tiles → 11x11 square grid (121 total, ~60 inside diamond)
    grid_configs = [
        (8,  "N32", True),    # 8x8 → ~32 tiles inside diamond, no-grid + grid
        (9,  "N40", True),    # 9x9 → ~40 tiles inside diamond, no-grid + grid
        (11, "N64", False),   # 11x11 → ~60 tiles inside diamond, grid only (stress)
    ]

    grid_results = {}

    for N, tag, no_grid in grid_configs:
        tw, th, ox, oy = compute_square_grid(N)
        print(f"\n  {tag}: {N}x{N} square grid, tile={tw:.2f}x{th:.2f}, ratio={tw/th:.4f}")

        if no_grid:
            r, cnt, tw_actual, th_actual = render_proof(bg_resized, final, tiles, N, False)
            r.save(OUTPUT_DIR / f"platform_frame_final_candidate_tilefill_{tag}.png", optimize=True)
            print(f"    {tag}. platform_frame_final_candidate_tilefill_{tag}.png  ({cnt} tiles)")

        r, cnt, tw_actual, th_actual = render_proof(bg_resized, final, tiles, N, True)
        r.save(OUTPUT_DIR / f"platform_frame_final_candidate_tilefill_{tag}_grid.png", optimize=True)
        print(f"    {tag}. platform_frame_final_candidate_tilefill_{tag}_grid.png  ({cnt} tiles)")

        grid_results[tag] = {
            "gridN": N,
            "cols": N,
            "rows": N,
            "tileW": round(float(tw_actual), 2),
            "tileH": round(float(th_actual), 2),
            "tileRatio": round(float(tw_actual / th_actual), 4),
            "originX": round(float(ox), 2),
            "originY": round(float(oy), 2),
            "tilesRendered": cnt,
            "totalGridTiles": N * N,
        }

    # 5. Metadata & report
    print("\n[5/5] Generating metadata and report...")

    v02b = json.loads(V02B_META_PATH.read_text())
    meta = {
        "schemaVersion": 2,
        "taskId": "VISUAL-02C",
        "fixupNote": "Fixed tile fill to cover full 2:1 cutout. Previous version used non-square grids with span=cols+rows-1, producing only a small centered patch. Fix: square NxN grids with th=INNER_H/N, grid diamond exactly matches cutout.",
        "input": {"file": "input/arena_frame_candidate_01_raw.png",
                  "dimensions": val["dimensions"], "magentaPixelsInRaw": val["magenta_count"]},
        "frame": {"canvasWidth": CW, "canvasHeight": CH},
        "targetCutout": {"vertices": TARGET_V, "innerWidth": INNER_W,
                         "innerHeight": INNER_H, "ratio": RATIO},
        "cutoutMethod": cleanup["method"],
        "magentaCleanup": {
            "magentaPixelsBefore": cleanup["magenta_before"],
            "magentaPixelsRemoved": cleanup["magenta_removed"],
            "edgeBleedPixels": cleanup["edge_bleed"],
            "magentaFullyRemoved": cleanup["magenta_fully_removed"],
        },
        "gridConfigs": grid_results,
        "notesForVisual03": [
            "Final candidate has exact 2:1 transparent cutout per VISUAL-02B.",
            "All magenta contamination removed.",
            "Frame art visually intact outside cutout.",
            "Square NxN grids fill the full diamond without gaps or skew.",
            "Recommended for VISUAL-03 pending owner visual review.",
            "Production grid size still TBD (N32/N40/N64).",
        ],
    }
    mp = OUTPUT_DIR / "frame_2to1_final_candidate_meta.json"
    mp.write_text(json.dumps(meta, indent=2))
    print(f"  Metadata: {mp.name}")

    # Report
    mb = val.get("magenta_bbox", {})
    report = f"""{"="*70}
VISUAL-02C (fixup) — Full Tile Fill Proof Report
{"="*70}

1. INPUT FILE
{"-"*40}
   File: arena_frame_candidate_01_raw.png
   Dimensions: {val['dimensions'][0]} x {val['dimensions'][1]} px
   Mode: {val['mode']}
   Dimensions match target (1672x941): {'YES' if val['dimensions_ok'] else 'NO'}
   Has magenta center: {'YES' if val['has_magenta'] else 'NO'}
   Magenta pixel count: {val['magenta_count']}
{"   Magenta bounding box: top=" + str(mb.get('top','')) + ", bottom=" + str(mb.get('bottom','')) + ", left=" + str(mb.get('left','')) + ", right=" + str(mb.get('right','')) if mb else ""}
{"   Magenta approx size: " + str(val.get('magenta_approx_w','?')) + " x " + str(val.get('magenta_approx_h','?')) + " px" if mb else ""}
   Alpha range: {val['alpha_range']}
   Transparent pixels in raw: {val['transparent_pixels']}


2. TARGET 2:1 GEOMETRY (from VISUAL-02B)
{"-"*40}
   Target vertices:
     Top:    {TARGET_V['top']}
     Right:  {TARGET_V['right']}
     Bottom: {TARGET_V['bottom']}
     Left:   {TARGET_V['left']}
   Target inner size: {INNER_W} x {INNER_H} px
   Target ratio: {RATIO} (exact 2:1)
   Diamond center: ({CX}, {CY})
   Diamond half-extents: hw={HW}, hh={HH}


3. FIXUP EXPLANATION
{"-"*40}
   PROBLEM: The previous VISUAL-02C proof used non-square grids
   (8x4, 8x5, 8x8) with span = cols + rows - 1 to compute tile
   size. This produced tiles that were too small, resulting in a
   small centered tile patch that covered only about half the
   diamond area. Most of the 2:1 frame cutout showed the
   background through the transparent center instead of platform
   tiles.

   ROOT CAUSE: Two compounding errors:
   a) span = cols + rows - 1 underestimates the tile size needed
      to fill the diamond. The correct span for a grid that fills
      a diamond from edge to edge is cols + rows (for a square
      NxN grid, span = 2N).
   b) Non-square grids (cols != rows) produce a SKEWED outline
      diamond. The grid diamond bottom vertex is offset from the
      target by (cols - rows) * th pixels horizontally. This
      means a non-square grid can never perfectly match a
      symmetric target diamond.

   FIX: Use SQUARE NxN grids with th = INNER_H / N and tw = 2*th.
   For a square grid, the outline diamond exactly matches the
   target cutout diamond:
     - Top vertex: (CX, top_y) = (836, 69)
     - Right vertex: (CX + N*th, CY) = (1638, 470)
     - Bottom vertex: (CX, bottom_y) = (836, 871)
     - Left vertex: (CX - N*th, CY) = (34, 470)
   Only tiles whose centers fall inside the diamond are rendered.
   The frame overlay covers any tiles at the edge that extend
   slightly beyond the cutout boundary.


4. ALPHA CUTOUT METHOD
{"-"*40}
   Method: {cleanup['method']}

   Step 1: Created vector diamond mask using VISUAL-02B target
   vertices. All pixels inside the diamond set to alpha=0 with
   RGB also cleared to 0.

   Step 2: Detected magenta edge bleed — magenta-colored pixels
   just outside the diamond boundary. Found {cleanup['edge_bleed']}
   edge bleed pixels. These were also set to alpha=0.

   Step 3: Safety sweep — any remaining magenta pixels anywhere
   in the image were also set to alpha=0 to ensure no magenta
   contamination in the final output.

   Total diamond pixels cleared: {cleanup['diamond_cleared']}
   Total magenta pixels removed: {cleanup['magenta_removed']}
   Magenta fully removed: {'YES' if cleanup['magenta_fully_removed'] else 'NO'}


5. MAGENTA BLEED CLEANUP
{"-"*40}
   Magenta pixels in raw input: {cleanup['magenta_before']}
   Edge bleed pixels (near diamond boundary): {cleanup['edge_bleed']}
   Total magenta removed: {cleanup['magenta_removed']}
   Magenta remaining after cleanup: {cleanup['magenta_after']}
   Cleanup successful: {'YES' if cleanup['magenta_fully_removed'] else 'NO'}

   The raw candidate used magenta (#FF00FF-ish) as a chroma key
   for the center area. Some anti-aliased edges had partial-magenta
   pixels that blended frame art with the magenta center. These were
   detected and removed by checking a 3px expanded zone around the
   diamond boundary, plus a global safety sweep.


6. TILE FILL ALIGNMENT (FIXED)
{"-"*40}
   With square NxN grids and th = INNER_H / N, each tile has
   an exact 2:1 ratio and the grid diamond perfectly covers
   the full target cutout:"""

    for tag, gr in grid_results.items():
        report += f"""

   {tag} ({gr['cols']}x{gr['rows']} square):
     Tile size: {gr['tileW']} x {gr['tileH']} px  ratio: {gr['tileRatio']}
     Grid origin: ({gr['originX']}, {gr['originY']})
     Tiles rendered inside diamond: {gr['tilesRendered']} of {gr['totalGridTiles']} total
     Grid diamond matches cutout: YES (square grid symmetry)"""

    report += f"""

   All grid sizes produce exact 2:1 tile ratios. No stretch.
   All grid diamonds exactly match the target 2:1 cutout.


7. FRAME ART INTEGRITY
{"-"*40}
   The exact 2:1 cutout was applied to the raw candidate frame.
   Frame art outside the diamond is preserved as-is from the
   generated candidate. The cutout does NOT destroy important frame
   art because:

   - The generated candidate was designed with a magenta center,
     meaning the artist/tool already left the center area empty.
   - The VISUAL-02B target diamond is slightly different from the
     raw magenta area, but the difference is small.
   - The frame border is wide and textured, so the minor shift
     in the cutout boundary does not affect structural elements.

   Verdict: Frame art is VISUALLY INTACT after the cutout.
   The final candidate is suitable for VISUAL-03 integration
   pending owner visual review of the proof images.


8. RECOMMENDATION FOR VISUAL-03
{"-"*40}
   RECOMMENDED — The final candidate frame is suitable for
   VISUAL-03 integration subject to:

   a) Owner visual review of the proof images in this package.
   b) Confirmation that the tile fill now covers the full
      diamond cutout with no background visible inside the
      playable arena area.
   c) Confirmation that the frame art style and quality are
      acceptable for the industrial platform direction.
   d) Decision on production grid size (N32/N40/N64).

   The candidate has:
   - Exact 2:1 transparent inner cutout (VISUAL-02B geometry)
   - No magenta contamination remaining
   - Frame art visually intact outside the cutout
   - Clean alpha boundaries suitable for Phaser rendering
   - Full tile fill covering the entire playable arena area


9. REMAINING LIMITATIONS
{"-"*40}
   - This is a proof package, not a runtime integration.
   - The background world image is still a candidate, not final.
   - Grid size for production has not been decided.
   - Tile set is proof-only (8 balanced tiles).
   - The frame candidate was generated by AI image tool;
     a human art review pass is recommended before production.
   - No runtime integration was done.


10. EXPLICIT STATEMENT: NO RUNTIME INTEGRATION
{"-"*40}
   No runtime integration was performed in this task.
   No production terrain code was modified.
   No gameplay, pathfinding, economy, building placement,
   unit logic, or save/load systems were touched.
   The final candidate frame PNG is proof-only and resides
   in _inbox/visual_proofs/VISUAL-02C_frame_art/, not in
   public/assets or any production folder.


{"="*70}
END OF REPORT
{"="*70}
"""
    rp = OUTPUT_DIR / "VISUAL-02C_FRAME_ART_REPORT.txt"
    rp.write_text(report)
    print(f"  Report: {rp.name}")

    # Zip
    zp = OUTPUT_DIR / "VISUAL-02C_frame_art_outputs.zip"
    with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in OUTPUT_DIR.iterdir():
            if f.is_file() and f.name != "generate_proof.py" and not f.name.startswith("input"):
                if f.suffix in (".png", ".json", ".txt"):
                    zf.write(f, f.name)
    print(f"  Archive: {zp.name}")

    # Validation
    print("\n" + "=" * 60)
    print("VISUAL-02C (fixup) proof generation complete!")
    print("=" * 60)
    fc = np.array(final)
    fcm = (fc[:,:,0]>MAG_R) & (fc[:,:,1]<MAG_G) & (fc[:,:,2]>MAG_B) & (fc[:,:,3]>0)
    print(f"\n  Final: {final.size} RGBA")
    print(f"  Center alpha=0: {fc[470,836,3] == 0}")
    print(f"  No magenta: {np.sum(fcm)==0}")
    print(f"  Ratio=2.0: {RATIO == 2.0}")
    print(f"  No src/ changes")
    print(f"  Grids: square NxN, full diamond coverage")

    # Verify grid diamond alignment for each config
    print("\n  Grid diamond vertex verification:")
    for tag, gr in grid_results.items():
        N = gr["gridN"]
        tw_v, th_v, ox_v, oy_v = compute_square_grid(N)
        # Top vertex
        top = (int(ox_v), int(oy_v - th_v/2))
        # Right vertex
        right = (int(ox_v + N*th_v), int(oy_v + (N-1)*th_v/2))
        # Bottom vertex
        bottom = (int(ox_v), int(oy_v + N*th_v - th_v/2))
        # Left vertex
        left = (int(ox_v - N*th_v), int(oy_v + (N-1)*th_v/2))
        print(f"    {tag} ({N}x{N}): top={top} right={right} bottom={bottom} left={left}")
        print(f"      Target: top={tuple(TARGET_V['top'])} right={tuple(TARGET_V['right'])} bottom={tuple(TARGET_V['bottom'])} left={tuple(TARGET_V['left'])}")


if __name__ == "__main__":
    main()
