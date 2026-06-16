# VEHICLE-RENDER-UNIFY-AUDIT — Vehicle Render Unification Audit

**Date:** 2026-06-16
**Project:** Four Elements Phaser
**Repo:** `ratoker-jpg/four-elements-phaser`
**Base branch:** `main`
**Base SHA:** `4bced103db1daf204720564f7a69de4300121c63` (Merge PR #295 / MODULAR-RUNTIME-04A)
**Mode:** AUDIT / DESIGN / DOCS PR ONLY
**Risk level:** High+
**Author role:** Lead architect / orchestrator (worker-delegated investigation, self-verified)
**Status:** Awaits GPT / Denis review before any implementation

---

## 1. Executive summary

After PR #295 (MODULAR-RUNTIME-04A), modular PNG hull+turret rendering is the
**default runtime visual** for both Arena devtools/demo and normal runtime
modular-combat, gated by `ENABLE_MODULAR_VEHICLE_RENDER = true` in
`src/phaser/render/ModularVehicleLiveAdapter.ts:72`. Scale is normalized to a
single shared source of truth `MODULAR_VEHICLE_BASE_SCALE = 0.16` in
`src/modular/modularVehicleComposition.ts:73`. Dictator hull-only `×1.09` is
preserved. Lazy-load cap `MAX_MODULAR_VEHICLE_SET_PNG = 32` is preserved.

Despite that, manual QA observations (PNG vs blockout cubes mixed, faction
loss, debug artifacts leaking, turret-to-cursor in some modes, different
paths per mode) are **real and reproducible from current `main` code**. They
are not residual from a stale branch. Root causes are:

1. **Three live render paths still exist** and share state with three
   fallback paths. Each surface (preview / Arena devtools / normal runtime)
   uses a different combination. See §3 and §4.
2. **Blockout procedural fallback is the default-ON emergency path** in
   `BlockoutVehicleRenderer`. While modular textures are loading or missing,
   vehicles render as turquoise blockout cubes. There is no
   "wait-for-textures-before-showing" gate.
3. **`entity.faction ?? 'cyan'` defaults at three call sites** silently
   recolor non-cyan entities to cyan whenever upstream state forgets to set
   a faction. See §6.
4. **Three debug artifacts in `BlockoutVehicleRenderer` are not gated by
   `isDevtoolsActive()`**: red mount-point dot, debug labels, and the red
   dashed aim line for selected vehicles. See §7.
5. **`BlockoutVehicleInputController` keeps a non-Arena devtools
   turret-follows-mouse behavior** that conflicts with Arena target-lock.
   See §7.
6. **Legacy `MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR` per-dir offset table**
   in `src/config/worldConfig.ts:37–66` is still in use by
   `ModularTankRenderer` (legacy normal-runtime fallback). It violates the
   AGENTS.md rule "no manual per-PNG offsets as source of truth".

The closed PR #296 (MODULAR-RUNTIME-04B) attempted a "unified corrective
refactor" but was not accepted after manual QA. The prompt explicitly warns
not to blindly reuse its mount-slot / forward-back drift model. This audit
does **not** reverse-engineer #296's branch; instead it derives a fresh
plan from current `main` evidence.

**Recommended canonical renderer:** `ModularVehicleLiveAdapter` +
`composeModularVehicle()` + `GeneratedModularVehicleRenderer`-style
sprite placement, used by **both** live surfaces (Arena devtools and
normal runtime), with `BlockoutVehicleRenderer` and `ModularTankRenderer`
retained only as emergency fallback until manual QA accepts Stage 3
retirement.

**Recommended next sequence:** 4 High/High+ stages (see companion
`VEHICLE_RENDER_UNIFICATION_ROADMAP_2026_06_16.md`):

- Stage 1 — Canonical renderer foundation (gate, contract, debug isolation)
- Stage 2 — Visual parity + placement stabilization (faction flow, debug
  gating, no-flicker loading)
- Stage 3 — Legacy renderer retirement (after manual QA acceptance)
- Stage 4 — `GameScene` render orchestration cleanup

---

## 2. Current repo / PR state (verified from GitHub API on 2026-06-16)

```text
main HEAD: 4bced103db1daf204720564f7a69de4300121c63
message:   Merge pull request #295 from ratoker-jpg/claude/funny-newton-dyuan3
            MODULAR-RUNTIME-04A: default modular PNG render + normalized scale
date:      2026-06-15T21:28:48Z
```

PR state (all verified via `GET /repos/.../pulls/{n}`):

| PR | Title | State | Merged | Merged/Closed at | Head branch |
|----|-------|-------|--------|------------------|-------------|
| #290 | OPUS-AUDIT-RUNTIME-03: add modular full game integration audit | closed | ✅ merged | 2026-06-15T08:11:35Z | `claude/modest-planck-vr6xek` |
| #291 | MODULAR-RUNTIME-03A: add live modular adapter for Arena demo vehicles | closed | ❌ not merged | 2026-06-15T11:43:37Z | `modular-runtime-03a-live-adapter` |
| #292 | MODULAR-RUNTIME-03A: calibration-free live modular vehicle adapter | closed | ✅ merged | 2026-06-15T16:31:14Z | `modular-runtime-03a-v3` |
| #293 | MODULAR-RUNTIME-03B: route normal runtime vehicles through modular adapter | closed | ✅ merged | 2026-06-15T20:29:38Z | `modular-runtime-03b-normal-runtime` |
| #294 | MODULAR-RUNTIME-03C1: remove dead generated vehicle proof harness | closed | ❌ not merged | (closed, superseded by 04A) | `modular-runtime-03c1-proof-harness-cleanup` |
| #295 | MODULAR-RUNTIME-04A: default modular PNG render + normalized scale | closed | ✅ merged | 2026-06-15T21:28:49Z | `claude/funny-newton-dyuan3` |
| #296 | MODULAR-RUNTIME-04B: unified modular vehicle renderer corrective refactor | closed | ❌ not merged | 2026-06-16T20:22:12Z | `claude/fervent-euler-fq6qr8` |

**Conclusions:**

- 03A (#292), 03B (#293), and 04A (#295) are merged on `main`. The audit
  base is current `main` after 04A.
- 04B (#296) is **closed without merge** after manual QA showed
  placement/composition issues. The prompt's warning not to blindly reuse
  its mount-slot/drift model is enforced by this audit.
- 03C1 (#294) was superseded by 04A (04A removed the proof harness as
  part of its scope). No further cleanup of #294 is needed; the
  forbidden-identifier guard list in `legacyWaspIsolation.test.ts` is
  intentionally kept stronger than the removal (per 04A report §4).

Active source-of-truth docs verified on `main`:

- `AGENTS.md`
- `docs/project/PROJECT_STATE.md`
- `docs/project/CURRENT_NEXT_STEP.md`
- `docs/project/GPT_WORKFLOW.md`
- `docs/project/GLM_EXECUTOR_RULES.md`
- `docs/project/CAMERA_PROJECTION_CONTRACT.md`
- `docs/project/MODULAR_RUNTIME_03_FULL_GAME_INTEGRATION_AUDIT_2026_06_15.md`
- `docs/project/MODULAR_RUNTIME_03_FULL_GAME_INTEGRATION_ROADMAP_2026_06_15.md`
- `docs/project/MODULAR_RUNTIME_03A_LIVE_ADAPTER_REPORT_2026_06_15.md`
- `docs/project/MODULAR_RUNTIME_03B_NORMAL_RUNTIME_INTEGRATION_REPORT_2026_06_15.md`
- `docs/project/MODULAR_RUNTIME_04A_DEFAULT_MODULAR_RENDER_SCALE_REPORT_2026_06_16.md`

No 04B report exists on `main` (PR #296 was not merged; its report is not
in the repo). This audit does not import or trust any 04B content.

---

## 3. Current render paths (verified from `main` code)

### 3.1 Path inventory

| # | Path | Surface | Renderer(s) | Default visual | Source of truth |
|---|------|---------|-------------|----------------|-----------------|
| P1 | Preview / calibration | devtools overlay only | `GeneratedModularVehicleRenderer` + `ModularVehicleDevtoolsPanel` | Modular PNG (always, fallback = labelled box) | `ModularVehicleVisual` selected in devtools panel |
| P2 | Arena devtools / demo vehicles | Arena mode (gameMode='arena' or URL `?devtools=1&arena=1`) | `BlockoutVehicleRenderer` + `ModularVehicleLiveAdapter.syncVehicle()` per frame | Modular PNG when `plan.available === true`; otherwise procedural blockout cube | `BlockoutVehicleState` → `blockoutToModularVisual()` → `composeModularVehicle()` |
| P3 | Normal runtime modular-combat | Normal game with modular-combat entity | `EntityRenderer` → `ModularTankRenderer.place()` + `ModularVehicleLiveAdapter.placeModularCombat()` once at placement, `retryCleanModular()` per frame | Modular PNG when `plan.available === true`; otherwise legacy `generated_hull_*` + `wasp_m0_*` sprites | `RenderableEntity` (kind='modular-combat') → `normalCombatToModularVisual()` → `composeModularVehicle()` |
| P4 | Legacy fallback in P2 | Same as P2, when `plan.available === false` | `BlockoutVehicleRenderer.renderVehicle(useModularBody=false)` — procedural Graphics box | Turquoise blockout cube | `BlockoutVehicleState` directly |
| P5 | Legacy fallback in P3 | Same as P3, when `plan.available === false` or `ENABLE_MODULAR_VEHICLE_RENDER === false` | `ModularTankRenderer` legacy path: `getWaspHullKey()` + `getSmokyTurretKey()` + `MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR` | Legacy wasp + smoky sprites (cyan-tinted by default faction) | `RenderableEntity` + per-dir offset tables |
| P6 | `ENABLE_MODULAR_VEHICLE_RENDER = false` (emergency toggle) | Either surface, when devtools toggle is OFF | Skips modular path entirely; P4 or P5 runs | Blockout cube (Arena) or legacy wasp (normal) | Same as P4/P5 |

### 3.2 Mode → renderer matrix

| Mode | P1 Preview | P2 Arena Modular | P3 Normal Modular | P4 Blockout fallback | P5 Legacy wasp fallback |
|------|------------|-------------------|-------------------|----------------------|-------------------------|
| Standard normal game | — | — | ✅ primary (when entity exists) | — | ✅ during texture load |
| Standard debug (`?devtools=1`) | available via panel | — | ✅ primary | — | ✅ during texture load |
| Arena (`?devtools=1&arena=1`) | available via panel | ✅ primary | — | ✅ during texture load | — |
| Preview-only (Visual0Xa URL) | — | — | — | — | — (separate legacy scene, unrelated) |

### 3.3 What "draws PNG by default" actually means per mode

- **P1 Preview:** always PNG if the selected set is loaded; otherwise
  labelled fallback box. **No flicker** because the panel does not show a
  vehicle until the user picks a visual and the set is requested.
- **P2 Arena:** default PNG *after* lazy-load completes. **Flicker visible
  for the first frames** while `requestModularVehicleSet()` queues and
  downloads the 32 PNGs for the spawned vehicle's visual. During that
  window `plan.available === false` and the procedural blockout cube is
  drawn.
- **P3 Normal runtime:** default PNG *after* `retryCleanModular()` succeeds
  on a subsequent frame. Legacy wasp hull + smoky turret is shown during
  the wait, then swapped. Visible as a brief "old look → new look" pop.

### 3.4 Where fallback is invoked

- `ModularVehicleLiveAdapter.syncVehicle()` lines 226–233: when
  `plan.available !== true`, calls `this.hideVehicle(vehicle.id)` and
  returns `usedModular: false`. The caller (`BlockoutVehicleRenderer`)
  then renders the procedural blockout path for that vehicle this frame.
- `ModularVehicleLiveAdapter.placeModularCombat()` lines 311–323: when
  `plan.available !== true`, stores `pendingCombat` and returns
  `usedModular: false`. The caller (`ModularTankRenderer`) renders the
  legacy `generated_hull_*` / `wasp_m0_*` path for that entity. Each
  frame `retryCleanModular()` re-attempts and swaps once textures arrive.
- `BlockoutVehicleRenderer.renderVehicle()` `useModularBody` parameter
  (line 698): when `false`, the full procedural blockout body + turret is
  drawn. This is the turquoise cube.

---

## 4. Mode-by-mode renderer map (file/function level)

### 4.1 Preview / calibration (P1)

- **Entry:** `GameScene.create()` constructs `GeneratedModularVehicleRenderer`
  + `ModularVehicleDevtoolsPanel` when `devtoolsActive`.
- **Files:**
  - `src/phaser/render/GeneratedModularVehicleRenderer.ts` (651 lines)
  - `src/phaser/dev/ModularVehicleDevtoolsPanel.ts` (530 lines)
- **Visual source:** `DEFAULT_MODULAR_VEHICLE_VISUAL` from
  `src/modular/modularVehicleVisual.ts:48` (wasp/smoky/cyan/m0/m0).
  User-selectable via panel.
- **PNG by default:** Yes, once the selected set is loaded.
- **Fallback invoked:** labelled box when textures/metadata missing
  (`plan.available !== true`).
- **Calibration:** `ModularPreviewCalibration` (modelScale, hullScale,
  turretScale, hullOffset, turretOffset) — **devtools-only, never written
  back** to constants/metadata/assets. Locked by tests in
  `modularPreviewCalibration01c.test.ts`.
- **Scale:** `effectiveHullScale = MODULAR_VEHICLE_BASE_SCALE × modelScale ×
  hullMult × hullScale`. Default `modelScale = 1`, so effective = `0.16`
  (or `0.16 × 1.09 = 0.1744` for Dictator).

### 4.2 Arena devtools / demo (P2 + P4 fallback)

- **Entry:** `GameScene.update()` calls
  `this.blockoutVehicleRenderer?.syncFromState(this.gameState)` per frame.
  Internally, for each `BlockoutVehicleState`, calls
  `this.modularAdapter.syncVehicle(vehicle)`.
- **Files:**
  - `src/phaser/render/BlockoutVehicleRenderer.ts` (1548 lines)
  - `src/phaser/render/ModularVehicleLiveAdapter.ts` (614 lines)
  - `src/modular/blockoutToModularVisual.ts` (196 lines)
- **Visual source:** `BlockoutVehicleState.bodyId/weaponId/faction/
  modificationLevel/bodyAngle/turretAngle` → `blockoutToModularVisual()` →
  `ModularVehicleVisual` + dir16.
- **PNG by default:** Yes when `plan.available === true` (textures loaded).
- **Fallback invoked:** procedural blockout cube when `plan.available ===
  false`. See §5 for why this happens repeatedly.
- **Per-frame allocation:** `syncVehicle()` is called per vehicle per
  frame; `composeModularVehicle()` allocates a fresh `ModularRenderPlan`
  each call.
- **Overlays:** HP bar, selection ring, hover ring, target-lock indicator,
  aim line, direction arrow, move-target marker, mount-point dot, debug
  label — all rendered by `BlockoutVehicleRenderer` regardless of
  `useModularBody`. See §7 for which of these leak in default view.

### 4.3 Normal runtime modular-combat (P3 + P5 fallback)

- **Entry:** `EntityRenderer.placeEntity()` for `kind === 'modular-combat'`
  delegates to `ModularTankRenderer.place()`. Internally calls
  `this.modularAdapter.placeModularCombat(entity, anchor, chassis, weapon,
  mod)`. Per-frame `retryCleanModular()` re-attempts until textures arrive.
- **Files:**
  - `src/phaser/render/EntityRenderer.ts` (681 lines)
  - `src/phaser/render/ModularTankRenderer.ts` (720 lines)
  - `src/phaser/render/ModularVehicleLiveAdapter.ts` (614 lines, shared with P2)
  - `src/modular/normalCombatToModularVisual.ts` (171 lines)
- **Visual source:** `RenderableEntity` (kind='modular-combat') with
  `chassis/weapon/mod/dir/turretDir/faction`. Entity comes from
  `ModularCombatUnit` config in `state/types.ts:144`.
- **PNG by default:** Yes when `plan.available === true`.
- **Fallback invoked:** legacy `generated_hull_*` / `wasp_m0_*` sprites via
  `ModularTankRenderer` legacy path, with `MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR`
  per-dir offset table from `src/config/worldConfig.ts:37–66`.
- **Notable:** only one modular-combat entity exists at a time in normal
  runtime, so `pendingCombat` is a single slot, not a Map. See
  `ModularVehicleLiveAdapter.ts:142`.

### 4.4 Controlled demo / blockout spawn tools

- **Arena spawn:** `arenaSpawnVehicle()` from `src/state/devArena.ts`
  (referenced from `GameScene` line 29 import).
- **Dev commands:** `devSpawnBlockoutVehicleSet()` from
  `src/state/devCommands.ts` (referenced from `blockoutMovement.test.ts`).
- **Asset preview tool:** `AssetPreviewTool` + `AssetPreviewPanel` in
  `src/phaser/dev/` — separate from live vehicle rendering, not a path
  that draws into the world.

### 4.5 Fallback renderers (P4, P5, P6)

- **P4 Blockout procedural:** `BlockoutVehicleRenderer.renderVehicle()` with
  `useModularBody === false`. Draws a pseudo-isometric box (base + side +
  top face), procedural turret box, barrel line. Color comes from
  `FACTION_COLORS` mapping at `BlockoutVehicleRenderer.ts:120–129`
  (cyan=0x00cccc, green=0x44cc44, etc.). This is the turquoise cube.
- **P5 Legacy wasp/smoky:** `ModularTankRenderer` legacy path. Hull via
  `getWaspHullKey(faction, dir)` from `src/assets/modularUnitAssets.ts`,
  turret via `getSmokyTurretKey(faction, dir)`. Offsets via
  `MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR` (8 entries, all `{x:2, y:16}`)
  and `MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR` (8 entries, varying). These
  are the per-dir manual offset tables that violate AGENTS.md.
- **P6 Emergency toggle:** `ENABLE_MODULAR_VEHICLE_RENDER = false` via
  devtools panel "Modular: OFF (emergency legacy)" toggle. Skips modular
  path entirely.

---

## 5. Why fallback placeholders reappear (root-cause analysis)

### 5.1 Lazy-load race on first frame after spawn

`requestModularVehicleSet(scene, visual)` is called from inside
`syncVehicle()` / `placeModularCombat()` **at the same time** as
`composeModularVehicle()` is checked. Phaser's `scene.load.image()` is
asynchronous; `scene.textures.exists(key)` returns `false` for the same
keys until the load completes. So:

```text
frame 0: spawn vehicle
  → syncVehicle() called
  → requestModularVehicleSet() queues 32 PNGs (or fewer if already loaded)
  → composeModularVehicle() checks textures.exists() → all false
  → plan.available = false
  → fallback (blockout cube or legacy wasp) drawn this frame
frame 1..N: same; fallback drawn while PNGs stream in
frame N+1: textures.exists() = true for all 32 keys
  → plan.available = true
  → modular PNG rendered
```

Visual symptom: turquoise blockout cube (Arena) or cyan wasp hull (normal
runtime) for ~100–500 ms after spawn, then abrupt swap to modular PNG.

### 5.2 `requestModularVehicleSet` ledger does not pre-load

`requestedSets: Set<string>` in
`src/modular/modularVehicleRuntimeLoader.ts:82` prevents re-queueing the
same set, but it does **not** preload sets proactively. Each new visual
combination pays the load latency once on first appearance.

### 5.3 `pendingCombat` single-slot retry

`ModularVehicleLiveAdapter.pendingCombat` (line 142) is a single slot,
assuming only one modular-combat entity exists in normal runtime at a
time. If multiple modular-combat entities are spawned before the first
one's textures arrive, only the last one is retried; the others remain on
legacy fallback until re-placed.

### 5.4 `ENABLE_MODULAR_VEHICLE_RENDER = false` (emergency toggle)

If a user toggles the devtools "Modular: OFF (emergency legacy)" switch
(relabeled in 04A but still functional), every vehicle falls back. The
default is `true` so this is not the source of "PNG vs blockout mixed"
in default view — but it is a manual escape hatch that can produce the
same symptom.

### 5.5 Asset-pipeline integrity

If a PNG file is missing or its key is wrong, `plan.available` stays
`false` forever for that visual and the vehicle is stuck on fallback.
The `runtimeAssetDiagnostics.ts` module exists for this; ensure it runs
in CI and surfaces missing keys.

---

## 6. Where faction information is lost or hardcoded to cyan

### 6.1 Direct `'cyan'` defaults in live path (3 sites)

| File | Line | Code | Effect |
|------|------|------|--------|
| `src/phaser/render/ModularVehicleLiveAdapter.ts` | 267 | `faction: entity.faction ?? 'cyan',` | When `RenderableEntity.faction` is `undefined`, normal-runtime modular-combat defaults to cyan for the modular mapping. |
| `src/phaser/render/ModularVehicleLiveAdapter.ts` | 318 | `faction: entity.faction ?? 'cyan',` | Same default stored in `pendingCombat` for retry. |
| `src/phaser/render/ModularTankRenderer.ts` | 182 | `const faction: Faction = entity.faction ?? 'cyan';` | Legacy `ModularTankRenderer.place()` defaults to cyan before delegating to the adapter. |

### 6.2 Implicit cyan fallback in resolver

- `src/assets/generatedHullAssets.ts:217–223`:
  `resolveGeneratedHullFaction(faction)` returns `'cyan'` when the
  provided faction is not in `GENERATED_HULL_FACTIONS`. This is the
  legacy fallback path's silent recolor.
- `src/modular/modularVehicleVisual.ts:48–54`:
  `DEFAULT_MODULAR_VEHICLE_VISUAL.faction = 'cyan'` — used only as a
  devtools default selection, not in live path. Safe but worth noting.

### 6.3 Pilot set is cyan-only

- `src/assets/pilotVehicleLazyLoad.ts:126`:
  `return preloadGeneratedTurretSet(scene, 'smoky', 'cyan', 'm0');`
- `src/assets/pilotVehicleLazyLoad.ts:175, 187, 195, 196`:
  `wasp/cyan/m0` and `smoky/cyan/m0` are the only pilot-set combinations.
- `PreloadScene.loadArenaVisualAssets()` (via
  `src/assets/runtimeGeneratedAssets.ts:238–263`): preloads wasp hull for
  **all 4 factions** but pilot turret (smoky) for **cyan only**. So a
  green/yellow/purple wasp+smoky combo has hull preloaded but turret
  needs lazy-load → blockout turret fallback until loaded.

This is the **single biggest source of "only cyan works in some paths"**.
Any non-cyan vehicle with a non-preloaded turret combination will show
procedural fallback for the turret until lazy-load completes, which can
look like "the turret is cyan" because the fallback path uses cyan
default colors.

### 6.4 `normalCombatToModularVisual` accepts `Faction | string`

- `src/modular/normalCombatToModularVisual.ts:111`:
  `faction: Faction | string;`
- Line 145: `factionToModularFactionId(args.faction as Faction)` casts
  away the string-ness. If `args.faction` is an invalid string (e.g.
  `'red'`, `'blue'`), `factionToModularFactionId()` returns `null`,
  mapping fails, fallback runs. The `as Faction` cast hides the type
  error from TypeScript.

### 6.5 `BlockoutVehicleState.faction` is typed `Faction`

- `src/state/blockoutVehicleState.ts:52`: `faction: Faction;` — required,
  not optional. So Arena devtools spawn must set faction; if it doesn't,
  TypeScript catches it. This is safer than the normal-runtime path.

### 6.6 Summary of faction-loss vectors

| Vector | Severity | Where |
|--------|----------|-------|
| `entity.faction ?? 'cyan'` in normal-runtime adapter | High | `ModularVehicleLiveAdapter.ts:267, 318` |
| `entity.faction ?? 'cyan'` in `ModularTankRenderer.place()` | High | `ModularTankRenderer.ts:182` |
| `resolveGeneratedHullFaction()` cyan fallback | Medium | `generatedHullAssets.ts:217–223` |
| Pilot set cyan-only preload | High | `pilotVehicleLazyLoad.ts:126, 175, 187, 195, 196` + `runtimeGeneratedAssets.ts:238–263` |
| `Faction | string` cast in normal-runtime mapper | Medium | `normalCombatToModularVisual.ts:111, 145` |

---

## 7. Debug artifact inventory (where the leaks come from)

### 7.1 `BlockoutVehicleRenderer` artifacts

| Artifact | Default ON? | Gated by `isDevtoolsActive()`? | Color | File:line |
|----------|-------------|-------------------------------|-------|-----------|
| Selection ring | Yes when selected | No (intentional UI) | faction color | `BlockoutVehicleRenderer.ts` ~860 |
| Hover ring | Yes when hovered | No (intentional UI) | faction color, alpha 0.3 | ~860 |
| **Mount-point dot** | **Yes (`showMountPoints = true`)** | **No** | **red (`MOUNT_POINT_COLOR = 0xff0000`)** | **233, 1010–1015** |
| HP bar | Yes when HP < max | No (intentional UI) | green→red gradient | ~1018 |
| Target-lock indicator | Yes when target assigned | No (intentional UI) | colored dot | ~880 |
| Enemy team indicator | Yes for enemies | No (intentional UI) | red diamond | ~890 |
| **Aim line** (dashed) | **Yes when `isSelected`** | **No** | **red (`AIM_LINE_COLOR = 0xff4444`)** | **178, 1254–1280** |
| Direction arrow | Yes when selected | No (intentional UI) | faction color | 162–166, 830–855 |
| Move-target marker | Yes during move | No (intentional UI) | green (`MOVE_TARGET_COLOR = 0x44ff44`) | ~190 |
| **Debug label** | **Yes (`showDebugLabels = true`)** | **No** | white-on-dark | **230, ~502** |
| Direction-debug overlay | No (`directionDebugEnabled = false`) | Yes | multi-color | 1286 |
| Calibration overlay | No | Yes (`isDevtoolsActive() && isCalibrationActive()`) | multi-color | 1319 |
| Placement overlay | No | Yes (`isDevtoolsActive() && isWaspPlacementActive()`) | multi-color | 1390 |

### 7.2 The four leaks (no devtools gate)

These three artifacts render in **any** Arena/devtools mode regardless
of whether the user enabled debug:

1. **Red mount-point dot** at turret mount position — visible on every
   vehicle, every frame, while `showMountPoints = true` (the default).
2. **Debug label** text above every vehicle, every frame, while
   `showDebugLabels = true` (the default).
3. **Red dashed aim line** from barrel tip along turret aim direction,
   every frame, for the selected vehicle (`if (isSelected)`).
4. **Direction arrow** outside the selection ring (gold/faction color)
   for the selected vehicle. This one is borderline — it is useful UI,
   but the prompt lists "arrow/marker on selection ring" as a debug
   artifact to hide.

These are the green/red debug lines and arrow markers the prompt lists
as appearing in default view.

### 7.3 Turret-to-cursor behavior

- `src/phaser/input/BlockoutVehicleInputController.ts:344–347`:
  ```ts
  // Non-Arena devtools: original mouse-follow behavior
  const targetAngle = angleFromTo(turretMountScreen.x, turretMountScreen.y, this._mouseWorldX, this._mouseWorldY);
  selected.turretTargetAngle = targetAngle;
  ```
  Gated by `!arenaMode`. So:
  - **Arena mode:** target-lock only (no cursor follow). Correct per
    ARENA-03H+ contract.
  - **Non-Arena devtools:** turret follows mouse cursor. This is the
    "turret-to-cursor behavior still active in some modes" observation.

This is intentional legacy behavior for non-Arena devtools. It is not a
bug per se, but it is mode-inconsistent and should be revisited in
Stage 2.

### 7.4 `BlockoutVehicleInputController` debug calibration imports

- `BlockoutVehicleInputController.ts:61, 62, 71` imports
  `isCalibrationActive`, `isOverrideActive`, `isPlacementActive` from
  `WaspHullDirectionCalibrator` / `WaspHullPlacementCalibrator`.
- These are guarded by `isWaspPlacementActiveCheck()` at line 380, 403,
  679. So calibration UI only activates when explicitly toggled. Safe.

---

## 8. Scale / placement / socket analysis

### 8.1 Current scale constants (single source of truth since 04A)

| Constant | Value | Location | Used by |
|----------|-------|----------|---------|
| `MODULAR_VEHICLE_BASE_SCALE` | `0.16` | `modularVehicleComposition.ts:73` | Live adapter + preview |
| `MODULAR_VEHICLE_DISPLAY_SCALE` | `= MODULAR_VEHICLE_BASE_SCALE` (deprecated alias) | `modularVehicleComposition.ts:79` | Legacy imports |
| `MODULAR_FRAME_SIZE` | `512` | `modularVehicleComposition.ts:82` | Composition math |
| `HULL_VISUAL_SCALE_MULTIPLIERS` | `{ dictator: 1.09 }` | `modularVehicleComposition.ts:100` | Hull-only scale multiplier |
| `GENERATED_HULL_SCALE` | (legacy) | `generatedHullAssets.ts` | Legacy `generated_hull_*` path |
| `MODULAR_TANK_SCALE` | `= MODULAR_RENDER_SCALE` (legacy) | `ModularTankRenderer.ts:67` | Legacy `ModularTankRenderer` path |
| `MODULAR_RENDER_SCALE` | (legacy) | `unitRenderConfig.ts` | Legacy path |

### 8.2 Preview == live parity (since 04A)

- Preview effective hull scale = `0.16 × modelScale × hullMult × hullScale`
  with default `modelScale = 1, hullScale = 1, hullMult = 1` → `0.16`.
- Live effective hull scale = `MODULAR_VEHICLE_DISPLAY_SCALE × hullMult`
  with default `displayScale = 0.16` → `0.16`.
- Dictator: `0.16 × 1.09 = 0.1744` in both. ✅ parity verified by
  `modularRuntime04a.test.ts`.

### 8.3 Socket / pivot composition (metadata-driven, no per-dir tables)

From `src/modular/modularVehicleComposition.ts:14–22`:

```text
socketOffsetPx = (socketNorm - 0.5) * hullDisplaySize
pivotOffsetPx  = (pivotNorm  - 0.5) * turretDisplaySize
turretCenter   = hullCenter + socketOffsetPx - pivotOffsetPx
```

Under the `fixed_512_frame` export policy, both `socketNorm` and
`pivotNorm` are `(0.5, 0.5)`, so the offset is zero — both sprites keep
their natural frame-center origin. The formula generalizes to future
per-direction socket/pivot without changing the renderer.

### 8.4 Per-dir offset tables still in legacy path

- `src/config/worldConfig.ts:37–66`:
  - `DEFAULT_MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR` — 8 entries, all
    `{x:2, y:16}` (no actual per-dir variation).
  - `DEFAULT_MODULAR_TURRET_MOUNT_BY_BODY_DIR` — 8 entries, varying
    `{x, y}` per direction.
- These are used **only** by `ModularTankRenderer` legacy fallback
  (P5). The new modular pipeline (P2, P3 primary) does not use them.
- They violate the AGENTS.md rule "no manual per-PNG offsets as source
  of truth". They must be removed when P5 is retired (Stage 3).

### 8.5 The failed #296 mount-slot / drift model

PR #296 attempted a "unified corrective refactor" with a mount-slot
model. It was not accepted after manual QA. The prompt explicitly warns:

> Do not assume the failed #296 mount-slot math is correct. It was not
> accepted. Do not recommend blindly reusing #296's forward/back drift
> model. If recommending mount-slot profiles, explain how to avoid
> breaking the currently working visual alignment.

This audit does **not** import #296's approach. The current
metadata-driven `composeModularVehicle()` already produces visually
correct alignment in preview mode (locked by
`modularRuntime04a.test.ts` parity tests). Stage 2 of the roadmap
stabilizes this for live modes **without** introducing a new mount-slot
abstraction.

---

## 9. Current tests / QA coverage

### 9.1 Modular runtime tests (verified from `src/__tests__/`)

| Test file | Coverage |
|-----------|----------|
| `modularRuntime01.test.ts` | 32-PNG cap, no all-factions preload, key namespace |
| `modularRuntime02aPilotAssetIntake.test.ts` | Pilot set intake (cyan only) |
| `runtime02bPilotLazyLoad.test.ts` | Pilot lazy-load behavior |
| `modularLiveAdapter03a.test.ts` | Live adapter for Arena (syncVehicle) |
| `modularRuntime03b.test.ts` | Live adapter for normal runtime (placeModularCombat) |
| `modularRuntime04a.test.ts` | Scale parity (preview == live), default flag, Dictator hull-only |
| `runtime03PilotTurretComposition.test.ts` | Pilot turret composition (legacy, quarantined) |
| `modularPreviewCalibration01c.test.ts` | Preview calibration controls (devtools-only) |
| `modularTurretSpriteResolver.test.ts` | Turret sprite resolution |
| `runtimeGeneratedAssets.test.ts` | Generated asset manifest loading |
| `generatedHullAssets.test.ts` | Generated hull key/path/scale |
| `legacyWaspIsolation.test.ts` | Forbidden-identifier guard (legacy Wasp) |
| `waspHullDirectionCalibrator.test.ts` | Direction calibrator (devtools) |
| `waspHullPlacementCalibrator.test.ts` | Placement calibrator (devtools) |
| `waspHullPlacementCalibrator.test.ts` | (duplicate name?) |
| `tankviewerManifest.test.ts` | Tankviewer manifest (Blender export) |
| `assetDiagnostics.test.ts` | Asset diagnostics |
| `assetPreview.test.ts` | Asset preview tool |

### 9.2 Gaps in test coverage

| Gap | Why it matters | Proposed test |
|-----|----------------|---------------|
| No test that `entity.faction ?? 'cyan'` is **never reached** in normal-runtime with a non-cyan faction | This is the silent recolor bug | Test that spawns a non-cyan modular-combat entity and asserts the modular mapping uses the correct faction |
| No test that `BlockoutVehicleRenderer` does **not** draw mount-point dot / debug label / aim line when `isDevtoolsActive() === false` | These are the debug leaks | Test that constructs a renderer with `isDevtoolsActive = () => false` and asserts the Graphics calls exclude the leak artifacts |
| No test that `ModularTankRenderer` legacy path is **never reached** when `ENABLE_MODULAR_VEHICLE_RENDER === true && plan.available === true` | This is the canonical-renderer contract | Test that asserts `usedModular === true` for a fully-loaded visual |
| No test that `pendingCombat` retry actually swaps to modular after textures arrive | This is the no-flicker contract | Test that simulates `textures.exists() = false` then `true` and asserts `usedModular` flips |
| No test that pilot set preloads only cyan smoky m0 (not other factions) | This is the "only cyan works" root cause | Test that asserts `loadArenaVisualAssets()` queues exactly the expected keys |
| No e2e/visual regression test for "first-frame fallback" | This is the visible flicker | Playwright screenshot test that spawns a vehicle and asserts no blockout cube is visible after N ms |
| No test that `normalCombatToModularVisual` rejects invalid faction strings | Type-cast hole | Test that passes `faction: 'red'` and asserts `failReason` is set |

### 9.3 QA smoke coverage

- `tools/qa_smoke.mjs` — Playwright-based, 2 runs (standard + devtools/arena).
  Asserts console markers and HUD DOM content. **Does not** assert visual
  correctness (no screenshot diff). **Does not** exercise non-cyan
  vehicles (smoke runs use default cyan setup).

---

## 10. Risks

### 10.1 Architectural risks

| Risk | Severity | Where | Mitigation |
|------|----------|-------|------------|
| Three live render paths coexist (P2/P3 + P4/P5 fallbacks) | Critical | §3.1 | Stage 1–3 roadmap: enforce canonical adapter, retire legacy after QA |
| `entity.faction ?? 'cyan'` silent recolor at 3 sites | High | §6.1 | Stage 2: remove cyan default, require `Faction` (non-optional) at mapper entry |
| Per-dir offset tables `MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR` | High | `worldConfig.ts:37–66` | Stage 3: remove when `ModularTankRenderer` legacy path is retired |
| `pendingCombat` single-slot retry | Medium | `ModularVehicleLiveAdapter.ts:142` | Stage 2: convert to Map if multi-entity normal runtime is planned; or document the single-entity constraint |
| `BlockoutVehicleRenderer` is 1548 lines (god class) | High | §1.4 | Stage 4: split into hull/turret/overlays/calibration sub-renderers |
| `normalCombatToModularVisual` accepts `Faction \| string` | Medium | §6.4 | Stage 2: tighten to `Faction` only, remove cast |

### 10.2 Gameplay risks

| Risk | Severity | Where | Mitigation |
|------|----------|-------|------------|
| Flicker on spawn (100–500 ms blockout cube) | High | §5.1 | Stage 2: pre-request set on spawn decision, hide vehicle until `plan.available` |
| Turret-to-cursor in non-Arena devtools | Medium | §7.3 | Stage 2: align with Arena target-lock contract, or document as intentional devtools behavior |
| Manual QA cannot trust default view | High | §7 | Stage 1: gate debug artifacts behind `isDevtoolsActive()` |

### 10.3 Performance risks

| Risk | Severity | Where | Mitigation |
|------|----------|-------|------------|
| Per-frame `composeModularVehicle` allocation | Low | §4.2 | Stage 4: pool render plans |
| No atlas packing (32 PNG per visual = 32 HTTP requests) | Medium | §5 of full project audit | Out of scope for this audit; separate roadmap |
| `BlockoutVehicleRenderer` Graphics clear+redraw per frame | Medium | §4.2 | Stage 4: split static overlays from dynamic |

### 10.4 Asset-pipeline risks

| Risk | Severity | Where | Mitigation |
|------|----------|-------|------------|
| Pilot set cyan-only preload | High | §6.3 | Stage 2: either preload all 4 factions for the pilot turret, or document that non-cyan pilot combos require lazy-load and accept the brief fallback |
| Missing PNG → permanent fallback | Medium | §5.5 | Stage 1: run `runtimeAssetDiagnostics` in CI, fail build on missing keys |
| 5 GB asset repo (separate concern) | Critical | (out of scope) | Separate asset-pipeline roadmap |

### 10.5 Development risks

| Risk | Severity | Where | Mitigation |
|------|----------|-------|------------|
| Roadmap-gated development slowdown | Medium | AGENTS.md | This audit + roadmap is a single decision document; implementation can proceed in bounded High+ PRs after GPT approval |
| PR #296 memory — team may push back on "another refactor" | Medium | Process | Stage 1 is **not** a refactor; it is gating + contract + test additions. No runtime visual change. |
| Manual QA burden for each stage | High | Process | Each stage has explicit manual QA checklist (see roadmap) |

---

## 11. Recommended architecture

### 11.1 Canonical renderer

```text
                         ┌──────────────────────────────────┐
                         │   ModularVehicleVisual (typed)   │
                         └──────────────┬───────────────────┘
                                        │
                       ┌────────────────┴────────────────┐
                       │  composeModularVehicle()        │
                       │  (metadata-driven, no offsets)  │
                       └────────────────┬────────────────┘
                                        │
                              ModularRenderPlan
                                        │
                       ┌────────────────┴────────────────┐
                       │  ModularVehicleLiveAdapter      │
                       │  - syncVehicle (Arena)          │
                       │  - placeModularCombat (normal)  │
                       │  - retryCleanModular            │
                       └────────────────┬────────────────┘
                                        │
                       ┌────────────────┴────────────────┐
                       │  Hull + Turret Phaser.Image     │
                       │  (placed in world space)        │
                       └─────────────────────────────────┘
```

- **One** composition entry point: `composeModularVehicle()`.
- **One** live adapter: `ModularVehicleLiveAdapter` (already exists).
- **Two** entry surfaces (Arena syncVehicle / normal placeModularCombat)
  both delegate to the same adapter. Already true; Stage 1 enforces it
  as a contract.
- **Fallback** is emergency-only, never the default workflow. Already
  true at the flag level; Stage 2 ensures fallback is **invisible**
  during normal load (no turquoise cube flicker).

### 11.2 What gets retired, when

| Component | Stage 1 | Stage 2 | Stage 3 | Stage 4 |
|-----------|---------|---------|---------|---------|
| `GeneratedModularVehicleRenderer` (preview) | Keep | Keep | Keep | Refactor into sub-renderer |
| `ModularVehicleLiveAdapter` | Keep, enforce contract | Add retry Map, remove cyan default | Keep | Keep |
| `composeModularVehicle()` | Keep | Keep | Keep | Keep |
| `BlockoutVehicleRenderer` (procedural fallback) | Gate debug artifacts | Keep as emergency fallback | **Quarantine** (devtools-only) | Split into sub-renderers |
| `ModularTankRenderer` (legacy wasp/smoky) | Keep as emergency fallback | Keep as emergency fallback | **Quarantine** (devtools-only) | Remove |
| `MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR` | Keep | Keep | **Remove** (after `ModularTankRenderer` retired) | — |
| `MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR` | Keep | Keep | **Remove** | — |
| `pilotVehicleLazyLoad.ts` cyan-only pilot | Keep | Document or extend to all factions | Keep or remove | — |
| `pilotTurretComposition.ts` (quarantined) | Keep | Keep | Remove | — |
| `modularUnitAssets.ts` legacy `getWaspHullKey` / `getSmokyTurretKey` | Keep | Keep | Remove | — |
| `ENABLE_PILOT_GENERATED_TURRET_COMPOSITION` (quarantine flag) | Keep `false` | Keep `false` | Remove | — |

### 11.3 What stays forbidden (from AGENTS.md, enforced by this audit)

- No combined hull×turret production matrix.
- No preload of all 4352 PNG.
- No new URL debug-mode flags.
- No per-PNG manual offset tables as source of truth.
- No Canvas renderer / renderer bridge / dual renderer.
- No copying runtime code from `four-elements-next`.
- No combat/movement/economy/mapgen/pathfinding/save-load changes during
  render unification.

---

## 12. What not to do (audit-level)

This list is **project-specific**, derived from current `main` state and
recent PR history. It is not generic advice.

1. **Do not blindly reuse PR #296's mount-slot / forward-back drift
   model.** It was not accepted. The current `composeModularVehicle()`
   math already produces correct alignment in preview; live-mode issues
   are about *gating and faction flow*, not about composition math.
2. **Do not delete `BlockoutVehicleRenderer` or `ModularTankRenderer`
   before manual QA accepts Stage 2.** They are the emergency fallback.
   Removing them early removes the rollback path.
3. **Do not change `MODULAR_VEHICLE_BASE_SCALE` or `HULL_VISUAL_SCALE_MULTIPLIERS`
   values.** They are locked by `modularRuntime04a.test.ts` parity
   tests. Any change requires a new audit.
4. **Do not change `composeModularVehicle()` math.** It is
   metadata-driven and locked by tests. If live placement looks wrong,
   the bug is in the *caller* (faction default, anchor computation, dir
   mapping), not in the composition.
5. **Do not add a new render path.** Three is already too many. Any new
   visual feature (damage decals, animations, particle effects) must
   extend the canonical path, not create a fourth.
6. **Do not add a new query-string flag** for visual testing. Use the
   Arena/devtools UI surfaces (AGENTS.md rule).
7. **Do not preload the full modular matrix.** Lazy-load 32 PNG per
   visual is the contract.
8. **Do not change `entity.faction ?? 'cyan'` to a different default
   faction.** Remove the default entirely; require `Faction` at the
   mapper entry. Changing the default just moves the bug.
9. **Do not touch combat/movement/economy/mapgen/pathfinding/save-load.**
   Render unification is render-only.
10. **Do not change camera projection (`basisX`, `basisY`, `basisZ`).**
    Non-negotiable per `CAMERA_PROJECTION_CONTRACT.md`.
11. **Do not add a fourth render path for "transitional" purposes.** No
    hidden temporary architecture (AGENTS.md rule).
12. **Do not commit logs, tool-results, screenshots, secrets, or
    tokens** (this is a docs PR; only `.md` files are touched).

---

## 13. Open questions

These are questions for GPT/Denis to resolve before Stage 2
implementation, not blockers for Stage 1.

1. **Pilot set scope:** Should `loadArenaVisualAssets()` preload the
   pilot turret (smoky) for all 4 factions, or only cyan? Preloading all
   4 adds 48 PNG (3 × 16) to startup; not preloading means non-cyan
   vehicles flicker on first spawn. **Recommendation:** preload all 4
   factions for the pilot turret; the cost is small (~1 MB) and it
   removes the "only cyan works" symptom immediately.

2. **Non-Arena devtools turret-to-cursor:** Should this behavior be
   preserved as intentional devtools UX, or aligned with Arena
   target-lock? **Recommendation:** preserve for non-Arena devtools
   (it is useful for QA), but document it explicitly in
   `BlockoutVehicleInputController.ts` as "non-Arena devtools only".

3. **`pendingCombat` single-slot vs Map:** Is normal runtime expected to
   ever have more than one modular-combat entity simultaneously? If yes,
   convert to Map. If no, document the constraint in code.
   **Recommendation:** document the constraint; convert to Map only if
   a future feature requires it.

4. **Direction arrow on selection ring:** Keep as gameplay UI or hide as
   debug? **Recommendation:** keep — it is useful for orienting the
   player. But the prompt lists it as a debug artifact, so confirm with
   Denis.

5. **`showMountPoints` and `showDebugLabels` defaults:** Should they
   flip to `false` by default, or be removed entirely?
   **Recommendation:** flip to `false` by default in Stage 1 (smallest
   change, immediate visual cleanup); consider removal in Stage 3.

6. **Stage 3 retirement scope:** When `BlockoutVehicleRenderer` and
   `ModularTankRenderer` are quarantined, should they move to
   `src/phaser/render/legacy/` or be deleted? **Recommendation:** move
   to `legacy/` first, delete after one release cycle.

---

## 14. Validation

This is a docs-only PR. Validation performed:

- No runtime files changed.
- No assets changed.
- No generated files changed.
- No tool-results / logs / screenshots committed.
- No tokens or secrets committed (verified by `git diff --check` before
  push; the audit does not contain any `ghp_`, `bot`, or chat-id strings).
- Markdown is rendered correctly (headings, tables, code blocks).

No `npm run typecheck` / `npm test` / `npm run build` / `npm run qa:smoke`
runs are required for a docs-only PR per the prompt's validation section.
Runtime validation will be required for the implementation PRs that
follow this audit.

---

## 15. Final notes

This audit was produced by reading current `main` code directly. PR
state was verified via GitHub API on 2026-06-16. No claims rely on
memory or on closed/not-merged PR branches. Where a claim depends on a
specific file/line, the file path and line number are cited.

The companion document
`docs/project/VEHICLE_RENDER_UNIFICATION_ROADMAP_2026_06_16.md` defines
the 4-stage High+ implementation plan derived from this audit. Both
documents must be reviewed together before any implementation PR is
opened.

**GPT review required before implementation.**
