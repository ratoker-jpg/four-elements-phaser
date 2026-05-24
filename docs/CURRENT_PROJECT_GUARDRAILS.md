# Current Project Guardrails — Four Elements Phaser

Date: 2026-05-25
Status: active working rules after restart audits and modular Wasp/Smoky visual spike

## 1. Purpose

This document compresses the long restart and follow-up audits into a short operational guide for day-to-day work.

Use this file to decide the next PR scope, what to freeze, what to reject, and what must be checked before implementation.

This is not a replacement for:

- `AGENTS.md`
- `docs/PROJECT_CHARTER.md`
- `docs/ROADMAP.md`
- `docs/AI_WORKFLOW.md`
- `docs/ASSET_POLICY.md`

It is the current practical guardrail layer on top of those documents.

---

## 2. Current project position

The active project is the Phaser-first restart:

```text
Repository: ratoker-jpg/four-elements-phaser
Engine: Phaser 4
Renderer: WebGL-only
Old repository: ratoker-jpg/four-elements-next
Old repo role: donor / reference / specification only
```

The old repo is not an implementation source.

Allowed from old repo:

- approved assets;
- design rules;
- numeric balance references;
- algorithms as specification;
- useful documentation;
- test ideas.

Forbidden from old repo:

- copying TypeScript implementation;
- Canvas renderer;
- renderer bridge;
- legacy `GameWorld`;
- `WorldRenderSnapshot`;
- dual renderer architecture;
- old feature-flag migration scaffolding.

---

## 3. Current status summary

Already established:

- Phaser 4 skeleton;
- real sand terrain assets;
- visible HQ;
- visible resources;
- visible harvesters;
- basic harvester civil loop;
- camera pan / zoom / reset;
- Wasp M0 + Smoky M0 modular visual spike;
- modular body / turret socket model, once PR7 / PR12 is merged.

Important clarification:

The Wasp/Smoky work is treated as a visual architecture spike, not as the start of combat gameplay.

It proved the correct model:

```text
bodyDir controls hull texture and turret socket position
turretDir controls turret texture only
```

After this spike, combat work is frozen again.

---

## 4. Immediate strategy

Do not continue into combat.

Next direction:

```text
stabilize → add tests → split oversized renderer → return to civil loop
```

Preferred next PR sequence:

```text
PR13A — Vitest baseline
PR13B — Modular renderer/debug split
PR14  — Passability + Pathfinding MVP
PR15  — Construction MVP
```

This sequence can be adjusted, but any change must be explicitly justified.

---

## 5. Combat freeze

Frozen until civil loop is healthy:

- attack commands;
- attack-move;
- damage;
- HP combat logic;
- projectiles;
- muzzle flashes;
- target acquisition;
- enemy units;
- enemy AI;
- combat selection behavior;
- unit factory combat production.

Allowed during freeze:

- cleanup of existing modular visual code;
- moving debug/tuner code out of production renderer;
- documenting body/turret/socket model;
- preserving approved Wasp/Smoky assets;
- no new combat behavior.

---

## 6. Testing baseline

The project currently needs a test foundation before larger gameplay systems.

Start with Vitest unit tests for pure TypeScript logic:

- `tileToScreen` / `screenToTile`;
- `directionFromDelta`;
- `createInitialState` smoke behavior;
- `updateGameState` smoke behavior;
- resource depletion / raw mineral delivery basics.

Do not overtest visuals early.

Do not write brittle pixel-perfect rendering tests.

Playwright E2E should start once there is a meaningful user flow to protect:

- boot;
- one harvester gather / deliver loop;
- later: one construction flow.

---

## 7. Renderer hygiene

`EntityRenderer` must not keep growing.

Current risk:

```text
EntityRenderer owns too many responsibilities:
- static entities
- resources
- harvesters
- modular tank rendering
- modular debug overlay
- tuner controls support
```

Target split:

```text
src/phaser/render/StaticEntityRenderer.ts
src/phaser/render/HarvesterRenderer.ts
src/phaser/render/ResourceRenderer.ts
src/phaser/render/ModularTankRenderer.ts
src/phaser/debug/ModularTankDebugOverlay.ts
```

Do not do a huge split in one PR unless explicitly approved.

Prefer one small extraction at a time.

---

## 8. Debug and tuner code policy

Debug tools are allowed, but they must not silently become production architecture.

Allowed:

- `T` overlay for visual debugging;
- temporary offset tuner;
- console output for copy-ready constants;
- debug-only keyboard helpers.

Required cleanup direction:

- keep debug overlay default OFF;
- isolate tuner state away from general config over time;
- move modular debug code out of `GameScene` and `EntityRenderer` when practical;
- do not persist debug values unless a specific PR approves it;
- do not add clipboard/browser permission APIs unless approved.

---

## 9. Phaser usage policy

Phaser 4 stays the engine.

Do not switch engine because of temporary friction.

Do not downgrade to Phaser 3.

Do not reintroduce Canvas fallback.

Use native Phaser 4 APIs first.

If a Phaser 4 API is uncertain:

1. read the relevant Phaser skill;
2. check installed TypeScript typings;
3. use the simplest verified API;
4. document the decision in the PR body.

TilemapGPULayer / SpriteGPULayer are research topics, not immediate production requirements.

Do not block civil-loop work on GPU-layer research.

If explored, do it as a small spike with a clear rollback.

---

## 10. Rex policy

Rex Rainbow docs are allowed as secondary reference.

Rex runtime dependencies are not allowed without a separate mini-audit.

Forbidden without explicit approval:

- `phaser4-rex-plugins`;
- rexUI;
- rexBoard;
- rexPathFinder;
- plugin packs;
- broad Rex dependency adoption.

Reason:

Rex plugins bring their own architecture, data models, and lifecycle patterns. The project must first stabilize its native Phaser architecture.

---

## 11. Asset policy

Copy only approved assets.

Old repo assets are not automatically approved.

Do not copy assets that were generated but later rejected or removed from the active game.

For each asset batch, clarify:

- source path;
- why it is approved;
- runtime path in the new repo;
- whether it is loaded immediately or deferred;
- whether optimization is needed.

Avoid loading large asset sets before they are actually used.

---

## 12. PR workflow

Default workflow:

```text
idea → scope → Phase 1 audit → approval "Делай" → implementation PR → review → manual QA → merge
```

Use GLM for code PRs with strict scope.

Use Codex only when the task is large, asset-heavy, or better suited to repository-wide implementation.

Use ChatGPT/GitHub review for:

- scope review;
- PR body vs diff check;
- mergeability;
- comments;
- next-step planning.

Do not spend Codex/GLM cycles on pixel guessing when an in-game tuner or manual QA is faster.

---

## 13. PR acceptance rules

Every implementation PR should state:

- goal;
- files changed;
- what was intentionally not implemented;
- validation results;
- manual QA checklist;
- rollback plan;
- next recommended step.

Reject or pause PRs that:

- add hidden architecture decisions;
- copy old TypeScript implementation;
- introduce feature flags for renderer alternatives;
- touch unrelated systems;
- mix combat with civil-loop work;
- add dependencies without audit;
- grow core files without a split plan.

---

## 14. Short next-step recommendation

After merging the modular socket PR, do not continue combat.

Recommended next task:

```text
PR13A — Vitest Baseline
```

Goal:

- add Vitest;
- add `npm test`;
- test pure TS logic only;
- no gameplay changes;
- no renderer changes except import fixes if needed.

After that:

```text
PR13B — ModularTankRenderer split
```

Goal:

- extract modular tank visual/debug code from `EntityRenderer`;
- keep behavior unchanged;
- no gameplay changes.

Then return to civil loop:

```text
PR14 — Passability + Pathfinding MVP
PR15 — Construction MVP
```

---

## 15. One-line operating rule

Build the game, not the bridge.

Stabilize the foundation, freeze combat, add tests, split oversized render code, then continue the civil loop.
