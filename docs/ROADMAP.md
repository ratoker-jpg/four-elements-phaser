# ROADMAP — Four Elements Phaser

## Current phase

Clean Phaser-first restart.

The old repository `ratoker-jpg/four-elements-next` is frozen as donor/reference/specification. This repository is the new implementation path.

## Strategic rule

Civil loop first. Combat later.

If the civil loop is boring after PR5, do not add combat. Fix the civil loop.

## PR1–PR5 vertical slice

### PR1 — Skeleton + terrain + camera + static entities

Goal:

- clean Vite + TypeScript + Phaser 4 project;
- approved sand terrain visual from day one;
- 48x48 isometric map or visible terrain patch;
- HQ visible;
- resources visible;
- one harvester visible;
- camera pan/zoom;
- basic HTML HUD placeholder.

Forbidden:

- economy;
- harvesting logic;
- construction;
- combat;
- editor;
- save/load;
- old code;
- Canvas;
- bridge;
- flat-color terrain placeholder.

### PR2 — Clean state model + map/entity model

Goal:

- pure GameState;
- map model;
- entity model;
- deterministic static map seed;
- render sync from state to Phaser objects.

Acceptance:

- state can exist without Phaser;
- render objects mirror state;
- GameScene remains orchestration-only.

### PR3 — Harvester movement + gather/deliver loop

Goal:

- harvester moves;
- gathers resource;
- returns to HQ;
- resource counter updates;
- basic pathing sufficient for first loop.

Acceptance:

- user can observe at least one complete gather/deliver cycle;
- state changes are testable;
- movement does not live only in sprite state.

### PR4 — Construction MVP + simple build UI

Goal:

- one building type;
- spend resource;
- construction site;
- build progress;
- completed building.

Acceptance:

- one building can be constructed end-to-end;
- cost is applied;
- building is grounded and aligned;
- no combat or advanced systems added.

### PR5 — Feel/VFX + starter balance

Goal:

- dust;
- inertia;
- gather/deliver pulse;
- construction feedback;
- starter map balance;
- civil loop should feel alive.

Acceptance:

- visual feedback is subtle and useful;
- no idle bobbing;
- no noisy particles;
- loop is understandable and not dead-looking.

## After PR5 decision gate

After PR5, play manually for 15–30 minutes.

Choose one:

- continue civil loop tuning;
- add save/load;
- add territory;
- add production;
- add combat readiness;
- stop and redesign if the loop is not fun.

## Later blocks, not before PR5

- Save/load MVP.
- Map generation expansion.
- Territory system.
- Unit production.
- Combat readiness.
- Enemy AI.
- Editor.
- Advanced UI.
- Performance benchmarking.

## Roadmap rules

- One stage can be one PR or several PRs depending on complexity.
- Combine only if scope is small, reviewable, and rollback is simple.
- Split when a PR touches multiple subsystems or creates a design decision.
- Do not add hidden architecture in implementation PRs.
- After two failed attempts at the same problem, stop and change approach.
