# MODULAR-PROOF-01: Generated Vehicle Attachment Proof Harness

**Date:** 2026-06-14
**Task:** MODULAR-PROOF-01 — Isolated generated vehicle proof harness + clean preview renderer scaffold
**Risk:** High+
**Executor:** Opus
**Mode:** Implementation (isolated proof harness / preview renderer only — NOT Arena live integration)

---

## 1. Summary

This PR adds an **isolated, devtools-only proof harness** that composes the existing
generated **Wasp cyan m0 hull** sprite + **Smoky cyan m0 turret** sprite in clean 2D
sprite-space, with debug overlay markers, **outside** the quarantined
`BlockoutVehicleRenderer` procedural turret path.

It exists to let Denis **visually verify**, against the actual rendered PNGs:

- where the hull **socket** marker lands on the Wasp hull;
- where the turret **pivot** marker lands on the Smoky turret;
- whether pivot and socket **coincide** after composition;
- whether **zHeight** should be ignored for baked sprite composition (default) or not;
- whether the real issue is **metadata** or **renderer integration**.

The failed live integration remains quarantined. No Arena live vehicle rendering changed.

---

## 2. Changed files

| File | Change |
|------|--------|
| `src/phaser/render/generatedVehiclePreviewComposition.ts` | **NEW.** Pure composition module — no Phaser, no asset loading, no state mutation. Computes sprite positions + marker positions for the harness. |
| `src/phaser/dev/GeneratedVehicleProofHarness.ts` | **NEW.** Devtools-only Phaser overlay that renders hull + turret + markers + labels at fixed screen coordinates, isolated from Arena world-space. **Controlled via the devtools UI panel — no gameplay/debug keyboard controls.** |
| `src/phaser/dev/GeneratedVehicleProofPanel.ts` | **NEW (fixup).** Devtools DOM control panel (AssetPreviewPanel style) with mouse buttons for open/close, body/turret dir, zHeight diagnostic, markers, reset, plus a live state readout. |
| `src/__tests__/generatedVehiclePreviewComposition.test.ts` | **NEW.** 17 tests for the pure composition contract. |
| `src/phaser/GameScene.ts` | Instantiate the harness + panel when devtools is active; wire panel ↔ harness; show the panel; destroy both on shutdown. |
| `src/phaser/input/GameInputController.ts` | Add the optional `9` open/close hotkey (mirrors the existing `0` asset-preview pattern). |
| `docs/project/MODULAR_PROOF_01_GENERATED_VEHICLE_ATTACHMENT_HARNESS_REPORT_2026_06_14.md` | **NEW.** This report. |

The quarantine flag `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION = false`
(`BlockoutVehicleRenderer.ts:111`) was **not** touched.

**MODULAR-PROOF-01 fixup (PR #277):** the harness's original `B`/`N`/`G`/`M`
keyboard controls were **removed** because they conflicted with existing
gameplay/debug hotkeys. The harness now has **no keyboard controls of its own**;
all interaction is via the new mouse-driven devtools panel. The fix was **not**
done by suppressing gameplay hotkeys. The composition math is unchanged.

---

## 3. Harness location / how to open

- **Where it lives:** `src/phaser/dev/GeneratedVehicleProofHarness.ts` (Phaser overlay)
  + `src/phaser/render/generatedVehiclePreviewComposition.ts` (pure math).
- **How to open:** start in devtools/arena mode (e.g. `?skipMenu&devtools=1&arena=1`).
  A small **"Proof Harness"** panel is docked top-right. Click **"Open Harness"**
  (or press the optional `9` shortcut). **No new query-string flag was added.**
- **Controls — all via mouse on the devtools panel (no gameplay hotkeys):**
  - **Open / Close Harness** — builds/tears down the overlay.
  - **Hull body dir ◀ prev / next ▶** — cycle the hull body direction (dir8).
  - **Turret dir ◀ prev / next ▶** — cycle the turret direction (dir16, all 16).
  - **zHeight diag** — toggle the **DIAGNOSTIC** zHeight projection (default OFF).
  - **markers** — toggle the markers + text labels visibility.
  - **Reset** — restore body/turret dir 0, zHeight off, markers on.
  - The panel shows a **live readout**: body dir8, turret dir16, hull/turret
    visual dir16, zHeight state, markers state, and availability/reason.
  - `9` remains only as an optional open/close shortcut; the UI button does the same.

The previous `B`/`N`/`G`/`M` keyboard controls were **removed** (they collided with
gameplay/debug hotkeys). The harness draws a full-screen backdrop and renders at fixed
screen coordinates (`scrollFactor 0`), fully isolated from the Arena camera and live
vehicles. Closing it restores the normal Arena view unchanged.

---

## 4. Markers rendered

For the composed hull + turret pair the harness draws:

- **Wasp hull sprite** — cyan, m0, selected visual dir16, origin `(0.5, 0.75)`, scale `0.12`.
- **Smoky turret sprite** — cyan, m0, selected visual dir16, origin `(0.5, 0.5)`, scale `0.12`.
- **Hull socket marker** — magenta cross + ring.
- **Turret pivot marker** — green cross + ring.
- **Hull sprite origin marker** — blue square.
- **Turret sprite origin marker** — yellow square.
- **Bounding boxes** — blue (hull), yellow (turret).
- **Ground anchor marker** — lilac diamond (hull bottom-center / true ground contact).
- **Text labels:** bodyId, weaponId, hull logical/visual dir16, turret logical/visual dir16,
  hull origin, turret origin, hull scale, turret scale, socket `nx/ny/zHeight`, pivot `x/y`,
  whether zHeight is applied or ignored, and the resolved hull/turret texture keys.

---

## 5. Composition formula (clean sprite-space)

For a **baked isometric sprite**, the socket pixel inside the hull image is the visual
mount point, and the turret pivot pixel must land on that socket pixel. The composition
is pure 2D — **no zHeight is applied by default**:

```
hullSpritePos      = anchor                                  // hull origin anchor
hullSocketMarker   = anchor + (socket.n - hullOrigin) * hullDisplaySize
pivotFromCenter    = (pivot - 0.5) * turretDisplaySize
turretSpritePos    = hullSocketMarker - pivotFromCenter (+ zHeightDelta?)
turretPivotMarker  = turretSpritePos + pivotFromCenter
                   = hullSocketMarker (+ zHeightDelta?)
```

Where `hullDisplaySize = 512 * 0.12` and `turretDisplaySize = 512 * 0.12`.
By construction the **turret pivot coincides with the hull socket** when the zHeight
diagnostic is OFF. The harness then proves, by eye, whether the socket marker actually
lands on the hull's drawn turret ring and the pivot marker on the turret's rotation axis.

Direction remap (matches the existing resolvers, no new tables):
- hull: `logicalDir16 = dir8 * 2` → `applyHullVisualDir16Remap('wasp', …)` (+4).
- turret: `logicalDir16 = turretAngleToDir16(angle)` → `+ facingOffset*(16/dirCount)` (+4 for Smoky).

---

## 6. zHeight: ignored by default, diagnostic only

- **Default:** zHeight is **IGNORED**. `zHeightApplied = false`, delta `{0,0}`. The label
  reads `zHeight: IGNORED (default sprite-space composition)`.
- **Diagnostic toggle (`zHeight diag` button):** applies `deltaY = socket.zHeight * basisZ.y` (`0.30 * -60 = -18px`)
  to the turret only. The label reads `zHeight: APPLIED (DIAGNOSTIC, deltaY=…)`. This exists
  purely to **demonstrate** whether zHeight helps or double-counts — it is **not** the source
  of truth for sprite-to-sprite attachment and must not be promoted into a runtime fix unless
  the harness proves it is needed.

zHeight was **not** tuned by eye. The `0.30` value is read from existing metadata; the
diagnostic just projects it through the camera contract `basisZ` for comparison.

---

## 7. Visual QA — what Denis must check (screenshots)

Open the harness from the docked **"Proof Harness"** panel (click **Open Harness**) in
devtools/arena and capture, using the panel **buttons** (mouse only — no hotkeys needed):

1. **Default view (dir 0 body, dir 0 turret, zHeight OFF):** does the magenta **socket**
   marker sit on the Wasp hull's **visible turret ring**?
2. Does the green **pivot** marker sit on the Smoky turret's **rotation axis**?
3. Do socket and pivot **coincide** (markers overlap) with zHeight OFF?
4. **Step the turret** through all 16 directions (**Turret dir next ▶**): does the pivot
   marker stay on the turret's rotation axis in every frame?
5. **Step the hull body** through its 8 orientations (**Hull body dir next ▶**): does the
   socket marker stay on the hull turret ring?
6. **Toggle zHeight** (**zHeight diag** button): does applying zHeight **improve** seating,
   or does it **lift the turret off** the ring (double-count)? Capture both ON and OFF for
   the same direction.
7. **Close the harness** (**Close Harness** button or `9`): confirm the Arena falls back to
   the normal procedural view unchanged.
8. Confirm clicking the panel buttons **never** triggers gameplay/build/produce commands and
   there are **no** keyboard-hotkey conflicts.

Suggested capture set: dir 0/4/8/12 body × dir 0/4/8/12 turret, plus one zHeight ON/OFF pair.

---

## 8. What is still quarantined / must NOT be cleaned yet

**Still quarantined (unchanged by this PR):**
- `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION = false` in `BlockoutVehicleRenderer.ts`.
- The generated turret sprite lifecycle + positioning block inside `BlockoutVehicleRenderer`.
- Arena live vehicles continue to use the stable procedural turret fallback.

**Must NOT be cleaned until the screenshot proof is accepted** (do **not** delete in this PR;
listed here for the future cleanup step only):
- Wasp placement calibration apparatus (`WaspHullPlacementCalibrator`,
  `WaspPlacementCalibrationPanel`, `WaspHullDirectionCalibrator`, `getWaspDebugOffset*`).
- Manual `WASP_HULL_OFFSET_X/Y = {-1, 12}` + `getGeneratedHullPlacementOffset` and the
  mirrored `WASP_HULL_VISUAL_PROFILE.placementOffset`.
- `ModularTankRenderer` legacy path (flat `tileToScreen`, fixed turret origin, 8-dir keys).
- Per-bodyDir pixel tables (`MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR`,
  `MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR`).
- Old `modularUnitAssets.ts` legacy 8-dir keys (`wasp_m0_hull_*`, `smoky_m0_turret_*`).
- Duplicate scale/direction-remap sources (`MODULAR_RENDER_SCALE`/`MODULAR_ANCHOR_CORRECTION`;
  `WASP_HULL_VISUAL_DIR16_REMAP` vs `WASP_HULL_DIRECTION_REMAP_PROFILE` vs turret `facingOffset`).
- The legacy single-pivot `SMOKY_TURRET_VISUAL_PROFILE.pivot {0.5,0.5}` + `textureScale 0.24`.

These are load-bearing for the current procedural fallback and must only be retired **after**
the socket/pivot metadata is visually proven and a clean renderer is wired in.

---

## 9. Validation results

| Command | Result |
|---------|--------|
| `npm run typecheck` | **PASS** (clean) |
| `npm run test` | **PASS** — 4463/4463 (84 files); +17 new tests over the 4446 baseline |
| `npm run build` | **PASS** (`tsc && vite build`, built in ~41s) |
| `npm run qa:smoke` | **PASS** — 2/2 (standard + devtools/arena) after `npx playwright install chromium` in this container |

---

## 10. Forbidden areas — untouched

- Did **not** re-enable `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION`.
- Did **not** connect generated turret rendering into live Arena vehicles.
- Did **not** modify combat, movement, economy, mapgen, or save/load.
- Did **not** import new PNG/assets; did **not** edit `generatedAssetManifest.ts`.
- Did **not** add a broad preload (harness loads only the 16+16 pilot set on demand,
  reusing the existing per-set loaders with their duplicate-key guards).
- Did **not** add a combined hull×turret rendered matrix.
- Did **not** add manual x/y offsets or per-direction pixel tables.
- Did **not** tune zHeight by eye.
- Did **not** continue PR #263.
- Did **not** delete any legacy system.
- Did **not** add or commit Telegram config/tokens/chat IDs/secrets.

---

## 11. Next recommended step

After Denis captures and signs off the harness screenshots:

1. **If the socket marker misses the hull turret ring** → the **metadata** is the issue.
   Recover the true projected Wasp socket value (and confirm/replace `{0.5,0.5}`); the
   composition math and renderer are not the problem.
2. **If the pivot marker misses the turret rotation axis** → validate the Smoky directional
   pivots against the exported PNG crop.
3. **If both markers land correctly with zHeight OFF** → the diagnosis "ignore zHeight for
   baked sprites" is confirmed; proceed to build a clean preview-only `GeneratedVehicleRenderer`
   around this proven composition, then wire it into Arena behind a single internal gate
   (separate task), keeping `BlockoutVehicleRenderer` procedural as fallback.

No Arena enablement, metadata edits, or legacy removal should happen until the screenshot
proof is accepted.
