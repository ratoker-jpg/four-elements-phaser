# AGENTS.md — Four Elements Phaser

Status: active root agent instructions  
Updated: 2026-07-10

---

## Project identity

```text
repo: ratoker-jpg/four-elements-phaser
engine: Phaser 4.1.0
language: TypeScript
build: Vite
renderer: Phaser-first / WebGL-only
camera: fixed isometric / axonometric 2.5D
```

The old repository `ratoker-jpg/four-elements-next` is donor/reference/specification only. Do not copy old runtime implementation by inertia.

---

## Current operating mode

<!-- PROJECT_STATUS:START -->
Updated: 2026-07-10

```text
PLAYABLE FOUR-FACTION SKIRMISH — Phase 2: Production combat runtime in Normal Game
Status: READY_FOR_IMPLEMENTATION
Last merged: PR #339 — Bounded combat destruction lifecycle
Next: Extend canonical GameState.combatUnits so factory-produced tanks can move, stop, acquire targets, attack, take damage and die in Normal Game using shared pure Arena combat systems.
Gate: Do not create a third combat-unit runtime or copy BlockoutVehicleState wholesale. Normal Game combatUnits remain canonical; Arena movement, aiming, range, hit and damage logic must be extracted or adapted as shared pure systems.
```
<!-- PROJECT_STATUS:END -->

The status block above is generated from `docs/project/project-status.json`. Do not edit it manually.

---

## Active source-of-truth documents

Read these first:

```text
AGENTS.md
docs/project/project-status.json
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/FINAL_RTS_FOUNDATION_ROADMAP_2026_06_22.md
docs/project/FINAL_RTS_FOUNDATION_IMPLEMENTATION_AUDIT_2026_06_22.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

Workflow and agent rules:

```text
docs/project/GPT_WORKFLOW.md
docs/project/AI_ORCHESTRATION_RULES_2026_06_14.md
docs/project/AI_GRAPHIFY_WORKFLOW.md
docs/project/GPT_PROJECT_LEAD_INSTRUCTIONS.md
docs/project/GLM_EXECUTOR_RULES.md
docs/project/OPUS_ARCHITECT_AUDIT_RULES.md
docs/project/CODEX_LOCAL_AUDITOR_RULES.md
```

Closed/old roadmap documents are references only, not active queues.

---

## Tool roles

```text
GPT   = project lead / task router / PR reviewer / docs keeper
GLM   = High/High+ executor after accepted audit/roadmap
Opus  = system architect / broad auditor / complex executor when justified
Codex = local/repository auditor and implementation helper when available
Denis = product owner and final visual acceptance owner
```

Do not swap roles silently. Do not claim Denis manual QA unless he actually performed it.

---

## Validation contract

Every implementation PR must pass:

```text
npm run check:project-status
npm run typecheck
npm test
npm audit --audit-level=high
npm run build
npm run check:asset-budget
npm run qa:smoke
git diff --check
final GitHub Actions status
```

If a local environment is blocked by disk space, report it honestly and use GitHub Actions as the build/smoke authority.

---

## Graphify-first rule

For broad repository reasoning, cleanup audits, architecture audits and High/High+ planning, use the GitHub Actions Graphify artifact first when available.

Do not commit `graphify-out/` by default. Do not ask Denis to repeatedly download repository context that can be generated in GitHub.

---

## Roadmap/audit model

Preferred:

```text
broad durable roadmap/audit
-> bounded implementation PR
-> automated validation
-> review
-> manual visual QA when needed
-> merge
-> generated status update
```

Avoid one tiny audit per tiny patch. Do not perform audits for ceremony.

---

## Modular vehicle constraints

Accepted production model:

```text
hull sprite separately
+
turret sprite separately
+
socket/pivot/muzzle metadata
+
on-demand loading
+
combatUnits as canonical produced-unit state
```

Rejected:

```text
combined hull × turret production matrix
full modular matrix preload
old Wasp M0 preload
manual per-PNG production offset tables
dual renderers / legacy GameWorld
```

Produced combat units must not be duplicated into independent persistent render state. Render inputs are derived from canonical game state.

---

## Camera/projection non-negotiables

For every visual, world-space, rendering or asset task, read `docs/project/CAMERA_PROJECTION_CONTRACT.md`.

```text
- fixed isometric / axonometric 2.5D camera;
- no camera rotation;
- screen = origin + x*basisX + y*basisY + z*basisZ;
- ground markers, shadows, ranges and footprints use projected ground-plane geometry;
- no top-down screen circles for world-space concepts.
```

---

## Arena/debug UX policy

Manual visual QA should use real project surfaces:

```text
Standard
Debug / Отладка
Arena / Арена
ArenaMenu
Arena inspection panels
```

Do not add a query-string mode for every visual test. Query flags are acceptable only for automation and smoke shortcuts.

---

## GitHub-first rule

Repository context, validation, graph generation, PR review and status synchronization should happen in GitHub when possible.

Local machine work is reserved for:

```text
- Blender/export work;
- local-only assets;
- manual visual QA;
- explicitly approved reproduction that cannot run in CI.
```

---

## Strict non-goals unless explicitly scoped

```text
- no Enemy AI before the dedicated roadmap;
- no hidden temporary architecture expected to be cleaned later;
- no unrelated combat/economy/mapgen/save-load changes inside visual or asset work;
- no Rex runtime dependency without separate approval;
- no Canvas fallback;
- no renderer bridge, legacy GameWorld, WorldRenderSnapshot or dual renderer;
- no full all-faction asset import by inertia;
- no reopening closed AoE4 UX work by inertia.
```

---

## Documentation hygiene

`docs/project/project-status.json` is the only editable active-status source.

After changing it:

```text
npm run sync:project-status
npm run check:project-status
```

Commit the JSON and generated documents together. CI must fail when generated status files drift.
