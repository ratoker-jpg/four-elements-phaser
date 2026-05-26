# NEXT_STEP_ARCH_05Y.md

Status: planned next mini-stage  
Project: Four Elements Phaser  
After: PR #61 / ARCH-05X civil movement-control-passability

---

## Goal

Fix the two accepted visual/motion follow-ups left after ARCH-05X merge.

This is a focused follow-up, not a new movement/pathfinding feature.

```text
ARCH-05Y — Selection ring ground anchor + harvester movement smoothing
```

---

## Context

ARCH-05X proved the larger high-controlled workflow works and merged the civil movement/control/passability bundle.

Two issues were intentionally deferred from PR #61:

1. Selection ring is visible but is not anchored to the real unit ground footprint.
2. Harvester can show small micro-teleport / snapping while following path waypoints.

Both are visual/motion trust issues. They should be fixed before adding more unit-control features.

---

## Scope

### 1. Selection ring ground anchor

Required behavior:

- ring is visually under the unit chassis/tracks;
- ring follows the unit smoothly while moving;
- builder and harvester can use separate anchor offsets/radius if their renderer anchors differ;
- ring must not be tied blindly to raw `tileToScreen(ftx, fty)` if the rendered sprite uses additional ground/origin offsets;
- do not change selection model unless directly necessary.

### 2. Harvester micro-teleport smoothing

Required behavior:

- harvester movement should not visually snap between path waypoints;
- movement should remain state-correct and not distort gameplay position;
- if smoothing is render-only, clearly document that state remains authoritative;
- do not change resource approach behavior unless directly required.

---

## Hard rules

Do not change:

- pathfinding algorithm;
- passability/occupancy rules;
- economy;
- construction flow;
- asset pipeline/generated manifests;
- tank/modular unit rendering;
- save/load;
- combat/enemy AI.

Do not add:

- drag-box selection;
- multi-select;
- attack-move;
- waypoint queue;
- path preview.

---

## Suggested risk

```text
risk: medium/high-controlled
```

Reason:

- renderer/input visual follow-up from existing ARCH-05X behavior;
- focused scope;
- needs manual visual QA;
- should not touch unrelated systems.

---

## Validation

Run:

```bash
npm test
npm run typecheck
npm run build
npm run qa:smoke
```

Manual QA:

- select builder — ring is under ground footprint;
- select harvester — ring is under ground footprint;
- move selected harvester with LMB — ring follows correctly;
- harvester follows path without visible micro-teleporting;
- harvester still gathers from adjacent resource tile;
- builder construction still works;
- no console errors.

---

## Expected PR title

```text
ARCH-05Y: Fix selection ring anchor and harvester movement smoothing
```
