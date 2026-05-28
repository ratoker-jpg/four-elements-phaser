# Phaser 4 Audit Clarification Retry

Status: corrected source-of-truth audit  
Project: Four Elements Phaser  
Active repo: `ratoker-jpg/four-elements-phaser`  
Reference/donor repo: `ratoker-jpg/four-elements-next` (reference only)  
Date: 2026-05-28

---

## 1. Purpose

This document is the corrected Phaser 4 audit for the Four Elements project.

A previous clarification audit accidentally analyzed `four-elements-next` / Phaser 3.90. That audit is **invalid** for active implementation planning.

This retry confirms:

```text
Active repo: ratoker-jpg/four-elements-phaser
Phaser version: 4.1.0
Reference repo: ratoker-jpg/four-elements-next (donor/reference only)
```

All roadmap and future prompts must use this document as the current source-of-truth.

---

## 2. Confirmed baseline

### 2.1 Active repo

```text
ratoker-jpg/four-elements-phaser
```

This is the only repo where implementation happens.

### 2.2 Phaser version

```text
4.1.0
```

Verified from `package.json`:
```json
"phaser": "4.1.0"
```

### 2.3 Reference repo

```text
ratoker-jpg/four-elements-next
```

This is donor/reference only. It must never be treated as the active implementation baseline.

The previous audit incorrectly analyzed this repo's Phaser 3.90 setup. That analysis does not apply.

---

## 3. Phaser 4.1.0 available APIs

Phaser 4.1.0 provides these systems relevant to the project:

| System | Available | Notes |
|--------|-----------|-------|
| Animation Manager | Yes | Sprite animation playback, frame-based animation, blend/transition support |
| Tweens | Yes | Visual interpolation, fire-and-forget pulses, progress feedback |
| Particles | Yes | ParticleEmitter for dust, one-shot bursts, flow emission |
| Containers | Yes | Grouped transform for composite objects |
| Groups / Layers | Yes | Batch management for sprites |
| TilemapGPULayer | Yes | GPU-accelerated tile rendering (spike/research only) |
| SpriteGPULayer | Yes | GPU-accelerated sprite batch rendering (spike/research only) |
| Filters / Shaders | Yes | Post-processing, color correction, visual effects |
| Loader / Pack | Yes | Asset loading, pack files, conditional loading |

These APIs are available but not all are currently used. Adoption follows: spike -> decision -> scoped implementation.

---

## 4. What the previous audit got wrong

The previous clarification audit:

```text
1. Analyzed four-elements-next instead of four-elements-phaser.
2. Reported Phaser 3.90 APIs as the available set.
3. Recommended migration paths from Phaser 3 patterns.
4. Did not reflect the actual Phaser 4.1.0 runtime.
5. Produced a roadmap sequence based on Phaser 3 constraints.
```

All conclusions from that audit are superseded by this document.

---

## 5. Corrected roadmap sequence

The following sequence replaces any previous roadmap ordering derived from the invalid audit.

This sequence is for the post-Phase-1-freeze Sandbox MVP work:

```text
1.  FIX-01 — Faction asset wiring: HQ + harvester hardcoded cyan
2.  PHASER4-ANIM-01 — Animation Manager spike
3.  ARCH-18A-LITE — GameScene input/command extraction
4.  FIX-02 — Harvester idle-forever UI feedback
5.  FIX-03 — Unit cap / ControlState
6.  FIX-04 — Factory spawn blockage UI feedback + cancel
7.  PHASER4-ANIM-02 — Animation Manager migration
8.  PHASER4-LOAD-01 — Conditional asset loading spike
9.  PHASER4-GPU-01 — SpriteGPULayer / TilemapGPULayer spike
10. ARCH-11A — QA smoke automation
```

### Sequence rationale

```text
FIX-01 is first because non-cyan factions have missing/invisible HQ and
harvester visuals. This blocks any meaningful multi-faction playtesting.

PHASER4-ANIM-01 is an animation spike that should happen early to inform
later animation-dependent work (idle states, production feedback, etc.).

ARCH-18A-LITE reduces GameScene coupling before more systems are added.
It is small-scope input/command extraction only.

FIX-02 through FIX-04 are small targeted fixes that unblock economy/unit
feedback loops. They should not expand into larger reworks.

PHASER4-ANIM-02 is the actual animation migration after the spike validates
the approach.

PHASER4-LOAD-01 and PHASER4-GPU-01 are research spikes that may or may not
lead to implementation. They are sequenced after functional fixes.

ARCH-11A is QA smoke automation to harden CI before more complex work.
```

---

## 6. Work group details

### FIX-01 — Faction asset wiring: HQ + harvester hardcoded cyan

```text
Risk: high-controlled
Scope: runtime
Problem: Non-cyan faction HQ and harvester use hardcoded cyan assets.
         Other factions can be selected but show wrong or missing visuals.
Solution: Wire faction-specific asset keys in renderers and state builders.
Touched: EntityRenderer, ConstructionRenderer, asset key mapping, state init
Blocks: Multi-faction playtesting
```

### PHASER4-ANIM-01 — Animation Manager spike

```text
Risk: low (spike only, no production code)
Scope: research / spike
Purpose: Validate Phaser 4.1.0 Animation Manager API for:
         - sprite frame animations (walk cycles, idle, gathering);
         - animation state machine integration;
         - performance with current sprite counts.
Output: Decision document with API findings and migration recommendation.
Do not: Implement production animation system during spike.
```

### ARCH-18A-LITE — GameScene input/command extraction

```text
Risk: medium
Scope: refactor
Purpose: Extract input handling and command dispatch from GameScene into
         a dedicated InputController or CommandDispatcher module.
Constraint: Small scope only — no UI rewrite, no new systems beyond extraction.
Touched: GameScene, new input/command module
```

### FIX-02 — Harvester idle-forever UI feedback

```text
Risk: medium
Scope: runtime + UI
Problem: Harvesters can enter idle-forever state with no visual feedback
         to the player about why they stopped.
Solution: Add blockedReason telemetry and idle-state visual indicator.
Touched: HarvesterState, FeedbackRenderer, HUD
Depends on: Understanding of harvester phase transitions (audit first)
```

### FIX-03 — Unit cap / ControlState

```text
Risk: medium
Scope: state + UI
Problem: No unit cap or ControlState enforcement. Player can spam units
         beyond intended limits with no feedback.
Solution: Add ControlState with unit cap, display cap info in HUD.
Touched: GameState, ControlState model, units-factory, HUD
```

### FIX-04 — Factory spawn blockage UI feedback + cancel

```text
Risk: medium
Scope: UI + state
Problem: When factory cannot spawn (path blocked, no resources, cap reached),
         there is no feedback to the player. No cancel option for queued units.
Solution: Add blockage reason display and cancel button for factory queue.
Touched: Factory queue UI, FeedbackRenderer, units-factory state
```

### PHASER4-ANIM-02 — Animation Manager migration

```text
Risk: high-controlled
Scope: runtime
Purpose: Migrate sprite animations to Phaser 4 Animation Manager
         after PHASER4-ANIM-01 spike validates the approach.
Depends on: PHASER4-ANIM-01 findings
Touched: Sprite rendering, animation definitions, state-to-render sync
```

### PHASER4-LOAD-01 — Conditional asset loading spike

```text
Risk: low (spike only)
Scope: research / spike
Purpose: Validate Phaser 4.1.0 Loader/Pack capabilities for:
         - loading only faction-specific assets after faction selection;
         - pack files for asset groups;
         - late-loading without full scene restart.
Output: Decision document with API findings.
Do not: Implement production loading system during spike.
```

### PHASER4-GPU-01 — SpriteGPULayer / TilemapGPULayer spike

```text
Risk: low (spike only)
Scope: research / spike
Purpose: Validate Phaser 4.1.0 GPU layer APIs for:
         - SpriteGPULayer for large unit counts;
         - TilemapGPULayer for terrain rendering;
         - compatibility with current isometric approach;
         - performance characteristics.
Output: Decision document with findings and go/no-go recommendation.
Do not: Implement GPU layer system during spike.
```

### ARCH-11A — QA smoke automation

```text
Risk: low-medium
Scope: tooling
Purpose: Automate more comprehensive QA smoke checks:
         - multi-faction startup;
         - save/load round-trip;
         - economy cycle verification;
         - devtools/arena mode.
Touched: tools/qa_smoke.mjs, possibly new test utilities
```

---

## 7. Rules for future audits

```text
1. Always confirm the active repo before starting.
2. Always verify package.json phaser version before API analysis.
3. If paths mention four-elements-next while the task says four-elements-phaser,
   stop and report the mismatch.
4. Do not silently switch repo baseline.
5. Audit files in chat are not source-of-truth until committed into docs/project/.
6. Do not use four-elements-next as active implementation baseline.
7. Do not use the old Phaser 3.90 clarification as source-of-truth.
```

---

## 8. Relationship to existing docs

This document updates and supersedes:

```text
- Any previous Phaser audit that analyzed four-elements-next / Phaser 3.90
- Any roadmap sequence derived from that audit
```

This document does not replace:

```text
- docs/ROADMAP.md (archived, historical reference only)
- docs/project/PHASE_1_FREEZE.md (active checkpoint)
- docs/project/FIX_BACKLOG.md (active issue tracking)
- docs/project/PROJECT_STATE.md (active operational state)
- docs/project/NEW_CHAT_HANDOFF.md (active handoff protocol)
```

---

## 9. Phaser 4 API adoption policy

Adoption of Phaser 4 APIs beyond current usage follows:

```text
spike -> decision document -> scoped implementation -> validation
```

Rules:

```text
- Do not adopt a new Phaser 4 system in production code without a spike first.
- Spikes must produce a written decision (committed to docs/project/).
- Implementation must be scoped and reviewed.
- Do not rewrite large systems to use new APIs unless the spike proves it safe.
- Current working systems must not break during migration.
```

---

## 10. Summary

```text
Active repo:           ratoker-jpg/four-elements-phaser
Phaser version:        4.1.0
Reference repo:        ratoker-jpg/four-elements-next (donor only)
Source-of-truth audit: This document (PHASER4_AUDIT_CLARIFICATION_RETRY.md)
Phase:                 Post-Phase-1 freeze, Sandbox MVP stability
Mode:                  Fix + spike + limited refactor
Combat/enemy/bot:      Parked until later phase
```
