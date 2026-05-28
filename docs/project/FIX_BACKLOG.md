# FIX_BACKLOG.md

Status: active backlog for Sandbox MVP stability work  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-05-28

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

## 2. Confirmed work groups

These work groups are from the corrected Phaser 4 audit (`PHASER4_AUDIT_CLARIFICATION_RETRY.md`).

### FIX-01 — Faction asset wiring: HQ + harvester hardcoded cyan

```text
Risk: high-controlled
Scope: runtime
Problem: Non-cyan faction HQ and harvester use hardcoded cyan assets.
         Other factions can be selected but show wrong or missing visuals.
Solution: Wire faction-specific asset keys in renderers.
Touched:
  - EntityRenderer is the expected primary file.
  - Use getHqAssetKey(faction) and getCivilUnitKey(faction, 'harvester')
    if those helpers exist.
  - Do not change ConstructionRenderer, PreloadScene,
    generatedAssetManifest, state init, or asset files unless a direct
    implementation-time code check proves they are part of the root cause.
  - Builder/building rendering is believed to already be faction-aware
    and should not be changed in FIX-01 unless disproven.
Blocks: Multi-faction playtesting
```

### PHASER4-ANIM-01 — Animation Manager spike

```text
Risk: low (spike only)
Scope: research / spike
Purpose: Validate Phaser 4.1.0 Animation Manager API for sprite animations.
Output: Decision document with API findings and migration recommendation.
Do not: Implement production animation system during spike.
```

### ARCH-18A-LITE — GameScene input/command extraction

```text
Risk: medium
Scope: refactor
Purpose: Extract input handling and command dispatch from GameScene.
Constraint: Small scope only — no UI rewrite, no new systems beyond extraction.
```

### FIX-02 — Harvester idle-forever UI feedback

```text
Risk: medium
Scope: runtime + UI
Problem: Harvesters can enter idle-forever state with no visual feedback.
Solution: Add blockedReason telemetry and idle-state visual indicator.
Depends on: Understanding of harvester phase transitions (audit first)
```

### FIX-03 — Unit cap / ControlState

```text
Risk: medium
Scope: state + UI
Problem: No unit cap or ControlState enforcement.
Solution: Add ControlState with unit cap, display cap info in HUD.
```

### FIX-04 — Factory spawn blockage UI feedback + cancel

```text
Risk: medium
Scope: UI + state
Problem: No feedback when factory cannot spawn. No cancel for queued units.
Solution: Add blockage reason display and cancel button for factory queue.
```

### PHASER4-ANIM-02 — Animation Manager migration

```text
Risk: high-controlled
Scope: runtime
Purpose: Migrate sprite animations to Phaser 4 Animation Manager.
Depends on: PHASER4-ANIM-01 spike findings
```

### PHASER4-LOAD-01 — Conditional asset loading spike

```text
Risk: low (spike only)
Scope: research / spike
Purpose: Validate Phaser 4.1.0 Loader/Pack for conditional asset loading.
Output: Decision document with API findings.
```

### PHASER4-GPU-01 — SpriteGPULayer / TilemapGPULayer spike

```text
Risk: low (spike only)
Scope: research / spike
Purpose: Validate Phaser 4.1.0 GPU layer APIs for performance gains.
Output: Decision document with findings and go/no-go recommendation.
```

### ARCH-11A — QA smoke automation

```text
Risk: low-medium
Scope: tooling
Purpose: Automate more comprehensive QA smoke checks.
```

---

## 3. Additional known issues (not yet in audit sequence)

### 3.1 Harvester reliability

```text
Harvesters can gather and work for a while, then later stop gathering.
This existed before the recent UI/map/devtools work. It was parked intentionally.
Must audit before implementing fixes.
```

### 3.2 Unit grounding / centering / selection marker

```text
- selection marker/ring not properly grounded under unit;
- some units not centered on intended tile;
- unit visual anchor and tile anchor not consistently modeled.
Must stay system-first: no random per-unit offsets.
```

### 3.3 Lane movement / diagonal cut-through readability

```text
Units can visually appear to cut through cells / move diagonally.
Audit must separate actual state movement from visual readability.
```

### 3.4 Movement dust rework

```text
Current dust is acceptable as MVP but style should be redesigned later.
Future: softer shape, better placement, less circular look.
```

### 3.5 Controlled unit bobbing / suspension

```text
Future render-only visual: bobbing/suspension while moving.
Rules: no gameplay state changes, no idle bobbing for stationary units.
Must be planned in audit before implementation.
```

---

## 4. Non-blocking / later backlog

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
- asset diagnostics CI integration.
```

---

## 5. Fix package rule

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
