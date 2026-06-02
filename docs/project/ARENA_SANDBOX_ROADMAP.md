# ARENA-SANDBOX ROADMAP — CLOSED

Status: CLOSED / implemented and accepted  
Project: Four Elements Phaser  
Repository: `ratoker-jpg/four-elements-phaser`  
Focus: Arena mode only  
Original format: High+ / High steps only  
Closed after: PR #184  
Date: 2026-06-03

---

## Closure note

This roadmap is no longer an active implementation queue.

It was implemented through the accepted Arena Sandbox PR sequence:

```text
#178 — ARENA-00H+: Arena Sandbox roadmap
#179 — ARENA-00H+: Arena Sandbox system audit
#180 — ARENA-01H+: Standalone Clean Arena
#181 — ARENA-02H+: Unit Creation and Click Placement
#182 — ARENA-03H+: Control, Targeting and Turret Rules
#183 — ARENA-04H+: Arena Control Panel Roster Usability Help
#184 — ARENA-05H+: Enemy Behavior Modes
```

Closure report:

```text
docs/project/ARENA_SANDBOX_CLOSURE_REPORT.md
```

Do not continue Arena work from this roadmap by inertia. Any new Arena feature, polish pass, save/load system, wave system, strategic AI or final-combat pass requires a new roadmap/audit or explicit owner-approved follow-up.

---

## Implemented product decisions

```text
1. Arena is a standalone mode, not DevTools.
2. DevTools is not the primary Arena UX.
3. Arena has no HQ/base.
4. Arena has no harvesters.
5. Arena has no resource nodes.
6. Arena has no economy / production HUD.
7. Arena has no gameplay obstacles.
8. blocker_wall / cover_crate / low_barrier / dummy_rock are removed from Arena runtime/UX.
9. User manually chooses body + weapon + team.
10. Code does not force preset body+weapon combinations as the main flow.
11. Turret does not continuously follow mouse pointer in Arena.
12. Turret tracks selected enemy target.
13. Allies are controllable.
14. Enemies are not controllable.
15. Enemies can be placed, targeted, damaged and destroyed.
16. Enemy behavior modes are simple test modes, not full strategic AI.
```

---

## Final implemented sequence

```text
ARENA-01H+ [High]  — Standalone Clean Arena
ARENA-02H+ [High+] — Unit Creation + Click Placement
ARENA-03H+ [High+] — Control, Targeting, and Turret Rules
ARENA-04H+ [High]  — Arena Control Panel: Roster + Usability + Help
ARENA-05H+ [High+] — Enemy Behavior Modes
```

---

## Implemented Arena capabilities

```text
- clean standalone Arena mode
- ArenaMenu as primary UX
- manual unit creation by body + weapon + team
- AI mode selector for newly created enemies
- click placement using CAMERA_PROJECTION_CONTRACT.md
- projected ground-plane placement marker
- ally/enemy model
- target-lock turret behavior
- real VFX/damage through existing weapon systems
- roster/control panel/help/status
- clear/delete/reset controls
- simple enemy AI modes: passive, stationary_shooter, chaser, hold_position
```

---

## Deferred / out of scope

```text
- Arena save/load setups
- JSON import/export
- attack waves
- strategic AI
- economy AI
- base-building AI
- final production combat
- final art
- pathfinding rewrite
- obstacle gameplay in Arena
- fog of war / minimap in Arena
```

---

## Historical note

The original roadmap was written as a product-level planning document in Russian. The live source of truth after closure is now:

```text
docs/project/ARENA_SANDBOX_CLOSURE_REPORT.md
```
