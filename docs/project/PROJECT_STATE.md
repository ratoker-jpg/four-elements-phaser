# PROJECT_STATE.md

Status: active operational project state  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Updated: 2026-06-20

---

## Current mode

```text
VISUAL ROADMAP — AUDIT/DESIGN MODE.

Renderer unification Stage 1-4 is closed.
PR #304 Arena visual/combat fix is merged and accepted by Denis manual QA with one known follow-up.
Issue #305 tracks the known Wasp+Smoky muzzle-origin follow-up.
The current selected direction is Visual Roadmap.
The next operational task is VISUAL-AUDIT-01 / VISUAL-HUD-AUDIT as docs/design only.
No HUD/runtime implementation starts automatically.
```

Current direction:

```text
Graphify-first AI workflow
+
source-of-truth docs cleanup
+
accepted modular vehicle runtime / unified vehicle renderer baseline
+
accepted RenderManager / GameScene orchestration baseline
+
accepted Arena visual/combat fix baseline
+
Visual Roadmap audit/design next
```

Closed / accepted cycles:

```text
BLOCKOUT-MVP roadmap slice: CLOSED.
CAMERA-00 projection contract: IMPLEMENTED / ACCEPTED.
PROJECTION-01 ground-plane retrofit: IMPLEMENTED / ACCEPTED.
Arena Sandbox roadmap/audit cycle: CLOSED after PR #184.
Core Mechanics roadmap/audit cycle: CLOSED after PR #207.
MODULAR-RUNTIME-04A baseline: MERGED via PR #295.
VEHICLE-RENDER-UNIFY audit/roadmap: MERGED via PR #297.
VEHICLE-RENDER-UNIFY Stage 1+2: MERGED via PR #298 and accepted by Denis manual QA.
VEHICLE-RENDER-UNIFY Stage 3: MERGED via PR #300 and accepted by Denis manual QA.
VEHICLE-RENDER-UNIFY Stage 4: MERGED via PR #302 and accepted by Denis manual QA.
ARENA-VISUAL-COMBAT-FIX-01: MERGED via PR #304 and accepted by Denis manual QA with known #305 follow-up.
```

Do not continue closed roadmaps by inertia.

---

## Current source-of-truth docs

Read before project work:

```text
AGENTS.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/AI_ORCHESTRATION_RULES_2026_06_14.md
docs/project/AI_GRAPHIFY_WORKFLOW.md
docs/project/VISUAL_ROADMAP.md
docs/project/VISUAL_SYSTEM_AUDIT.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
docs/project/VISUAL_ROADMAP_ACTIVATION_2026_06_20.md
```

Render/vehicle baseline references:

```text
docs/project/VEHICLE_RENDER_UNIFICATION_AUDIT_2026_06_16.md
docs/project/VEHICLE_RENDER_UNIFICATION_ROADMAP_2026_06_16.md
docs/project/VEHICLE_RENDER_UNIFY_03_VH_IMPLEMENTATION_REPORT_2026_06_17.md
docs/project/VEHICLE_RENDER_UNIFY_04_VH_IMPLEMENTATION_REPORT_2026_06_18.md
```

Agent-specific docs:

```text
GPT:   docs/project/GPT_PROJECT_LEAD_INSTRUCTIONS.md
GLM:   docs/project/GLM_EXECUTOR_RULES.md
Opus:  docs/project/OPUS_ARCHITECT_AUDIT_RULES.md
Codex: docs/project/CODEX_LOCAL_AUDITOR_RULES.md
```

Closed docs are references only, not active queues.

---

## Current Phaser version

```text
4.1.0
```

Always confirm this in `package.json` before Phaser API work.

---

## Current owner-facing state

The project currently has:

```text
- standalone Arena mode;
- ArenaMenu as primary Arena UX;
- manual Arena unit creation: body + weapon + team;
- projected click placement through CAMERA_PROJECTION_CONTRACT.md;
- target-lock turret behavior in Arena;
- accepted weapon runtime mechanics for 10 weapons, excluding Shaft;
- body armor/damage reduction and body/weapon M0-M3 runtime scaling;
- industrial generated map as default for new games;
- core economy/building/movement/combat baseline from closed Core Mechanics work;
- modular PNG vehicle renderer enabled in normal runtime and Arena/devtools;
- canonical faction resolver with no silent cyan fallback in live render path;
- sticky no-flicker behavior after successful modular render;
- default debug render artifacts OFF;
- legacy pilot Wasp/Smoky preload removed;
- old Wasp M0 no longer forced as default/preloaded visual;
- modular vehicle assets load on-demand through requestModularVehicleSet();
- loadArenaVisualAssets() no longer preloads modular vehicle sets;
- neutral loading placeholder exists for first-load fallback;
- RenderManager owns renderer construction, phased sync, visual bridge callbacks, and destroy;
- GameScene keeps scene lifecycle, gameplay state, UI/menu callbacks, input, camera, placement, save/load;
- Arena visual/combat baseline accepted after PR #304;
- known follow-up #305: Smoky muzzle origin on Wasp hull only.
```

---

## Current asset-runtime direction

Accepted model:

```text
hull sprite separately
+
turret sprite separately
+
socket/pivot/muzzle metadata where available
+
canonical live adapter path
+
on-demand modular asset loading
+
RenderManager-owned render orchestration
```

Rejected model:

```text
combined hull x turret production matrix
old pilot Wasp/Smoky preload as default visual source
old offset tuner / per-dir production offset tables
full modular matrix preload
```

Important current renderer decision:

```text
modular PNG is the default visual path when assets are available.
fallback is emergency/loading only, not a normal production render path.
loadArenaVisualAssets() does not preload vehicle sets.
requestModularVehicleSet() owns on-demand loading and starts Phaser loader when needed.
RenderManager owns renderer construction, phased sync, and cleanup.
GameScene no longer directly owns most renderer fields.
```

---

## Active next work

```text
1. [DONE] VEHICLE-RENDER-UNIFY-AUDIT (PR #297) — 4-stage roadmap accepted.
2. [DONE] VEHICLE-RENDER-UNIFY-01-VH (PR #298) — Stage 1 + Stage 2 merged.
3. [DONE] VEHICLE-RENDER-UNIFY-03-VH (PR #300) — Stage 3 legacy renderer retirement.
4. [DONE] VEHICLE-RENDER-UNIFY-04-VH (PR #302) — Stage 4 GameScene render orchestration cleanup.
5. [DONE] ARENA-VISUAL-COMBAT-FIX-01-HIGH (PR #304) — Arena visual/combat fix accepted.
6. [OPEN FOLLOW-UP] #305 — Smoky muzzle origin on Wasp hull only.
7. [ACTIVE NEXT] VISUAL-AUDIT-01 / VISUAL-HUD-AUDIT — docs/design only.
```

---

## Next implementation direction

There is no automatic implementation task after #304.

The selected direction is Visual Roadmap, but the first step is audit/design:

```text
VISUAL-HUD-AUDIT
  Type: docs/design.
  Runtime implementation: blocked until audit accepted.
  Denis visual approval: required before HUD runtime PR.
```

Candidate future Visual Roadmap slices after HUD audit:

```text
- HUD shell implementation;
- minimap implementation;
- selected-unit/building info panel;
- command/action/hotkey panel;
- terrain/industrial map visual pass;
- resource field visual refresh;
- main menu visual refresh;
- civil unit/building visual cleanup.
```

---

## Stop rules

Do not start implementation if:

```text
- there is no accepted audit/design for the selected Visual Roadmap slice;
- the task continues a closed roadmap by inertia;
- docs contradict current repo state;
- visual/world-space work ignores CAMERA_PROJECTION_CONTRACT.md;
- task proposes combined hull x turret production matrix;
- task proposes preloading all modular assets at startup;
- task restores old Wasp M0 preload / pilotVehicleLazyLoad / pilot turret preload;
- task restores pilotTurretComposition;
- task reintroduces offset tuner tables or ENABLE_PILOT_GENERATED_TURRET_COMPOSITION;
- task rewrites RenderManager/GameScene lifecycle without a concrete bug or accepted audit;
- task adds new URL debug/test modes instead of using Arena/debug UI;
- task touches combat, movement, economy, mapgen, pathfinding, save-load, bot/AI during Visual Roadmap work;
- task asks Denis to do local repo context work that can run in GitHub;
- task turns Codex from read-only local auditor into executor without explicit approval.
```

---

## Working model

```text
GPT: project lead / reviewer / merge gate.
GLM: executor for scoped implementation/docs work.
Opus: architecture / high-risk implementation when explicitly assigned.
Codex: local read-only auditor unless explicitly approved as executor.
Denis: product owner / visual acceptance gate.
```
