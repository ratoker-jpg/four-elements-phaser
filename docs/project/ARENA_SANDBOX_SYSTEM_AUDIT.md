# ARENA SANDBOX SYSTEM AUDIT — CLOSED

Status: CLOSED / implemented and accepted  
Project: Four Elements Phaser  
Repository: `ratoker-jpg/four-elements-phaser`  
Original roadmap: `docs/project/ARENA_SANDBOX_ROADMAP.md`  
Closed after: PR #184  
Date: 2026-06-03

---

## Closure note

This technical audit is no longer an active implementation queue.

It was used as the source-of-truth audit for the Arena Sandbox implementation cycle:

```text
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

Do not continue implementation directly from this audit. For new Arena work, create a follow-up roadmap/audit or explicit owner-approved amendment.

---

## Final implemented PR sequence

```text
ARENA-01H+ [High]  — Standalone Clean Arena
ARENA-02H+ [High+] — Unit Creation + Click Placement
ARENA-03H+ [High+] — Control, Targeting, and Turret Rules
ARENA-04H+ [High]  — Arena Control Panel: Roster + Usability + Help
ARENA-05H+ [High+] — Enemy Behavior Modes
```

---

## Final implementation map

### ARENA-01H+ — Standalone Clean Arena

Implemented:

```text
- separate clean Arena mode
- no HQ/base rendered in Arena
- no harvesters/resources/economy/production HUD
- no gameplay obstacles
- ArenaMenu shell as primary UX
- DevTools hidden by default in Arena, still available for technical debug
- Arena reset does not restore obstacles
```

### ARENA-02H+ — Unit Creation + Click Placement

Implemented:

```text
- body selector
- weapon selector
- team selector
- Place Unit flow
- click-to-place using unprojectScreenToGround()
- projected ground-plane marker
- placement guard against LMB/RMB/Esc conflicts
- occupied/out-of-bounds rejection
```

### ARENA-03H+ — Control, Targeting, and Turret Rules

Implemented:

```text
- ally selectable/controllable
- enemy target-only / non-controllable
- enemy click assigns target when ally selected
- RMB moves ally only
- turret target-lock in Arena
- no mouse-follow turret in Arena
- fire blocked/stopped without valid target
- continuous fire stops when target is missing/destroyed
- non-Arena DevTools mouse-follow preserved
```

### ARENA-04H+ — Arena Control Panel: Roster + Usability + Help

Implemented:

```text
- roster rows show body, weapon, team, HP, alive/destroyed, selected/targeted markers
- ally row selects controllable ally
- enemy row assigns target only when ally selected
- enemy row never becomes controllable selection
- delete selected / delete row
- clear all / clear allies / clear enemies
- reset Arena
- selected/target references cleaned when units are removed
- help/status messages
```

### ARENA-05H+ — Enemy Behavior Modes

Implemented:

```text
- passive
- stationary_shooter
- chaser
- hold_position
- AI mode selector for newly placed enemies
- enemy AI gated to Arena mode
- allies do not run AI
- simple AI uses existing movement fields
- single-shot AI firing uses fireBlockoutWeapon() + applyBlockoutWeaponDamage()
- continuous AI firing uses existing continuous fire loop
```

---

## Projection contract requirements preserved

All visual/world-space Arena work remains bound by:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

Required rules:

```text
- fixed isometric / axonometric 2.5D
- not top-down
- not side-view
- camera pan + zoom allowed
- camera rotation forbidden
- ground markers/rings/shadows/ranges/footprints projected onto ground plane
```

---

## Known deferred work

```text
- manual Arena QA pass
- Arena polish follow-up, if owner chooses it
- AI mode switching for existing enemies, if reopened
- Arena save/load/import/export, if reopened
- attack waves, if reopened
- strategic/economy/base-building AI, if reopened
- final art / final combat / pathfinding work, if reopened
```

---

## Historical note

The original 1000+ line audit was intentionally replaced by this closure summary because the cycle is now implemented. Detailed decisions are preserved in PR bodies #179-#184 and in the closure report.
