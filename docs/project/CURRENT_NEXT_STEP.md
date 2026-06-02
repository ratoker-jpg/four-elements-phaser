# CURRENT_NEXT_STEP.md

Status: BLOCKOUT-07H+ implemented / BLOCKOUT-08H next
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
BLOCKOUT-07H+ is implemented. Blockout vehicles have HP/damage/destroyed placeholders.
All 11 weapons apply placeholder damage in arena/dev mode.
Next step: BLOCKOUT-08H — Blockout obstacles.
```

---

## Current next step

```text
BLOCKOUT-07H+ — Damage placeholders — IMPLEMENTED

Blockout vehicles now have placeholder HP/damage/destroyed state in arena/dev mode:
- Each blockout vehicle has HP initialized from body profile (Wasp=180, Mammoth=500)
- HP bar visible above each vehicle (green > 60%, yellow 30-60%, red < 30%)
- Damage flash (white overlay) when vehicle is hit
- Floating damage numbers appear at hit location
- Hit markers (white circle + red X) at hit point
- Status tag markers: burn=orange, freeze=cyan, beam=green, overheat=red, plasma=purple, ricochet=yellow
- Destroyed vehicles show dimmed body + red X marker, stop firing/movement
- All 11 weapons apply damage via their damage behavior:
  - Smoky: direct hit, medium damage
  - Thunder: splash radius, medium damage
  - Railgun: line penetration, high damage, pierce up to 3 vehicles
  - Shaft: focused line direct, high single-shot damage
  - Flamethrower: cone tick, low repeated damage, burn marker
  - Freeze: cone tick, low repeated damage, freeze marker
  - Isida: beam tick, low/medium repeated damage, beam marker
  - Vulcan: rapid tick, low repeated damage, overheat marker
  - Twins: plasma hit, medium repeated damage
  - Ricochet: segmented path hit, medium damage
  - Hammer: shotgun pellet fan, multiple small damage hits
- Continuous weapons tick damage at weapon-specific cadence (not every frame)
- BLOCKOUT-07H+ fixup: Separate lastDamageTickAt from lastStreamTickAt — VFX and damage cadence do not block each other
- Destroyed vehicles cannot fire, move, or be damaged again
- Firing vehicle does not damage itself by default
- All damage state is transient (not persisted in saves)
- No production combat, no save schema changes
- Production/default game remains unchanged when devtools/arena is off

Next step: BLOCKOUT-08H — Blockout obstacles
```

Mode:

```text
BLOCKOUT-07H+ COMPLETE
READY FOR BLOCKOUT-08H IMPLEMENTATION
No standalone low-risk PRs.
High/high+ visible progress steps only.
```

---

## Current roadmap state

```text
VISUAL/UI roadmap slice: CLOSED
Current active planning direction: BLOCKOUT-MVP
Current implementation task: BLOCKOUT-07H+ COMPLETE
Next action: BLOCKOUT-08H — Blockout obstacles
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
BLOCKOUT-07H+ damage placeholders is implemented.
All 11 blockout weapons apply placeholder damage in arena/dev mode.
Next step: BLOCKOUT-08H — Blockout obstacles.
```
