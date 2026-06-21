# PROJECT_STATE.md

Status: active operational project state  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Updated: 2026-06-22

---

## Current mode

```text
RTS FOUNDATION ROADMAP — Phase 1 (Validation Baseline / Red Gates) ACTIVE.

PR #322 merged. FINAL_RTS_FOUNDATION roadmap accepted as source-of-truth direction.
Phase 0 (Roadmap/Audit) is CLOSED.
Phase 1 (Validation Baseline / Red Gates) is ACTIVE.
Phase 2+ implementation is BLOCKED until Phase 1 is green or explicitly accepted by Denis/GPT.

Previous completed cycle: AOE4-UX-POLISH-PASS-09-HIGHPLUS (MERGED via PR #319).
Previous completed docs cycle: FINAL-RTS-FOUNDATION-ROADMAP-AUDIT-01 (MERGED via PR #322).

Number keys 1-9 are control group recall keys.
Ctrl+1-9 assigns control groups.
S=Stop, F=Factory, R=Element Storage, HOME=Camera Reset.
```

Current direction:

```text
FINAL_RTS_FOUNDATION roadmap — Phase 1 active
+
Graphify-first AI workflow
+
source-of-truth docs aligned to accepted roadmap
+
accepted modular vehicle runtime / unified vehicle renderer baseline
+
accepted RenderManager / GameScene orchestration baseline
+
accepted Arena visual/combat fix baseline
+
closed AoE4-inspired RTS UX redesign slice
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
AOE4-inspired UX redesign slice: CLOSED after PR #319.
FINAL-RTS-FOUNDATION-ROADMAP-AUDIT-01: MERGED via PR #322.
```

Do not continue closed roadmaps by inertia.

---

## Known red gates (Phase 1)

The following validation failures are known and must be resolved or explicitly accepted before Phase 2:

```text
1. npm test — 28 failing tests across 4 files:
   - blockoutDamage.test.ts: 19 failures (hit detection, damage application, continuous fire)
   - blockoutObstacles.test.ts: 2 failures (damage with obstacles)
   - commandRegistry.test.ts: 6 failures (legacy alias count mismatch — expects 16, gets 13)
   - coreEconomyLoop.test.ts: 1 failure (legacy storage alias keys undefined)

2. qa:smoke — fails: ENOSPC in this environment (public/assets 4.7G fills disk).
   Windows spawn('npx') ENOENT issue is documented but not testable in Linux CI.

3. npm audit — 1 high-severity Vite advisory (<=6.4.2, Windows fs deny bypass / launch-editor).
   Fix available via npm audit fix. Requires maintenance PR.

4. command alias contract — commandRegistry source registers 13 MVP commands,
   but tests expect 16 (11 primary + 5 legacy aliases).
   Legacy storage build aliases (build-raw-storage-legacy, build-matter-storage-legacy,
   build-element-storage-legacy) appear to have been removed from source but not from tests.
   Decision needed: restore aliases in source or update tests.

5. combat hit-model failures — 19/28 test failures are in blockoutDamage.
   Hit detection (findDirectHitTarget, findSplashTargets, findPenetrationTargets,
   findConeTargets, findBeamTargets, findShotgunTargets, findRicochetTargets)
   returns null/empty when tests expect hits.
   Continuous damage (tickContinuousDamage) also fails.
   These are pre-existing and predated AoE4 UX work.
```

Phase 1 red gate rule: **No Phase 2+ implementation PR may be opened until Phase 1 is closed via P1F, green, or explicitly accepted by Denis/GPT as known baseline.**

---

## Current source-of-truth docs

Read before project work:

```text
AGENTS.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/FINAL_RTS_FOUNDATION_ROADMAP_2026_06_22.md
docs/project/FINAL_RTS_FOUNDATION_IMPLEMENTATION_AUDIT_2026_06_22.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
docs/project/GLM_EXECUTOR_RULES.md
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
- AoE4-inspired RTS UX layer closed after PR #319:
  - bottom RTS HUD;
  - 4x3 command card;
  - minimap click/drag;
  - multi-select and control groups;
  - typed feedback/status/minimap pings;
  - fog of war and vision;
  - final UX polish;
- RTS Foundation roadmap accepted after PR #322;
- known follow-up #305: Smoky muzzle origin on Wasp hull only;
- 28 pre-existing test failures in blockoutDamage, blockoutObstacles, commandRegistry, coreEconomyLoop;
- Vite <=6.4.2 high-severity advisory pending maintenance PR.
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
1.  [DONE] VEHICLE-RENDER-UNIFY-AUDIT (PR #297) — 4-stage roadmap accepted.
2.  [DONE] VEHICLE-RENDER-UNIFY-01-VH (PR #298) — Stage 1 + Stage 2 merged.
3.  [DONE] VEHICLE-RENDER-UNIFY-03-VH (PR #300) — Stage 3 legacy renderer retirement.
4.  [DONE] VEHICLE-RENDER-UNIFY-04-VH (PR #302) — Stage 4 GameScene render orchestration cleanup.
5.  [DONE] ARENA-VISUAL-COMBAT-FIX-01-HIGH (PR #304) — Arena visual/combat fix accepted.
6.  [OPEN FOLLOW-UP] #305 — Smoky muzzle origin on Wasp hull only.
7.  [DONE] VISUAL-HUD-AUDIT (PR #307) — HUD audit/design document.
8.  [DONE] VISUAL-HUD-CORE-01-HIGHPLUS (PR #308) — Bottom HUD core prototype.
9.  [DONE] VISUAL-COMMAND-PANEL-02-HIGHPLUS (PR #309) — Command panel MVP prototype.
10. [DONE] VISUAL-MINIMAP-03-VERYHIGH (PR #310) — Minimap MVP prototype.
11. [DONE] VISUAL-AOE4-UX-REDESIGN-ROADMAP-01 — AoE4-inspired UX redesign roadmap (merged).
12. [DONE] HUD-LAYOUT-REBUILD-02-VERYHIGHPLUS — Bottom HUD rebuild (merged PR #312).
13. [DONE] COMMAND-CARD-REBUILD-03-VERYHIGHPLUS — 4x3 command card grid + grid hotkeys (merged PR #313).
14. [DONE] MINIMAP-INTERACTION-04-VERYHIGHPLUS — minimap camera interaction (merged PR #314).
15. [DONE] SELECTION-CONTROL-GROUPS-05-VERYHIGHPLUS — multi-select, drag-box, control groups (merged PR #315).
16. [DONE] FEEDBACK-ALERTS-06-HIGHPLUS — typed feedback, command errors, idle worker, minimap pings (merged PR #316).
17. [DONE] FOG-VISION-AUDIT-07-HIGHPLUS-DOCS — fog of war design audit (merged PR #317).
18. [DONE] FOG-VISION-IMPLEMENTATION-08-VERYHIGHPLUS — fog of war implementation (merged PR #318).
19. [DONE] AOE4-UX-POLISH-PASS-09-HIGHPLUS — final AoE4-inspired RTS UX polish (merged PR #319).
20. [DONE] FINAL-RTS-FOUNDATION-ROADMAP-AUDIT-01 — RTS Foundation roadmap + audit docs (merged PR #322).
21. [ACTIVE] RTS-FND-P1A — Phase 1 source-of-truth docs + validation baseline status.
22. [PENDING] P1B — command alias contract alignment.
23. [PENDING] P1C — qa:smoke Windows-safe launcher.
24. [PENDING] P1D — combat hit-model failures.
25. [PENDING] P1E — Vite advisory maintenance PR.
26. [PENDING] P1F — Phase 1 closure.
```

---

## RTS Foundation roadmap reference

```text
Source: docs/project/FINAL_RTS_FOUNDATION_ROADMAP_2026_06_22.md
Audit: docs/project/FINAL_RTS_FOUNDATION_IMPLEMENTATION_AUDIT_2026_06_22.md
Status: accepted (PR #322 merged)
Phases: 0-14
Active: Phase 1 — Validation Baseline / Red Gates
Blocked: Phase 2+ until Phase 1 green or Denis acceptance
```

---

## Stop rules

Do not start Phase 2+ implementation if:

```text
- Phase 1 is not green or explicitly accepted by Denis;
- there is no accepted audit/design for the selected roadmap step;
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
- task touches combat, movement, economy, mapgen, pathfinding, save-load during unrelated roadmap work;
- task asks Denis to do local repo context work that can run in GitHub;
- task turns Codex from read-only local auditor into executor without explicit approval;
- task copies AoE4 assets or exact layout;
- task reassigns 1-9 away from control groups;
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
