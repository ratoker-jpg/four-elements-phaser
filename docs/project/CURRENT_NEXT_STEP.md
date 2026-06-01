# CURRENT_NEXT_STEP.md

Status: BLOCKOUT-02H implemented / BLOCKOUT-03H next
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
BLOCKOUT-02H is implemented. Visible blockout vehicles now exist in arena/dev mode.
Next step: BLOCKOUT-03H — Selection/control + turret aiming.
```

---

## Current next step

```text
BLOCKOUT-02H — First visible blockout vehicles — IMPLEMENTED

Visible blockout vehicles now appear in arena/dev mode as Phaser Graphics primitives:
- colored rectangle body (size varies by body profile)
- separate turret rectangle
- barrel line (length varies by weapon profile)
- mount point circle (visible in debug/dev display)
- different body sizes readable (Wasp small, Mammoth large)
- different barrel lengths visible (Railgun long, Smoky medium)
- rear-mounted turrets visible on Wasp/Dictator
- front_center turrets visible on Titan/Mammoth
- production/default game unchanged when devtools is off

Next step: BLOCKOUT-03H — Selection/control + turret aiming
```

Mode:

```text
BLOCKOUT-02H COMPLETE
READY FOR BLOCKOUT-03H IMPLEMENTATION
No standalone low-risk PRs.
High/high+ visible progress steps only.
```

---

## Current roadmap state

```text
VISUAL/UI roadmap slice: CLOSED
Current active planning direction: BLOCKOUT-MVP
Current implementation task: BLOCKOUT-02H COMPLETE
Next action: BLOCKOUT-03H — Selection/control + turret aiming
```

Roadmap document:

```text
docs/project/BLOCKOUT_MVP_ROADMAP.md
```

Previous closure document:

```text
docs/project/ROADMAP_CLOSURE_2026_06_01_VISUAL_UI.md
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
- independent turret rotation (BLOCKOUT-03H)
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

## What is explicitly NOT active

Do not start these by default:

```text
- final tank asset integration
- deleting current/legacy tank assets
- mass asset generation
- full combat system
- enemy AI/bots
- attack waves
- save schema rewrite
- economy expansion
- map size migration
- fog of war
- full upgrade shop UI
- broad renderer refactor
```

---

## Read before doing anything

```text
docs/project/BLOCKOUT_MVP_ROADMAP.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
docs/project/ROADMAP_CLOSURE_2026_06_01_VISUAL_UI.md
```

---

## Short handoff

```text
We are working in ratoker-jpg/four-elements-phaser.
The VISUAL/UI roadmap is closed after PR #144-#162.
The new active planning direction is BLOCKOUT-MVP: vehicle/combat/upgrade skeleton before final art.
BLOCKOUT-01 huge roadmap audit is complete.
BLOCKOUT-02H first visible blockout vehicles is implemented.
Visible blockout vehicles now exist in arena/dev mode.
Next step: BLOCKOUT-03H — Selection/control + turret aiming.
```
