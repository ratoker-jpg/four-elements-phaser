# CURRENT_NEXT_STEP.md

Status: BLOCKOUT-04H+ implemented / BLOCKOUT-05H+ next
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
BLOCKOUT-04H+ is implemented. Blockout vehicles have semi-physics movement in arena/dev mode.
Next step: BLOCKOUT-05H+ — Recoil + first weapon VFX set.
```

---

## Current next step

```text
BLOCKOUT-04H+ — Semi-physics movement — IMPLEMENTED

Blockout vehicles can now move in arena/dev mode:
- Select a blockout vehicle with LMB
- RMB click on ground sets a movement target
- Vehicle accelerates gradually toward target
- Vehicle brakes/stops near target instead of snapping
- Body rotates gradually toward movement direction
- Body rotation is independent from turret rotation
- Turret can continue aiming at mouse while body turns/moves
- Wasp feels faster/lighter than Mammoth
- Movement target marker (crosshair) and line visible for selected vehicle
- Speed shown in debug label when moving
- Production/default game remains unchanged when devtools/arena is off

Next step: BLOCKOUT-05H+ — Recoil + first weapon VFX set: Smoky/Railgun/Thunder
```

Mode:

```text
BLOCKOUT-04H+ COMPLETE
READY FOR BLOCKOUT-05H+ IMPLEMENTATION
No standalone low-risk PRs.
High/high+ visible progress steps only.
```

---

## Current roadmap state

```text
VISUAL/UI roadmap slice: CLOSED
Current active planning direction: BLOCKOUT-MVP
Current implementation task: BLOCKOUT-04H+ COMPLETE
Next action: BLOCKOUT-05H+ — Recoil + first weapon VFX set
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
BLOCKOUT-04H+ semi-physics movement is implemented.
Blockout vehicles can now accelerate, brake, turn, and move to targets.
Next step: BLOCKOUT-05H+ — Recoil + first weapon VFX set.
```
