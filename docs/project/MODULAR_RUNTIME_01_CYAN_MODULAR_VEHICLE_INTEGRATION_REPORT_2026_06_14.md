# MODULAR_RUNTIME_01_CYAN_MODULAR_VEHICLE_INTEGRATION_REPORT_2026_06_14

Date: 2026-06-14
Task: MODULAR-RUNTIME-01
Status: implemented, GPT review required before merge
Branch: `claude/brave-euler-k3ipc4`

---

## Summary

This change adds the clean modular cyan vehicle runtime: a metadata-driven path
that composes a hybrid modular vehicle from **independent** hull and turret
sprites. It supersedes the failed pilot generated-turret composition path
(PR #274/#275) and does not re-enable `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION`.

The runtime model is `ModularVehicleVisual` with independent `hullId`, `turretId`,
`faction`, `hullMod`, `turretMod`. Upgrading `hullMod` changes only the hull
sprite; upgrading `turretMod` changes only the turret sprite; hull and turret
identity are independent. Wasp + Smoky cyan m0 is the default demo selection,
not hardcoded architecture.

---

## Source assets used from repo

Used directly from the merged ASSET-IMPORT-01 (PR #278) payload — no local
staging, no new attachments:

- hull PNGs: `public/assets/units/hulls/<hull>/<faction>/<mod>/<hull>_<faction>_<mod>_dirNN_<DIR>.png`
- turret PNGs: `public/assets/units/turrets/<turret>/<faction>/<mod>/<turret>_<faction>_<mod>_dirNN_<DIR>.png`
- root manifest: `public/assets/units/modular_vehicle_asset_manifest_cyan_v1.json`
- generated registry: `src/assets/generatedModularVehicleAssets.generated.ts`

Metadata manifests in `public/assets/units/metadata/`:

- `hull_socket_manifest_modular_cyan_v1.json`
- `turret_pivot_manifest_modular_cyan_v1.json`
- (`runtime02a_smoky_cyan_m0_pivot_subset.json`, `modular_vehicle_asset_manifest_cyan_v1.json` also present)

## Asset counts used / reused

- 7 hulls × 1 faction (cyan) × 4 mods × 16 dirs = 448 modular hull frames addressable.
- 10 turrets × 1 faction × 4 mods × 16 dirs = 640 modular turret frames addressable.
- 28 hull socket families + 40 turret pivot families in metadata (all 16-dir).
- No PNG was renamed; the new package uses the `<id>_<faction>_<mod>_dirNN_<DIR>.png`
  convention, distinct from the legacy `_hull_` hull set, so both coexist safely.

## Manifest / metadata files used

The two export manifests are the **single source** for socket/pivot placement.
A build-time generator (`tools/generate_modular_vehicle_metadata.mjs`) transforms
them into committed, zero-fetch TypeScript constants
(`src/assets/generatedModularVehicleMetadata.generated.ts`). Runtime never reads
JSON. The render strategy is `fixed_512_frame` with the socket pixel policy
`world_origin_projects_to_frame_center`: every hull socket and every turret pivot
projects to the exact centre (256,256 = 0.5,0.5) of the 512×512 frame, for every
hull, turret, mod and direction. The generator asserts this invariant.

---

## Runtime model summary

`src/modular/modularVehicleVisual.ts`:

```ts
type ModularVehicleVisual = {
  hullId: GeneratedModularHullId;
  turretId: GeneratedModularTurretId;
  faction: "cyan";
  hullMod: "m0" | "m1" | "m2" | "m3";
  turretMod: "m0" | "m1" | "m2" | "m3";
};
```

- `withHullMod` / `withTurretMod` mutate exactly one dimension.
- `isCombinedPairId` guards against the rejected `"wasp_smoky_cyan_m0"` encoding.
- No combined hull×turret pair id is ever used to address a texture.

## Lazy-load behavior and max PNG count per selected vehicle

`src/modular/modularVehicleRuntimeLoader.ts`:

- `requestModularVehicleSet(scene, visual)` queues exactly the selected set:
  16 hull frames + 16 turret frames = **32 PNG maximum** per selected visual.
- Already-present textures are skipped (duplicate-key safe).
- A module-level ledger records requested set ids to avoid re-queue churn.
- Full-matrix preload (1088 PNG), full-turret preload (640), full-hull preload
  (2240), and hull×turret combination preload are all impossible by construction:
  the loader only ever iterates the 16 directions of the single selected hull and
  the single selected turret.
- Rich diagnostics returned: requested fields, set id, validity, queued keys,
  queued count, already-available keys, full-set flag, fallback reason.

## Renderer owner decision

A **new, clean renderer** `src/phaser/render/GeneratedModularVehicleRenderer.ts`
owns modular composition. It is an isolated devtools overlay (fixed-screen,
`scrollFactor 0`).

- It does **not** copy procedural turret math from `BlockoutVehicleRenderer`.
- It does **not** extend the pilot path (`pilotTurretComposition`,
  `generatedVehiclePreviewComposition`, `pilotVehicleLazyLoad`) or
  `ModularTankRenderer`.
- It does **not** become a hidden production owner; live Arena combat rendering
  is unchanged. This keeps the change additive and reversible, and avoids the
  double-hull-placement hazard the audit flagged (B1) until the cohesive
  px-stack retirement step is scheduled.

Composition is pure and engine-agnostic
(`src/modular/modularVehicleComposition.ts`):

```
socketOffsetPx = (socketNorm - 0.5) * hullDisplaySize
pivotOffsetPx  = (pivotNorm  - 0.5) * turretDisplaySize
turretCenter   = hullCenter + socketOffsetPx - pivotOffsetPx   // pivot lands on socket
```

Under the frame-centre policy the offset is zero, but the formula generalises to
any future per-direction socket/pivot without renderer changes.

## Legacy pixel-offset stack: superseded vs left untouched

- **Superseded for the new path:** the clean renderer uses zero per-direction
  pixel tables, zero zHeight hacks, zero Wasp-only constants. Placement comes
  entirely from export metadata.
- **Intentionally left untouched (this PR):** the legacy
  `MODULAR_TANK_*` / `MODULAR_SCALE_RATIO` / `MODULAR_ANCHOR_CORRECTION` /
  `WASP_HULL_OFFSET_*` stack and `ModularTankRenderer` remain in place. The audit
  (§6, §15 RUNTIME-03) scopes their removal as a single cohesive, high-regression
  Opus step that rewires the live renderers. Deleting them here — before the new
  path is the live owner — would risk a half-migrated double-composition state.
  This PR delivers the clean path additively; the px-stack retirement is the
  documented next step.

## Fallback behavior

`composeModularVehicle` always returns a complete plan and never throws:

| Condition | Behavior |
|---|---|
| Invalid visual | `fallbackReason: 'invalid-visual'`, both sprites null, blockout boxes |
| Hull + turret texture missing | `'hull-and-turret-texture-missing'`, blockout boxes |
| Hull texture missing | `'hull-texture-missing'` |
| Turret texture missing | `'turret-texture-missing'` |
| Hull/turret metadata missing | centre default `{0.5,0.5}` + `'*-metadata-missing'` flag |

The renderer draws labelled blockout boxes for any missing sprite and surfaces
the reason in its on-screen readout and the devtools panel. The loader returns a
`fallbackReason` for invalid visuals (queues 0 PNG). Standard (non-devtools) play
is entirely unaffected — the renderer is only constructed when devtools is active.

## Devtools / Arena QA instructions

Open the app in Arena/devtools mode (the existing `?devtools=1&arena=1&skipMenu=1`
surface — **no new flags added**). A docked **"Modular Vehicle"** panel appears
(top-right, next to the Proof Harness panel):

1. Click **Open Preview** to show the isolated composition overlay.
2. **◀ hull / hull ▶** cycles `hullId` independently.
3. **◀ turret / turret ▶** cycles `turretId` independently.
4. **hullMod+ / turretMod+** step the two mods independently.
5. **body / turret** direction steppers rotate hull and turret independently (dir16).
6. **markers** toggles the magenta socket / green pivot markers (they coincide).
7. **Reset** returns to the wasp+smoky cyan m0 default.

The readout shows hull/turret/mods/faction, dirs, set-loaded state, queued PNG
count, and availability/fallback reason. This is a QA/demo selector — there are
no pixel-offset controls and no manual calibration loop.

## Validation results

- `npm run typecheck`: **PASS** (exit 0)
- `npm run test`: **PASS** — 85 files, 4499 tests, exit 0 (no Vitest worker-fork
  error on this run)
- `npm run build`: **PASS** (`tsc && vite build`, exit 0)
- `npm run qa:smoke`: **PASS** — standard + devtools, 2/2 runs, exit 0
  (Playwright chromium had to be installed in the fresh container first)

New tests: `src/__tests__/modularRuntime01.test.ts` (35 tests) cover registry id
coverage, key/path builders, hull/turret mod independence, combined-pair
rejection, 32-PNG cap, no-full-preload, skip-loaded, fallback diagnostics,
metadata-driven pivot-on-socket alignment across directions, no zHeight/manual
offset in default composition, and devtools default validity.

## Known limitations

- Live Arena combat vehicles still render via `BlockoutVehicleRenderer`
  (procedural turret). The clean modular renderer is a devtools QA overlay; wiring
  it as the live owner and retiring the legacy px-offset stack is the cohesive
  next step (audit RUNTIME-03).
- Faction is cyan-only (V1), matching the imported package.
- Muzzle metadata (`muzzleNorm`) exists in the turret manifest but is not yet
  consumed (future VFX/aim-line use).
- `MODULAR_VEHICLE_DISPLAY_SCALE` is a preview display constant; final in-world
  scale is decided when the renderer becomes the live owner.

## Next recommended step

RUNTIME-03 (Opus, cohesive): make `GeneratedModularVehicleRenderer` the live
modular owner in Arena, reuse `BlockoutVehicleRenderer`'s ring/HP/target/depth
machinery, and remove/supersede the legacy `MODULAR_TANK_*` /
`MODULAR_SCALE_RATIO` / `MODULAR_ANCHOR_CORRECTION` / `WASP_HULL_OFFSET_*` stack
in one reference-checked change — with no combat/movement/economy/mapgen/save-load
changes.
