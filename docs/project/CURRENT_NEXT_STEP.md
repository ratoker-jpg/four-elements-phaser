# CURRENT_NEXT_STEP.md

Status: BLOCKOUT-09H implemented / BLOCKOUT-10H+ next
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
BLOCKOUT-09H is implemented. Dev/arena upgrade skeleton exists.
Upgrade visual indicators exist. Simple upgrade effects modify blockout movement/damage/HP/range.
Next step: BLOCKOUT-10H+ — Combat readability sandbox / closure QA.
```

---

## Current next step

```text
BLOCKOUT-09H — Upgrade skeleton + visual indicators — IMPLEMENTED

Dev/arena blockout upgrade skeleton now exists in the combat sandbox:
- 5 upgrade types: mobility_boost, armor_plating, weapon_tuning, range_extender, cooling_system
- Upgrade visual indicators: speed arcs, armor brackets, weapon glow, range circle, cooling dots
- Upgrade hotkeys: U/1 = mobility, I/2 = armor, O/3 = weapon, P/4 = range, B/5 = cooling
- Max 3 levels per upgrade, applied to selected vehicle in arena/dev mode
- mobility_boost: +15% speed, +10% accel, +10% turn per level
- armor_plating: +15% max HP, -5% incoming damage per level
- weapon_tuning: +10% damage, -5% cooldown per level
- range_extender: +10% range per level
- cooling_system: -10% continuous tick/cadence per level
- Effective profiles computed without mutating base configs
- Destroyed vehicles cannot be upgraded
- Upgrades are dev/arena-only, not persisted in saves
- Debug labels show upgrade IDs and levels
- Production/default game remains unchanged when devtools/arena is off

Next step: BLOCKOUT-10H+ — Combat readability sandbox / closure QA
```

Mode:

```text
BLOCKOUT-09H COMPLETE
READY FOR BLOCKOUT-10H+ IMPLEMENTATION
No standalone low-risk PRs.
High/high+ visible progress steps only.
```

---

## Current roadmap state

```text
VISUAL/UI roadmap slice: CLOSED
Current active planning direction: BLOCKOUT-MVP
Current implementation task: BLOCKOUT-09H COMPLETE
Next action: BLOCKOUT-10H+ — Combat readability sandbox / closure QA
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
- upgrade skeleton ✓ (BLOCKOUT-09H)
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
BLOCKOUT-09H upgrade skeleton + visual indicators is implemented.
All 11 blockout weapons apply placeholder damage with obstacle blocking and upgrade effects in arena/dev mode.
Next step: BLOCKOUT-10H+ — Combat readability sandbox / closure QA.
```
