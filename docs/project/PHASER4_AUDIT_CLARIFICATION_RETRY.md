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

## 3. Invalid findings from the previous audit

The previous clarification audit produced the following invalid findings because it analyzed the wrong repo and wrong Phaser version. Each finding is listed with the reason it is invalid.

### 3.1 Invalid finding: Phaser 3.90 API surface

```text
Previous claim: "The project runs Phaser 3.90 with the following API surface..."
Why invalid: The active repo (four-elements-phaser) runs Phaser 4.1.0, not 3.90.
             The API surface of 3.90 differs significantly from 4.1.0.
             Migration paths from 3.x patterns are not relevant.
Correct finding: See section 4 for the actual Phaser 4.1.0 API surface.
```

### 3.2 Invalid finding: Phaser 3 Scene management patterns

```text
Previous claim: "Scene lifecycle follows Phaser 3 patterns with ScenePlugin..."
Why invalid: Phaser 4.1.0 scene management has API changes from 3.x.
             The previous audit described scene restart, scene switch, and
             shutdown patterns based on Phaser 3 ScenePlugin behavior.
             Phaser 4 scene lifecycle should be verified against 4.1.0 typings.
Correct finding: Current project uses Phaser 4 scene lifecycle correctly
                (verified by working PreloadScene -> GameScene flow).
```

### 3.3 Invalid finding: Phaser 3 particle system

```text
Previous claim: "Particle system uses Phaser 3 ParticleEmitterManager..."
Why invalid: Phaser 4.1.0 uses a different particle API.
             The previous audit described Phaser 3's manager-based particle system.
             Phaser 4 uses scene.add.particles() with config objects.
             The project's PHASER4_RUNTIME_NOTES.md already documents the correct
             Phaser 4 particle patterns.
Correct finding: See section 4.3 for Phaser 4.1.0 particle API.
```

### 3.4 Invalid finding: Phaser 3 animation system

```text
Previous claim: "Animation uses Phaser 3 AnimationManager with .play() method..."
Why invalid: While the basic .play() pattern is similar, Phaser 4 Animation Manager
             has API changes from 3.x that affect animation definitions, blend
             transitions, and state machine integration.
             The previous audit described migration from Phaser 3 animation patterns.
Correct finding: PHASER4-ANIM-01 spike will validate the exact 4.1.0 animation API.
```

### 3.5 Invalid finding: Next.js/Phaser 3 integration patterns

```text
Previous claim: "The project uses Next.js with Phaser 3 embedded via dynamic import..."
Why invalid: The active repo is a standalone Phaser 4.1.0 Vite project.
             There is no Next.js in four-elements-phaser.
             The previous audit analyzed four-elements-next which is a
             Next.js project that embeds Phaser 3.90 — this is the reference/donor repo.
Correct finding: Active project is pure Phaser 4.1.0 + Vite + TypeScript.
```

### 3.6 Invalid finding: Rex plugin compatibility

```text
Previous claim: "Rex plugins for Phaser 3 may need migration to Phaser 4 compatible versions..."
Why invalid: Rex plugins are already banned in the active project.
             GLM_EXECUTOR_RULES.md section 14 and GPT_WORKFLOW.md section 26
             explicitly forbid Rex dependencies.
             The question of Rex migration is moot.
Correct finding: No Rex plugins are used or planned. See existing hard bans.
```

---

## 4. Phaser 4.1.0 available API surface

### 4.1 Core rendering systems

| System | Available | Currently used | Notes |
|--------|-----------|----------------|-------|
| Sprite | Yes | Yes | Civil units, harvester, builder sprites |
| Image | Yes | Yes | Buildings, HQ, terrain, resources |
| Graphics | Yes | Yes | FeedbackRenderer, UnitMotionFxRenderer, debug overlays |
| RenderTexture | Yes | Yes | TerrainRenderer static terrain layer |
| Text | Yes | Yes | Dev panel labels, HUD text |
| Container | Yes | No | Available for grouped transforms |
| Group | Yes | No | Available for batch management |
| Layer | Yes | No | Available for depth-sorted batch management |

### 4.2 Animation and tween systems

| System | Available | Currently used | Notes |
|--------|-----------|----------------|-------|
| Animation Manager | Yes | No | Sprite frame animation playback, blend/transition support |
| Tween Manager | Yes | Yes | Visual pulses (gathering, construction), UI animations |
| Timeline | Yes | No | Sequenced tween chains, available if needed |

Animation Manager is available but not yet used. Current sprites use direct frame indexing via direction rows. PHASER4-ANIM-01 spike will validate the API before migration.

### 4.3 Particle system

| System | Available | Currently used | Notes |
|--------|-----------|----------------|-------|
| ParticleEmitter | Yes | No | Dust, one-shot bursts, flow emission available |
| GravityWell | Yes | No | Available for directional particle effects |

Particles are available but not yet used. Current dust (PR #80) uses Graphics circles. PHASER4_RUNTIME_NOTES.md documents the correct Phaser 4 particle patterns for future use.

### 4.4 GPU-accelerated rendering

| System | Available | Currently used | Notes |
|--------|-----------|----------------|-------|
| TilemapGPULayer | Yes | No | GPU-accelerated tile rendering |
| SpriteGPULayer | Yes | No | GPU-accelerated sprite batch rendering |

Both are available but not yet used. Current terrain uses RenderTexture with stamp/draw pattern. Current sprites use individual Sprite objects. PHASER4-GPU-01 spike will validate whether these APIs are compatible with the current isometric approach.

### 4.5 Post-processing and shaders

| System | Available | Currently used | Notes |
|--------|-----------|----------------|-------|
| Filters | Yes | No | Post-processing pipeline available |
| Shaders | Yes | No | Custom shader pipeline available |
| Camera effects | Yes | No | Fade, flash, shake available |

These are available for future visual polish. Not needed for Sandbox MVP.

### 4.6 Loader and asset management

| System | Available | Currently used | Notes |
|--------|-----------|----------------|-------|
| LoaderPlugin | Yes | Yes | PreloadScene loads all assets at startup |
| Pack files | Yes | No | Available for grouped/conditional loading |
| Multi-file load | Yes | No | Available for atlas + data pairs |
| Scene plugin loader | Yes | No | Available for scene-specific asset sets |

Conditional loading (loading only faction-specific assets after selection) is available but not yet used. PHASER4-LOAD-01 spike will validate the approach.

---

## 5. CameraControls analysis

### 5.1 Current camera setup

```text
The project uses Phaser 4.1.0 camera system.
GameScene sets up camera controls including pan and zoom.
Camera follows the game world with isometric coordinate mapping.
```

### 5.2 Available camera capabilities

| Capability | Available | Currently used | Notes |
|------------|-----------|----------------|-------|
| Pan / scroll | Yes | Yes | Edge scrolling and drag |
| Zoom | Yes | Yes | Scroll wheel zoom |
| Follow target | Yes | No | Available for camera follow on selected unit |
| Bounds | Yes | Yes | Camera stays within map bounds |
| Fade effect | Yes | No | Available for scene transitions |
| Flash effect | Yes | No | Available for damage/impact feedback |
| Shake effect | Yes | No | Available for explosion/impact feedback |
| Lerp smoothing | Yes | No | Available for smooth camera follow |

### 5.3 Camera and isometric mapping

```text
The current isometric coordinate system works with the camera as follows:
- tileToScreen(tx, ty) converts tile coordinates to screen pixels
- screenToTile(sx, sy) converts screen pixels back to tile coordinates
- Camera pan/zoom operates in screen pixel space
- Pointer coordinates must be adjusted for camera position before tile conversion

This is working correctly. No camera changes are needed for Sandbox MVP.
```

### 5.4 Future camera considerations

```text
Not for Sandbox MVP, but documented for future reference:
- Camera follow on selected unit (requires FIX-03 unit selection model)
- Smooth lerp camera follow (Phaser 4 supports lerp parameter)
- Camera shake on building destruction (requires combat system)
- Camera fade for scene transitions (available via Phaser 4 camera effects)
```

---

## 6. Repeated verification checks

These checks confirm the corrected audit baseline. Each check was performed against the active repo.

### 6.1 Repo identity check

```text
Check: What repo was analyzed?
Active repo: ratoker-jpg/four-elements-phaser
Previous audit: ratoker-jpg/four-elements-next (WRONG)
Result: Previous audit analyzed the wrong repo. This retry is correct.
```

### 6.2 Phaser version check

```text
Check: What Phaser version is in package.json?
Active repo package.json: "phaser": "4.1.0"
Previous audit assumption: Phaser 3.90 (WRONG)
Result: Active repo uses Phaser 4.1.0, not 3.90.
```

### 6.3 Framework check

```text
Check: What build framework is used?
Active repo: Vite + TypeScript
Previous audit: Next.js + Phaser 3 embedded (WRONG for active repo)
Result: Active repo is standalone Vite + Phaser 4.1.0.
```

### 6.4 Animation system check

```text
Check: Is Animation Manager available?
Phaser 4.1.0: Yes, Animation Manager is available.
Current usage: Not yet used. Sprites use direct frame indexing.
Previous audit: Described Phaser 3 animation migration (IRRELEVANT)
Result: PHASER4-ANIM-01 spike needed before production use.
```

### 6.5 Particle system check

```text
Check: Is ParticleEmitter available?
Phaser 4.1.0: Yes, ParticleEmitter is available.
Current usage: Not yet used. Dust uses Graphics circles.
Previous audit: Described Phaser 3 ParticleEmitterManager (WRONG API)
Result: PHASER4_RUNTIME_NOTES.md has correct Phaser 4 patterns.
```

### 6.6 GPU layer check

```text
Check: Are TilemapGPULayer and SpriteGPULayer available?
Phaser 4.1.0: Yes, both are available.
Current usage: Not yet used.
Previous audit: Did not evaluate (focused on Phaser 3)
Result: PHASER4-GPU-01 spike needed before production use.
```

### 6.7 Loader/Pack check

```text
Check: Are Pack files and conditional loading available?
Phaser 4.1.0: Yes, Loader supports Pack files and scene-specific loading.
Current usage: PreloadScene loads all assets at startup.
Previous audit: Did not evaluate Phaser 4 loader capabilities.
Result: PHASER4-LOAD-01 spike needed before production use.
```

### 6.8 Rex plugin check

```text
Check: Are Rex plugins relevant?
Answer: No. Rex plugins are explicitly banned in project rules.
Previous audit: Discussed Rex migration (MOOT)
Result: No change needed. Existing hard bans are sufficient.
```

---

## 7. Corrected roadmap sequence

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

### 7.1 Sequence rationale

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

### 7.2 Sequence evidence table

| Priority | Work group | Type | Risk | Blocks | Depends on |
|----------|-----------|------|------|--------|------------|
| 1 | FIX-01 | Runtime fix | high-controlled | Multi-faction playtesting | None |
| 2 | PHASER4-ANIM-01 | Research spike | low | Animation-dependent work | None |
| 3 | ARCH-18A-LITE | Refactor | medium | Future system additions | None |
| 4 | FIX-02 | Runtime + UI fix | medium | Economy feedback | Harvester audit |
| 5 | FIX-03 | State + UI fix | medium | Unit management | None |
| 6 | FIX-04 | UI + state fix | medium | Factory UX | FIX-03 (cap) |
| 7 | PHASER4-ANIM-02 | Runtime migration | high-controlled | Animation-rich VFX | PHASER4-ANIM-01 |
| 8 | PHASER4-LOAD-01 | Research spike | low | Conditional asset loading | None |
| 9 | PHASER4-GPU-01 | Research spike | low | Performance optimization | None |
| 10 | ARCH-11A | Tooling | low-medium | CI robustness | None |

---

## 8. Work group details

### FIX-01 — Faction asset wiring: HQ + harvester hardcoded cyan

```text
Risk: high-controlled
Scope: runtime
Problem: Non-cyan faction HQ and harvester use hardcoded cyan assets.
         Other factions can be selected but show wrong or missing visuals.
Solution: Wire faction-specific asset keys in renderers and state builders.
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
Risk: low (spike only, no production code)
Scope: research / spike
Purpose: Validate Phaser 4.1.0 Animation Manager API for:
         - sprite frame animations (walk cycles, idle, gathering);
         - animation state machine integration;
         - blend/transition between animation states;
         - performance with current sprite counts (~8 civil units + 64 modular).
Questions to answer:
  1. How does Phaser 4 AnimationManager differ from Phaser 3?
  2. Can current direction-row spritesheets be used as animation frames?
  3. What is the migration path from manual frame indexing to Animation Manager?
  4. Are there performance implications for 8-16 animated sprites?
  5. Does the animation system integrate with Containers and Groups?
Output: Decision document with API findings and migration recommendation.
Do not: Implement production animation system during spike.
```

### ARCH-18A-LITE — GameScene input/command extraction

```text
Risk: medium
Scope: refactor
Purpose: Extract input handling and command dispatch from GameScene into
         a dedicated InputController or CommandDispatcher module.
Current state: GameScene handles pointer input, keyboard input, unit commands,
              building placement, and devtools hotkeys in a single file.
Constraint: Small scope only — no UI rewrite, no new systems beyond extraction.
Touched: GameScene, new input/command module
Does not touch: Renderers, state logic, DOM UI, assets
```

### FIX-02 — Harvester idle-forever UI feedback

```text
Risk: medium
Scope: runtime + UI
Problem: Harvesters can enter idle-forever state with no visual feedback
         to the player about why they stopped.
Known scenarios:
  - harvester cannot find reachable resource;
  - harvester cannot find path to dropoff;
  - harvester is blocked by building placement;
  - storage is full and no dropoff accepts delivery.
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
Reference: four-elements-next has working ControlState with cap logic.
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
Depends on: FIX-03 (cap enforcement needed for cap-reached feedback)
```

### PHASER4-ANIM-02 — Animation Manager migration

```text
Risk: high-controlled
Scope: runtime
Purpose: Migrate sprite animations to Phaser 4 Animation Manager
         after PHASER4-ANIM-01 spike validates the approach.
Migration targets:
  - civil unit walk cycle (currently manual direction-row frame indexing);
  - harvester gathering animation (if animation frames exist);
  - builder movement animation (if animation frames exist);
  - potential idle/gathering state animations.
Depends on: PHASER4-ANIM-01 findings
Touched: Sprite rendering, animation definitions, state-to-render sync
Constraint: Current frame-based rendering must remain as fallback.
```

### PHASER4-LOAD-01 — Conditional asset loading spike

```text
Risk: low (spike only)
Scope: research / spike
Purpose: Validate Phaser 4.1.0 Loader/Pack capabilities for:
         - loading only faction-specific assets after faction selection;
         - pack files for asset groups (by faction, by type);
         - late-loading without full scene restart;
         - unloading unused faction assets to reduce memory.
Questions to answer:
  1. Can Phaser 4 Loader load assets after PreloadScene completes?
  2. Do Pack files support grouped loading by category?
  3. Can loaded assets be selectively unloaded?
  4. What is the performance impact of late-loading vs all-at-once?
  5. Does late-loading work with the current generated manifest system?
Output: Decision document with API findings.
Do not: Implement production loading system during spike.
```

### PHASER4-GPU-01 — SpriteGPULayer / TilemapGPULayer spike

```text
Risk: low (spike only)
Scope: research / spike
Purpose: Validate Phaser 4.1.0 GPU layer APIs for:
         - SpriteGPULayer for large unit counts (potential 50+ sprites);
         - TilemapGPULayer for terrain rendering (replace RenderTexture stamp);
         - compatibility with current isometric approach;
         - performance characteristics vs current approach.
Questions to answer:
  1. Does SpriteGPULayer support isometric coordinate transforms?
  2. Does TilemapGPULayer work with non-orthogonal tile layouts?
  3. What are the minimum sprite counts where GPU layers show benefit?
  4. Are there compatibility issues with the current camera/zoom setup?
  5. Can GPU layers coexist with regular Sprites for mixed rendering?
Output: Decision document with findings and go/no-go recommendation.
Do not: Implement GPU layer system during spike.
```

### ARCH-11A — QA smoke automation

```text
Risk: low-medium
Scope: tooling
Purpose: Automate more comprehensive QA smoke checks:
         - multi-faction startup (currently cyan-only smoke);
         - save/load round-trip verification;
         - economy cycle verification (gather -> convert -> build);
         - devtools/arena mode startup;
         - generated map startup with different seeds.
Current state: qa_smoke.mjs verifies 3 console markers + screenshot.
Target: Expand to verify more functional paths without manual QA.
Touched: tools/qa_smoke.mjs, possibly new test utilities
```

---

## 9. First-ready prompts

These prompts are ready to be sent to GLM once the audit is accepted.

### 9.1 FIX-01 — Faction asset wiring

```text
Task: FIX-01 — Faction asset wiring: HQ + harvester hardcoded cyan
Mode: IMPLEMENTATION ONLY

Read first:
- docs/project/GLM_EXECUTOR_RULES.md
- docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md
- src/phaser/render/EntityRenderer.ts
- src/assets/buildingAssets.ts
- src/assets/civilUnitAssets.ts

Goal:
Wire faction-specific HQ and harvester asset keys so non-cyan factions
display their correct visuals instead of hardcoded cyan.

Scope:
- EntityRenderer is the expected primary file.
- Use getHqAssetKey(faction) and getCivilUnitKey(faction, 'harvester')
  if those helpers exist.
- Do not change ConstructionRenderer, PreloadScene,
  generatedAssetManifest, state init, or asset files unless a direct
  implementation-time code check proves they are part of the root cause.
- Builder/building rendering is believed to already be faction-aware
  and should not be changed in FIX-01 unless disproven.

Hard rules:
- Do not change gameplay movement/pathfinding/state logic.
- Do not change ConstructionRenderer unless code proves it is root cause.
- Do not change PreloadScene, generatedAssetManifest, or state init.
- Do not generate images/assets.
- Do not fix selection ring/unit centering/lane movement/harvester reliability.

Validation:
npm test
npm run typecheck
npm run build
npm run qa:smoke

Open PR into main.
Do not merge.
```

### 9.2 PHASER4-ANIM-01 — Animation Manager spike

```text
Task: PHASER4-ANIM-01 — Animation Manager spike
Mode: AUDIT REPORT ONLY

Read first:
- docs/project/GLM_EXECUTOR_RULES.md
- docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md
- src/phaser/render/EntityRenderer.ts
- src/phaser/render/ConstructionRenderer.ts
- src/config/unitRenderConfig.ts

Goal:
Validate Phaser 4.1.0 Animation Manager API and produce a decision document
with findings and migration recommendation.

Questions to answer:
1. How does Phaser 4 AnimationManager differ from Phaser 3?
2. Can current direction-row spritesheets be used as animation frames?
3. What is the migration path from manual frame indexing to Animation Manager?
4. Are there performance implications for 8-16 animated sprites?
5. Does the animation system integrate with Containers and Groups?

Do not implement production animation system.
Return findings as Markdown report only.
```

---

## 10. Rules for future audits

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

## 11. Relationship to existing docs

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
- docs/PHASER4_RUNTIME_NOTES.md (active runtime reference)
```

---

## 12. Phaser 4 API adoption policy

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

## 13. Summary

```text
Active repo:           ratoker-jpg/four-elements-phaser
Phaser version:        4.1.0
Reference repo:        ratoker-jpg/four-elements-next (donor only)
Source-of-truth audit: This document (PHASER4_AUDIT_CLARIFICATION_RETRY.md)
Phase:                 Post-Phase-1 freeze, Sandbox MVP stability
Mode:                  Fix + spike + limited refactor
Combat/enemy/bot:      Parked until later phase
```
