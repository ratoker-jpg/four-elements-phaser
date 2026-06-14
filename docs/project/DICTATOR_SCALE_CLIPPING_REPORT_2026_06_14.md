# DICTATOR_SCALE_CLIPPING_REPORT_2026_06_14

## Project

```text
Project: Four Elements Phaser
Asset pipeline: Modular hull + turret sprites
Current staging/export target: modular all factions
Renderer model: hull sprite separately + turret sprite separately
```

## Status

```text
issue found
root cause understood
asset-side fix selected
runtime/game-side compensation required
```

## Summary

During `modular_all_factions` smoke/full-prep pipeline QA, an old visual defect was found for the `Dictator` hull: the hull clips at the edge of the `512x512` PNG frame.

The issue is hull-specific: `Dictator` is longer/larger than the other hull models, so it can exceed the fixed frame in some directions.

Accepted asset-side fix:

```text
Dictator render scale = 0.91
```

This means the `Dictator` hull is rendered 9% smaller in the Blender/export pipeline so it fits inside the fixed `512x512` frame.

Because this makes the exported `Dictator` sprite visually smaller, the game/runtime renderer must compensate only for `Dictator` with a visual-only hull sprite scale multiplier.

Recommended starting value:

```ts
const HULL_VISUAL_SCALE_MULTIPLIERS = {
  dictator: 1.09,
};
```

Exact inverse of `0.91` is `1 / 0.91 = 1.0989`; use `1.09` first, adjust to `1.10` only if QA says `Dictator` still looks too small.

---

## What was found

### Problem

Original `Dictator` hull PNG clips at the image boundary in the fixed export setup:

```text
frame: 512x512
fixedOrthoScale: 860
socketPixel: 256,256
render strategy: fixed_512_frame
```

Observed issue:

```text
Dictator hull edge is cut off in some directions.
```

The issue exists across `Dictator` modifications, not just one mod.

### Affected asset

```text
hull: dictator
mods: m0 / m1 / m2 / m3
factions: expected all factions, visually found on cyan/purple previews
directions: at least some 16-dir views, especially side/diagonal views
```

### Not affected

```text
Other hulls were not flagged in this check.
Turret assets were not the source of this clipping issue.
```

---

## Root cause

`Dictator` is physically longer/larger than the other hulls. With current render constraints:

```text
512x512 canvas
fixedOrthoScale = 860
anchor/socket centered at 256,256
```

the full projected geometry does not always fit inside the frame.

This is not a metadata/pivot bug and not a texture bug. It is a model/frame fit issue.

---

## Tested solutions

### Tested scale values

Focused test:

```text
DICTATOR_CYAN_SCALE_16DIRS_V1
dictator only
cyan only
m0/m1/m2/m3
all 16 dirs
scales: 0.96 / 0.94 / 0.92
```

Result:

```text
0.92 still clipped slightly on at least one direction.
```

Second focused test:

```text
DICTATOR_CYAN_SCALE_16DIRS_V2
dictator only
cyan only
m0/m1/m2/m3
all 16 dirs
scales: 0.91 / 0.90
```

Result:

```text
0.91 accepted visually
0.90 not needed unless future QA finds edge clipping again
```

### Attach check

Focused attach check:

```text
DICTATOR_RAILGUN_CYAN_M0_ATTACH_16DIRS_V1
hull: dictator
turret: railgun
faction: cyan
hull mod: m0
turret mod: m0
directions: all 16
dictator scale: 0.91
```

Result:

```text
Railgun attachment looked normal.
No obvious center/pivot drift was found visually.
```

---

## Accepted asset-side fix

Apply `Dictator`-only render scale override in the Blender/export pipeline:

```python
HULL_RENDER_SCALE_OVERRIDES = {
    "dictator": 0.91,
}
```

### Important implementation detail

The scale must be applied **after socket anchoring** and **around local origin**.

Correct order:

```text
1. Import Dictator hull.
2. Find mount/socket object.
3. Convert hull mesh into socket-anchored local mesh.
4. Move socket/mount to local origin.
5. Apply uniform scale 0.91 to mesh vertices around origin.
6. Render into 512x512 frame.
```

Expected invariant:

```text
hull socketPixel remains 256,256
turret pivotPixel remains 256,256
turret.pivotPixel -> hull.socketPixel still works
```

Do not scale around bbox center. That can move the socket relative to the visual model and break turret alignment.

---

## Required game/runtime compensation

Because the exported `Dictator` PNG is now rendered at `0.91`, the game should compensate visually by increasing only the `Dictator` sprite scale.

### Why compensation is needed

Without compensation:

```text
Dictator will no longer clip,
but it will be about 9% smaller than intended.
```

To keep the visual gameplay size close to the old/original size:

```text
runtime scale multiplier ~= 1 / 0.91 = 1.0989
```

Recommended practical values:

```text
Option A: 1.09  // user-requested approx +9%, slightly conservative
Option B: 1.10  // mathematically closer to inverse scale
```

Start with:

```text
dictator runtime visual scale multiplier = 1.09
```

If it still looks slightly smaller than intended, adjust to:

```text
1.10
```

### Where this should live conceptually

This should be a renderer/profile-level visual override, not a gameplay/stat change.

Example concept:

```ts
const HULL_RUNTIME_VISUAL_SCALE_OVERRIDES = {
  dictator: 1.09,
};
```

or in a sprite/profile config:

```ts
dictator: {
  visualScaleMultiplier: 1.09,
}
```

### Scope

Apply only to:

```text
hull: dictator
```

Do not apply to:

```text
all hulls
all turrets
all factions globally
gameplay collision
hitbox
movement
weapon range
health bars unless they are visually tied to sprite bounds
```

---

## Composition and anchor notes

The modular renderer should still compose sprites by metadata:

```text
hull sprite origin = hull.socketPixel / imageSize
turret sprite origin = turret.pivotPixel / imageSize
hull position = vehicle mount screen/world position
turret position = same vehicle mount screen/world position
```

Runtime formula:

```ts
hullImage.setOrigin(socketPixel.x / imageW, socketPixel.y / imageH);
turretImage.setOrigin(pivotPixel.x / imageW, pivotPixel.y / imageH);

hullImage.setPosition(vehicleX, vehicleY);
turretImage.setPosition(vehicleX, vehicleY);
```

Then apply visual scale after origin is set:

```ts
const scale = baseScale * getHullVisualScaleMultiplier(hullId);

hullImage.setScale(scale);
turretImage.setScale(baseScale);
```

For `Dictator`, increasing hull sprite scale around socket-origin should preserve turret alignment because the socket is the sprite origin.

If the renderer uses a shared vehicle scale for both hull and turret, the safer approach is:

```text
hull visual scale override applies to hull image only
turret scale remains normal
both keep the same socket/pivot position
```

---

## Why not increase frame size

Alternative considered:

```text
increase frame from 512x512 to 640x640
```

Rejected for now because:

```text
would increase all PNG sizes
would affect all assets
would require broader pipeline/runtime review
not needed if Dictator-only 0.91 fixes clipping
```

The selected fix is smaller and safer:

```text
asset pipeline: Dictator render scale 0.91
runtime: Dictator visual scale multiplier 1.09-1.10
```

---

## Expected full export after fix

Full all-factions modular export should still produce:

```text
hulls:   7 hulls x 4 mods x 16 dirs x 4 factions = 1792 PNG
turrets: 10 turrets x 4 mods x 16 dirs x 4 factions = 2560 PNG
total:   4352 runtime PNG
```

No combined hullx-turret production matrix should be generated.

---

## Validation checklist

Before accepting the full export:

```text
1. Run full all-factions export with Dictator scale override 0.91.
2. Confirm warnings = 0.
3. Open index.html.
4. Inspect Dictator for all factions:
   - cyan
   - green
   - yellow
   - purple
5. Inspect Dictator for all mods:
   - m0
   - m1
   - m2
   - m3
6. Inspect all 16 directions for clipping.
7. Confirm no edge clipping remains.
8. Confirm other hulls did not change scale.
9. Confirm turrets did not change scale.
10. Confirm metadata still reports socketPixel near 256,256.
11. Run attach preview if needed:
    Dictator + Railgun, all 16 dirs.
```

Runtime/game validation:

```text
1. Load Dictator with modular hull sprite.
2. Apply Dictator visual scale multiplier 1.09 or 1.10.
3. Confirm visual size matches intended heavy/large hull feel.
4. Confirm Railgun/turret remains centered on socket.
5. Rotate through all 16 or mapped runtime directions.
6. Confirm no turret drift.
7. Confirm no selection ring / HP bar / shadow offset regression.
8. Confirm collision/gameplay footprint is unchanged unless intentionally handled elsewhere.
```

---

## Strict non-goals

```text
Do not scale all hulls.
Do not scale all turrets.
Do not change weapon pivots.
Do not change socket metadata.
Do not change gameplay stats.
Do not change hitboxes/footprints because of this visual fix.
Do not use combined hullx-turret production matrix.
Do not preload all assets at runtime.
Do not fix by manual per-direction offsets.
```

---

## GitHub tracking

Issue:

```text
#282 — DICTATOR-SCALE-01: Dictator 0.91 export scale requires runtime visual compensation
```

---

## Final recommendation

Accepted rule:

```text
Asset export:
  dictator render scale = 0.91

Runtime/game renderer:
  dictator visual scale multiplier = 1.09 initially
  optionally adjust to 1.10 if it still looks slightly small
```

Short implementation note:

```ts
// Asset was rendered 9% smaller to avoid 512x512 clipping.
// Restore visual gameplay size only for Dictator.
const HULL_VISUAL_SCALE_MULTIPLIERS = {
  dictator: 1.09,
};
```
