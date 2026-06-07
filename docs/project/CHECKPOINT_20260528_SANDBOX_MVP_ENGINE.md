# CHECKPOINT_20260528_SANDBOX_MVP_ENGINE.md

Status: checkpoint document
Project: Four Elements Phaser
Repo: `ratoker-jpg/four-elements-phaser`
Date: 2026-05-29

---

## 1. Purpose

This checkpoint captures the state of the Sandbox MVP engine/foundation roadmap after all 10 work items (PR #83–#92) are merged to main.

A new GPT/GLM session can use this document, together with `PROJECT_STATE.md` and `NEW_CHAT_HANDOFF.md`, to resume work without relying on chat memory.

---

## 2. Active repo

```text
ratoker-jpg/four-elements-phaser
```

---

## 3. Phaser version

```text
4.1.0
```

---

## 4. Donor repo

```text
ratoker-jpg/four-elements-next is reference only, never active baseline.
```

---

## 5. Merged PR summary (PR #83–#92)

| PR | Task | What changed |
|----|------|--------------|
| #83 | FIX-01 | Wired faction-specific HQ and harvester asset keys in EntityRenderer. Non-cyan factions display correct visuals. |
| #84 | PHASER4-ANIM-01 | Animation Manager spike report. Confirmed Phaser 4.1.0 API works with current spritesheet layout. Recommended harvester-first migration. |
| #85 | PHASER4-ANIM-02 | Migrated harvester walk cycle from manual frame indexing to Phaser Animation Manager. Direction-based animation keys per faction. |
| #86 | ARCH-18A-LITE | Extracted GameInputController from GameScene. Input handling and command dispatch moved to dedicated module. |
| #87 | FIX-02 | Added harvester blockedReason telemetry and idle-state visual indicator (no resource, no path, storage full). |
| #88 | FIX-03 | Added ControlState with unit cap enforcement and cap display in HUD. |
| #89 | FIX-04 | Added factory spawn blockage UI feedback and cancel button for factory queue. |
| #90 | PHASER4-LOAD-01 | Conditional asset loading spike report. Recommended dev/arena-only modularUnits loading. Faction-aware loading premature. |
| #91 | PHASER4-LOAD-02 | Gated modularUnits loading behind isDevtoolsEnabled(). Added stripModularCombatFromState() for old saves in standard mode. |
| #92 | PHASER4-GPU-01 | GPU layer spike report. TilemapGPULayer: orthographic only (blocked). SpriteGPULayer: no per-member depth (blocked). No implementation recommended. |

---

## 6. Current Sandbox MVP status

### 6.1 Stabilized features

- **Civil loop**: gather raw, convert at separator, build with matter, spawn units at factory
- **Faction assets**: HQ, harvester, builder, building images all faction-aware
- **Harvester animation**: Animation Manager drives walk cycle; direction-based keys per faction
- **Input/command**: GameInputController extracted; GameScene delegates input
- **Harvester blocked feedback**: blockedReason telemetry + visual indicator
- **Unit cap**: ControlState enforces cap; HUD shows cap info
- **Factory blockage/cancel**: Player sees why factory cannot spawn; can cancel queued units
- **Modular combat assets**: devtools/arena-only (`?devtools=1` / `?arena=1`); standard mode skips 64 modular images
- **Old save compatibility**: stripModularCombatFromState() sanitizes loaded saves in standard mode

### 6.2 Spike decisions

- **Animation Manager**: adopted (PHASER4-ANIM-02 implemented)
- **Conditional loading**: adopted for dev/arena-only modularUnits (PHASER4-LOAD-02 implemented); faction-aware loading deferred
- **GPU layers**: rejected/postponed (PHASER4-GPU-01); isometric depth constraints are hard blockers

---

## 7. Explicitly parked / out of scope

```text
- combat
- enemy AI / bot
- enemy economy
- attack waves
- upgrades
- progression
- faction-aware loading (premature per PHASER4-LOAD-01)
- asset unloading (premature per PHASER4-LOAD-01)
- SpriteGPULayer / TilemapGPULayer implementation (rejected per PHASER4-GPU-01)
- command relay economy expansion
- refund economy
- full UI redesign
```

---

## 8. Next recommended roadmap step

**ARCH-11A — QA smoke automation / Sandbox MVP regression coverage**

Why next: We now need stronger automated coverage for the features shipped in PR #83–#92.

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

---

## 9. Key architectural facts

### 9.1 Architecture layers

```text
Pure TS state / logic    — no Phaser imports
Phaser rendering          — reads state, renders visuals, no gameplay logic
DOM HUD / UI              — separate from Phaser-specific rendering
```

### 9.2 Isometric projection

```text
Tile: 76×38
tileToScreen(tx, ty) = { x: (tx - ty) * 38, y: (tx + ty) * 19 }
Depth model: depth = baseValue + worldY (painter's algorithm)
```

### 9.3 Asset loading

```text
Total manifest: 106 asset keys
Standard mode: 42 keys (106 - 64 modularUnits)
Devtools/arena mode: 106 keys
Gating: isDevtoolsEnabled() checks URL param ?devtools=1
```

### 9.4 Animation

```text
System: Phaser 4.1.0 Animation Manager
Harvester: direction-based walk cycles via sprite.anims.play()
Other units: not yet migrated (builder uses manual frame indexing)
Idle: single-frame (setFrame) or low-repeat animation
```

### 9.5 Smoke test

```text
3 required console markers:
  [PreloadScene] All assets loaded.
  [GameScene] All asset textures verified.
  [GameScene] State-driven scene ready.
Tool: tools/qa_smoke.mjs
```

---

## 10. Source-of-truth doc hierarchy

```text
1. docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md  — corrected audit
2. docs/project/PROJECT_STATE.md                      — operational state
3. docs/project/NEW_CHAT_HANDOFF.md                   — new chat protocol
4. docs/project/FIX_BACKLOG.md                        — known issues
5. docs/project/PHASE_1_FREEZE.md                     — active freeze
6. docs/project/CHECKPOINT_20260528_SANDBOX_MVP_ENGINE.md — this document
```

---

## 11. Spike reports in docs/project/

```text
PHASER4_ANIM_01_SPIKE_REPORT.md  — Animation Manager spike
PHASER4_LOAD_01_SPIKE_REPORT.md  — Conditional loading spike
PHASER4_GPU_01_SPIKE_REPORT.md   — GPU layer spike
```
