# RUNTIME-03B: Failed Pilot Turret Composition Quarantine Report

**Date:** 2026-06-14
**Task:** RUNTIME-03B — Quarantine failed pilot turret renderer integration
**Risk:** Medium
**Executor:** GLM

---

## Manual QA Failure Summary

After merging RUNTIME-03 and RUNTIME-03A (PRs #274 and #275), manual Arena QA confirmed that the generated Smoky turret sprite does **not** visually sit on the Wasp hull. The turret appears offset/down/front relative to the expected hull-top position. Despite three incremental PRs that progressively refined the composition math (pivot-on-socket, visual direction remap, hull sprite anchoring, zHeight projection), the resulting screen position remains visually incorrect.

### Evidence (described, not committed)

- **Observation 1:** Smoky turret on Wasp hull appears displaced downward and forward from the hull top. The turret center is not aligned with the visual turret mount point on the hull sprite.
- **Observation 2:** The displacement is consistent across all 16 directions — it is not a per-direction misalignment but a systematic offset.
- **Observation 3:** The procedural turret fallback (colored box + barrel) renders correctly at the mount point, confirming that the mount point computation itself is sound.

### Merged PR Chain

| PR | Title | Status |
|----|-------|--------|
| #271 | RUNTIME-01: modular turret resolver | Merged |
| #272 | RUNTIME-02: Smoky turret assets and lazy-load | Merged |
| #273 | RUNTIME-03: pilot turret composition integration | Merged (credential leak fixed) |
| #274 | RUNTIME-03 fixup v3: visual direction remap + GENERATED_TURRET_SCALE | Merged |
| #275 | RUNTIME-03A: fix pilot turret attachment height and hull anchoring | Merged |

All five PRs are merged to main. The turret composition code is live but produces incorrect visual results.

---

## What Is Now Disabled

The `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION` constant in `BlockoutVehicleRenderer.ts` is set to `false`. This gates the entire generated turret sprite lifecycle:

1. **No generated turret sprites are created or updated.** When the flag is false, even if `resolvePilotTurretComposition()` returns `hasGeneratedTurret=true` and a valid `turretKey`, the renderer will not create a `Phaser.GameObjects.Image` for the turret.

2. **Any existing turret sprite is destroyed.** The `else` branch of the gated conditional destroys any turret sprite that may have been created in a previous frame (e.g., if the flag were toggled at runtime), removes it from `vehicleTurretSprites`, and sets `vehicleHasGeneratedTurret` to `false`.

3. **Procedural turret renders normally.** Since `vehicleHasGeneratedTurret` is `false`, the `hasGenTurret` check in `renderVehicle()` evaluates to `false`, and the procedural turret box + barrel is drawn using the existing isometric projection pipeline.

4. **Composition resolver still runs.** `resolvePilotTurretComposition()` is still called every frame. The result is stored in `vehicleTurretComp` for audit/diagnostic purposes. The pure function has no side effects — it does not load assets, create sprites, or modify state. The `textureExists` callback is the only external dependency.

---

## What Remains Preserved for Audit

All RUNTIME-01/02/03/03A files remain in the codebase untouched:

| File | Purpose |
|------|---------|
| `src/assets/pilotTurretComposition.ts` | Pure composition resolver — visual direction remap, pivot-on-socket math, socket zHeight |
| `src/assets/generatedTurretAssets.ts` | Turret texture key generation, `GENERATED_TURRET_SCALE`, `turretAngleToDir16()` |
| `src/assets/generatedHullAssets.ts` | Hull texture key generation, direction mapping, placement offsets |
| `src/assets/generatedVehicleMetadata.ts` | `HULL_IMAGE_SIZE`, `TURRET_IMAGE_SIZE` constants |
| `src/config/hullTurretVisualProfiles.ts` | Hull visual profiles with socket metadata (nx, ny, zHeight) |
| `src/config/directionalTurretProfiles.ts` | Directional pivot resolver per weapon/mod/visualDir16 |
| `src/config/turretAttachmentMath.ts` | `computeTurretSpriteCenterOffsetForSocket()` pure function |
| `src/config/visualDirectionRemap.ts` | `remapVisualDirection()` helper |
| `src/__tests__/runtime03PilotTurretComposition.test.ts` | 38+ tests covering remap, pivot, scale, zHeight, fallbacks |
| `BlockoutVehicleRenderer.ts` | Full turret sprite lifecycle code (gated, not removed) |
| `docs/project/RUNTIME_03A_TURRET_ATTACHMENT_FIX_REPORT_2026_06_14.md` | RUNTIME-03A report |

The quarantine flag is the **only** change. No files were removed, no logic was deleted, no tests were modified.

---

## Why No Further GLM Position Tuning Should Be Attempted

Three PRs progressively refined the turret position math:

1. **RUNTIME-03** introduced pivot-on-socket composition: offset = socketFromSpritePos - pivotFromCenter. This is geometrically correct for placing a sprite's pivot point at the hull socket.

2. **RUNTIME-03 fixup v3** added visual direction remap (`visualDir16 = logicalDir16 + dir16Offset`) and replaced the legacy `turretProfile.textureScale` (0.24) with `GENERATED_TURRET_SCALE` (0.12). Both changes were verified by unit tests.

3. **RUNTIME-03A** moved turret positioning to after `hullSprite.setPosition()` so the actual hull sprite position is used as base, and applied `socket.zHeight` (0.30) through `projectWorldPoint` for screen-space elevation.

Each step was individually correct and verified by tests. Yet the visual result remains wrong. This indicates the problem is **not** in any individual math step but in the **integration layer** — the relationship between the 2D sprite coordinate space and the isometric projected coordinate space used by the renderer. Specifically:

- The hull sprite is positioned in screen space using a mix of world coordinates, projection offsets, placement offsets, and debug calibration offsets.
- The turret offset is computed in a normalized coordinate space (based on image size * scale) that may not correctly map to the same screen space.
- The `zHeight` projection delta is computed by round-tripping through `unprojectScreenToGround` then `projectWorldPoint`, which may introduce error at the hull sprite's specific position.

These are **coordinate space integration problems** that require a holistic review of how the sprite rendering pipeline maps to the isometric projection pipeline. Incremental patches to individual offset computations will not resolve this class of bug.

**Forbidden next actions:**
- No magic offsets (hardcoded pixel deltas)
- No more zHeight guessing (tweaking values without understanding the projection)
- No manual tuning inside `BlockoutVehicleRenderer`
- No per-direction pixel tuning tables
- No adding hand-tuned constants to compensate for coordinate space mismatches

---

## Recommended Next Step: Opus Cleanup/Rebuild Audit

The turret composition pipeline needs a **comprehensive Opus-level audit** of the modular vehicle renderer. The audit should:

1. **Map the coordinate spaces end-to-end.** Document how each rendering layer (hull sprite, turret sprite, procedural graphics, projected geometry) maps between world coordinates, tile coordinates, screen coordinates, and sprite-local coordinates.

2. **Identify the exact transformation chain.** From `vehicle.worldX/worldY` through `projectWorldPoint()` / `unprojectScreenToGround()` to the final sprite `setPosition()` call. Identify where the turret offset (computed in sprite-local space) is composed with the hull position (computed in screen space via projection).

3. **Validate the zHeight projection approach.** The current approach computes `zHeightScreenDeltaY` by projecting at z=0 and z=socketZHeight and taking the Y difference. Verify this is correct for the isometric projection contract. Consider whether the hull sprite's screen position already includes an implicit Z offset that must be accounted for.

4. **Consider a unified sprite rendering approach.** Instead of computing turret offset separately and adding it to the hull sprite position, consider whether both hull and turret should be positioned from the same world-space anchor point, with the turret offset applied in world space before projection.

5. **Re-enable `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION`** only after the above audit produces a verified, tested coordinate space integration.

---

## Validation

| Check | Status |
|-------|--------|
| `npm run typecheck` | Pending |
| `npm run test` | Pending |
| `npm run build` | Pending |
| `npm run qa:smoke` | Pending |

---

## Change Summary

**Changed files:** 2
1. `src/phaser/render/BlockoutVehicleRenderer.ts` — Added `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION = false` constant; gated turret sprite creation behind the flag; turret sprite destruction in else-branch remains; composition resolver still runs for audit.
2. `docs/project/RUNTIME_03B_FAILED_COMPOSITION_QUARANTINE_REPORT_2026_06_14.md` — This report.

**What was disabled:** Generated turret sprite creation and display in `BlockoutVehicleRenderer`.

**What remains preserved:** All RUNTIME-01/02/03/03A source files, tests, and reports. Composition resolver still invoked (pure function, no side effects). Procedural turret fallback renders normally.
