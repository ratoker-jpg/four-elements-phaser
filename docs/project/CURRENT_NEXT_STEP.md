# CURRENT_NEXT_STEP.md

Status: FOG-VISION-AUDIT-07 — Fog of war and vision system design audit
Project: Four Elements Phaser  
Updated: 2026-06-21

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

#297 VEHICLE-RENDER-UNIFY-AUDIT
  Status: MERGED.
  Result: accepted 4-stage vehicle render unification roadmap.

#298 VEHICLE-RENDER-UNIFY-01-VH
  Status: MERGED.
  Result: Stage 1 + Stage 2 completed and manually QA-accepted by Denis.

#300 VEHICLE-RENDER-UNIFY-03-VH
  Status: MERGED.
  Result: Stage 3 completed and manually QA-accepted by Denis.

#302 VEHICLE-RENDER-UNIFY-04-VH
  Status: MERGED.
  Result: Stage 4 completed and manually QA-accepted by Denis.

#304 ARENA-VISUAL-COMBAT-FIX-01-HIGH
  Status: MERGED.
  Result: Arena visual/combat fix accepted by Denis manual QA.

#307 VISUAL-HUD-AUDIT
  Status: MERGED.
  Result: HUD audit/design document accepted.

#308 VISUAL-HUD-CORE-01-HIGHPLUS (+ FIXUP-1, FIXUP-2)
  Status: MERGED (DRAFT PR).
  Result: Bottom RTS HUD core prototype — camera safe-area, input guard, resource strip, selection panel, command panel placeholder.

#309 VISUAL-COMMAND-PANEL-02-HIGHPLUS (+ FIXUP-1)
  Status: MERGED (DRAFT PR).
  Result: Command panel MVP — context-sensitive commands, descriptorMap, aria-disabled.

#310 VISUAL-MINIMAP-03-VERYHIGH (+ FIXUP-1)
  Status: MERGED (DRAFT PR).
  Result: Minimap MVP — Canvas 2D, entity markers, 4-corner camera viewport.
```

**Direction change: Denis rejected the current HUD/command panel/minimap direction visually and UX-wise.** PRs #308–#310 are treated as technical prototypes, not an accepted final UX direction. The new direction is AoE4-inspired RTS UX redesign.

---

## Active next step (single)

```text
FOG-VISION-AUDIT-07-HIGHPLUS-DOCS
  Risk: High+ — audit/design for fog-of-war and vision system.
  Type: docs-only PR (DRAFT, not ready for merge).
  Goal: produce detailed technical design for future fog implementation.
  Deliverable: docs/project/FOG_VISION_AUDIT_2026_06_21.md
  Branch: docs/fog-vision-audit-07
  Base: main
  Status: DRAFT PR, pending GPT review + Denis approval.

  Previous steps:
    #312 HUD-LAYOUT-REBUILD-02-VERYHIGHPLUS: MERGED.
    #313 COMMAND-CARD-REBUILD-03-VERYHIGHPLUS: MERGED.
    #314 MINIMAP-INTERACTION-04-VERYHIGHPLUS: MERGED.
    #315 SELECTION-CONTROL-GROUPS-05-VERYHIGHPLUS: MERGED.
    #316 FEEDBACK-ALERTS-06-HIGHPLUS: MERGED.
      Result: typed feedback, command errors, control group feedback, idle worker alert, minimap pings.

  Fog is NOT yet implemented. This is a design audit only.
  Next likely task: FOG-VISION-IMPLEMENTATION-08-VERYHIGHPLUS (split into 08A–08D per audit).
```

---

## Direction change: from HUD integration to AoE4-like UX redesign

The current HUD implementation (PRs #308–#310) is a functional technical prototype but was rejected as the final UX direction by Denis. Key issues:

1. No stable command surface (flat 3-column grid, not a stable command card)
2. Hotkey badges are afterthoughts, not spatially mapped
3. Number keys 1/2/3 overloaded for build commands (conflicts with control groups)
4. Minimap is passive (no click-to-camera interaction)
5. Selection panel is text-only and shallow
6. No feedback/alert system
7. PlaytestHud still coexists (duplicate UI)
8. Layout feels prototype/debug-like
9. No fog/vision layer
10. No control groups

The new direction rebuilds the roadmap around AoE4-like RTS UX principles:
- Stable bottom command surface with 4×3 command card grid
- Q/W/E/R/A/S/D/F/Z/X/C/V hotkey spatial mapping
- Number keys reserved for control groups
- Interactive minimap (click-to-camera)
- Rich selection panel
- Status/toast alert lane
- Fog/vision as strategic layer

See `docs/project/VISUAL_AOE4_UX_REDESIGN_ROADMAP_2026_06_20.md` for the full redesign spec.

---

## Roadmap — implementation sequence

All steps 1–6 are merged. Step 7 is the current active step:

```text
1. VISUAL-AOE4-UX-REDESIGN-ROADMAP-01 — MERGED (direction accepted by Denis)
2. HUD-LAYOUT-REBUILD-02-VERYHIGHPLUS — MERGED via PR #312
3. COMMAND-CARD-REBUILD-03-VERYHIGHPLUS — MERGED via PR #313
4. MINIMAP-INTERACTION-04-VERYHIGHPLUS — MERGED via PR #314
5. SELECTION-CONTROL-GROUPS-05-VERYHIGHPLUS — MERGED via PR #315
6. FEEDBACK-ALERTS-06-HIGHPLUS — MERGED via PR #316
7. FOG-VISION-AUDIT-07-HIGHPLUS-DOCS — fog audit (THIS STEP, DRAFT PR #317)
8. FOG-VISION-IMPLEMENTATION-08-VERYHIGHPLUS — fog system (after audit, split into 08A–08D)
```

Each step requires Denis manual visual approval before merge.

---

## What is not next by default

```text
- Do not continue polishing the current HUD (#308-#310) as final.
- Do not implement HUD integration cleanup (VISUAL-HUD-INTEGRATION-04 is cancelled).
- Do not copy AoE4 assets or exact layout.
- Do not implement fog without audit.
- Do not mix control groups with current 1/2/3 build hotkeys without resolving conflict.
- Do not implement minimap interaction beyond MINIMAP-INTERACTION-04 scope (no fog, no enemy markers, no control groups).
- Do not merge High+ visual PRs without Denis manual visual approval.
- Do not continue renderer unification by inertia.
- Do not reopen #304 inside Visual Roadmap.
- Do not remove legacy build hotkey aliases (B/P) until control groups
  are implemented and accepted. Number key aliases (1/2/3) have been removed
  as part of SELECTION-CONTROL-GROUPS-05.
- Number keys 1-9 are now control group recall keys. Do not reassign them
  to other features. Legacy number build aliases are permanently removed.
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

## Manual QA gates for Visual Roadmap implementation

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
- HUD/minimap/command layout approved by Denis before merge.
- AoE4-like UX redesign roadmap accepted by Denis before implementation starts.
```

---

## Still in force (rules)

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
- Do not touch combat, movement, economy, pathfinding, save-load, bot/AI, or mapgen as part of Visual Roadmap/HUD work.
- Do not rewrite RenderManager/GameScene lifecycle without a concrete bug or accepted audit.
- Do not continue polishing current HUD as final until redesign spec is accepted.
```

---

## Read first

```text
AGENTS.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/VISUAL_ROADMAP.md
docs/project/VISUAL_AOE4_UX_REDESIGN_ROADMAP_2026_06_20.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
```
