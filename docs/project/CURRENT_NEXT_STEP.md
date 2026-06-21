# CURRENT_NEXT_STEP.md

Status: NEXT-ROADMAP-DECISION — choose next focus after AoE4 UX closure  
Project: Four Elements Phaser  
Updated: 2026-06-22

---

## Purpose

This file answers one operational question:

```text
What should GPT/GLM/Opus/Codex do next by default?
```

---

## Current baseline

```text
Renderer unification Stage 1-4 is CLOSED.
Arena visual/combat fix PR #304 is MERGED and accepted by Denis manual QA.
AoE4-inspired UX redesign slice is CLOSED after PR #319.
```

Completed visual / UX sequence:

```text
#307 VISUAL-HUD-AUDIT
  Status: MERGED.
  Result: HUD audit/design document accepted.

#308 VISUAL-HUD-CORE-01-HIGHPLUS
  Status: MERGED.
  Result: Bottom RTS HUD core prototype.

#309 VISUAL-COMMAND-PANEL-02-HIGHPLUS
  Status: MERGED.
  Result: Command panel MVP prototype.

#310 VISUAL-MINIMAP-03-VERYHIGH
  Status: MERGED.
  Result: Minimap MVP prototype.

#311 VISUAL-AOE4-UX-REDESIGN-ROADMAP-01
  Status: MERGED.
  Result: AoE4-inspired RTS UX direction accepted.

#312 HUD-LAYOUT-REBUILD-02-VERYHIGHPLUS
  Status: MERGED.
  Result: Bottom HUD layout rebuilt.

#313 COMMAND-CARD-REBUILD-03-VERYHIGHPLUS
  Status: MERGED.
  Result: 4x3 command card, S=Stop, F=Factory, R=Element Storage, HOME=Camera Reset.

#314 MINIMAP-INTERACTION-04-VERYHIGHPLUS
  Status: MERGED.
  Result: Minimap click-to-camera and drag-to-pan.

#315 SELECTION-CONTROL-GROUPS-05-VERYHIGHPLUS
  Status: MERGED.
  Result: Multi-select, drag-box, double-click same type, control groups 1-9.

#316 FEEDBACK-ALERTS-06-HIGHPLUS
  Status: MERGED.
  Result: Typed feedback, command errors, status lane, minimap pings.

#317 FOG-VISION-AUDIT-07-HIGHPLUS-DOCS
  Status: MERGED.
  Result: Fog/vision technical audit accepted.

#318 FOG-VISION-IMPLEMENTATION-08-VERYHIGHPLUS
  Status: MERGED.
  Result: Fog of war and vision implementation.

#319 AOE4-UX-POLISH-PASS-09-HIGHPLUS
  Status: MERGED.
  Result: Final AoE4-inspired RTS UX polish pass.
```

---

## Active next step

```text
NEXT-ROADMAP-DECISION
  Risk: Low until Denis chooses a new implementation focus.
  Type: planning / product decision, not implementation.
  Goal: choose the next roadmap slice after AoE4 UX closure.
  Status: waiting for Denis decision.
```

Default behavior:

```text
Do not start a new High+ / Very High+ implementation PR by default.
First ask Denis to choose the next focus, unless he has already chosen one explicitly.
```

---

## Candidate next directions

```text
1. VISUAL-QA-FIXUP
   Use only if Denis finds manual QA issues after #319.

2. #305 Wasp + Smoky muzzle origin follow-up
   Narrow visual/runtime fix. Keep separate from new roadmap work.

3. Economy / production / progression roadmap
   Audit/design first, then implementation sequence.

4. Combat / enemy / AI roadmap
   Audit/design first. Do not add enemy AI ad hoc.

5. Asset pipeline / turret integration roadmap
   Audit local/export state first. Avoid full matrix preload.

6. Save/load hardening roadmap
   Audit current save format, migrations, compatibility, QA cases.

7. New visual roadmap slice
   Terrain/resource fields/main menu/civil building cleanup, but only after accepted audit/design.
```

Recommended default: close docs first, then let Denis choose between a narrow #305 follow-up and a new large roadmap audit.

---

## AoE4 UX slice closure status

```text
AOE4-inspired UX redesign slice: CLOSED after PR #319.

Implemented systems:
- bottom HUD layout;
- 4x3 command card;
- RTS hotkeys and command feedback;
- minimap click/drag;
- multi-selection and control groups;
- typed feedback/status/minimap pings;
- fog of war and vision;
- final visual polish.
```

Closed does not mean bug-free forever. If Denis finds visual QA regressions, create a focused visual QA fixup PR instead of reopening the whole roadmap.

---

## What is not next by default

```text
- Do not continue AoE4 UX polish by inertia after #319.
- Do not start enemy AI without audit/design.
- Do not start economy/progression changes without audit/design.
- Do not start save/load hardening without audit/design.
- Do not reopen #308-#310 as final HUD direction.
- Do not copy AoE4 assets or exact layout.
- Do not assign number keys 1-9 to build commands. They are control groups.
- Do not merge High+ visual PRs without Denis manual visual approval.
- Do not touch #305 inside unrelated roadmap work.
```

---

## Required validation for future implementation work

Minimum:

```text
npm run typecheck
npm test
npm run build
npm run qa:smoke
git diff --check
secret/token scan
GitHub Actions final status
```

If build/Playwright is blocked in GLM/Codex/Opus environment, report it honestly and check GitHub Actions directly.

---

## Manual QA gates for future visual implementation

```text
- default game mode boots;
- devtools/Arena mode still boots;
- no default debug artifacts;
- no broken modular vehicles;
- no regression to #304 accepted Arena visuals;
- no silent cyan recolor;
- no full modular matrix preload;
- no old Wasp M0 preload;
- z-depth unchanged around units/buildings/resources unless explicitly in scope;
- HUD/minimap/command layout approved by Denis before merge when touched.
```

---

## Still in force

```text
- Do not restore pilotVehicleLazyLoad or old Wasp M0 preload.
- Do not restore pilotTurretComposition.
- Do not restore ModularTankDebugOverlay / offset tuner.
- Do not preload the full modular matrix.
- Do not use a combined hull x turret production matrix.
- Do not add new query-string visual test modes.
- Do not turn preview calibration offsets into production constants without audit.
- Do not blindly reuse PR #296 mount-slot / forward-back drift model.
- Do not touch composeModularVehicle() placement/math without explicit Denis approval.
- Do not rewrite RenderManager/GameScene lifecycle without a concrete bug or accepted audit.
- Do not continue closed roadmaps by inertia.
```

---

## Read first

```text
AGENTS.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/VISUAL_ROADMAP.md
docs/project/VISUAL_AOE4_UX_REDESIGN_ROADMAP_2026_06_20.md
docs/project/AOE4_UX_ROADMAP_CLOSURE_2026_06_22.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
```
