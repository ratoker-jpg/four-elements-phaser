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

There is currently **no active implementation roadmap**.

Closed / accepted cycles:

```text
VISUAL/UI roadmap slice: CLOSED.
BLOCKOUT-MVP roadmap slice: CLOSED.
CAMERA-00 projection contract: IMPLEMENTED / ACCEPTED.
PROJECTION-01 ground-plane retrofit: IMPLEMENTED / ACCEPTED.
Arena Sandbox roadmap/audit cycle: CLOSED after PR #184.
```

Default next action:

```text
Choose the next product direction and create a new roadmap audit before implementation.
```

Do not continue old VISUAL, BLOCKOUT, CAMERA, PROJECTION or ARENA tasks by inertia.

---

## Active source-of-truth docs

Read these first for current work:

```text
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
docs/project/ARENA_SANDBOX_CLOSURE_REPORT.md
```

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
roadmap first -> huge/system audit second -> implementation after accepted audit
```

Implementation steps should be scoped High+/High unless Denis explicitly approves a smaller docs-only or fixup step.

No code PR should start without:

```text
1. owner-approved direction
2. roadmap or scoped plan
3. accepted audit/design when architecture/gameplay/runtime is involved
4. strict task scope
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

Deferred Arena work requires a new roadmap/audit:

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
- Copying StarCraft assets/UI exactly
```

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
- old systems implementation
- old pathfinding implementation
- old E2E tests
- old devtools/editor implementation
- old migration scaffolding
- renderer feature flags
```

---

## Development workflow

Use this flow:

```text
1. Product idea / direction
2. GPT checks fit and risks
3. Roadmap or scoped plan
4. Huge/system audit when architecture/gameplay/runtime is involved
5. High+/High implementation PR sequence
6. GPT reviews PR diff, changed files and validation
7. Denis decides merge
8. Docs updated when roadmap/current state changes
```

If scope expands, stop and report.

After two failed attempts, stop and change approach.

---

## PR rules

Every runtime PR should include:

```text
- goal
- files changed
- implementation/model details
- what is intentionally not implemented
- validation commands/results
- manual QA if visual/runtime
- rollback plan if relevant
- next step
```

Docs-only PRs must state clearly:

```text
No code, assets, gameplay, runtime behavior or dependency changes.
```

Hard review checks:

```text
- no copied old source code
- no Canvas/bridge/fallback
- no hidden architecture decisions
- no broad "while here" changes
- no implementation outside accepted roadmap/audit
- no placeholder terrain replacing approved asset visuals
- no mass asset generation without visual approval
- no top-down visual assumptions after CAMERA-00
```

---

## Stop conditions

Stop immediately if:

```text
- old TypeScript code is copied
- GameScene starts owning economy/pathfinding/construction rules
- a bridge/fallback renderer appears
- PR becomes too large to review in one pass
- terrain is flat-color placeholder instead of approved assets
- Phaser API confusion repeats
- agent says "we will clean it later"
- docs/current state are stale
- the task needs a new roadmap/audit but tries to skip it
- the same approach failed twice
```
