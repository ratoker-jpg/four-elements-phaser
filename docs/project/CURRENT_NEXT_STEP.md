# CURRENT_NEXT_STEP.md

Status: BLOCKOUT-06H+ implemented / BLOCKOUT-07H+ next
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
BLOCKOUT-06H+ is implemented. All 11 blockout weapon families have visual-only VFX placeholders.
Next step: BLOCKOUT-07H+ — Damage placeholders.
```

---

## Current next step

```text
BLOCKOUT-06H+ — Remaining weapon VFX families — IMPLEMENTED

All 11 blockout weapons now have distinct visual-only VFX:
- Smoky: muzzle flash + short tracer + impact dot + medium recoil (BLOCKOUT-05H+)
- Railgun: long bright line + pierce ticks + strong recoil (BLOCKOUT-05H+)
- Thunder: short tracer + explosion circle + splash radius ring + medium-heavy recoil (BLOCKOUT-05H+)
- Shaft: charge pulse + focused long sniper line + crosshair at end
- Flamethrower: orange cone with flicker + inner yellow cone + muzzle glow
- Freeze: cyan cone + inner blue cone + frost circles + muzzle glow
- Isida: green pulsing beam + glow line + tether dots
- Vulcan: rapid short tracers + small muzzle flash + visual overheat indicator
- Twins: moving plasma dots with glow + trail
- Ricochet: segmented path with deterministic bounces + bounce markers
- Hammer: fan of pellet tracers in cone + impact dots
- Continuous weapons (Flamethrower/Freeze/Isida/Vulcan/Twins) fire while Space/F is held
- Single-fire weapons (Smoky/Railgun/Thunder/Shaft/Ricochet/Hammer) fire on press
- Recoil visible on all weapons (stronger on heavy weapons, lighter on stream weapons)
- All timing uses consistent Phaser scene time basis
- Production/default game remains unchanged when devtools/arena is off

Next step: BLOCKOUT-07H+ — Damage placeholders
```

Mode:

```text
BLOCKOUT-06H+ COMPLETE
READY FOR BLOCKOUT-07H+ IMPLEMENTATION
No standalone low-risk PRs.
High/high+ visible progress steps only.
```

---

## Current roadmap state

```text
VISUAL/UI roadmap slice: CLOSED
Current active planning direction: BLOCKOUT-MVP
Current implementation task: BLOCKOUT-06H+ COMPLETE
Next action: BLOCKOUT-07H+ — Damage placeholders
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
BLOCKOUT-06H+ remaining weapon VFX families is implemented.
All 11 blockout weapons have distinct visual-only VFX placeholders.
Next step: BLOCKOUT-07H+ — Damage placeholders.
```
