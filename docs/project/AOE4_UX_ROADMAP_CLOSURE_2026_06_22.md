# AOE4_UX_ROADMAP_CLOSURE_2026_06_22.md

Status: closed roadmap slice  
Project: Four Elements Phaser  
Updated: 2026-06-22

---

## Executive summary

The AoE4-inspired RTS UX redesign slice is closed after PR #319.

This slice replaced the earlier technical HUD prototypes from PRs #308-#310 with a more complete RTS UX layer:

```text
HUD layout
+
4x3 command card
+
interactive minimap
+
selection/control groups
+
feedback/alerts
+
fog of war / vision
+
final visual polish
```

Closed means the roadmap slice is no longer the default active queue. Future issues found by Denis manual QA should become focused fixup PRs, not a continuation of the whole roadmap by inertia.

---

## Completed sequence

```text
#311 VISUAL-AOE4-UX-REDESIGN-ROADMAP-01
  Result: accepted AoE4-inspired UX redesign direction.

#312 HUD-LAYOUT-REBUILD-02-VERYHIGHPLUS
  Result: bottom HUD layout rebuilt.

#313 COMMAND-CARD-REBUILD-03-VERYHIGHPLUS
  Result: 4x3 command card, Q/W/E/R/A/S/D/F/Z/X/C/V layout, S=Stop, F=Factory, R=Element Storage, HOME=Camera Reset.

#314 MINIMAP-INTERACTION-04-VERYHIGHPLUS
  Result: minimap click-to-camera, drag-to-pan, selected marker highlight, input isolation.

#315 SELECTION-CONTROL-GROUPS-05-VERYHIGHPLUS
  Result: multi-select, drag-box selection, double-click same type, Ctrl+1-9 assign, 1-9 recall, double-tap center.

#316 FEEDBACK-ALERTS-06-HIGHPLUS
  Result: typed feedback model, disabled command reasons, control group feedback, build feedback, idle worker alerts, minimap pings.

#317 FOG-VISION-AUDIT-07-HIGHPLUS-DOCS
  Result: fog/vision technical design audit.

#318 FOG-VISION-IMPLEMENTATION-08-VERYHIGHPLUS
  Result: fog of war and vision system implemented in one PR with internal checkpoints.

#319 AOE4-UX-POLISH-PASS-09-HIGHPLUS
  Result: final visual/UX polish for HUD, command card, minimap, fog, selection, feedback.
```

---

## Systems now implemented

### HUD layout

- Bottom RTS HUD surface.
- Top-left resource strip.
- Selection panel.
- Command card area.
- Minimap area.
- Status/feedback lane.
- HUD input isolation.

### Command card

- 4x3 spatial command grid.
- Hotkey layout: `Q/W/E/R`, `A/S/D/F`, `Z/X/C/V`.
- `S = Stop`.
- `F = Units Factory`.
- `R = Element Storage`.
- `HOME = Camera Reset`.
- Disabled command feedback.
- Number keys are no longer build aliases.

### Minimap

- Canvas minimap.
- Click-to-camera.
- Drag-to-pan.
- Camera viewport rectangle.
- Selected marker highlight.
- Fog rendering.
- Feedback pings.

### Selection and control groups

- Single select.
- Multi-select.
- Drag-box selection.
- Double-click same type.
- `Ctrl+1-9` assign groups.
- `1-9` recall groups.
- Double-tap group centers camera.
- Multi-select panel summary.

### Feedback and alerts

- Typed feedback model.
- Deduped status messages.
- Disabled command reasons.
- Insufficient resource feedback.
- Control group feedback.
- Build start/complete feedback.
- Idle worker alert MVP.
- Minimap pings.

### Fog of war and vision

- Three-state tile model: unexplored / explored / visible.
- Diamond-radius vision.
- Vision sources from HQ/buildings/builders/harvesters.
- Building radius lookup through canonical runtime-to-production mapping.
- Main fog overlay.
- Minimap fog.
- Resource visibility through fog.
- Save/load support for explored state.

---

## Known non-goals / still deferred

These were intentionally not implemented in this roadmap slice:

```text
- enemy AI;
- edge pan;
- attack-move;
- formations;
- patrol / hold-position;
- full combat roadmap;
- deeper economy / progression roadmap;
- turret asset integration roadmap;
- #305 Wasp + Smoky muzzle origin follow-up;
- exact AoE4 visual copy;
- new generated assets;
- full renderer architecture rewrite.
```

---

## Manual QA checklist for the closed slice

Use this if Denis wants one final acceptance pass:

```text
- Normal game opens without errors.
- HUD readable at 1280x720.
- Command card buttons are readable and clickable.
- S=Stop, F=Factory, R=Element Storage.
- HOME resets camera.
- 1-9 control groups work.
- Ctrl+1-9 assigns groups.
- Minimap click/drag controls camera.
- Minimap fog is readable.
- Main fog is readable.
- No fog holes after camera pan/zoom.
- Resources do not show through unexplored fog.
- Explored resources are dimmed.
- Own units remain selectable under fog.
- Drag-box selection works.
- Double-click same type works.
- Disabled command shows reason.
- Feedback does not spam.
- Build start/complete feedback works.
- Minimap pings are visible and expire.
- Save/load does not crash.
- Arena mode still works.
- Pause/Esc still works.
- No edge pan added.
- No enemy AI added.
- No attack-move/formations/patrol added.
- No Wasp+Smoky muzzle changes.
```

---

## Recommended next roadmap choices

No implementation starts by default after this closure.

Candidate directions:

```text
1. VISUAL-QA-FIXUP
   Only if Denis finds visual/UX issues in manual QA after #319.

2. #305 Wasp + Smoky muzzle origin follow-up
   Narrow fix. Keep isolated from larger roadmap work.

3. Economy / production / progression roadmap
   Needs audit/design first.

4. Combat / enemy / AI roadmap
   Needs audit/design first. Do not add enemy AI ad hoc.

5. Asset pipeline / turret integration roadmap
   Needs current asset/export audit first.

6. Save/load hardening roadmap
   Needs compatibility/migration audit first.

7. New visual roadmap slice
   Terrain/resource field/main menu/civil visual cleanup, with audit first.
```

Recommended operational rule:

```text
roadmap -> audit/design -> scoped PR sequence -> implementation
```

---

## Closure decision

```text
AoE4-inspired UX redesign slice is CLOSED.
Current default work item is NEXT-ROADMAP-DECISION.
```
