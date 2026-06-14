# WASP HULL DIRECTION CALIBRATION AID

Status: **ARCHIVED** — superseded by MODULAR_VEHICLE_ASSET_RUNTIME_SYSTEM_AUDIT_2026_06_14.md; calibration aid retained as history (2026-06-14)  
Task: PIM-HULL-WASP-DIR-MAP-01  
Date: 2026-06-08  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  

---

## Purpose

This document describes the Wasp hull direction calibration tool — a dev-only debug aid that allows manual inspection and cycling of all 16 hull sprite directions. This is **NOT** the final direction fix. It exists so Denis can manually determine the correct `WASP_HULL_VISUAL_DIR16_REMAP` table values by visual inspection.

---

## How to enter calibration mode

1. Open Arena mode: `?arena=1&devtools=1`
2. Spawn a Wasp (any weapon, any team)
3. Select the Wasp (LMB click)
4. Press `.` (period) to activate calibration mode

The calibration overlay will appear above the Wasp showing all diagnostic info.

---

## Hotkeys

| Hotkey | Action | Note |
|--------|--------|------|
| `.` | Toggle calibration mode ON/OFF | Only works when a Wasp is selected |
| `]` | Next dir16 (cycle forward) | Wraps from 15 → 0 |
| `[` | Previous dir16 (cycle backward) | Wraps from 0 → 15 |
| `\` | Clear override (return to auto) | Hull uses normal pipeline again |
| `;` | Toggle calibration overlay visibility | Overlay text ON/OFF |

All hotkeys are dev/arena-only and only work when:
- Devtools is active
- A Wasp is selected
- Calibration mode is ON (for ]/[/\ hotkeys)

---

## What you see on the overlay

The calibration overlay shows:

```
=== WASP CALIBRATOR ===
hull: wasp
bodyAngle: 90°
dir8: 2  logical dir16: 4
remap → visual dir16: 4 (dir04_S)
FORCED visual dir16: 8 (dir08_W)
compass: W
texture: dir08
override: ACTIVE
```

Key fields:
- **hull** — hull ID (should always be 'wasp' during calibration)
- **bodyAngle** — current body angle in degrees
- **dir8** — 8-direction index from bodyAngle
- **logical dir16** — 16-direction index before remap
- **remap → visual dir16** — what the current remap table produces
- **FORCED visual dir16** — the PNG you're currently viewing (from hotkey cycling)
- **compass** — compass suffix of the currently displayed PNG
- **texture** — texture key fragment (dir number + suffix)
- **override** — whether the forced override is active

---

## How to fill the final mapping table

### Step-by-step process

1. Select the Wasp in Arena.
2. Activate calibration mode (`.` key).
3. Move the Wasp so it faces **East** (the yellow heading arrow points East).
4. Use `]` and `[` to cycle through all 16 PNG directions.
5. Find which PNG direction makes the hull sprite face the same way as the yellow arrow.
6. Record: logical dir16 for East (0) → visual dir16 that looks correct.
7. Repeat for all 8 cardinal/ordinal directions (SE, S, SW, W, NW, N, NE).
8. For odd dir16 indices (half-directions like ESE, SSE, etc.), either interpolate from the 8-direction values or test with half-angles.

### Blank template

Fill in the correct visual dir16 for each logical dir16:

```typescript
// WASP_HULL_VISUAL_DIR16_REMAP — calibration results
// logical dir16 → visual dir16 (which PNG actually faces the correct direction)
export const WASP_HULL_VISUAL_DIR16_REMAP: Record<number, number> = {
  0: __,  // logical E  → visual ??? (dir00_E)
  1: __,  // logical ESE → visual ??? (dir01_ESE)
  2: __,  // logical SE  → visual ??? (dir02_SE)
  3: __,  // logical SSE → visual ??? (dir03_SSE)
  4: __,  // logical S   → visual ??? (dir04_S)
  5: __,  // logical SSW → visual ??? (dir05_SSW)
  6: __,  // logical SW  → visual ??? (dir06_SW)
  7: __,  // logical WSW → visual ??? (dir07_WSW)
  8: __,  // logical W   → visual ??? (dir08_W)
  9: __,  // logical WNW → visual ??? (dir09_WNW)
  10: __, // logical NW  → visual ??? (dir10_NW)
  11: __, // logical NNW → visual ??? (dir11_NNW)
  12: __, // logical N   → visual ??? (dir12_N)
  13: __, // logical NNE → visual ??? (dir13_NNE)
  14: __, // logical NE  → visual ??? (dir14_NE)
  15: __, // logical ENE → visual ??? (dir15_ENE)
};
```

---

## Console API

For advanced use, a browser console API is also available after activation:

```javascript
// Cycle directions from browser dev console
window.WASP_CAL.cycle()      // next dir16
window.WASP_CAL.prev()       // prev dir16
window.WASP_CAL.dir(8)       // force specific dir16
window.WASP_CAL.auto()       // clear override (auto mode)
window.WASP_CAL.reset()      // reset to dir00
window.WASP_CAL.overlay()    // toggle overlay visibility
window.WASP_CAL.freeze()     // toggle movement freeze
window.WASP_CAL.template()   // print calibration template to console
window.WASP_CAL.state()      // print current calibrator state
```

---

## Direction reference

### 16-direction naming convention

| Index | Suffix | Full Direction | Angle (screen-space) |
|-------|--------|---------------|---------------------|
| 0 | E | East | 0° |
| 1 | ESE | East-Southeast | 22.5° |
| 2 | SE | Southeast | 45° |
| 3 | SSE | South-Southeast | 67.5° |
| 4 | S | South | 90° |
| 5 | SSW | South-Southwest | 112.5° |
| 6 | SW | Southwest | 135° |
| 7 | WSW | West-Southwest | 157.5° |
| 8 | W | West | 180° |
| 9 | WNW | West-Northwest | -157.5° |
| 10 | NW | Northwest | -135° |
| 11 | NNW | North-Northwest | -112.5° |
| 12 | N | North | -90° |
| 13 | NNE | North-Northeast | -67.5° |
| 14 | NE | Northeast | -45° |
| 15 | ENE | East-Northeast | -22.5° |

### Runtime 8-direction convention

| dir8 | Direction | Angle (screen-space) |
|------|-----------|---------------------|
| 0 | E | 0° |
| 1 | SE | PI/4 (45°) |
| 2 | S | PI/2 (90°) |
| 3 | SW | 3PI/4 (135°) |
| 4 | W | PI (180°) |
| 5 | NW | -3PI/4 (-135°) |
| 6 | N | -PI/2 (-90°) |
| 7 | NE | -PI/4 (-45°) |

### Current remap (identity — needs manual calibration)

```typescript
// Current: identity mapping — no remap applied
0: 0,   // E  → E
1: 1,   // ESE → ESE
2: 2,   // SE  → SE
3: 3,   // SSE → SSE
4: 4,   // S   → S
5: 5,   // SSW → SSW
6: 6,   // SW  → SW
7: 7,   // WSW → WSW
8: 8,   // W   → W
9: 9,   // WNW → WNW
10: 10, // NW  → NW
11: 11, // NNW → NNW
12: 12, // N   → N
13: 13, // NNE → NNE
14: 14, // NE  → NE
15: 15, // ENE → ENE
```

This identity remap is the starting point. Use this calibration tool to determine the actual correct values.

---

## What this tool does NOT do

- Does NOT change PNG assets
- Does NOT change asset filenames
- Does NOT change turret direction logic
- Does NOT change movement/pathfinding logic
- Does NOT change production/economy/save-load systems
- Does NOT persist any calibration state

---

## Next step after calibration

Once Denis has determined the correct remap values using this tool:

1. Create a tiny implementation PR that updates `WASP_HULL_VISUAL_DIR16_REMAP` in `src/assets/generatedHullAssets.ts` with the calibrated values.
2. Update the tests in `src/__tests__/generatedHullAssets.test.ts` to match.
3. Run validation and manual QA.
4. If the calibration tool is no longer needed, it can be removed in a separate cleanup PR.
