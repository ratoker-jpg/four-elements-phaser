# PROJECT_STATE.md

Status: active operational project state  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Updated: 2026-06-18

---

## Current mode

```text
VEHICLE RENDER UNIFICATION — POST-PR #302 BASELINE.
Stage 1 + Stage 2 + Stage 3 + Stage 4 are merged and manually QA-accepted.
The current operational step is docs sync after #302.
After docs sync, vehicle render unification is closed unless Denis explicitly starts a new render-adjacent task.
```

Current direction:

```text
Graphify-first AI workflow
+
documentation/source-of-truth cleanup
+
accepted modular vehicle runtime / unified vehicle renderer baseline
+
accepted RenderManager / GameScene orchestration baseline
+
next roadmap direction to be selected explicitly by Denis
```

Closed / accepted cycles:

```text
VISUAL/UI roadmap slice: CLOSED.
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

For visual/world-space/rendering/asset work:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
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
- Stage 1 + Stage 2 + Stage 3 + Stage 4 are merged and accepted.
```

---

## Current asset-runtime direction

Accepted model:

```text
hull sprite separately
+
turret sprite separately
+
socket/pivot metadata
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
```

Reason:

```text
combined matrix explodes with independent hull/turret mods and factions.
old Wasp/Smoky preload masked canonical loader failures and is now removed.
production placement must come from canonical composition/socket data, not ad hoc tuner tables.
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
1. [DONE] Docs-only Graphify + AI governance + modular roadmap update.
2. [DONE] Opus cleanup + modular runtime system audit committed.
3. [DONE] ASSET-IMPORT-01 (PR #278) — modular cyan assets imported into repo.
4. [DONE] MODULAR-RUNTIME-04A (PR #295) — default modular + scale normalization.
5. [DONE] VEHICLE-RENDER-UNIFY-AUDIT (PR #297) — 4-stage roadmap accepted.
6. [DONE] VEHICLE-RENDER-UNIFY-01-VH (PR #298) — Stage 1 + Stage 2 merged:
   - canonical renderer foundation;
   - visual parity + placement stabilization;
   - no silent cyan fallback;
   - no flicker back to cubes after modular success;
   - debug artifacts OFF by default;
   - Arena + normal runtime parity.
7. [DONE] DOCS-SYNC-POST-298 (PR #299) — source-of-truth docs sync after #298.
8. [DONE] VEHICLE-RENDER-UNIFY-03-VH (PR #300) — Stage 3 legacy renderer retirement:
   - pilot Wasp/Smoky preload removed;
   - pilotVehicleLazyLoad deleted;
   - pilotTurretComposition deleted;
   - ModularTankDebugOverlay / offset tuner removed;
   - legacy offset tables removed;
   - canonical on-demand loader fixed;
   - manual visual QA accepted by Denis.
9. [DONE] DOCS-SYNC-POST-300 (PR #301) — source-of-truth docs sync after #300.
10. [DONE] VEHICLE-RENDER-UNIFY-04-VH (PR #302) — Stage 4 GameScene render orchestration cleanup:
    - RenderManager added;
    - renderer construction moved from GameScene;
    - phased renderer sync moved from GameScene;
    - visual bridge callbacks moved through RenderManager;
    - renderer cleanup moved to RenderManager;
    - manual visual QA accepted by Denis.
11. [ACTIVE] DOCS-SYNC-POST-302 — source-of-truth docs sync after #302.
```

---

## Next implementation direction, not yet selected

There is no automatic next implementation task after renderer unification closure.

Candidate directions Denis may choose:

```text
- post-render baseline hardening / regression checklist;
- next gameplay/product roadmap audit;
- next asset pipeline/runtime task;
- Arena UX or unit runtime improvements;
- new feature direction selected explicitly by Denis.
```

Before starting a new direction, create or read the relevant audit/roadmap and avoid continuing closed renderer-unification work by inertia.

---

## Stop rules

Do not start implementation if:

```text
- there is no accepted roadmap/audit for the requested direction;
- the task continues a closed roadmap by inertia;
- docs contradict current repo state;
- visual/world-space work ignores CAMERA_PROJECTION_CONTRACT.md;
- task asks for final modular assets without accepted cleanup/runtime plan;
- task proposes combined hull x turret production matrix;
- task proposes preloading all modular assets at startup;
- task restores old Wasp M0 preload / pilotVehicleLazyLoad / pilot turret preload;
- task restores pilotTurretComposition;
- task reintroduces offset tuner tables or ENABLE_PILOT_GENERATED_TURRET_COMPOSITION;
- task rewrites RenderManager/GameScene lifecycle without a concrete bug or accepted audit;
- task adds new URL debug/test modes instead of using Arena/debug UI;
- task changes composeModularVehicle() placement/math without explicit Denis approval;
- task blindly reuses PR #296 mount-slot / forward-back drift model;
- task touches combat, movement, economy, mapgen, pathfinding, save-load, bot/AI
  during render cleanup work;
- task asks Denis to do local repo context work that can run in GitHub;
- task turns Codex from read-only local auditor into executor without explicit approval.
```

---

## Working model

```text
GPT = project lead / router / task writer / PR reviewer
GLM = High/High+ executor after accepted audit
Opus = broad architect auditor and complex High+ executor when justified
Codex = read-only local auditor for files/assets unavailable through GitHub
Denis = product owner and merge decision maker
```
