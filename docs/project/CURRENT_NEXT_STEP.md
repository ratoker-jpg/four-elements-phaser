# CURRENT_NEXT_STEP.md

Status: BLOCKOUT-05H+ implemented / BLOCKOUT-06H+ next
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
BLOCKOUT-05H+ is implemented. Blockout vehicles have visual-only firing, recoil, and weapon VFX for Smoky/Railgun/Thunder.
Next step: BLOCKOUT-06H+ — Remaining weapon VFX families.
```

---

## Current next step

```text
BLOCKOUT-05H+ — Recoil + first weapon VFX set — IMPLEMENTED

Blockout vehicles can now fire in arena/dev mode:
- Select a blockout vehicle with LMB
- Press Space or F to fire selected vehicle
- Smoky: muzzle flash + short tracer + impact dot + medium recoil
- Railgun: long bright line + pierce ticks + strong recoil
- Thunder: short tracer + explosion circle + splash radius ring + medium-heavy recoil
- Barrel kickback visible on all three weapons
- Recoil recovers smoothly over time
- Cooldown prevents uncontrolled VFX spam
- Body impulse shifts vehicle backward visually during recoil
- Turret kickback deflects turret angle temporarily during recoil
- Movement from BLOCKOUT-04H+ keeps working while firing
- Turret aiming from BLOCKOUT-03H keeps working while firing
- VFX origin uses actual barrel/mount origin (not body center)
- Rear-mounted and front_center vehicles fire from correct origin
- Production/default game remains unchanged when devtools/arena is off

Next step: BLOCKOUT-06H+ — Remaining weapon VFX families: Flamethrower, Freeze, Isida, Vulcan, Twins, Ricochet, Hammer, Shaft
```

Mode:

```text
BLOCKOUT-05H+ COMPLETE
READY FOR BLOCKOUT-06H+ IMPLEMENTATION
No standalone low-risk PRs.
High/high+ visible progress steps only.
```

---

## Current roadmap state

```text
VISUAL/UI roadmap slice: CLOSED
Current active planning direction: BLOCKOUT-MVP
Current implementation task: BLOCKOUT-05H+ COMPLETE
Next action: BLOCKOUT-06H+ — Remaining weapon VFX families
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
- remaining weapon VFX families (BLOCKOUT-06H+)
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
BLOCKOUT-05H+ recoil + first weapon VFX set is implemented.
Blockout vehicles can now fire with visual recoil and weapon-specific VFX (Smoky/Railgun/Thunder).
Next step: BLOCKOUT-06H+ — Remaining weapon VFX families.
```
