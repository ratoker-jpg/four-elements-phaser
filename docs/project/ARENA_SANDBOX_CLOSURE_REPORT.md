# ARENA_SANDBOX_CLOSURE_REPORT.md

Status: CLOSED / accepted implementation cycle  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Cycle: Arena Sandbox  
Closed after: PR #184  
Date: 2026-06-03

---

## 1. Closure verdict

The Arena Sandbox roadmap and technical audit are closed.

```text
ARENA-00H+ through ARENA-05H+ are complete and merged.
The Arena mode is now usable as a standalone combat sandbox.
No further Arena implementation should continue by inertia.
Next implementation requires a new roadmap/audit or an explicit owner-approved follow-up.
```

---

## 2. Merged PR sequence

```text
#178 — ARENA-00H+: Arena Sandbox roadmap
#179 — ARENA-00H+: Arena Sandbox system audit
#180 — ARENA-01H+: Standalone Clean Arena
#181 — ARENA-02H+: Unit Creation and Click Placement
#182 — ARENA-03H+: Control, Targeting and Turret Rules
#183 — ARENA-04H+: Arena Control Panel Roster Usability Help
#184 — ARENA-05H+: Enemy Behavior Modes
```

---

## 3. What the cycle delivered

### Standalone Arena mode

```text
- Arena is a separate mode, not Normal Game with DevTools on top.
- Arena is clean: no HQ/base, no harvesters, no resource nodes, no economy HUD, no production HUD.
- Arena has no gameplay obstacles and reset does not restore obstacles.
- DevTools can exist as technical debug, but ArenaMenu is the primary UX.
```

### Unit creation and placement

```text
- User manually selects body, weapon and team.
- Bodies: Wasp, Hornet, Hunter, Viking, Dictator, Titan, Mammoth.
- Weapons: Smoky, Thunder, Railgun, Shaft, Flamethrower, Freeze, Isida, Vulcan, Twins, Ricochet, Hammer.
- Teams: Ally / Enemy.
- No forced preset body+weapon combinations as the main flow.
- Placement uses CAMERA_PROJECTION_CONTRACT.md via unprojectScreenToGround().
- Placement marker is projected on the ground plane, not drawn as top-down screen UI.
- LMB places, Esc/RMB cancels placement.
- Occupied/out-of-bounds placement is rejected.
```

### Control and target-lock combat rules

```text
- Allies are controllable.
- Enemies are not controllable.
- Clicking an enemy while an ally is selected assigns the enemy as target.
- Enemy click does not switch control to enemy.
- RMB moves selected ally only.
- Turret does not continuously follow mouse in Arena.
- Turret tracks selected enemy target.
- If no target exists, Arena fire is blocked / stopped safely.
- Missing or destroyed target clears target state and stops continuous fire.
- Non-Arena DevTools mouse-follow behavior remains preserved.
```

### Arena Control Panel

```text
- Roster lists placed units.
- Rows show body, weapon, team, HP, alive/destroyed, selected and targeted markers.
- Ally row selects controllable ally.
- Enemy row assigns target only when a selected ally exists.
- Enemy row never becomes controllable selection.
- Delete selected, delete row, clear all, clear allies, clear enemies, reset arena are available.
- Delete/clear/reset clean selected/target references and stop affected firing.
- Help/status messages explain placement, control, targeting, firing and cleanup.
```

### Enemy behavior modes

```text
- passive: enemy stands still, can be damaged/destroyed, does not fire.
- stationary_shooter: enemy stands still, targets/fires at ally in range.
- chaser: enemy moves toward nearest ally and fires when in range.
- hold_position: enemy engages only within hold radius and returns/holds safely.
- AI mode selector appears for enemy unit creation.
- New enemy units spawn with selected aiMode.
- Allies never run AI.
- AI update is gated to Arena mode.
- Normal Game remains unchanged.
```

---

## 4. Accepted limitations / deferred work

These are intentional non-goals, not regressions:

```text
- No Arena save/load setups.
- No JSON import/export for arena layouts.
- No attack waves.
- No strategic/economy/base-building AI.
- No final art.
- No production combat system.
- No pathfinding rewrite.
- No mapgen rewrite.
- No camera rotation.
- No obstacles in Arena.
- No fog of war/minimap in Arena.
- AI mode switching for existing placed enemies is deferred unless reopened.
- AI behavior is simple test behavior, not final opponent design.
```

---

## 5. Projection contract status

All Arena visual/world-space work remains bound by:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

Required rules continue to apply:

```text
- This is fixed isometric / axonometric 2.5D, not top-down.
- Camera pan + zoom are allowed; camera rotation is forbidden.
- screen = origin + x*basisX + y*basisY + z*basisZ.
- Ground markers, range indicators, shadows, selection rings and footprints must be projected onto the ground plane.
- Do not use top-down screen circles for ground-space concepts.
```

---

## 6. Validation at closure

Last implementation PR reported:

```text
PR #184
npm run typecheck — PASS
npm run test — PASS, 1700 tests
npm run build — PASS
npm run qa:smoke — PASS
```

---

## 7. Required manual QA after closure

Before building the next roadmap, do at least one browser pass:

```text
1. Open Arena mode.
2. Place Ally Wasp+Smoky.
3. Place Enemy Wasp+Smoky with Passive AI — confirm it does not fire.
4. Place Enemy Wasp+Smoky with Shooter AI — confirm turret tracks and damage occurs.
5. Place Enemy Chaser — confirm it moves toward ally and fires in range.
6. Place Enemy Hold Pos — confirm it engages only within hold radius.
7. Select ally, click enemy, move ally around enemy — turret stays locked on target.
8. Use roster delete/clear/reset and confirm selected/target refs do not break.
9. Confirm Arena reset has no HQ, harvesters, resources, economy HUD or obstacles.
10. Open Normal Game and confirm it still has normal HQ/harvester/resource behavior.
```

---

## 8. Operational next step

The project currently has no active implementation roadmap after this closure.

Next default action:

```text
Choose the next product direction and create a new roadmap audit.
```

Recommended candidates:

```text
1. Arena polish / manual QA follow-up audit.
2. Production visual/world-space roadmap using CAMERA_PROJECTION_CONTRACT.md.
3. Return to Normal Game civil loop/economy readability.
4. Asset integration roadmap for final tanks/units/buildings.
```

Do not start implementation for any of these without a new accepted roadmap/audit.
