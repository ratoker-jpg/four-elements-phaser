# CURRENT_NEXT_STEP.md

Status: Wasp+Smoky attachment recovery is paused at projection-source decision  
Project: Four Elements Phaser  
Date: 2026-06-13

---

## Purpose

This file answers one operational question:

```text
What should GPT/GLM/Codex/Claude do next by default?
```

---

## Current answer

```text
PR #263 is HOLD / DO NOT MERGE.
Do not continue blind renderer offset/formula fixes.
Do not hand-calibrate Wasp socket perDir values as production source.
The next decision is Wasp socket projection recovery, not runtime implementation.
```

Read first:

```text
docs/project/TURRET_HULL_SOCKET_RECOVERY_HANDOFF_2026_06_13.md
docs/project/TURRET_HULL_ATTACHMENT_AUDIT_2026_06_12.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
docs/project/GLM_EXECUTOR_RULES.md
```

---

## Active issue

Runtime debug in PR #263 proved:

```text
computed hull socket world point == computed turret pivot world point
```

Therefore renderer math is not the current blocker. The remaining blocker is Wasp socket profile data.

---

## Current PR state

```text
PR #263 — TURRET-HULL-CONTRACT-PR-F2: wire directional Smoky turret rendering
URL: https://github.com/ratoker-jpg/four-elements-phaser/pull/263
Branch: turret-hull-contract-pr-f2
Status: HOLD / DO NOT MERGE
```

Useful contents of PR #263:

```text
- real Smoky M0 512x512 16-dir assets for 4 factions;
- generated turret resolver/pathing;
- renderer wiring for Wasp+Smoky;
- turret anchor debug overlay;
- Wasp socket calibration/debug tool;
- qa:turret-assets validation.
```

Do not merge because Wasp+Smoky manual visual QA still failed and Wasp socket data is not projection-backed.

---

## Confirmed facts

```text
Do not change renderer math next.
Do not change origins/scales next.
Do not change Smoky pivot next.
```

Denis found this visual runtime reference for current Wasp dir04:

```ts
dir04: { nx: 0.506821, ny: 0.326525 }
```

This is a sanity check only. It is not production source-of-truth.

The correct physical Wasp socket source was visually confirmed in Blender:

```text
socket source = center of object mount
```

---

## Next decision

GPT/Denis must choose the next projection recovery path before implementation.

```text
Path A — recover/match current shipped Wasp PNG generator.
Path B — re-baseline Wasp through Blender and generate Wasp PNGs + socket projection together.
```

No agent should choose A or B by inertia.

---

## Do not start by default

```text
- do not merge PR #263;
- do not keep adding offset/origin/math fixups to #263;
- do not let GLM plan the asset/socket pipeline;
- do not update Wasp socket runtime data from manual calibration alone;
- do not render all hulls/weapons in one broad task;
- do not commit 3D source files to this game repo;
- do not touch public/assets/units/hulls unless an explicit Wasp re-baseline asset PR is approved;
- do not change combat, movement, economy, pathfinding, save-load, bot/AI, or mapgen as part of this work.
```

---

## Validation baseline

Future implementation PRs should keep using:

```text
npm run typecheck
npm run test
npm run build
npm run qa:smoke
```

Turret asset/runtime PRs also need:

```text
npm run qa:turret-assets
```

Manual visual QA is mandatory for Wasp+Smoky attachment.
