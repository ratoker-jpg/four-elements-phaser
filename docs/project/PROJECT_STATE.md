# PROJECT_STATE.md

Status: active operational project state  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Updated: 2026-06-17

---

## Current mode

```text
VEHICLE RENDER UNIFICATION — POST-PR #298 BASELINE.
Stage 1 + Stage 2 are merged and manually QA-accepted.
The next direction is docs sync, then Stage 3/4 audit-first planning.
```

Current direction:

```text
Graphify-first AI workflow
+
documentation/source-of-truth cleanup
+
modular vehicle runtime / unified vehicle renderer
+
legacy render path retirement planning
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
- legacy render paths still present but ready for Stage 3 retirement planning.
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
```

Rejected model:

```text
combined hull x turret production matrix
```

Reason:

```text
combined matrix explodes with independent hull/turret mods and factions.
```

Important current renderer decision:

```text
modular PNG is the default visual path when assets are available.
fallback is emergency/loading only, not a normal production render path.
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
7. [ACTIVE] DOCS-SYNC-POST-298 — source-of-truth docs sync after #298 merge.
8. [NEXT] VEHICLE-RENDER-UNIFY-03-04-VH-AUDIT — audit-only decision on whether
   Stage 3 + Stage 4 can be combined into one Very High+ GLM 5.2 implementation PR.
```

---

## Next implementation direction, not yet approved

Candidate experiment:

```text
Combine Stage 3 + Stage 4 into one larger Very High+ implementation PR.
```

This is not automatically approved. It requires an audit-only PR or audit report first.

Audit must answer:

```text
- all production references to ModularTankRenderer / legacy render paths;
- whether BlockoutVehicleRenderer procedural fallback should move to legacy/ or be dev-only gated;
- whether emergency/loading fallback remains safe and explicit;
- exact GameScene render orchestration extraction plan;
- exact touched files;
- rollback plan;
- validation and manual QA plan;
- whether combined implementation is justified, or whether Stage 3 and Stage 4 must remain separate.
```

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
- task adds new URL debug/test modes instead of using Arena/debug UI;
- task changes composeModularVehicle() placement/math without explicit Denis approval;
- task blindly reuses PR #296 mount-slot / forward-back drift model;
- task touches combat, movement, economy, mapgen, pathfinding, save-load, bot/AI
  during vehicle render unification work;
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
