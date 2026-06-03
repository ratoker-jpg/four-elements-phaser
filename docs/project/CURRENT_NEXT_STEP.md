# CURRENT_NEXT_STEP.md

Status: Arena Sandbox cycle closed / next direction pending  
Project: Four Elements Phaser  
Date: 2026-06-03

---

## Purpose

This file answers one operational question:

```text
What should GPT/GLM/Codex do next by default?
```

---

## Current answer

```text
Do not start new implementation by inertia.

VISUAL/UI roadmap slice: CLOSED.
BLOCKOUT-MVP roadmap slice: CLOSED.
CAMERA-00 projection contract: IMPLEMENTED / ACCEPTED.
PROJECTION-01 ground-plane retrofit: IMPLEMENTED / ACCEPTED.
Arena Sandbox roadmap/audit cycle: CLOSED after PR #184.

Next default action:
Choose the next product direction and create a new roadmap audit before implementation.
```

---

## Latest closed cycle

```text
Arena Sandbox cycle:
#178 — ARENA-00H+ roadmap
#179 — ARENA-00H+ system audit
#180 — ARENA-01H+ Standalone Clean Arena
#181 — ARENA-02H+ Unit Creation and Click Placement
#182 — ARENA-03H+ Control, Targeting and Turret Rules
#183 — ARENA-04H+ Arena Control Panel Roster Usability Help
#184 — ARENA-05H+ Enemy Behavior Modes
```

Closure report:

```text
docs/project/ARENA_SANDBOX_CLOSURE_REPORT.md
```

---

## What Arena now has

```text
- standalone clean Arena mode
- no HQ/base, harvesters, resources, economy HUD, production HUD or gameplay obstacles
- ArenaMenu as primary UX
- manual body + weapon + team unit creation
- click placement through CAMERA_PROJECTION_CONTRACT.md
- projected ground-plane placement marker
- ally/enemy model
- ally controllable, enemy non-controllable
- target-lock turret behavior instead of mouse-follow in Arena
- real fire/damage path for target-locked firing
- Arena roster/control panel/help/status
- simple enemy AI modes: passive, stationary_shooter, chaser, hold_position
```

---

## Active mode

```text
NO ACTIVE IMPLEMENTATION ROADMAP.
NO NEW CODE WITHOUT A NEW ACCEPTED ROADMAP/AUDIT.
```

Allowed immediate work:

```text
- manual QA of the merged Arena cycle
- docs cleanup
- roadmap/audit planning for the next direction
- PR review for existing open PRs, if any
```

Forbidden by default:

```text
- continuing Arena features by inertia
- adding Arena save/load/import/export without new roadmap/audit
- adding waves/strategic AI/economy AI without new roadmap/audit
- starting visual/world-space/asset work without CAMERA_PROJECTION_CONTRACT.md
- drawing ground markers/range/selection/shadows as top-down screen circles
```

---

## Recommended next planning options

Denis should choose one direction before implementation:

```text
1. Arena manual QA + polish follow-up audit.
2. Production visual/world-space roadmap using CAMERA_PROJECTION_CONTRACT.md.
3. Normal Game civil loop/economy readability roadmap.
4. Final asset integration roadmap for units/buildings/tanks.
```

After owner choice:

```text
roadmap -> huge/system audit -> High+/High PR sequence -> implementation PRs -> GPT review -> Denis merge
```
