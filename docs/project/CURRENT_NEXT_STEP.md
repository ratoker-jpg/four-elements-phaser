# CURRENT_NEXT_STEP.md

Status: BLOCKOUT-MVP closed / next step is new roadmap audit
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
BLOCKOUT-MVP is closed. Next: create a new roadmap audit for the next direction.
```

---

## Current next step

```text
BLOCKOUT-10H+ — Combat readability sandbox / closure QA — IMPLEMENTED

BLOCKOUT-MVP is now closed. The full dev/arena combat sandbox exists:
- 9 vehicles in curated deterministic scenario layout
- 11 weapons with distinct VFX and damage behaviors
- 4 obstacle types with movement collision and line-of-fire blocking
- 5 upgrade types with visual indicators and effective profiles
- Help/legend overlay (H toggles)
- Selected vehicle status overlay (HP, upgrades, speed, fire readiness)
- Scenario reset (R key) restoring deterministic defaults
- Vehicle cycling (T key) for quick multi-vehicle testing
- Readability polish (selection ring, direction arrow, damage number offset, obstacle labels)

BLOCKOUT-MVP is closed. Next: create a new roadmap audit for the next direction.
```

Mode:

```text
BLOCKOUT-MVP COMPLETE
NO NEW IMPLEMENTATION WITHOUT NEW ROADMAP AUDIT
Start a new roadmap audit before any implementation.
```

---

## Current roadmap state

```text
VISUAL/UI roadmap slice: CLOSED
BLOCKOUT-MVP roadmap slice: CLOSED
Next action: New roadmap audit for next direction
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
