# MODULAR-ALL-FACTIONS-01C: Preview Calibration Controls and Tile Overlay

Date: 2026-06-15
Task: MODULAR-ALL-FACTIONS-01C
Status: implemented, GPT review required before merge
Branch: `modular-all-factions-01c-preview-calibration`

---

## Summary

This change turns the Modular Vehicle devtools preview into a proper visual calibration tool. Denis can now visually prove whether the hull is centered inside a real isometric cell, whether hull/turret scale looks correct, whether the hull is shifted relative to the tile, and how many pixels of offset are needed for temporary inspection.

The change is strictly devtools-only. No assets, metadata, gameplay, combat, movement, economy, mapgen, pathfinding, save/load, or collision code was modified. No calibration values are persisted or applied to production metadata/config.

---

## Controls added

### Selection (existing from 01B)
- Faction cycle: changes both hull and turret asset faction. Preserves hullId, turretId, hullMod, turretMod, hullDir, turretDir, and calibration values.
- Hull / turret id cycle (independent).
- Hull mod / turret mod step (independent).

### Direction (existing from 01B)
- Body / turret direction cycle (dir16).

### Overlay (new in 01C)
- **markers ON/OFF**: Toggle socket/pivot marker circles and debug text.
- **tile ON/OFF**: Toggle 2:1 isometric diamond tile overlay under the vehicle.

### Scale (new in 01C)
- **model- / model+**: Adjust global model scale (affects both hull and turret).
- **hull- / hull+**: Adjust extra hull scale (QA-only multiplier applied AFTER Dictator baseline 1.09).
- **turret- / turret+**: Adjust extra turret scale (QA-only multiplier, turret does NOT inherit Dictator hull scale).

### Position (new in 01C)
- **hullX- / hullX+**: Move hull horizontally relative to tile center.
- **hullY- / hullY+**: Move hull vertically relative to tile center.
- **turretX- / turretX+**: Move turret horizontally relative to rendered position.
- **turretY- / turretY+**: Move turret vertically relative to rendered position.

### Steps (new in 01C)
- **px step**: Cycle pixel step for position controls (1 / 5 / 10).
- **scale step**: Cycle scale step for scale controls (0.01 / 0.05).

### Reset
- **reset cal**: Reset all calibration values to defaults (does not reset visual/dirs).
- **reset sel**: Reset visual/dirs/markers to defaults (existing behavior).

---

## Tile overlay behavior

- Draws a 2:1 isometric diamond under the preview vehicle using the project camera projection contract (basisX/basisY from TILE_W=76, TILE_H=38).
- Tile center corresponds to the preview world origin / vehicle anchor.
- Tile is rendered with a semi-transparent blue fill and a blue outline.
- Center cross marker (gold) at tile center.
- Corner markers (small circles) at N/E/S/W corners when markers are visible.
- Tile renders behind hull/turret and does not hide the vehicle.
- Tile is devtools preview only. Not added to live gameplay.
- Default: tile ON (visible for calibration mode).

---

## Calibration state and defaults

```typescript
type ModularPreviewCalibration = {
  showTile: boolean;        // default: true
  modelScale: number;       // default: 1
  hullScale: number;        // default: 1
  turretScale: number;      // default: 1
  hullOffsetX: number;      // default: 0
  hullOffsetY: number;      // default: 0
  turretOffsetX: number;    // default: 0
  turretOffsetY: number;    // default: 0
  pixelStep: 1 | 5 | 10;   // default: 1
  scaleStep: 0.01 | 0.05;  // default: 0.01
};
```

Effective scale formulas:
- `effectiveHullScale = baseDisplayScale * modelScale * getHullVisualScaleMultiplier(hullId) * hullScale`
- `effectiveTurretScale = baseDisplayScale * modelScale * turretScale`

Key rules:
- `hullScale` is an extra preview multiplier. It does NOT replace the production Dictator baseline scale (1.09).
- Dictator still has baseline 1.09. Non-Dictator baseline remains 1.
- Turret does NOT inherit Dictator hull scale.
- Calibration is devtools-only and never persisted.

---

## Left debug overlay fields

**Current selection:** hull id/mod/dir, turret id/mod/dir, faction

**Asset state:** available, fallback reason, hull/turret metadata, set loaded, queued count

**Tile / Calibration:** tile overlay on/off, markers on/off, modelScale, hullScale extra, turretScale extra, Dictator/base hull multiplier, effective hull scale, effective turret scale, hullOffset X/Y, turretOffset X/Y, pixelStep, scaleStep

**Positions:** preview center, hull pos, turret pos, socket, pivot, socket-pivot delta, tile corner coordinates

**Asset keys:** hull key, turret key

**Disclaimer:** "calibration is devtools-only", "does not modify metadata/assets"

---

## Confirmation: devtools-only

- All calibration controls are in the Modular Vehicle devtools panel only.
- No query-string flags added.
- No production config modified.
- No assets or metadata changed.
- No gameplay code changes.
- No live combat unit connection.
- No persistence of calibration values (no localStorage).

---

## Tests added

New test file: `src/__tests__/modularPreviewCalibration01c.test.ts` (39 tests)

Coverage includes faction cycling, calibration defaults, pixel/scale step cycling, reset calibration, Dictator baseline, preview scale independence from asset paths, effective scale computation, lazy load bounds, and namespace checks.

Existing tests still pass: modularRuntime01 (60), generatedHullAssets (69).

---

## Validation results

| Check | Result |
|-------|--------|
| `tsc --noEmit` | PASS — exit 0 |
| `vitest modularPreviewCalibration01c` | PASS — 39/39 |
| `vitest modularRuntime01` | PASS — 60/60 |
| `vitest generatedHullAssets` | PASS — 69/69 |
| `vitest run` (full suite) | PASS — 87 files, 4569 tests |
| `npm run build` | FAIL — ENOSPC (environment disk space, not code) |
| `npm run qa:smoke` | NOT RUN — requires build output |

---

## Changed files

| File | Change |
|------|--------|
| `src/modular/modularPreviewCalibration.ts` | NEW |
| `src/phaser/render/GeneratedModularVehicleRenderer.ts` | UPDATED |
| `src/phaser/dev/ModularVehicleDevtoolsPanel.ts` | UPDATED |
| `src/__tests__/modularPreviewCalibration01c.test.ts` | NEW |
| `docs/project/MODULAR_ALL_FACTIONS_01C_PREVIEW_CALIBRATION_REPORT_2026_06_14.md` | NEW |
| `docs/project/CURRENT_NEXT_STEP.md` | UPDATED |

---

## Known limitations

- Build fails due to ENOSPC (9.9G disk, 4352 PNGs). Not a code issue.
- Tile overlay is screen-space projected in the fixed preview. It does not account for camera pan/zoom (preview is already fixed-screen, scrollFactor 0).
- Visual tile overlay drawing is manual-QA validated (no automated screenshot tests).
- Calibration values are session-only; page reload resets them.

---

## Manual QA plan

After PR deploy, open Modular Vehicle preview.

**A. Factions:** Verify all 4 factions load and render.

**B. Tile overlay:** Verify diamond shape, center cross, corner markers. Toggle ON/OFF.

**C. Scales:** modelScale affects both, hullScale affects only hull, turretScale affects only turret. Dictator baseline 1.09 still applies.

**D. Offsets:** hullX/Y moves hull, turretX/Y moves turret. Diagnostics update live.

**E. Steps:** px step cycles 1/5/10. Scale step cycles 0.01/0.05.

**F. Regressions:** Wasp m0 correct, Dictator no clip, available:YES, queued<=32, no fallback.

---

## Next recommended step

MODULAR-RUNTIME-02B — Controlled Arena demo unit using GeneratedModularVehicleRenderer after QA accepts preview placement.
