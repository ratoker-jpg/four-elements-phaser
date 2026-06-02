# CURRENT_NEXT_STEP.md

Status: BLOCKOUT-08H implemented / BLOCKOUT-09H next
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
BLOCKOUT-08H is implemented. Dev/arena blockout obstacles exist.
Obstacle movement collision and placeholder line-of-fire blocking exist.
Next step: BLOCKOUT-09H — Upgrade skeleton + visual indicators.
```

---

## Current next step

```text
BLOCKOUT-08H — Blockout obstacles — IMPLEMENTED

Dev/arena blockout obstacles now exist in the combat sandbox:
- 4 obstacle types: blocker_wall, cover_crate, low_barrier, dummy_rock
- Phaser Graphics primitives only (no assets)
- Deterministic default arena layout (2 walls, 2 crates, 1 barrier, 1 rock)
- Vehicle movement collision: stops/clamps at obstacle edges
- Line-of-fire blocking: direct/rapid/plasma/beam blocked by obstacles
- Penetration: passes pierceable obstacles (low_barrier), blocked by non-pierceable
- Splash: impact point moves to obstacle intersection when blocked
- Cone/beam: targets behind obstacles are excluded
- Shotgun: each pellet ray can be blocked independently
- Ricochet: direct-line check blocks behind obstacles (placeholder)
- Obstacle renderer: distinct visual per type, pierceable marker, debug labels
- Obstacles are dev/arena-only, not persisted in saves
- saveGame strips blockoutObstacles
- 51 unit tests for obstacles, collision, line-of-fire blocking, save stripping
- No production pathfinding/combat/mapgen changes
- Production/default game remains unchanged when devtools/arena is off

Next step: BLOCKOUT-09H — Upgrade skeleton + visual indicators
```

Mode:

```text
BLOCKOUT-08H COMPLETE
READY FOR BLOCKOUT-09H IMPLEMENTATION
No standalone low-risk PRs.
High/high+ visible progress steps only.
```

---

## Current roadmap state

```text
VISUAL/UI roadmap slice: CLOSED
Current active planning direction: BLOCKOUT-MVP
Current implementation task: BLOCKOUT-08H COMPLETE
Next action: BLOCKOUT-09H — Upgrade skeleton + visual indicators
```

Roadmap document:

```text
docs/project/BLOCKOUT_MVP_ROADMAP.md
```

---

## BLOCKOUT-MVP goal

The new roadmap direction is:

```text
Vehicle / Combat / Upgrade Skeleton before final art.
```

The working model:

```text
reference → contract → blockout → audit → scoped implementation → validation → final assets later
```

Core rule:

```text
Do not make it beautiful before it is clear what exactly must become beautiful.
```

---

## What BLOCKOUT-MVP is about

The roadmap focuses on Phaser/blockout placeholders for:

```text
- vehicle bodies ✓ (BLOCKOUT-02H)
- body-specific turret mount points ✓ (BLOCKOUT-02H)
- independent turret rotation ✓ (BLOCKOUT-03H)
- semi-physics vehicle movement feel ✓ (BLOCKOUT-04H+)
- recoil ✓ (BLOCKOUT-05H+)
- weapon behavior families — first set ✓ (BLOCKOUT-05H+)
- primitive VFX placeholders — first set ✓ (BLOCKOUT-05H+)
- remaining weapon VFX families ✓ (BLOCKOUT-06H+)
- direct/splash/penetration/status damage placeholders ✓ (BLOCKOUT-07H+)
- obstacle blockers ✓ (BLOCKOUT-08H)
- upgrade skeleton (BLOCKOUT-09H)
- combat readability sandbox (BLOCKOUT-10H+)
```

This is not a final-art roadmap.

---

## Short handoff

```text
We are working in ratoker-jpg/four-elements-phaser.
The VISUAL/UI roadmap is closed after PR #144-#162.
The new active planning direction is BLOCKOUT-MVP: vehicle/combat/upgrade skeleton before final art.
BLOCKOUT-01 huge roadmap audit is complete.
BLOCKOUT-02H first visible blockout vehicles is implemented.
BLOCKOUT-03H selection/control + turret aiming is implemented.
BLOCKOUT-04H+ semi-physics movement is implemented.
BLOCKOUT-05H+ recoil + first weapon VFX set is implemented.
BLOCKOUT-06H+ remaining weapon VFX families is implemented.
BLOCKOUT-07H+ damage placeholders is implemented.
BLOCKOUT-08H blockout obstacles is implemented.
All 11 blockout weapons apply placeholder damage with obstacle blocking in arena/dev mode.
Next step: BLOCKOUT-09H — Upgrade skeleton + visual indicators.
```
