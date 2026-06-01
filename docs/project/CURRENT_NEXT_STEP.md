# CURRENT_NEXT_STEP.md

Status: BLOCKOUT-03H implemented / BLOCKOUT-04H+ next
Project: Four Elements Phaser
Date: 2026-06-01

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
BLOCKOUT-03H is implemented. Blockout vehicles can be selected and turrets aim independently.
Next step: BLOCKOUT-04H+ — Semi-physics movement.
```

---

## Current next step

```text
BLOCKOUT-03H — Selection/control + turret aiming — IMPLEMENTED

Blockout vehicles can now be selected and controlled in arena/dev mode:
- LMB click selects a blockout vehicle (deselect on empty ground click)
- Selected vehicle has visible gold selection highlight ring
- Hovered vehicle shows subtle white hover marker
- Selected vehicle turret rotates toward mouse cursor independently from body
- Turret turn speed is rate-limited per weapon profile
- Debug aim line (dashed red) extends from barrel toward cursor
- Different weapons have different turret turn speeds (Smoky fast, Railgun slow)
- Body angle remains independent from turret angle
- Only one vehicle selected at a time
- Production/default game remains unchanged when devtools/arena is off

Next step: BLOCKOUT-04H+ — Semi-physics movement
```

Mode:

```text
BLOCKOUT-03H COMPLETE
READY FOR BLOCKOUT-04H+ IMPLEMENTATION
No standalone low-risk PRs.
High/high+ visible progress steps only.
```

---

## Current roadmap state

```text
VISUAL/UI roadmap slice: CLOSED
Current active planning direction: BLOCKOUT-MVP
Current implementation task: BLOCKOUT-03H COMPLETE
Next action: BLOCKOUT-04H+ — Semi-physics movement
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
- semi-physics vehicle movement feel (BLOCKOUT-04H+)
- recoil (BLOCKOUT-05H+)
- weapon behavior families (BLOCKOUT-05H+/06H+)
- primitive VFX placeholders (BLOCKOUT-05H+/06H+)
- direct/splash/penetration/status damage placeholders (BLOCKOUT-07H+)
- obstacle blockers (BLOCKOUT-08H)
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
Blockout vehicles can now be selected and turrets aim independently.
Next step: BLOCKOUT-04H+ — Semi-physics movement.
```
