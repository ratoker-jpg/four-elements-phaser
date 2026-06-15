# MODULAR-RUNTIME-03 — Full Game Integration Audit / Design

Date: 2026-06-15
Mode: AUDIT / DESIGN ONLY (no code, asset, metadata, or runtime changes)
Branch: `claude/modest-planck-vr6xek`
Base verified: `main` @ `7282df3` (PR #289 merged)
Author role: lead architect / orchestrator (worker-delegated investigation, self-verified conclusions)

---

## 1. Executive summary

The clean modular vehicle runtime (`src/modular/*`, `modular_hull_*` keys, metadata-driven
socket/pivot composition, 32-PNG lazy loader, Dictator 1.09 hull-only scale) is **fully built and
tested, but is wired into exactly one surface**: the devtools-only Modular Preview / Calibration
overlay (`GeneratedModularVehicleRenderer` + `ModularVehicleDevtoolsPanel`, created in
`GameScene` only when `devtoolsActive`).

The two **live** rendering surfaces do **not** use the clean modular runtime:

- **Arena devtools / demo** renders `blockoutVehicles` through `BlockoutVehicleRenderer`, which uses
  the **legacy** `generated_hull_*` path (Wasp-only, devtools-gated forced-direction) for the hull and
  a **procedural** turret (`ENABLE_PILOT_GENERATED_TURRET_COMPOSITION = false`).
- **Normal arena / game runtime** renders `modular-combat` entities through
  `EntityRenderer → ModularTankRenderer`, a **legacy Wasp/Smoky pilot** using `generated_hull_*` keys
  and per-`bodyDir` offset tables (`MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR`).

So "full modular integration" = **route the live surfaces through the already-clean composition
pipeline** (`composeModularVehicle` + `requestModularVehicleSet` + `modular_hull_*`/`generated_turret_*`
keys + metadata socket/pivot), behind a guarded flag, with the existing blockout/procedural renderer
retained as fallback. Most gameplay→visual mapping primitives already exist
(`Faction` is 1:1 with the 4 visual factions; `bodyId` is 1:1 with the 7 hulls; a `weaponId→turretId`
table and `modLevelToModularMod` converter already exist).

**Recommended shape: 2 High+ implementation PRs + 1 optional cleanup PR** (03A live adapter + Arena
demo under flag; 03B normal-runtime + preview parity; 03C optional legacy cleanup after QA).

**No blockers found.** One key design correction: the three-slot mount hypothesis (front/center/rear)
should **not** become a new runtime offset table — a 5-value `MountCategory` + `mountOffsetNormalized`
already exists as production data, and the frame-centered metadata + baked sprite art already encodes
the mount visually. See §9.

---

## 2. Orchestration plan and worker outputs

Investigation was delegated to read-only workers; conclusions were self-verified by the lead.

| Worker | Scope | Status |
|---|---|---|
| A | Repo state + docs/constraints | ✅ delivered |
| B | Asset registry / metadata | ✅ delivered |
| C | Preview / calibration internals | ✅ delivered |
| D | Game-mode + renderer entry-point tracing | ✅ delivered (2 claims corrected by lead) |
| E | Mount-slot design | folded into lead synthesis (§9), informed by B/C + self-verification |
| F | Unit → visual mapping | ✅ delivered |
| G | Tests / QA inventory | ✅ delivered |
| H | Risk / rollback | folded into lead synthesis (§14) |

**Cross-check / contradictions resolved by lead:**

1. **"Modular Preview/Calibration mode" identity.** Worker D claimed the `?visual02a/03a/04a`
   preview scenes. Workers A/C and lead verification show those scenes contain **no** references to
   `GeneratedModularVehicleRenderer` / `modular_hull_` / `ModularVehicleDevtoolsPanel`
   (`grep -rln` returned nothing). The actual modular preview is the devtools overlay built in
   `GameScene.ts:593–601`. **Resolution: preview mode = the devtools overlay; the Visual0Xa scenes are
   unrelated legacy prototypes.**
2. **Third renderer.** Worker D's `ModularTankRenderer` was confirmed real
   (`src/phaser/render/ModularTankRenderer.ts`, used by `EntityRenderer.ts:198,343`) — it is the legacy
   Wasp/Smoky pilot for `modular-combat` entities in normal runtime. Incorporated into §6/§7/§13.

Commands used (representative):

```
git status / git log --oneline -15 / git log --oneline main..HEAD
grep "type Faction" src/state/types.ts                       → 'cyan'|'green'|'yellow'|'purple'
grep "mountCategory|mountOffsetNormalized" src/config/blockoutBodyData.ts
grep "new BlockoutVehicleRenderer|new GeneratedModularVehicleRenderer" src
grep "ModularTankRenderer|modular-combat|includeModularCombat" src
grep -rln "GeneratedModularVehicleRenderer|modular_hull_" src/phaser/Visual0*PreviewScene.ts  → (none)
```

---

## 3. Current merged state

`main` @ `7282df3` includes all referenced PRs (verified via local `git log`):

- #278 asset import base / modular cyan assets — merged.
- #279 MODULAR-RUNTIME-01 clean modular runtime + devtools renderer — merged.
- #280/#284 Wasp cyan m0 asset correction — merged.
- #281 legacy Wasp pilot hooks marked legacy + isolation tests — merged.
- #285 MODULAR-RUNTIME-02A `modular_hull_*` key namespace — merged (`c2d97f2`).
- #286 all-factions modular assets (asset-only) — merged (`fbc6e92`).
- #287 all-factions runtime/devtools + Dictator 1.09 — merged (`636284d`).
- #288 preview calibration controls + tile overlay — merged (`0c8cbda`).
- #289 ROADMAP-03 docs — merged (`7282df3`).

Working tree clean at start. The only untracked file after this audit is this report (see Validation).

---

## 4. Current modular asset / runtime state (Worker B, lead-verified)

Source of truth: `src/assets/generatedModularVehicleAssets.generated.ts`,
`src/assets/generatedModularVehicleMetadata.generated.ts`, `src/modular/*`.

- **Factions (4):** `GENERATED_MODULAR_FACTIONS = ["cyan","green","yellow","purple"]` (assets:14).
- **Hulls (7):** `dictator, hornet, hunter, mammoth, titan, viking, wasp` (assets:12).
- **Turrets (10):** `firebird, freeze, hammer, isida, railgun, ricochet, smoky, thunder, twins, vulcan_b` (assets:13).
- **Mods (4):** `m0, m1, m2, m3` (assets:15).
- **Dirs (16):** suffix map `E…ENE` (assets:23–26).
- **Total runtime PNG:** 1792 hull + 2560 turret = 4352, matching the package spec.
- **Lazy-load cap:** `MAX_MODULAR_VEHICLE_SET_PNG = 32` (loader:32); enforced in `requestModularVehicleSet`
  (loader:160–205) with a defensive truncation (loader:203–205); `MODULAR_FRAMES_PER_FAMILY = 16`.
- **Hull key:** `getGeneratedHullTextureKey` → `modular_hull_<hull>_<faction>_<mod>_dirNN` (assets:38–52).
- **Turret key:** `getGeneratedTurretTextureKey` → `generated_turret_<turret>_<faction>_<mod>_dirNN` (assets:54–61).
- **Dictator scale:** `HULL_VISUAL_SCALE_MULTIPLIERS = { dictator: 1.09 }`, helper
  `getHullVisualScaleMultiplier()` (composition:73–80); hull-only, applied around the hull socket/origin.
- **No `_hull_dir` in modular runtime:** confirmed (0 matches in loader/composition/assets).
- **Socket/pivot metadata:** `ModularVehicleFamilyMeta { id, mod, normalized{nx,ny}, imageSize, renderStrategy, perDir? }`.
  `MODULAR_HULL_SOCKET_META` (28 entries) and `MODULAR_TURRET_PIVOT_META` (40 entries); all currently
  `normalized {0.5,0.5}` (frame-centered); `perDir` present in the shape but unpopulated.
  Flags `MODULAR_HULL_SOCKET_ALL_FRAME_CENTERED = true`, `MODULAR_TURRET_PIVOT_ALL_FRAME_CENTERED = true`.
  Render strategy `fixed_512_frame` / `world_origin_projects_to_frame_center`.

---

## 5. Current preview / calibration state (Worker C, lead-verified)

`src/phaser/render/GeneratedModularVehicleRenderer.ts`, `src/phaser/dev/ModularVehicleDevtoolsPanel.ts`,
`src/modular/modularPreviewCalibration.ts`.

- **Draw:** two independent `scene.add.image()` sprites. Hull depth `OVERLAY_DEPTH+2` (21002), turret
  `OVERLAY_DEPTH+3` (21003). Texture keys from `composeModularVehicle()`.
- **Alignment:** turret pivot aligned to hull socket via normalized metadata
  (composition:219–235): socket screen pos = hull center + `(socketNorm-0.5)*hullDisplaySize`; turret
  center placed so its pivot lands on the socket. No magic offsets; no zHeight.
- **Tile overlay:** isometric diamond, `drawTileOverlay()` (renderer:383), toggled via
  `calibration.showTile`; devtools-only; fixed-screen (`scrollFactor 0`).
- **Calibration:** `ModularPreviewCalibration { showTile, modelScale, hullScale, turretScale,
  hullOffsetX/Y, turretOffsetX/Y, pixelStep, scaleStep }`. Stored as a private renderer field; set via
  `setCalibration()`; applied only in `drawSpritesWithCalibration()`.
- **Persistence:** **none** — no `localStorage`/`sessionStorage`/file writes (grep-verified). Composition
  (`composeModularVehicle`) does **not** take calibration as input → calibration cannot leak into resolved
  PNG paths or production metadata. Test `modularPreviewCalibration01c` asserts scale/offset do not change
  texture keys or asset paths.
- **Devtools-only vs reusable:** reusable = `composeModularVehicle` (engine-agnostic), key builders,
  `getHullVisualScaleMultiplier`, sprite setup, `ensureAssetsLoaded`. Devtools-only = tile overlay,
  socket/pivot debug markers, labels, calibration controls, fallback boxes, fixed-screen backdrop.
- **HP/selection/shadows:** **not** drawn by this renderer (it is a clean composition+preview surface).

---

## 6. Three game modes — code-level mapping

All three live inside `GameScene` (single scene). Gating: `devtoolsActive = urlDevtools || configDebug
|| configArena`; `arenaMode = (urlDevtools && urlArena) || configArena` (`GameScene.ts:254–260`).

| # | Mode | Entry / gate | Renderer | Unit data | Clean modular today? |
|---|---|---|---|---|---|
| 1 | **Modular Preview / Calibration** | `GameScene.ts:593–601` when `devtoolsActive`; `ModularVehicleDevtoolsPanel.show()` | `GeneratedModularVehicleRenderer` (fixed-screen overlay) | `ModularVehicleVisual` (devtools selection) | ✅ yes (only surface) |
| 2 | **Arena Devtools / demo** | `arenaMode` (`?devtools=1&arena=1` or `gameMode:'arena'`); renderer at `GameScene.ts:608` | `BlockoutVehicleRenderer` (+ damage/VFX/upgrade overlays) | `BlockoutVehicleState[]` via `devArena.arenaSpawnVehicle` | ❌ legacy `generated_hull_*` Wasp-only + procedural turret |
| 3 | **Normal Arena / game runtime** | default (no devtools); `EntityRenderer` | `EntityRenderer → ModularTankRenderer` for `kind:'modular-combat'`; civil units separately | `RenderableEntity` (`dir`, `turretDir`, `faction`) | ❌ legacy `ModularTankRenderer` Wasp/Smoky pilot |

Note: query-string flags (`devtools`, `arena`, `skipMenu`, `visualXX`) **already exist** in the codebase
and the smoke harness. The constraint is to add **no new** query-string flags — existing ones may be used.

---

## 7. Current renderer path per mode

**Mode 1 — Preview.** `composeModularVehicle(visual, dirs, anchor, textureExists)` → render plan →
two sprites drawn fixed-screen with calibration. Lazy-load via `requestModularVehicleSet` (≤32 PNG).
Clean, isolated, no HP/selection. **Integration point:** already integrated — only needs to share the
same live adapter once one exists (parity).

**Mode 2 — Arena demo (`BlockoutVehicleRenderer`, 1489 lines).** Per-frame `syncFromState(vehicles)`.
Hull: legacy `generated_hull_*` path, **Wasp-only**, forced-dir gated to devtools (renderer ~362–407),
else blockout box. Turret: procedural box+barrel (`ENABLE_PILOT_GENERATED_TURRET_COMPOSITION = false`).
HP bars, selection/hover/target rings, direction arrows, shadows, damage flash, weapon-resource bars,
debug labels are **all drawn inside this renderer** (projected onto the ground plane / via z-offset, per
`cameraProjectionContract`). Depth: isometric `sortByDepth` (`depthSorting.ts`). **Integration point:**
inside `renderVehicle()`, replace the hull/turret sprite branch with the clean modular composition;
leave HP/selection/shadows untouched.

**Mode 3 — Normal runtime (`EntityRenderer → ModularTankRenderer`).** `modular-combat` entities (stripped
from non-devtools saves at `GameScene.ts:268–278`) rendered as Wasp/Smoky m0 via `generated_hull_*` keys
+ per-`bodyDir` offset tables (`MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR`,
`MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR`) + `unitRenderConfig` scaling. Depth via `computeDepthValue()`.
No HP/selection overlays here. **Integration point:** `EntityRenderer` `case 'modular-combat'`
(line 343) / `ModularTankRenderer.placeAndUpdate()` — swap the legacy offset-table composition for the
clean composition, behind the flag, with the legacy renderer as fallback.

**Projection (all live modes):** `cameraProjectionContract.ts` — fixed isometric;
`screen = origin + worldX*basisX + worldY*basisY + worldZ*basisZ`; `basisX{38,19}`, `basisY{-38,19}`,
`basisZ{0,-60}`. Ground markers projected onto the ground plane (not screen-space circles).

---

## 8. Full modular integration target

Bring the **clean modular composition** to both live surfaces while keeping HP/selection/shadows and the
fallback renderers intact:

1. A small, calibration-free **live adapter** that takes a `ModularVehicleVisual` + body/turret dir +
   world anchor and produces two world-placed sprites (hull, turret) using `composeModularVehicle`,
   `modular_hull_*`/`generated_turret_*` keys, metadata socket/pivot, and `getHullVisualScaleMultiplier`.
   This is an extraction of the engine-agnostic composition already used by the preview renderer
   (minus calibration, tile, markers).
2. **Mode 2:** `BlockoutVehicleRenderer.renderVehicle()` calls the adapter for hull+turret when the flag is
   on and assets are ready; blockout box/procedural turret remains the fallback.
3. **Mode 3:** `EntityRenderer`/`ModularTankRenderer` calls the same adapter for `modular-combat` entities;
   legacy renderer remains the fallback.
4. **Mode 1:** confirm parity (preview already uses the composition); calibration stays devtools-only.

Target end-state: one composition pipeline, three surfaces, guarded by a single flag, legacy paths kept
as fallback until QA sign-off (cleanup deferred to 03C).

---

## 9. Mount-slot model analysis (audit question 5)

**Key finding:** a **5-value** mount model already exists as **production data**, not just the
3-value QA hypothesis.

`src/config/blockoutProfiles.ts`:
```
type MountCategory = 'front' | 'front_center' | 'center' | 'center_rear' | 'rear';
interface BodyProfile { ... mountCategory; mountOffsetNormalized: {x,y}; ... }
```
`src/config/blockoutBodyData.ts` (actual data):

| Hull | mountCategory | mountOffsetNormalized.x | QA hypothesis |
|---|---|---|---|
| mammoth | front_center | 0.75 | front |
| titan | front_center | 0.75 | front |
| hunter | center | 0.50 | center |
| viking | center | 0.50 | center |
| hornet | center_rear | 0.35 | center |
| wasp | rear | 0.20 | rear |
| dictator | rear | 0.20 | rear |

The QA front/center/rear hypothesis is a **coarsening** of the existing 5-value model and matches it
(modulo hornet, which the data places at `center_rear`/0.35).

**Critical architectural point:** the clean modular composition is `fixed_512_frame` with
`world_origin_projects_to_frame_center`. Both hull and turret sprites are rendered from the same camera
about the same world origin, so **the mount position is already baked into the sprite art**: overlaying
the two frame-centered sprites at one screen anchor reproduces the correct turret-on-hull placement
without any offset. The current frame-centered socket/pivot metadata is therefore **correct by
construction** for visual placement.

**Decision (choose ONE): Option B — metadata generation — as the channel, with "no offset" as the
Stage-03 position.** Justification:

- For Stage 03, add **no mount offset at all**: rely on frame-centered metadata + baked art (this is what
  the preview already does and what tests validate).
- If visual QA later proves a specific hull's turret sits wrong, the fix is to populate the
  socket/pivot `normalized`/`perDir` fields in the **generated metadata** (regenerated from the export
  pipeline), keeping the metadata as the single source of truth.
- **Reject Option A (runtime config offset table)** and **Option C (renderer-only visual offset)**: both
  reintroduce the per-hull/per-dir offset tables the project explicitly retired (legacy `ModularTankRenderer`
  / Wasp pilot) and risk drift from the art.
- Keep `MountCategory` / `mountOffsetNormalized` as the **gameplay/blockout-box semantic field and QA
  validation grouping** (used by the procedural blockout box and as a documented category), **not** as a
  modular-PNG render offset. Do **not** introduce a competing 3-value enum; if a 3-bucket grouping is ever
  needed, derive it from the existing `mountCategory`.

Testing turret-alignment stability: assert pivot lands on socket across all dirs/mods/factions (already in
`modularRuntime01`), plus a per-hull frame-center invariant test; visual QA spot-check per `mountCategory`
bucket. Future hulls: author art in the same `fixed_512_frame` convention → no code change needed; only
assign a `mountCategory` for the blockout/gameplay layer.

---

## 10. Unit visual mapping design (audit question 7)

Mapping primitives largely already exist (Worker F, lead-verified):

| Gameplay | Field / source | Visual | Mapping |
|---|---|---|---|
| body | `bodyId` (`BlockoutVehicleState`/`BodyProfile`) | `hullId` | 1:1 (7 hulls identical names); `bodyIdToGeneratedHullId` exists |
| weapon | `weaponId` (11 values incl. `shaft`) | `turretId` (10) | table in `generatedTurretAssets.ts` (`flamethrower→firebird`, `vulcan→vulcan_b`, `shaft→none`) |
| faction | `Faction` = `cyan/green/yellow/purple` | faction | **direct 1:1** |
| team | `ArenaTeam` ally/enemy | — | not a visual faction; arena spawns map team→faction (ally cyan / enemy green) |
| mod | `modificationLevel` 0–3 | `hullMod`/`turretMod` | `modLevelToModularMod` (clamp 0–3 → m0–m3); applied to both, independent dimensions |
| dir | `bodyAngle`/`turretAngle` (radians) | dir16 | `bodyAngleToDir8`→`mapRuntimeDir8ToGeneratedDir16` (hull, even indices); `turretAngleToDir16` (turret, full 16) |

**Visual descriptor:** reuse the existing `ModularVehicleVisual { hullId, turretId, faction, hullMod,
turretMod }` (`src/modular/modularVehicleVisual.ts`). Add two **pure** mappers (new functions, no field
changes to gameplay state):
- `blockoutVehicleToModularVisual(vehicle): ModularVehicleVisual | null`
- `modularCombatEntityToModularVisual(entity): ModularVehicleVisual | null`

**Defaults / fallback:** weapon with no turret (`shaft`) or any missing hull/turret asset → return a
`null`/`fallbackReason` so the caller uses the existing blockout/procedural renderer for that unit;
default mod = `m0`; default faction from the unit; frame-center metadata fallback already exists in
`composeModularVehicle`. **No gameplay stat/field changes** — mappers are read-only projections.

Tests: mapping correctness for all 7 hulls / 10 turrets / 4 factions / 4 mods; `shaft`→fallback;
dir conversion parity; missing-asset → fallback path.

---

## 11. Lazy-loading and texture-cache design (audit question 8)

- **Per-unit-visual set ≤ 32 PNG** stays the invariant (`requestModularVehicleSet`, 16 hull + 16 turret).
- **Live policy:** on spawn/visual-change, compute the **distinct** `(hull,faction,hullMod)` and
  `(turret,faction,turretMod)` families across active units and request only those sets. N identical units
  share one 32-set (dedupe by family key). Never iterate all factions/hulls/turrets.
- **No all-factions preload**: do not extend `PreloadScene`/legacy hull preload; request on demand.
- **Eviction:** none for Stage 03 (arena/runtime active-unit counts are small). If memory becomes a
  concern, add reference-counted eviction in a later stage — out of scope now.
- **Cache keys:** `modular_hull_*` / `generated_turret_*` remain disjoint from legacy `generated_hull_*`
  (namespace already protected; isolation tests in place) — no collision risk when both systems coexist
  during the guarded rollout.

---

## 12. Dictator scale interaction (audit question 6)

- `getHullVisualScaleMultiplier('dictator') = 1.09`, all others `1` (composition:73–80). Applied to the
  **hull sprite scale only**, around the hull socket/origin, so the turret pivot still lands on the socket.
- **Mount slots do not interact**: mount placement comes from frame-centered metadata + baked art;
  the 1.09 factor scales the hull sprite about its origin and does not move the socket in normalized space.
- **Must remain visual-only**: the live adapter multiplies only the hull display scale; it must **never**
  touch hitbox/collision/footprint/movement. Add a regression assert that turret pivot == hull socket at
  scale 1.09 (already covered for the composition; extend to the live adapter).

---

## 13. Legacy / proof harness interaction (audit question 10)

Legacy/pilot constructs to **leave untouched** during 03A/03B and consider for 03C cleanup only:

- **Proof Harness** (`GeneratedVehicleProofPanel`/`GeneratedVehicleProofHarness`) — do not remove.
- **Legacy Wasp/Smoky pilot:** `ModularTankRenderer` (Wasp/Smoky only), `WASP_HULL_*` offsets,
  `WASP_HULL_VISUAL_DIR16_REMAP`, `WaspHullDirectionCalibrator`, `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION`
  (kept `false`), per-`bodyDir` offset tables.
- **Legacy generated hull assets:** `src/assets/generatedHullAssets.ts` (`generated_hull_*` keys,
  `_hull_dir` paths) — used by the current live paths; keep until the modular path is QA-green.
- **`Visual02a/03a/04a` preview scenes** — unrelated legacy prototypes; out of scope.
- **`legacyWaspIsolation` test** enforces that `src/modular/*` never imports any of the above — the new
  live adapter must live in `src/modular/*` or honor the same isolation, or the test will (correctly) fail.

---

## 14. Risks and rollback

| Risk | Likelihood | Mitigation |
|---|---|---|
| Texture-cache collision (modular vs legacy) | Low | `modular_hull_*` namespace already isolated; isolation tests; both systems coexist during rollout |
| Preload explosion / all-4352 load | Med if mis-wired | Distinct-family lazy load; reuse `requestModularVehicleSet` 32-cap; explicit "no preload extension" test |
| Memory growth from many sets | Low (Stage 03) | Small active-unit counts; eviction deferred; monitor in QA |
| Depth / z-order regressions | Med | Reuse existing `sortByDepth`/`computeDepthValue`; draw hull/turret at the same depth slot the box uses |
| HP bars / selection / shadows misalign | Med | Keep them in `BlockoutVehicleRenderer`, unchanged; only swap the hull/turret sprite branch |
| Camera projection mismatch | Low | Adapter uses `projectWorldPoint`/contract basis; no screen-space hacks |
| Calibration leaking to production | Low | Calibration not consumed by composition; adapter ignores calibration; persistence already absent |
| Legacy Wasp/proof leakage into modular | Low | `legacyWaspIsolation` test; new code in `src/modular/*` |
| Generated TS overwritten by packager | Med | Treat `*.generated.ts` as generated; never hand-edit; document regeneration step |
| Missing metadata/asset at runtime | Med | `composeModularVehicle` never throws; `fallbackReason`; fall back to blockout/procedural per unit |
| Gameplay/collision drift | Low | Mappers are read-only; Dictator scale visual-only; explicit "no stat change" tests |

**Rollback strategy:** single module-level flag `ENABLE_MODULAR_VEHICLE_RENDER` (default **off** in
production; **on** under `devtoolsActive`/arena for QA) — mirrors the existing
`ENABLE_PILOT_GENERATED_TURRET_COMPOSITION` pattern. **No new query-string flag.** Per-unit fallback to
the existing renderer whenever the visual is unmappable or assets are missing. Small acceptance gates per
stage (below). Reverting the flag to `false` fully restores current behavior.

---

## 15. Proposed High / High+ implementation stages

### Stage 03A — High+
**Purpose:** Introduce the clean live composition adapter + read-only unit→visual mappers + per-unit lazy
loading, and render a controlled Arena **demo** modular unit through `BlockoutVehicleRenderer` behind a
guarded flag (Mode 2), with blockout fallback intact.
**What changes:** add `ENABLE_MODULAR_VEHICLE_RENDER` (default off; on under devtools/arena); add
`blockoutVehicleToModularVisual()` + the live adapter (calibration-free world placement reusing
`composeModularVehicle`); in `renderVehicle()` swap the hull/turret sprite branch to the adapter when
flag+assets ready; wire distinct-family lazy loading on spawn.
**What not touched:** HP/selection/shadows/depth in `BlockoutVehicleRenderer`; normal runtime
(`ModularTankRenderer`); preview renderer; gameplay stats; collision/footprint; metadata; assets; legacy paths.
**Tests:** mapper unit tests (all hulls/turrets/factions/mods, `shaft`→fallback); adapter pivot==socket at
scale incl. Dictator 1.09; lazy-load ≤32 + distinct-family dedupe; namespace disjoint; flag-off = current behavior.
**Manual QA:** `?devtools=1&arena=1&skipMenu=1`, spawn one modular ally + one enemy, cycle hull/weapon/faction/mod,
verify alignment, selection ring, HP bar, depth, Dictator size; toggle flag off → blockout returns.
**Risks:** depth/z-order, lazy-load wiring (see §14).
**Acceptance:** flag-off identical to today; flag-on arena demo renders correct modular hull+turret with
stable alignment and intact HP/selection/shadows; ≤32 PNG/visual; no new query-string flag; typecheck/test/smoke green.

### Stage 03B — High+
**Purpose:** Route **normal arena / game runtime** (`modular-combat` entities) through the same adapter
(Mode 3), retiring reliance on legacy per-`bodyDir` offset tables for rendering, with legacy renderer as
fallback; confirm Preview (Mode 1) parity using the same composition.
**What changes:** `EntityRenderer` `case 'modular-combat'` / `ModularTankRenderer.placeAndUpdate()` use the
adapter behind the flag; `modularCombatEntityToModularVisual()` mapper; runtime distinct-family lazy load;
confirm Dictator 1.09 + calibration-isolation across all three surfaces.
**What not touched:** civil unit rendering; economy/movement/combat/pathfinding/save-load; collision;
legacy code remains as fallback (not deleted); calibration stays devtools-only.
**Tests:** entity mapper tests; renderer-path-selection test (flag/asset/fallback matrix); cross-mode parity
(same visual → same composition plan in preview/arena/runtime); no-stat-change assertions; Dictator across modes.
**Manual QA:** normal game with a modular-combat unit (devtools save) — verify modular rendering, fallback
when asset/visual missing, depth vs civil units, projection correctness; preview parity spot-check.
**Risks:** depth interplay with civil entities; save-strip behavior; fallback correctness (see §14).
**Acceptance:** all three modes render via one pipeline under the flag; fallback proven; no gameplay change;
preview parity; typecheck/test/smoke green.

### Stage 03C — optional High (post-QA cleanup)
**Purpose:** After 03A/03B are QA-green, retire superseded legacy paths.
**What changes (candidates):** remove `ModularTankRenderer` Wasp/Smoky pilot + per-dir offset tables;
remove `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION` dead branch; retire `generated_hull_*` legacy hull path
and `WaspHullDirectionCalibrator`/placement calibrators if unused; possibly promote the flag default to on.
**What not touched:** Proof Harness (unless separately approved); anything still referenced; gameplay systems.
**Tests:** update/retire legacy tests; ensure isolation + namespace tests still pass.
**Manual QA:** full regression across all three modes with the flag on.
**Risks:** removing a still-referenced path; do per-file reference checks before deletion.
**Acceptance:** no behavior change vs 03B; reduced surface; green suite. **Do this only if QA proves 03A/03B stable.**

---

## 16. Files likely touched per stage

**03A:** `src/modular/` (new mapper + live adapter, e.g. `modularVehicleLiveAdapter.ts`,
`blockoutVehicleToModularVisual.ts`); a flag constant (new `src/config/` or `src/modular/` module);
`src/phaser/render/BlockoutVehicleRenderer.ts` (hull/turret branch only); `GameScene`
spawn/lazy-load wiring; new tests under `src/__tests__/`.

**03B:** `src/modular/` (entity mapper); `src/phaser/render/EntityRenderer.ts`
(`case 'modular-combat'`); `src/phaser/render/ModularTankRenderer.ts` (delegate to adapter behind flag);
new tests under `src/__tests__/`.

**03C (optional):** removals in `ModularTankRenderer.ts`, `BlockoutVehicleRenderer.ts` (legacy branch),
`generatedHullAssets.ts` (if unused), calibrator/debug files; corresponding test cleanup.

---

## 17. Files explicitly NOT to touch

- `*.generated.ts` (`generatedModularVehicleAssets.generated.ts`, `generatedModularVehicleMetadata.generated.ts`)
  — generated; never hand-edit.
- `public/assets/**` and `modular_vehicle_asset_manifest_all_factions_v1.json` — no asset/metadata edits.
- `modularPreviewCalibration.ts` semantics (devtools-only; no persistence) — do not productionize calibration.
- Combat / movement / economy / mapgen / pathfinding / save-load / collision-hitbox-footprint modules.
- Proof Harness; `legacyWaspIsolation`/namespace tests (must continue to pass).
- `PreloadScene` / legacy hull preload (no all-factions preload).
- Camera projection contract (`cameraProjectionContract.ts`) — no projection changes.

---

## 18. Test plan

- **Mappers:** all 7 hulls / 10 turrets / 4 factions / 4 mods; `shaft`→fallback; dir conversion parity.
- **Adapter:** pivot==socket across dirs/mods/factions; Dictator 1.09 hull-only + alignment stable;
  composition plan parity with preview for identical visual.
- **Renderer-path selection:** flag on/off × asset present/missing × visual mappable/unmappable → correct
  renderer chosen; never throws.
- **Lazy loading:** ≤32 PNG/visual; distinct-family dedupe; no preload extension (assert legacy preload
  count unchanged).
- **Namespace:** `modular_hull_*` vs `generated_hull_*` disjoint (existing); `legacyWaspIsolation` green.
- **No gameplay change:** stats/hp/collision/footprint unchanged with flag on (state-level assertions).
- **Suite gates:** `npm run typecheck`, `npm run test` (vitest), `npm run qa:smoke` (Playwright dual-mode).

## 19. Manual QA plan

1. **Arena demo (03A):** `?devtools=1&arena=1&skipMenu=1` → spawn modular ally+enemy via ArenaMenu; cycle
   hull/weapon/faction/mod; verify turret-on-hull alignment, selection ring, HP bar, shadow, depth order,
   Dictator visual size; flag off → blockout fallback returns.
2. **Normal runtime (03B):** load a devtools save with a `modular-combat` unit; verify modular rendering,
   projection, depth vs civil units; force a missing asset → blockout/procedural fallback + diagnostic log.
3. **Preview parity (03B):** open Modular Preview overlay; confirm identical composition/alignment;
   calibration remains devtools-only and never alters live units.
4. Confirm no economy/movement/combat behavioral change in any mode.

## 20. Open questions

1. **Flag default & toggle UX:** confirm `ENABLE_MODULAR_VEHICLE_RENDER` default off in production / on under
   devtools is acceptable, and whether a devtools-panel toggle (not query-string) is wanted for QA.
2. **Normal-runtime unit source:** outside devtools, are `modular-combat` units expected in real gameplay
   yet, or is Mode 3 integration currently for devtools/QA saves only? (Affects 03B scope/demo data.)
3. **hornet bucket:** keep `center_rear` (data) or reclassify to `center` (QA hypothesis) — semantic only,
   no render impact under the frame-centered approach.
4. **03C timing:** retire legacy Wasp/Smoky pilot now-ish or keep as long-term fallback?
5. **Visual QA on metadata:** if any hull's turret looks off, confirm the fix path is metadata regeneration
   (Option B), not a runtime offset.

## 21. Final recommendation

Proceed with **two High+ PRs + one optional cleanup PR**:

- **03A:** live composition adapter + read-only mappers + per-unit lazy load + Arena demo modular unit,
  all behind `ENABLE_MODULAR_VEHICLE_RENDER` (default off), blockout fallback intact.
- **03B:** route normal runtime (`modular-combat`) through the same adapter with guarded fallback; confirm
  preview parity and Dictator/calibration isolation across all three modes.
- **03C (optional, post-QA):** retire the legacy Wasp/Smoky pilot and dead legacy hull path.

Adopt the **metadata-as-source-of-truth (Option B)** mount model with a **no-offset** Stage-03 position;
keep the existing 5-value `MountCategory` as the gameplay/QA grouping; **reject** runtime/renderer offset
tables. Keep calibration devtools-only; keep lazy load ≤32; keep `modular_hull_*` namespace; keep Dictator
1.09 hull-and-visual-only. No new query-string flags. No blockers found.

## 22.

Жду Делай
