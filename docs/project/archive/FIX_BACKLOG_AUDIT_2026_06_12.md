# FIX_BACKLOG_AUDIT_2026_06_12.md

Status: **ARCHIVED** — competing source-of-truth; superseded by MODULAR_VEHICLE_ASSET_RUNTIME_SYSTEM_AUDIT (2026-06-14)  
Project: Four Elements Phaser  
Date: 2026-06-12  
Origin: GLM audit of `docs/project/FIX_BACKLOG_ROADMAP_2026_06_12.md`  
Mode: audit only; no runtime code was changed.

---

## Purpose

This document records the accepted audit result for the current bugfix / visual calibration backlog so future GPT / GLM / Codex / Claude / Opus tasks do not rely on memory.

Use together with:

- `AGENTS.md`
- `docs/project/CURRENT_NEXT_STEP.md`
- `docs/project/AI_EXECUTION_WORKFLOW_2026_06_12.md`
- `docs/project/CODEMAP.md`
- `docs/project/FIX_BACKLOG_ROADMAP_2026_06_12.md`
- `docs/project/STRONG_MODEL_EXPERIMENTS_2026_06_12.md`

---

## Scope confirmation

This audit covers only the scoped fix backlog in:

- `docs/project/FIX_BACKLOG_ROADMAP_2026_06_12.md`

It does not reopen closed VISUAL, BLOCKOUT, ARENA SANDBOX, CORE MECHANICS, or asset pipeline roadmaps by inertia.

The audited backlog contains:

1. Manual QA route policy
2. Debug / Отладка mode cleanup: Map 1 / Sand Classic
3. Arena placement / preview clarity
4. Arena body + weapon visual calibration
5. Turret rest / target-lock behavior
6. Arena body/weapon inspection controls
7. Dev grid overlay — deferred

---

## Audit conclusions

- No substantive overlap with old `docs/project/FIX_BACKLOG.md` or closed roadmap queues.
- Current backlog is a fresh post-implementation bugfix / polish scope.
- PR #245 and PR #246 are failed attempts that explain the current turret issue, but they are not being reopened.
- Manual QA must use real menu flows: Standard / Debug / Arena.
- Sand Classic should remain available because it provides a visible isometric grid useful for calibration.
- Dev grid overlay remains deferred while Sand Classic is sufficient.

---

## Key finding: 19px Arena spawn offset

The audit confirmed a placement mismatch:

- placement preview crosshair uses tile center: `(tx + 0.5, ty + 0.5)`;
- `createBlockoutVehicle()` spawns using tile north vertex: `tileToScreen(tx, ty)`;
- this creates an approximately 19px Y discrepancy.

This is the root cause of Arena placement confusion.

Important dependency:

- B1 placement center alignment must be fixed before B2 body + weapon visual calibration.
- Otherwise turret/body mount offsets are calibrated against the wrong coordinate baseline.

In the strong-model experiment, this dependency remains active as an internal checkpoint: B1 must be solved before B2 work continues.

---

## Accepted GPT / Denis decisions

| Question | Decision |
|---|---|
| Map 1 | Remove Map 1 / `customMap1` from visible UI / `MAP_LIST`. Keep `src/data/maps/customMap1.ts` as fallback/reference. |
| Sand Classic | Keep Sand Classic / Песок as visible calibration map. Do not remove it. |
| Spawn position | Arena vehicles should spawn in the center of the selected tile diamond. Fix the spawn/model position, not by hiding the error with renderer-only offsets. |
| Wasp offsets | Do not casually modify `src/assets/generatedHullAssets.ts` / Wasp offsets in the first pass. |
| Turret rest speed | Smooth return using existing `turretTurnSpeedDeg`. No instant snap except initial spawn/init if needed. |
| Move-only command | RMB on ground = move-only and clears `targetVehicleId`. RMB on enemy = attack target. `S`/stop and target loss also clear target-lock and return turret to rest. |
| Inspection controls | Prefer Arena UI buttons first: next/prev body, next/prev weapon, reset pose/direction. Avoid new hotkeys first. |
| B2 executor | Use Codex as preferred executor for body+weapon visual calibration because screenshot-driven visual QA is useful. Claude/Opus is fallback. GLM must not implement B2/C1. |

---

## Accepted implementation sequence

A1 from the audit is considered mostly covered by existing merged workflow docs. Do not create a separate A1 PR unless real menu routes are broken.

Base accepted sequence:

1. `A2 — FIX-A2-MAP-CLEANUP-01`: Debug mode map cleanup / keep Sand Classic
2. `B1 — FIX-B1-PLACEMENT-CENTER-01`: Arena placement center alignment
3. `B2 — FIX-B2-BODY-WEAPON-VISUAL-01`: Arena body + weapon visual calibration
4. `C1 — FIX-C1-TURRET-REST-01`: Turret rest / target-lock behavior
5. `C2 — FIX-C2-INSPECTION-CONTROLS-01`: Arena body/weapon inspection controls
6. `D — DEV-GRID-OVERLAY`: deferred unless Sand Classic is insufficient

Dependency rule:

- Do not start B2 before B1 is resolved and accepted as the coordinate baseline.

---

## Strong-model experiment after A2

After A2 is merged and accepted, Denis/GPT selected one controlled strong-model experiment:

```text
EXPERIMENT-OPUS-B1B2-01
```

Goal:

```text
Test whether Claude/Opus 4.8 can safely handle a bundled High+ implementation package.
```

Bundle:

```text
B1 — Arena placement center alignment
B2 — Arena body + weapon visual calibration
```

Executor routing:

```text
Primary: Claude/Opus 4.8
Alternative: Codex GPT-5.5
GLM: patch apply / validation / PR delivery only if needed
```

This is an experiment, not a permanent new default.

If the experiment fails or the diff becomes too broad/fragile:

```text
Return to separate B1 -> B2 -> C1 -> C2 implementation steps.
```

If it succeeds:

```text
Allow larger High+ bundles for Claude/Opus and Codex experiments, still with strict checkpoints and merge gates.
```

Do not bundle B2 with C1 as the first experiment. B2 is renderer/visual calibration; C1 is behavior/target-lock/combat-adjacent logic.

The detailed experiment rules are recorded in:

```text
docs/project/STRONG_MODEL_EXPERIMENTS_2026_06_12.md
```

---

## Step routing

### A2 — Debug mode map cleanup / keep Sand Classic

- Classification: High
- Risk: Low
- Status: done after PR #251 is merged/accepted.
- Executor: GLM
- Goal: remove legacy Map 1 from visible Debug/New Game options; keep Sand Classic visible.
- Likely files: `src/state/gameSetup.ts`, possibly `src/phaser/NewGameSetupScene.ts`, directly related tests.
- Do not touch: renderers, Arena placement, turret/body/weapon logic, movement, combat, economy, assets.

### B1 — Arena placement center alignment

- Classification: High+
- Risk: Medium
- Executor: Claude/Opus or Codex; included as first checkpoint in `EXPERIMENT-OPUS-B1B2-01`.
- Goal: final vehicle spawn matches selected tile center and placement preview.
- Likely files: `src/state/blockoutVehicleState.ts`, `src/phaser/GameScene.ts`, possibly comments/naming in `src/phaser/render/blockoutVehicleGeometry.ts`.
- Do not touch: movement/pathfinding/occupancy/combat/economy/save-load/assets/Wasp offsets.

### B2 — Arena body + weapon visual calibration

- Classification: High+
- Risk: High
- Executor: Claude/Opus primary for the first experiment; Codex alternative/preferred if screenshot-driven QA is needed; GLM must not implement.
- Goal: body+weapon render as coherent tank; turret visible, attached, depth-correct, not detached.
- Likely files: `src/phaser/render/BlockoutVehicleRenderer.ts`; maybe targeted asset-key/preload/config files only if justified.
- Do not touch: movement, combat damage/hit model, economy, save-load, Wasp offsets, PNG/assets, full matrix preload.

### C1 — Turret rest / target-lock behavior

- Classification: High+
- Risk: Medium
- Executor: Claude/Opus or Codex
- Goal: turret rests parallel to body without valid target; attack target makes turret track enemy; move-only/stop/target loss clears lock and returns turret to rest.
- Likely files: `src/phaser/input/BlockoutVehicleInputController.ts`, `src/state/combatTargeting.ts`, `src/state/blockoutAi.ts`, `src/state/blockoutVehicleState.ts`.
- Do not touch: weapon fire coordinator, combat hit model, damage, economy, renderer unless absolutely necessary, assets.
- Do not include in `EXPERIMENT-OPUS-B1B2-01`.

### C2 — Arena body/weapon inspection controls

- Classification: High
- Risk: Medium
- Executor: Claude/Opus or Codex
- Goal: Arena/devtools-only UI controls to cycle selected unit body/weapon and reset pose/direction.
- Likely files: `src/phaser/ui/ArenaMenu.ts`, possible Arena unit composer/dev state helpers.
- Do not touch: renderer calibration, combat logic, movement, assets.
- Do not include in `EXPERIMENT-OPUS-B1B2-01`.

---

## Strong-model experiment gates

For `EXPERIMENT-OPUS-B1B2-01`, the executor must follow these internal checkpoints:

1. Diagnose B1 first.
2. Fix B1 placement center alignment first.
3. Stop if B1 causes Wasp placement regression.
4. Continue to B2 only after the coordinate baseline is coherent.
5. Stop and recommend split if the diff becomes too broad.
6. Do not implement C1/C2.

Hard boundaries:

```text
- no C1 turret rest / target-lock behavior
- no combat damage / hit model / weapon fire behavior
- no movement / pathfinding / occupancy rewrites
- no economy / save-load / bot / strategic AI
- no generated hull PNG edits
- no full hull/turret matrix preload
- no broad map generation changes
- no new gameplay features outside the accepted fix backlog
```

---

## Validation baseline

Every implementation PR in this sequence must run:

- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run qa:smoke`

If any command cannot run, the PR body must state why.

Visual/runtime PRs additionally require:

- preview URL;
- manual QA notes or screenshots where possible;
- GPT PR review;
- Denis visual acceptance before merge.

---

## Manual QA policy

Manual QA acceptance must use real menu flows:

- Standard
- Debug / Отладка
- Arena / Арена

Query flags may still be used for automation/smoke/dev shortcuts, but not as final manual acceptance evidence.

For placement and visual calibration, use Sand Classic as the main calibration map while it remains sufficient.

---

## Recommended next task

Current docs task:

```text
DOCS-STRONG-MODEL-EXPERIMENTS-01 — Record strong-model experiment policy
```

After that docs PR is merged, next implementation task:

```text
EXPERIMENT-OPUS-B1B2-01 — Arena placement center alignment + body/weapon visual calibration
```

Recommended primary executor:

```text
Claude/Opus 4.8
```

Alternative executor:

```text
Codex GPT-5.5
```

GLM role:

```text
patch apply / validation / PR delivery only if needed
```
