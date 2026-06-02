# CAMERA_PROJECTION_CONTRACT.md

Status: accepted — CAMERA-00
Project: Four Elements Phaser
Repo: `ratoker-jpg/four-elements-phaser`
Date: 2026-06-02

---

## 1. Camera model

The game uses a **fixed isometric/axonometric 2.5D camera**.

- The camera angle is **fixed** — the player cannot rotate the view.
- The player can **pan** (scroll/drag the view).
- The player can **zoom** (scroll wheel).
- The player **cannot rotate** the camera or map.

### What the camera is NOT

- ❌ **Not top-down** — the ground plane is viewed at an angle, not from directly above.
- ❌ **Not side-view** — height is projected but the view is oblique, not profile.
- ❌ **Not rotatable** — the camera angle never changes. All assets and rendering assume this fixed angle.

---

## 2. Exact projection formula

```
screen = origin + worldX * basisX + worldY * basisY + worldZ * basisZ
```

Where:

- `screen` = pixel position on screen (before camera pan/zoom)
- `origin` = map offset (positions tile (0,0) in the render buffer)
- `worldX` = position along the world X axis (in tile units)
- `worldY` = position along the world Y axis (in tile units)
- `worldZ` = vertical height above the ground plane (in height units)
- `basisX` = one world/tile step along X projected to screen
- `basisY` = one world/tile step along Y projected to screen
- `basisZ` = one vertical height unit projected to screen

Ground plane (z = 0):

```
screen = origin + worldX * basisX + worldY * basisY
```

---

## 3. Current constants

| Constant | Value | Source |
|---|---|---|
| TILE_W | 76 | `src/config/worldConfig.ts` |
| TILE_H | 38 | `src/config/worldConfig.ts` |
| basisX | { x: 38, y: 19 } | Derived: TILE_W/2, TILE_H/2 |
| basisY | { x: -38, y: 19 } | Derived: -TILE_W/2, TILE_H/2 |
| basisZ | { x: 0, y: -60 } | Calibrated vertical scale |

Source of truth: `src/config/cameraProjectionContract.ts`

---

## 4. Object anchor rule

**Ground contact point / bottom-center.**

All game objects (buildings, units, obstacles) are anchored at their ground contact point — the point where the object meets the terrain in the isometric view.

- **Buildings**: south vertex of their footprint diamond.
- **Units**: world position projected onto the ground plane (z = 0).
- **Height offsets**: applied upward (negative Y on screen) from the anchor using basisZ.

The anchor point is the reference from which all vertical offsets (HP bars, selection rings, status indicators, shadows) are computed.

---

## 5. Rules for specific visual elements

### Selection rings
- Must be projected onto the ground plane using `projectGroundCircleToPolyline`.
- A naive screen-space circle is **wrong** because the ground plane is tilted.
- The projected ring appears as an ellipse, wider than tall.

### Shadows
- Must lie on the ground plane, projected through basisX/basisY.
- Shadow shape is a projected ellipse or projected footprint parallelogram.
- Circular shadows are **forbidden** — they assume top-down camera.

### Footprints
- Rectangular footprints project as parallelograms/diamonds using `projectGroundRect`.
- The 4 corners of a W×H footprint are projected independently.
- Do not draw footprints as axis-aligned rectangles.

### Range indicators
- Must be projected ground circles using `projectGroundCircleToPolyline`.
- Same rule as selection rings: the ground is tilted, so range circles become ellipses.

### Ground VFX
- All ground-plane VFX (explosion rings, splash radius, etc.) must be projected.
- Use `projectGroundPoint` for point effects.
- Use `projectGroundCircleToPolyline` for area effects.
- Use `projectGroundRect` for rectangular areas.

### Hit markers / damage numbers
- Position at the hit point on the ground plane (or slightly above using basisZ).
- Do not place at screen-center or arbitrary offsets.

### Buildings
- Anchor at the south vertex of the footprint diamond.
- Height elements (roofs, upper floors) offset upward using basisZ.
- Building sprites must be designed for the fixed isometric angle.

### Unit sprites / assets
- Must be designed for the fixed isometric/axonometric camera angle.
- Body and turret assets must match the basisX/basisY/basisZ projection.
- Do not use top-down sprites — they will not align with the ground plane.

---

## 6. Forbidden assumptions

- ❌ **No screen-space circles for ground markers** — the ground plane is tilted; circles become ellipses.
- ❌ **No top-down unit bodies** — units are viewed from an oblique angle, not from above.
- ❌ **No circular top-down shadows** — shadows on the ground must be projected.
- ❌ **No camera rotation workaround** — the camera is fixed; assets and code must not assume rotation.
- ❌ **No assuming basisX.y = 0 or basisY.y = 0** — both basis vectors have a Y component, confirming the view is not top-down.

---

## 7. Correct assumptions

- ✅ Ground markers (selection rings, range indicators, footprints) must be **projected** through basisX/basisY.
- ✅ Height uses **basisZ** — vertical offset goes upward on screen (negative Y).
- ✅ Assets must match the **fixed isometric/axonometric 2.5D camera** angle.
- ✅ The projection formula `screen = origin + x*basisX + y*basisY + z*basisZ` is the single source of truth for all world-to-screen transformations.
- ✅ `projectGroundCircleToPolyline` is the correct function for any circular ground-plane marker.
- ✅ `projectGroundRect` is the correct function for any rectangular ground-plane footprint.

---

## 8. Implementation file

All projection constants and helpers are defined in:

```
src/config/cameraProjectionContract.ts
```

Dev/arena calibration overlay:

```
src/phaser/render/CameraProjectionDebugRenderer.ts
```

Toggle in arena mode: **C key**

---

## 9. Required reading before visual tasks

**Before any visual/world-space/rendering/asset task, read this document.**

Rules:

- Visual tasks must **not** assume top-down camera.
- Any ground marker must be **projected** onto the isometric ground plane.
- Any sprite/asset prompt must say **fixed isometric/axonometric 2.5D camera using camera projection contract**.
- Any shadow/selection/range/footprint task must use **ground-plane projection**.
