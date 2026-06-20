# VISUAL_ROADMAP_ACTIVATION_2026_06_20.md

Status: active direction note  
Project: Four Elements Phaser  
Updated: 2026-06-20

---

## Why this exists

After renderer unification and the Arena visual/combat fix, Denis selected the Visual Roadmap as the next project direction.

This note prevents agents from continuing old renderer work by inertia and defines the first Visual Roadmap step as audit/design, not runtime implementation.

---

## Closed before this activation

```text
Renderer unification Stage 1-4:
  CLOSED after PR #302 and docs sync.

Arena visual/combat fix:
  MERGED via PR #304.
  Accepted by Denis manual QA with one known follow-up.

Known follow-up:
  #305 — Smoky muzzle origin on Wasp hull.
  This is tracked separately and is not a blocker for Visual Roadmap unless a task touches Wasp+Smoky muzzle/VFX.
```

---

## Active direction

```text
Visual Roadmap
```

The first operational task should be:

```text
VISUAL-AUDIT-01 / VISUAL-HUD-AUDIT
  Type: docs/design only.
  Runtime implementation: not allowed yet.
  Required approval: GPT review + Denis visual approval before any HUD implementation PR.
```

---

## Why HUD first

`VISUAL_ROADMAP.md` identifies the target RTS HUD direction:

```text
bottom-left: minimap
bottom-center: selected unit/building information
bottom-right: command/actions/hotkeys
```

HUD is the best first Visual Roadmap slice because:

```text
- it is highly visible to the player;
- current PlaytestHud/debug-style UI is not a production RTS layout;
- it can be audited/designed before touching terrain, map generation, assets, or combat;
- it creates a UX frame for later terrain/resources/unit polish.
```

---

## What VISUAL-HUD-AUDIT must produce

```text
1. Current HUD inventory.
2. Current UX problems.
3. Target RTS HUD layout.
4. Minimap requirements and constraints.
5. Selected unit/building panel requirements.
6. Command/actions/hotkey panel requirements.
7. DOM vs Phaser UI recommendation.
8. Implementation split into controlled PRs.
9. Manual visual QA checklist.
10. Stop rules for implementation.
```

---

## What is not next

Do not start these by default:

```text
- HUD runtime implementation;
- terrain runtime integration;
- asset generation;
- main menu background art;
- civil unit visual refresh;
- resource visual refresh;
- Wasp+Smoky muzzle fix (#305);
- renderer unification continuation;
- RenderManager/GameScene lifecycle rewrite.
```

Those can be selected later, but only after the current audit/design step is accepted or Denis explicitly changes priority.

---

## Stop rules

```text
- No Visual Roadmap runtime implementation before audit/design acceptance.
- No HUD implementation before Denis visual approval.
- No economy/pathfinding/save-load/bot/mapgen changes inside HUD/visual tasks.
- No broad Phaser/projection refactor inside HUD work.
- No asset-generation work without accepted asset spec.
- No reopening PR #304 for unrelated Visual Roadmap work.
- #305 remains a narrow follow-up: Smoky muzzle origin on Wasp hull only.
```

---

## Recommended next prompt name

```text
VISUAL-HUD-AUDIT
```

Mode:

```text
Audit/design only.
Do not edit runtime code.
Do not edit assets.
Do not open implementation PR.
Return a HUD design/spec and implementation split.
```
