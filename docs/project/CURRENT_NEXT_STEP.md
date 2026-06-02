# CURRENT_NEXT_STEP.md

Status: CAMERA-00 — Projection calibration contract
Project: Four Elements Phaser
Date: 2026-06-02

---

## Why this file exists

This short checkpoint prevents confusion about the current operational workstream.

Use `PROJECT_STATE.md` as the primary operational source of truth.

This file answers one question:

```text
What should GPT/GLM/Codex do next by default?
```

Current answer:

```text
CAMERA-00: Projection calibration contract — in progress.
Define and expose the actual projection basis (basisX, basisY, basisZ),
add dev/arena calibration overlay (C key), and create the projection
contract document. After: new roadmap audit using CAMERA_PROJECTION_CONTRACT.md
as visual source of truth.
```

---

## Current next step

```text
CAMERA-00 — Projection calibration contract — IN PROGRESS

Created a precise mathematical camera/projection contract for the fixed
isometric/axonometric game view:
- Projection formula: screen = origin + x*basisX + y*basisY + z*basisZ
- basisX = { x: 38, y: 19 } — one tile step along X
- basisY = { x: -38, y: 19 } — one tile step along Y
- basisZ = { x: 0, y: -60 } — one vertical height unit
- Camera flags: fixedCamera=true, canPan=true, canZoom=true, canRotate=false
- Object anchor rule: ground-contact-bottom-center
- Projection helpers: projectGroundPoint, projectWorldPoint, projectGroundCircleToPolyline, projectGroundRect, getGroundEllipseBounds
- Dev/arena calibration overlay (C key): basis arrows, ground diamonds, projected circles, test pillar, wrong-top-down comparison
- CAMERA_PROJECTION_CONTRACT.md: full contract document with rules and forbidden assumptions
- Tests for pure projection helpers

After CAMERA-00: new roadmap audit using CAMERA_PROJECTION_CONTRACT.md
as required visual source of truth for all rendering/asset tasks.
```

Mode:

```text
CAMERA-00 IN PROGRESS
After CAMERA-00: new roadmap audit using CAMERA_PROJECTION_CONTRACT.md
```

---

## Current roadmap state

```text
VISUAL/UI roadmap slice: CLOSED
BLOCKOUT-MVP roadmap slice: CLOSED
CAMERA-00: IN PROGRESS
Next action: New roadmap audit using CAMERA_PROJECTION_CONTRACT.md
```

---

## What BLOCKOUT-MVP achieved

```text
- visible blockout vehicles (BLOCKOUT-02H)
- selection/deselection + independent turret aiming (BLOCKOUT-03H)
- semi-physics movement with acceleration/braking (BLOCKOUT-04H+)
- recoil + visual-only weapon VFX for all 11 weapons (BLOCKOUT-05H+ + 06H+)
- HP/damage/destroyed state + continuous damage (BLOCKOUT-07H+)
- obstacles + movement collision + line-of-fire blocking (BLOCKOUT-08H)
- upgrade skeleton + visual indicators + effective profiles (BLOCKOUT-09H)
- combat readability sandbox + closure QA (BLOCKOUT-10H+)
```

This is not a final-art roadmap. All rendering uses Phaser Graphics primitives.

---

## Short handoff

```text
We are working in ratoker-jpg/four-elements-phaser.
The VISUAL/UI roadmap is closed after PR #144-#162.
The BLOCKOUT-MVP roadmap is closed after PR #166-#TBD (10H+).
BLOCKOUT-MVP is closed. Next: create a new roadmap audit for the next direction.
No implementation without a new roadmap audit.
```
