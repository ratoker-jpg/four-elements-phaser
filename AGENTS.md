# AGENTS.md — Four Elements Phaser

## Project identity

This is a clean Phaser-first restart of Four Elements: browser-playable isometric RTS / civil sandbox.

The active repository is:

```text
ratoker-jpg/four-elements-phaser
```

The old repository `ratoker-jpg/four-elements-next` is donor/reference/specification only.

---

## Current operational state

There is currently **no broad active implementation roadmap**.

Closed / accepted cycles:

```text
VISUAL/UI roadmap slice: CLOSED.
BLOCKOUT-MVP roadmap slice: CLOSED.
CAMERA-00 projection contract: IMPLEMENTED / ACCEPTED.
PROJECTION-01 ground-plane retrofit: IMPLEMENTED / ACCEPTED.
Arena Sandbox roadmap/audit cycle: CLOSED after PR #184.
Core Mechanics roadmap: CLOSED after PR #207.
```

Current active process:

```text
Scoped fix backlog / visual calibration process.
Use the accepted fix backlog and accepted fix backlog audit.
Next default implementation step: A2 — Debug mode map cleanup / keep Sand Classic.
```

Do not continue old VISUAL, BLOCKOUT, CAMERA, PROJECTION, ARENA, or CORE MECHANICS tasks by inertia.

---

## Active source-of-truth docs

Read these first for current work:

```text
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
docs/project/AI_EXECUTION_WORKFLOW_2026_06_12.md
docs/project/CODEMAP.md
docs/project/FIX_BACKLOG_ROADMAP_2026_06_12.md
docs/project/FIX_BACKLOG_AUDIT_2026_06_12.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
docs/project/ARENA_SANDBOX_CLOSURE_REPORT.md
```

Use `docs/project/CODEMAP.md` as the routing map for source files. Do not scan the whole repository unless CODEMAP is insufficient.

For the current bugfix direction, use `docs/project/FIX_BACKLOG_AUDIT_2026_06_12.md` as the accepted implementation order and decision record. Do not reconstruct the audit from memory.

Historical / closed roadmap docs:

```text
docs/project/VISUAL_ROADMAP.md
docs/project/VISUAL_SYSTEM_AUDIT.md
docs/project/BLOCKOUT_MVP_ROADMAP.md
docs/project/BLOCKOUT_MVP_CLOSURE_REPORT.md
docs/project/ARENA_SANDBOX_ROADMAP.md
docs/project/ARENA_SANDBOX_SYSTEM_AUDIT.md
```

Closed docs are still useful as references, but they are not active implementation queues unless Denis explicitly reopens them.

---

## Current roadmap model

```text
roadmap/backlog first -> audit/design second -> implementation after accepted audit
```

Implementation steps should be scoped High+/High unless Denis explicitly approves a smaller docs-only or fixup step.

No code PR should start without:

```text
1. owner-approved direction
2. roadmap/backlog or scoped plan
3. accepted audit/design when architecture/gameplay/runtime is involved
4. strict task scope
```

For the current fix backlog, the accepted sequence is:

```text
A2 — Debug mode map cleanup / keep Sand Classic
B1 — Arena placement center alignment
B2 — Arena body + weapon visual calibration
C1 — Turret rest / target-lock behavior
C2 — Arena body/weapon inspection controls
D  — Dev grid overlay deferred unless Sand Classic is insufficient
```

Dependency rule:

```text
Do not start B2 before B1 is merged and Denis visually confirms placement on Sand Classic.
```

---

## Multi-agent execution model

Use the current workflow from `docs/project/AI_EXECUTION_WORKFLOW_2026_06_12.md`:

```text
GPT = coordinator / task writer / PR reviewer
GLM = audit, patch application, validation, PR delivery, Telegram notification
Claude/Opus = strong code executor; if push is blocked, provide patch handoff
Codex = strong code executor with direct PR ability and screenshot-driven visual QA when available
Denis = final manual / visual QA and merge decision
```

Current cost discipline:

```text
Do not spend Claude/Opus or Codex limits on routine audits, docs cleanup, or PR delivery.
Use GLM for low-risk audits and patch/PR plumbing.
Reserve Claude/Opus and Codex for High+ code implementation.
```

---

## Latest Arena baseline

Arena is now a standalone combat sandbox.

It includes:

```text
- clean Arena mode with no HQ/base, harvesters, resources, economy HUD or gameplay obstacles
- ArenaMenu as primary UX
- manual body + weapon + team unit creation
- click placement using CAMERA_PROJECTION_CONTRACT.md
- ally/enemy model
- allies controllable, enemies target-only
- turret target-lock in Arena instead of mouse-follow
- roster/control panel/help/status messages
- simple enemy behavior modes: passive, stationary_shooter, chaser, hold_position
```

Do not add more Arena features by inertia.

Deferred Arena work requires a new roadmap/audit unless it is explicitly part of the accepted fix backlog:

```text
- Arena save/load setups
- JSON import/export
- attack waves
- strategic AI
- economy/base-building AI
- final combat systems
- final art
- pathfinding rewrites
- obstacle return
```

---

## Camera/projection non-negotiables

For every visual/world-space/rendering/asset task, read:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

Rules:

```text
- The camera is fixed isometric / axonometric 2.5D.
- It is not top-down.
- It is not side-view.
- Pan + zoom are allowed.
- Rotation is forbidden.
- Projection formula: screen = origin + x*basisX + y*basisY + z*basisZ.
- Ground-space markers, selection rings, shadows, ranges and footprints must be projected on the ground plane.
- Do not draw ground-space concepts as top-down screen circles.
```

Manual visual QA for the current fix backlog must use real menu flows:

```text
Standard
Debug / Отладка
Arena / Арена
```

Query flags may be used for automation/smoke/dev shortcuts, but not as final manual acceptance evidence.

---

## Non-negotiable decisions

- Engine: Phaser 4.
- Repository: `ratoker-jpg/four-elements-phaser`.
- Copy policy: approved assets only.
- Old TypeScript/runtime/systems/renderers/tests: reference only, not implementation.
- No Canvas renderer.
- No renderer bridge.
- No `WorldRenderSnapshot`.
- No legacy `GameWorld`.
- No dual renderer.
- No temporary architecture that is expected to be cleaned later.
- No Rex runtime dependencies without separate audit/approval.

---

## Explicitly obsolete as active direction

```text
- Phase 2 roadmap as active direction
- Sand terrain as primary visual direction
- MAPLIFE #120 continuation
- MAPLIFE desert decor direction
- VISUAL implementation queue as active queue
- BLOCKOUT-MVP implementation queue as active queue
- Arena Sandbox implementation queue as active queue
- Mass asset generation directly into repo without visual approval
- Fixing bad art by code-only patches
- Four-biome system now
```

Note: Sand Classic is currently kept as a calibration map for the accepted fix backlog. This does not reopen sand terrain as the primary production visual direction.

---

## Architecture rules

- Phaser Scene owns lifecycle and rendering orchestration only.
- Game state is pure TypeScript where practical.
- Systems are pure TypeScript where practical.
- Input creates commands.
- UI reads state and sends commands.
- VFX is render-only and event/event-state driven.
- Game rules must be testable without Phaser where practical.
- GameScene must remain orchestration-only.

Layer rules:

```text
State layer: pure TS, no Phaser imports, no DOM.
Render layer: reads state and renders visuals, does not own gameplay.
DOM UI: UI/HUD only, no Phaser-specific rendering logic.
```

---

## Old repo usage

Allowed from `four-elements-next` only when explicitly useful:

```text
- approved assets after user approval
- visual targets
- gameplay requirements
- known mistakes
- docs/roadmap as reference
- old tests as scenario examples only
```

Forbidden to copy as implementation:

```text
- old Canvas renderer
- old Phaser adapter/bridge
- old GameWorld
```
