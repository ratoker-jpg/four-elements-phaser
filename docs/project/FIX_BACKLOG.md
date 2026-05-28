# FIX_BACKLOG.md

Status: active backlog for Sandbox MVP stability work
Project: Four Elements Phaser
Repo: `ratoker-jpg/four-elements-phaser`
Date: 2026-05-29

---

## 1. Purpose

This file collects known issues and work groups after Phase 1 Foundation.

It is not an implementation plan by itself.

Required flow:

```text
FIX_BACKLOG -> audit/design -> scoped package -> implementation -> manual QA -> merge
```

Do not pick items from this file and implement them directly unless the audit/roadmap has accepted the package.

---

## 2. Completed work groups

These items from the corrected audit sequence are now merged.

### FIX-01 — Faction asset wiring (PR #83)

```text
Status: DONE
What: Wired faction-specific HQ and harvester asset keys in EntityRenderer.
Result: Non-cyan factions now display correct HQ and harvester visuals.
```

### PHASER4-ANIM-01 — Animation Manager spike (PR #84)

```text
Status: DONE
What: Validated Phaser 4.1.0 Animation Manager API.
Result: Spike report confirms API works with current spritesheet layout.
        Recommended harvester-first migration for PHASER4-ANIM-02.
```

### ARCH-18A-LITE — GameScene input/command extraction (PR #86)

```text
Status: DONE
What: Extracted GameInputController from GameScene.
Result: Input handling and command dispatch in dedicated module.
        GameScene no longer owns pointer/keyboard logic directly.
```

### FIX-02 — Harvester idle-forever UI feedback (PR #87)

```text
Status: DONE
What: Added blockedReason telemetry and idle-state visual indicator.
Result: Harvesters show feedback when blocked (no resource, no path, storage full).
```

### FIX-03 — Unit cap / ControlState (PR #88)

```text
Status: DONE
What: Added ControlState with unit cap enforcement and HUD display.
Result: Unit production respects cap; cap info visible in HUD.
```

### FIX-04 — Factory spawn blockage UI feedback + cancel (PR #89)

```text
Status: DONE
What: Added blockage reason display and cancel button for factory queue.
Result: Player sees why factory cannot spawn; can cancel queued units.
```

### PHASER4-ANIM-02 — Animation Manager migration (PR #85)

```text
Status: DONE
What: Migrated harvester walk cycle to Phaser Animation Manager.
Result: Harvesters use sprite.anims.play() instead of manual frame indexing.
        Direction-based animation keys per faction.
```

### PHASER4-LOAD-01 — Conditional asset loading spike (PR #90)

```text
Status: DONE
What: Validated Phaser 4.1.0 Loader/Pack for conditional loading.
Result: Spike report recommends dev/arena-only modularUnits loading.
        Faction-aware loading is feasible but premature.
```

### PHASER4-LOAD-02 — Dev/arena-only modularUnits loading (PR #91)

```text
Status: DONE
What: Gated modularUnits loading behind isDevtoolsEnabled().
       Added stripModularCombatFromState() for old saves in standard mode.
Result: Standard mode skips 64 modular combat assets.
        Devtools/arena mode loads them normally.
        Old saves with modular-combat entities are sanitized in standard mode.
```

### PHASER4-GPU-01 — SpriteGPULayer / TilemapGPULayer spike (PR #92)

```text
Status: DONE
What: Validated Phaser 4.1.0 GPU layer APIs.
Result: TilemapGPULayer is orthographic-only (hard blocker for isometric).
        SpriteGPULayer has no per-member depth (hard blocker for depth-sorted entities).
        Recommendation: no GPU layer implementation now.
        Reconsider when sprite count exceeds 50 or Phaser adds isometric/depth support.
```

---

## 3. Active next work group

### ARCH-11A — QA smoke automation

```text
Risk: low-medium
Scope: tooling
Purpose: Automate more comprehensive QA smoke checks for the features
         shipped in PR #83–#92.
Coverage targets:
  - new game start
  - faction selection
  - harvester movement and animation
  - harvester blocked status
  - factory production
  - unit cap
  - factory cancel
  - standard mode: modularUnits skipped
  - devtools/arena mode: modularUnits enabled
  - no console errors
Current state: qa_smoke.mjs verifies 3 console markers + screenshot.
```

---

## 4. Additional known issues (not yet in active sequence)

### 4.1 Harvester reliability

```text
Harvesters can gather and work for a while, then later stop gathering.
This existed before the recent UI/map/devtools work. It was parked intentionally.
Must audit before implementing fixes.
```

### 4.2 Unit grounding / centering / selection marker

```text
- selection marker/ring not properly grounded under unit;
- some units not centered on intended tile;
- unit visual anchor and tile anchor not consistently modeled.
Must stay system-first: no random per-unit offsets.
```

### 4.3 Lane movement / diagonal cut-through readability

```text
Units can visually appear to cut through cells / move diagonally.
Audit must separate actual state movement from visual readability.
```

### 4.4 Movement dust rework

```text
Current dust is acceptable as MVP but style should be redesigned later.
Future: softer shape, better placement, less circular look.
```

### 4.5 Controlled unit bobbing / suspension

```text
Future render-only visual: bobbing/suspension while moving.
Rules: no gameplay state changes, no idle bobbing for stationary units.
Must be planned in audit before implementation.
```

---

## 5. Explicitly parked / out of scope

```text
- combat foundation;
- enemy AI / bot;
- attack waves;
- upgrades;
- progression;
- balance progression;
- map editor;
- advanced asset previews;
- obstacle/decor visual placeholders;
- asset diagnostics CI integration;
- faction-aware loading (premature per PHASER4-LOAD-01);
- asset unloading (premature per PHASER4-LOAD-01);
- SpriteGPULayer / TilemapGPULayer implementation (rejected per PHASER4-GPU-01);
- command relay economy expansion;
- refund economy;
- full UI redesign.
```

---

## 6. Fix package rule

Do not implement one-off fixes directly from this backlog.

Required flow:

```text
1. Audit issue cluster.
2. Identify root cause and touched contracts.
3. Group into coherent fix package.
4. Define manual QA checklist.
5. Implement with validation.
6. Merge only after Denis manual QA.
```

If a fix fails after 1-2 attempts, stop and return to audit instead of guessing.
