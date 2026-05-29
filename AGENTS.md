# AGENTS.md — Four Elements Phaser

## Project identity

This is a clean Phaser-first restart of Four Elements: browser-playable isometric RTS / civil sandbox.

The old repository `ratoker-jpg/four-elements-next` is donor/reference/specification only.

## Active direction

VISUAL roadmap is the active planning direction.

```text
Active source-of-truth docs:
  docs/project/VISUAL_ROADMAP.md — accepted visual planning direction
  docs/project/VISUAL_SYSTEM_AUDIT.md — accepted visual audit with staged PR sequence
  docs/project/PROJECT_STATE.md — current operational state
  docs/project/CURRENT_NEXT_STEP.md — current next step
  docs/project/GPT_WORKFLOW.md — GPT planner/reviewer workflow
  docs/project/GLM_EXECUTOR_RULES.md — GLM executor rules
```

Current next step: VISUAL-01 — Industrial map visual candidate workflow

Do not follow PHASE_2_ROADMAP.md or PHASE_2_ROADMAP_AUDIT.md as active direction. They are archived.

## Current roadmap model

```text
roadmap first → huge roadmap audit second → implementation after audit
```

Implementation can use high+/medium/low scoped steps directly if covered by the accepted audit (`VISUAL_SYSTEM_AUDIT.md`). Do not require a new mini-audit for every step that is already covered by the accepted audit.

If a task expands scope, touches gameplay/pathfinding/economy unexpectedly, or combines multiple phases, stop and request approval.

## Non-negotiable decisions

- Engine: Phaser 4.
- Repository: new clean repository.
- Copy policy: approved assets only.
- Old TypeScript/runtime/systems/renderers/tests: reference only, not implementation.
- No Canvas renderer.
- No renderer bridge.
- No `WorldRenderSnapshot`.
- No legacy `GameWorld`.
- No dual renderer.
- No temporary architecture that is expected to be cleaned later.
- No Rex runtime dependencies in PR1–PR5 without separate mini-audit.

## Explicitly obsolete

The following are no longer active direction:

```text
- Phase 2 roadmap as active direction (superseded by VISUAL_ROADMAP.md)
- Sand terrain as primary visual direction (paused/rejected)
- MAPLIFE #120 continuation (desert decor rejected)
- MAPLIFE desert decor direction
- Mass asset generation directly into repo without visual approval
- Fixing bad art by code-only patches
- Four-biome system now
- Copying StarCraft assets/UI exactly
```

## Primary goal

Build one strong primary biome first: industrial RTS battlefield / mining platform / industrial mineral wasteland.

The civil economy loop is already functional. The current focus is bringing the visual presentation to a real RTS quality bar.

Key visual decisions:

```text
- One strong primary biome first (industrial), not four biomes
- Industrial platform / mining battlefield direction
- Map must feel grounded on a surface, not floating
- Playable edges should eventually feel irregular/organic, not a perfect board
- HQ/start zone should move to lower-left later (VISUAL-05)
- HUD target: bottom-left minimap, bottom-center selected info, bottom-right commands/production/hotkeys
- Old successful main menu composition should be preserved, but background/theme updated
- Harvester and Builder visuals will be refreshed later (VISUAL-11/12)
- Tank/Wasp combat 3D asset direction should not be restyled by default
```

Combat, editor, save/load, enemy AI, factions and advanced systems are blocked until the civil loop is playable and feels good.

## Active VISUAL implementation sequence

```text
VISUAL-01 — Industrial map visual candidate workflow
VISUAL-02 — Map rendering prototype spike
VISUAL-03 — Industrial terrain/platform integration
VISUAL-04 — Map frame / grounded presentation
VISUAL-05 — Lower-left start composition
VISUAL-06 — Resource field visual model design
VISUAL-07 — HUD layout design doc
VISUAL-08 — HUD shell implementation
VISUAL-09 — Command panel/hotkey visual pass
VISUAL-10 — Main menu visual refresh
VISUAL-11 — Harvester/builder visual workflow design
VISUAL-12 — Approved unit visual integration
```

## Architecture rules

- Phaser Scene owns lifecycle and rendering only.
- Game state is pure TypeScript where practical.
- Systems are pure TypeScript where practical.
- Input creates commands.
- UI reads state and sends commands.
- VFX is render-only and event/event-state driven.
- Game rules must be testable without Phaser where practical.
- GameScene must remain orchestration-only.

## Old repo usage

Allowed from `four-elements-next`:

- approved assets after user approval;
- visual targets;
- gameplay requirements;
- known mistakes;
- docs/roadmap as reference;
- old tests as scenario examples only.

Forbidden to copy as implementation:

- old Canvas renderer;
- old Phaser adapter/bridge;
- old GameWorld;
- old systems implementation;
- old pathfinding implementation;
- old E2E tests;
- old devtools/editor implementation;
- old migration scaffolding;
- renderer feature flags.

## Phaser official skills

Official Phaser skills are the primary source for engine usage:
https://github.com/phaserjs/phaser/tree/master/skills

Every implementation PR must list which skills were read.

PR1 required skills:

- `game-setup-and-config`
- `scenes`
- `loading-assets`
- `sprites-and-images`
- `cameras`
- `scale-and-responsive`
- `v4-new-features`

Anti-hallucination rules:

- Verify Phaser APIs against installed Phaser 4 typings.
- Do not copy Phaser 3 examples blindly.
- Do not invent Phaser APIs.
- If an unfamiliar Phaser API is used, cite the official skill/API reference in the PR body.

## Rex Rainbow policy

Rex Rainbow notes are supplementary reference only:
https://rexrainbow.github.io/phaser3-rex-notes/docs/site/

Rules:

- No `phaser4-rex-plugins` dependency in PR1–PR5.
- No rexUI, rexBoard, rexPathFinder or plugin packs in PR1–PR5.
- Official Phaser skills and installed typings are the source of truth.
- A Rex plugin can only be considered after PR5 through a separate mini-audit.

## Development workflow

Use this flow:

1. Big strategic fork → deep audit.
2. Accepted direction → charter.
3. Each stage → narrow audit/plan if non-trivial, OR use accepted audit directly if scope is covered.
4. Implementation only after explicit approval.
5. One stage may be one PR or several PRs depending on complexity.
6. If scope expands, stop and report.
7. After two failed attempts, stop and change approach.

Review rules:

- GPT reviews PRs before merge.
- If a task is inside VISUAL_SYSTEM_AUDIT scope, do not ask for another audit.
- If a task expands scope, touches gameplay/pathfinding/economy unexpectedly, or combines multiple phases, stop and request approval.
- Runtime/assets PRs must include validation and manual QA.
- Docs-only PRs must not touch runtime/assets.

## PR rules

Every PR must include:

- goal;
- allowed files;
- forbidden files;
- Phaser skills read;
- acceptance checklist;
- validation commands/results;
- manual QA;
- rollback plan;
- out-of-scope list.

Hard review checks:

- no copied old source code;
- no Canvas/bridge/fallback;
- no hidden architecture decisions;
- no broad "while here" changes;
- no combat/editor/save-load before approved stage;
- no placeholder terrain replacing approved asset visuals;
- no mass asset generation without visual approval.

## Stop conditions

Stop immediately if:

- old TypeScript code is copied;
- GameScene starts owning economy/pathfinding/construction rules;
- a bridge/fallback renderer appears;
- PR becomes too large to review in one pass;
- terrain is flat-color placeholder instead of approved assets;
- Phaser API confusion repeats;
- agent says "we will clean it later";
- civil loop is not fun/readable by PR5.
