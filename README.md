# Four Elements Phaser

Clean Phaser-first restart of **Four Elements** — browser-playable isometric RTS / civil sandbox.

This repository intentionally starts fresh.

## Core decision

- **Engine:** Phaser 4.
- **Project strategy:** new repository.
- **Copy policy:** approved assets only.
- **Old repo:** `ratoker-jpg/four-elements-next` is donor/reference/specification only.
- **Old TypeScript code:** do not copy as implementation.
- **Renderer:** Phaser-first, no Canvas renderer, no renderer bridge, no fallback renderer.

## Goal

Build a small, clean vertical slice first:

1. real sand terrain;
2. HQ/resources/harvester visible;
3. camera pan/zoom;
4. harvester gather/deliver loop;
5. resource counter;
6. one constructible building;
7. visual feedback: dust, inertia, gather/deliver/construction pulses.

Combat, editor, save/load, enemy AI and advanced economy are intentionally out of scope until the civil loop is playable and feels good.

## Required reading before implementation

- `AGENTS.md`
- `docs/PROJECT_CHARTER.md`
- `docs/ROADMAP.md`
- `docs/AI_WORKFLOW.md`
- `docs/ASSET_POLICY.md`
- `docs/PR1_TASK.md`

## Development rule

No implementation PR starts without a narrow task contract, acceptance checklist, validation plan, manual QA steps and rollback plan.
