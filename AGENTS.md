# AGENTS.md — Four Elements Phaser

## Project identity

This is a clean Phaser-first restart of Four Elements: browser-playable isometric RTS / civil sandbox.

The old repository `ratoker-jpg/four-elements-next` is donor/reference/specification only.

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

## Primary goal

Build the civil loop first:

1. real approved sand terrain;
2. HQ/resources/harvester visible;
3. camera pan/zoom;
4. harvester movement;
5. gather/deliver loop;
6. resource counter;
7. one constructible building;
8. basic VFX/feel.

Combat, editor, save/load, enemy AI, factions and advanced systems are blocked until the civil loop is playable and feels good.

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
3. Each stage → narrow audit/plan if non-trivial.
4. Implementation only after explicit approval: “Делай”.
5. One stage may be one PR or several PRs depending on complexity.
6. If scope expands, stop and report.
7. After two failed attempts, stop and change approach.

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
- no broad “while here” changes;
- no combat/editor/save-load before approved stage;
- no placeholder terrain replacing approved asset visuals.

## Stop conditions

Stop immediately if:

- old TypeScript code is copied;
- GameScene starts owning economy/pathfinding/construction rules;
- a bridge/fallback renderer appears;
- PR becomes too large to review in one pass;
- terrain is flat-color placeholder instead of approved sand assets;
- Phaser API confusion repeats;
- agent says “we will clean it later”; 
- civil loop is not fun/readable by PR5.
