# PROJECT_STATE.md

Status: active operational project state  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Updated: 2026-06-21

---

## Current mode

```text
VISUAL ROADMAP — AoE4-INSPIRED UX REDESIGN MODE.

Renderer unification Stage 1-4 is closed.
PR #304 Arena visual/combat fix is merged and accepted by Denis manual QA.
PRs #308-#310 (HUD core, command panel, minimap) are merged as technical prototypes.
PR #311 (AoE4 UX redesign roadmap) is merged — direction accepted.
PR #312 (HUD layout rebuild) is merged — bottom HUD rebuilt.
Denis rejected the current HUD/command panel/minimap direction visually and UX-wise.
Direction changed: AoE4-inspired RTS UX redesign replaces the "continue integrating existing HUD" plan.
Current operational task: MINIMAP-INTERACTION-04-VERYHIGHPLUS (click-to-camera, drag-to-pan, selected marker highlight, input isolation — DRAFT PR, pending GPT review + Denis manual QA).
Previous completed task: COMMAND-CARD-REBUILD-03-VERYHIGHPLUS (4×3 grid + grid hotkeys, MERGED via PR #313).
Number keys 1–9 are reserved for future control groups.
S=Stop, F=Factory, R=Element Storage, HOME=Camera Reset (per #313).
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
AoE4-inspired UX redesign roadmap (accepted)
+
PRs #308-#310 are technical prototypes, not final accepted UX
+
PR #312 HUD layout rebuild accepted
+
COMMAND-CARD-REBUILD-03 merged via PR #313 (S=Stop, F=Factory, R=Storage, HOME=Reset)
+
MINIMAP-INTERACTION-04 in progress (click-to-camera, drag-to-pan, selected highlight)
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
docs/project/VISUAL_AOE4_UX_REDESIGN_ROADMAP_2026_06_20.md
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
7. [DONE] VISUAL-HUD-AUDIT (PR #307) — HUD audit/design document.
8. [DONE] VISUAL-HUD-CORE-01-HIGHPLUS (PR #308) — Bottom HUD core prototype.
9. [DONE] VISUAL-COMMAND-PANEL-02-HIGHPLUS (PR #309) — Command panel MVP prototype.
10. [DONE] VISUAL-MINIMAP-03-VERYHIGH (PR #310) — Minimap MVP prototype.
11. [DONE] VISUAL-AOE4-UX-REDESIGN-ROADMAP-01 — AoE4-inspired UX redesign roadmap (merged).
12. [DONE] HUD-LAYOUT-REBUILD-02-VERYHIGHPLUS — Bottom HUD rebuild (merged PR #312).
13. [DONE] COMMAND-CARD-REBUILD-03-VERYHIGHPLUS — 4×3 command card grid + grid hotkeys (merged PR #313).
14. [ACTIVE NEXT] MINIMAP-INTERACTION-04-VERYHIGHPLUS — minimap camera interaction (DRAFT PR, pending GPT review + Denis manual QA).
```

---

## Next implementation direction

The selected direction is AoE4-inspired UX redesign for the HUD.

Denis rejected the current HUD/command panel/minimap direction (PRs #308-#310).
Those PRs are treated as technical prototypes, not final UX.

The current step is MINIMAP-INTERACTION-04:

```text
MINIMAP-INTERACTION-04-VERYHIGHPLUS
  Type: implementation PR (DRAFT).
  Status: pending GPT review + Denis manual QA.
  Branch: visual/minimap-interaction-04
  Features: click-to-camera, drag-to-pan, selected marker highlight, input isolation.
  Deferred: fog, enemy markers, control groups.
```

Previous step (still awaiting acceptance):

```text
VISUAL-AOE4-UX-REDESIGN-ROADMAP-01
  Type: docs/design PR.
  Status: awaiting Denis acceptance.
  Deliverable: docs/project/VISUAL_AOE4_UX_REDESIGN_ROADMAP_2026_06_20.md
```

After roadmap acceptance, implementation sequence:

```text
1. VISUAL-AOE4-UX-REDESIGN-ROADMAP-01 — docs/design (current)
2. HUD-LAYOUT-REBUILD-02-VERYHIGHPLUS — restructure bottom bar layout
3. COMMAND-CARD-REBUILD-03-VERYHIGHPLUS — 4x3 grid + grid hotkeys
4. MINIMAP-INTERACTION-04-VERYHIGHPLUS — click-to-camera + larger minimap
5. SELECTION-CONTROL-GROUPS-05-VERYHIGHPLUS — multi-select + Ctrl+1..9
6. FEEDBACK-ALERTS-06-HIGHPLUS — toast lane + idle worker + alerts
7. FOG-VISION-AUDIT-07-HIGHPLUS-DOCS — fog audit (can parallel with 2-6)
8. FOG-VISION-IMPLEMENTATION-08-VERYHIGHPLUS — fog system (after audit)
```

Other future Visual Roadmap slices (not HUD-focused):

```text
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
- task turns Codex from read-only local auditor into executor without explicit approval;
- task continues polishing the current HUD (#308-#310) as final until redesign spec is accepted;
- task implements HUD integration cleanup (VISUAL-HUD-INTEGRATION-04 is cancelled);
- task copies AoE4 assets or exact layout;
- task implements minimap interaction beyond MINIMAP-INTERACTION-04 scope (fog, enemy markers, control groups);
- task mixes control groups with current 1/2/3 build hotkeys without resolving the conflict;
- task merges High+ visual PRs without Denis manual visual approval.
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
