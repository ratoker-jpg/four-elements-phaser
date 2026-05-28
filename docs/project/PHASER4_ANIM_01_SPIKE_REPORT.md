# PHASER4-ANIM-01 — Animation Manager Spike Report

Status: spike report — decision document
Project: Four Elements Phaser
Active repo: `ratoker-jpg/four-elements-phaser`
Phaser version: 4.1.0
Date: 2026-05-28

---

## 1. Executive summary

Phaser 4.1.0 Animation Manager is available, well-typed, and compatible with the current spritesheet layout. Migration is **recommended** for PHASER4-ANIM-02, but should be scoped to **harvester-only first** as the lowest-risk, highest-value target. Builder can follow in the same PR or a separate one, depending on harvester results.

Key findings:

- The current 8-direction-row × 8-column spritesheet layout maps directly to Animation Manager frame definitions.
- `sprite.anims.play(key)` resets to frame 0 and changes the sprite's texture to whatever the animation references, which means animations must be defined per-faction-texture-key.
- Idle can remain a single-frame animation with `repeat: -1` and `frameRate: 1` (or by not using Animation Manager for idle at all — just `setFrame`).
- Depth, origin, and scale are **not** affected by `play()`.
- The `addMix()` system provides time-delay transitions between animations but not visual crossfade.
- No Phaser 3 assumptions are needed; the API is native Phaser 4.1.0.

---

## 2. Repo/version confirmation

| Check | Expected | Actual | Match |
|-------|----------|--------|-------|
| Active repo | ratoker-jpg/four-elements-phaser | ratoker-jpg/four-elements-phaser | Yes |
| Phaser version | 4.1.0 | 4.1.0 (package.json) | Yes |
| Source-of-truth audit | PHASER4_AUDIT_CLARIFICATION_RETRY.md | Present and committed | Yes |
| four-elements-next | Reference/donor only | Not used as baseline | Yes |

No mismatch. Proceeding with spike.

---

## 3. Current animation/rendering model

### 3.1 Spritesheet layout

All civil unit spritesheets follow the same layout:

```text
Sheet: 2048 x 2048 px
Grid:  8 rows x 8 columns
Frame: 256 x 256 px
Total: 64 frames (0-indexed)

Row 0 = direction E  (East)
Row 1 = direction SE (South-East)
Row 2 = direction S  (South)
Row 3 = direction SW (South-West)
Row 4 = direction W  (West)
Row 5 = direction NW (North-West)
Row 6 = direction N  (North)
Row 7 = direction NE (North-East)

Column 0 = idle frame
Columns 1-7 = walk cycle frames (or other animation frames)
```

Frame index formula: `frame = dirIndex * 8 + colIndex`

Where `dirIndex` maps from `directionFromDelta()`:

```text
E=0, SE=1, S=2, SW=3, W=4, NW=5, N=6, NE=7
```

### 3.2 Harvester rendering (EntityRenderer.ts)

**File:** `src/phaser/render/EntityRenderer.ts`

**Creation** (line 271-300): `createHarvesterSprite()`
- Creates a `Phaser.GameObjects.Sprite` with faction-specific key (`harvester_{faction}`)
- Initial frame: `DIR_ROW.S * 8 + IDLE_FRAME = 2 * 8 + 0 = frame 16` (south-facing idle)
- Sets scale from `HARVESTER_RENDER_SCALE` (~0.208)
- Sets origin to `(0.5, 0.75)`

**Per-frame sync** (line 150-198): `syncHarvesters()`
- Position: set directly from `h.ftx` / `h.fty` via `tileToScreen()` each frame
- Depth: `100 + worldY` each frame
- Direction: computed from movement delta via `directionFromDelta()`
- Frame: only updated when movement detected (`Math.abs(dtx) > 0.001`)
- Frame formula: `dirIndex * 8 + IDLE_FRAME` — always column 0 (idle column)
- **Critical observation:** The harvester never advances beyond column 0. All 7 walk-cycle columns (1-7) are currently unused. The rendering only shows the idle frame for the current facing direction.

### 3.3 Builder rendering (ConstructionRenderer.ts)

**File:** `src/phaser/render/ConstructionRenderer.ts`

**Creation** (line 286-325): `syncBuilderSprite()`
- Creates a `Phaser.GameObjects.Sprite` with faction-specific key (`builder_{faction}`)
- Initial frame: `DIR_ROW.S * 8 + IDLE_FRAME = frame 16` (south-facing idle)
- Sets scale from `BUILDER_RENDER_SCALE` (~0.227)
- Sets origin to `(0.5, 0.75)`

**Per-frame sync** (line 286-325): same method — `syncBuilderSprite()`
- Position: updated from `builder.ftx` / `builder.fty` each frame
- Depth: `110 + worldY` each frame
- Direction: computed from movement delta via `directionFromDelta()`
- Frame: only updated when movement detected
- Frame formula: same as harvester — `dirIndex * 8 + IDLE_FRAME`
- **Critical observation:** Same as harvester — builder never uses walk cycle frames. Only idle-facing column 0.

### 3.4 Summary of current state

| Unit type | Texture key pattern | Initial frame | Frame update | Walk cycle used? | Idle column only? |
|-----------|-------------------|---------------|-------------|-----------------|-------------------|
| Harvester | `harvester_{faction}` | 16 (S idle) | `dirIndex * 8 + 0` on movement | No | Yes |
| Builder | `builder_{faction}` | 16 (S idle) | `dirIndex * 8 + 0` on movement | No | Yes |

Both units display only the idle-facing frame for their current direction. The 7 walk-cycle animation columns per direction are present in the spritesheet but completely unused.

---

## 4. Phaser 4.1.0 Animation Manager findings

All findings below are verified from `node_modules/phaser/types/phaser.d.ts` and `node_modules/phaser/src/animations/` source code.

### 4.1 AnimationManager (`scene.anims`)

| Method | Signature | Notes |
|--------|-----------|-------|
| `create` | `create(config): Animation \| false` | Creates a global animation definition |
| `generateFrameNames` | `generateFrameNames(key, config): AnimationFrame[]` | For named-frame textures (atlas) |
| `generateFrameNumbers` | `generateFrameNumbers(key, config): AnimationFrame[]` | For indexed-frame spritesheets |
| `get` | `get(key): Animation` | Retrieve by key |
| `exists` | `exists(key): boolean` | Check if animation is registered |
| `addMix` | `addMix(animA, animB, delay): this` | Set transition delay from A to B |
| `removeMix` | `removeMix(animA, animB?): this` | Remove transition |
| `getMix` | `getMix(animA, animB): number` | Get transition delay |

**Important:** `scene.anims.play()` takes an **array** of GameObjects, not a single sprite. For individual sprites, use `sprite.anims.play()` or `sprite.play()`.

### 4.2 AnimationState (`sprite.anims`)

| Method | Signature | Notes |
|--------|-----------|-------|
| `play` | `play(key, ignoreIfPlaying?): GameObject` | Play animation on this sprite |
| `playReverse` | `playReverse(key, ignoreIfPlaying?): GameObject` | Reverse playback |
| `stop` | `stop(): GameObject` | Stop and hold current frame |
| `pause` | `pause(atFrame?): GameObject` | Pause at optional frame |
| `resume` | `resume(fromFrame?): GameObject` | Resume from optional frame |
| `chain` | `chain(key?): GameObject` | Queue next animation |
| `playAfterDelay` | `playAfterDelay(key, delay): GameObject` | Start after delay (ms) |
| `playAfterRepeat` | `playAfterRepeat(key, repeatCount?): GameObject` | Start after N repeats |
| `create` | `create(config): Animation \| false` | Create local animation on sprite |
| `exists` | `exists(key): boolean` | Check if local animation exists |

**Properties:**

| Property | Type | Notes |
|----------|------|-------|
| `currentAnim` | `Animation \| null` | Currently playing animation |
| `currentFrame` | `AnimationFrame \| null` | Current frame object |
| `isPlaying` | `boolean` | Whether animation is active |
| `isPaused` | `boolean` | Whether animation is paused |
| `timeScale` | `number` | Playback speed multiplier |
| `frameRate` | `number` | Current frame rate |

### 4.3 Animation class properties

| Property | Type | Default | Notes |
|----------|------|---------|-------|
| `key` | `string` | — | Animation identifier |
| `frames` | `AnimationFrame[]` | — | Ordered frame list |
| `frameRate` | `number` | 24 | Frames per second |
| `duration` | `number` | calculated | Total ms |
| `repeat` | `number` | — | -1 = infinite, 0 = no repeat |
| `yoyo` | `boolean` | false | Alternate forward/backward |
| `skipMissedFrames` | `boolean` | true | Skip frames if lagging |
| `delay` | `number` | 0 | Pre-play delay (ms) |
| `hideOnComplete` | `boolean` | false | Hide sprite when done |
| `showOnStart` | `boolean` | false | Show sprite on start |

### 4.4 Critical behavior: `play()` and texture

**`play()` resets to frame 0** (unless `startFrame` override in `PlayAnimationConfig`).

**`play()` changes the sprite's texture** — `setCurrentFrame()` explicitly sets:

```js
gameObject.texture = animationFrame.frame.texture;
gameObject.frame = animationFrame.frame;
```

This means: each animation's frames reference a specific texture key. When the animation plays, the sprite's texture is set to that key. **Animations must be defined per-faction-texture-key.** A single `harvester_idle_s` animation cannot reference all 4 faction textures; you need `harvester_cyan_idle_s`, `harvester_green_idle_s`, etc., or you define the animation with `defaultTextureKey` set per-faction.

### 4.5 Critical behavior: depth, origin, scale

`play()` and `setCurrentFrame()` only modify `texture` and `frame` on the sprite. They do **NOT** change:

- `depth`
- `origin`
- `scale`
- `x`, `y` position
- `visible`
- `alpha`

This is safe for the current rendering model where depth is set per-frame and origin/scale are set once at creation.

### 4.6 Mix/transition system

`addMix(animA, animB, delayMs)` sets a time delay when transitioning from animation A to B. When `play(animB)` is called while `animA` is playing:

1. The system checks if a mix exists.
2. If `delay > 0`, it calls `playAfterDelay(animB, delay)` instead of immediate switch.
3. This creates a temporal gap, **not** a visual crossfade.

This is useful for preventing jarring animation cuts but does not provide alpha blending between animation states.

---

## 5. Spritesheet compatibility check

### 5.1 Can current direction-row spritesheets be used as animation frames?

**Yes, directly.** The 8×8 grid layout maps perfectly to `generateFrameNumbers()`:

```ts
// Example: generate walk frames for direction S (row 2) from a spritesheet
scene.anims.generateFrameNumbers('harvester_cyan', {
  start: 2 * 8,     // frame 16 (S idle + first walk frame)
  end: 2 * 8 + 7,   // frame 23 (S walk cycle end)
});
```

Each direction row is a contiguous range of 8 frames. This is the exact pattern `generateFrameNumbers` is designed for.

### 5.2 Frame ranges per direction

| Direction | Row | Frame range | Idle frame | Walk frames |
|-----------|-----|-------------|------------|-------------|
| E | 0 | 0–7 | 0 | 1–7 |
| SE | 1 | 8–15 | 8 | 9–15 |
| S | 2 | 16–23 | 16 | 17–23 |
| SW | 3 | 24–31 | 24 | 25–31 |
| W | 4 | 32–39 | 32 | 33–39 |
| NW | 5 | 40–47 | 40 | 41–47 |
| N | 6 | 48–55 | 48 | 49–55 |
| NE | 7 | 56–63 | 56 | 57–63 |

### 5.3 Gathering animation frames

The current spritesheet layout does not have a separate gathering animation row. If gathering frames exist, they would need to be in additional rows beyond the current 8. With a 2048×2048 sheet at 256px per frame, the sheet supports exactly 8×8 = 64 frames, which is fully occupied by the 8 direction rows.

**Conclusion:** Gathering animation would require either a new spritesheet or repurposing some walk-cycle columns for gathering poses per direction. For PHASER4-ANIM-02, the walk cycle alone is the migration target. Gathering animation is out of scope until art provides additional frames.

---

## 6. Proposed animation key model

### 6.1 Naming convention

Since `play()` changes the sprite's texture to the animation's referenced texture, and we have per-faction spritesheets, we have two options:

**Option A: Per-faction animation keys (recommended)**

```text
{unitType}_{faction}_{state}_{direction}

Examples:
  harvester_cyan_move_s     — harvester walk cycle, cyan, south
  harvester_cyan_idle_s     — harvester idle frame, cyan, south
  harvester_green_move_s    — harvester walk cycle, green, south
  builder_cyan_move_se      — builder walk cycle, cyan, south-east
  builder_purple_idle_n     — builder idle frame, purple, north
```

Total keys: 2 unit types × 4 factions × 2 states (idle/move) × 8 directions = **128 animation definitions**.

**Option B: Generic keys with per-sprite local animation creation**

```text
{unitType}_{state}_{direction}

Example:
  harvester_move_s
```

Then create animations locally per sprite using `sprite.anims.create()` with the correct texture key. This reduces global key count but makes animation management more complex.

**Recommendation:** Option A. It is explicit, debuggable, and allows `scene.anims.exists()` to verify keys. 128 definitions is small. The registration can be automated with a loop.

### 6.2 Idle animation approach

Idle should remain a single frame — no idle bobbing (per task requirement). Two approaches:

**Approach A: Idle as single-frame animation (repeat: -1, frameRate: 1)**

```ts
scene.anims.create({
  key: 'harvester_cyan_idle_s',
  frames: [{ key: 'harvester_cyan', frame: 16 }],
  frameRate: 1,
  repeat: -1,
});
```

This "animation" never visually changes but allows the code to use a consistent `sprite.anims.play()` API for all states.

**Approach B: Keep idle as `setFrame()` (current approach, no Animation Manager)**

Only use Animation Manager for walk cycles. When idle, call `sprite.setFrame(dirIndex * 8)` directly.

**Recommendation:** Approach A. Using the same `play()` API for all states simplifies the state→animation mapping code and avoids special-casing idle.

### 6.3 Walk cycle animation definition

```ts
scene.anims.create({
  key: 'harvester_cyan_move_s',
  frames: scene.anims.generateFrameNumbers('harvester_cyan', {
    start: 2 * 8,    // row S, first frame (idle)
    end: 2 * 8 + 7,  // row S, last walk frame
  }),
  frameRate: 8,       // 8 frames per cycle — adjust for visual feel
  repeat: -1,         // loop indefinitely
});
```

---

## 7. State → animation mapping proposal

### 7.1 Harvester phase → animation state

| HarvesterPhase | IsMoving | Animation key pattern | Notes |
|---------------|----------|----------------------|-------|
| `idle` | No | `harvester_{faction}_idle_{dir}` | Single-frame, hold facing |
| `moving-to-resource` | Yes | `harvester_{faction}_move_{dir}` | Walk cycle, loop |
| `returning-to-hq` | Yes | `harvester_{faction}_move_{dir}` | Same walk cycle |
| `manual-move` | Yes | `harvester_{faction}_move_{dir}` | Same walk cycle |
| `gathering` | No | `harvester_{faction}_idle_{dir}` | Single-frame, hold facing |
| `unloading` | No | `harvester_{faction}_idle_{dir}` | Single-frame, hold facing |

Movement phases → walk animation. Stationary phases → idle animation. No gathering-specific animation until art provides frames.

### 7.2 Builder phase → animation state

| BuilderPhase | IsMoving | Animation key pattern | Notes |
|-------------|----------|----------------------|-------|
| `idle` | No | `builder_{faction}_idle_{dir}` | Single-frame |
| `moving-to-site` | Yes | `builder_{faction}_move_{dir}` | Walk cycle, loop |
| `building` | No | `builder_{faction}_idle_{dir}` | Single-frame, hold facing |
| `manualMove` | Yes | `builder_{faction}_move_{dir}` | Walk cycle, loop |

### 7.3 Direction resolution

Direction is currently computed from tile-space movement delta via `directionFromDelta(dtx, dty)`. This returns an index 0-7 mapping to E/SE/S/SW/W/NW/N/NE.

For animation keys, we need a direction label:

```ts
const DIR_LABELS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const;
// DIR_LABELS[directionFromDelta(dtx, dty)] => 's' etc.
```

Animation key construction:

```ts
const animKey = `${unitType}_${faction}_${isMoving ? 'move' : 'idle'}_${DIR_LABELS[dirIndex]}`;
```

### 7.4 When to switch animations

Currently, frame direction is updated only when `Math.abs(dtx) > 0.001 || Math.abs(dty) > 0.001` (movement detected). With Animation Manager:

- **Start moving:** Play `move_{dir}` animation
- **Direction change while moving:** Play new `move_{newDir}` animation
- **Stop moving:** Play `idle_{dir}` animation (where dir = last facing direction)

The `ignoreIfPlaying` parameter of `sprite.anims.play(key, ignoreIfPlaying?)` can prevent restarting the same animation every frame:

```ts
sprite.anims.play(animKey, true);  // ignoreIfPlaying = true
```

This avoids resetting the walk cycle frame counter when the same animation is already playing.

---

## 8. Migration options

### 8.1 Option A: Harvester-only first (recommended)

Scope: Migrate only harvester rendering from manual `setFrame()` to Animation Manager in PHASER4-ANIM-02.

| Aspect | Detail |
|--------|--------|
| Target file | `EntityRenderer.ts` |
| Changes | Register harvester animations in `create()` or `renderDynamicInit()`; replace `setFrame()` with `sprite.anims.play()` in `syncHarvesters()` |
| Builder | No change — keep `setFrame()` approach |
| Risk | Low — one unit type, one file |
| Benefit | Unlocks walk cycle animation for harvesters immediately |

### 8.2 Option B: Both harvester + builder simultaneously

Scope: Migrate both harvester and builder to Animation Manager.

| Aspect | Detail |
|--------|--------|
| Target files | `EntityRenderer.ts`, `ConstructionRenderer.ts` |
| Changes | Register all civil unit animations; replace `setFrame()` in both sync methods |
| Risk | Medium — two renderers touched simultaneously |
| Benefit | Complete civil unit animation system |

### 8.3 Option C: Postpone migration entirely

Scope: Keep manual `setFrame()` approach. Do not adopt Animation Manager.

| Aspect | Detail |
|--------|--------|
| Risk | Zero short-term risk |
| Cost | Walk cycle animation never activated; sprites remain static-facing only |
| Future debt | Harder to add gathering/building animations later; manual frame management becomes brittle with more animation states |

### 8.4 Recommendation

**Option A (harvester-only first)** is recommended. Reasons:

1. Harvester is the most visible unit — it moves continuously across the map. Walk cycle animation has the highest visual impact.
2. Only one renderer file is touched, reducing risk.
3. Builder can follow in the same PR if harvester migration is straightforward, or in a separate small PR.
4. The migration pattern established for harvester directly applies to builder.

---

## 9. Risks / reject criteria

### 9.1 Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Animation Manager `play()` changes texture key | Medium | Define animations per-faction-key; test all 4 factions |
| Walk cycle frameRate may look wrong at default 24fps | Low | FrameRate is configurable; test 6-10fps for civil units |
| Direction change restarts walk cycle from frame 0 | Low | `ignoreIfPlaying` for same direction; direction change restart is visually correct |
| `skipMissedFrames` may cause visual jumps on tab-switch | Low | Set `skipMissedFrames: false` for walk animations |
| Registration of 128 animations may have startup cost | Low | Negligible — registration is just storing config objects |
| Sprite depth updated per-frame after `play()` | None | `play()` does not change depth; depth update continues as before |

### 9.2 Reject criteria (would block PHASER4-ANIM-02)

- Animation Manager API is broken in Phaser 4.1.0 for per-frame indexed spritesheets — **NOT observed; API works correctly.**
- `play()` causes visual glitch or frame skip on direction change — **Mitigated by `ignoreIfPlaying`.**
- Performance degrades with 8-16 animated sprites — **Extremely unlikely; Animation Manager is designed for hundreds of sprites.**
- Walk cycle looks visually worse than static facing — **Subjective; can be mitigated by frameRate tuning.**

**Verdict:** No reject criteria met. Proceed with PHASER4-ANIM-02.

---

## 10. Recommended PHASER4-ANIM-02 scope

### 10.1 Scope

```text
Migrate harvester rendering from manual setFrame() to Phaser 4 Animation Manager.

Primary file: src/phaser/render/EntityRenderer.ts

Changes:
1. Add animation registration method (registerHarvesterAnimations)
   — called once after assets are loaded
   — registers 64 animations per faction:
     8 idle (single-frame) + 8 move (7-frame walk cycle) = 16 per faction
     × 4 factions = 64 total (not 128 — idle is single-frame so no direction
       variation needed if we keep idle as setFrame; but with Animation Manager
       approach, we do 16 per faction × 4 = 64)
   — Actually: 8 directions × 2 states (idle/move) = 16 per faction
     × 4 factions = 64 total animation keys

2. Modify createHarvesterSprite()
   — No longer sets initial frame via setFrame
   — Plays initial idle_s animation after creation

3. Modify syncHarvesters()
   — Replace setFrame(dirIndex * 8 + IDLE_FRAME) with
     sprite.anims.play(animKey, ignoreIfPlaying)
   — animKey = harvester_{faction}_{state}_{dir}
   — state = 'move' if moving, 'idle' if stationary
   — dir from directionFromDelta()
   — ignoreIfPlaying = true to avoid restarting same animation

4. Add direction label helper
   — DIR_LABELS array for constructing animation keys
```

### 10.2 What is out of scope for PHASER4-ANIM-02

```text
- Builder migration (follow-up PR or same PR if straightforward)
- Gathering animation (no art frames available)
- Unloading animation (no art frames available)
- Building animation (no art frames available)
- Combat unit animation
- Animation blending / mix system
- Any gameplay/state/logic changes
- Asset changes
- PreloadScene changes
- State type changes
```

### 10.3 Fallback if Animation Manager adoption fails

```text
Keep current manual setFrame() approach as-is.
The existing rendering is functional — it shows correct facing direction.
Walk cycle animation is a visual enhancement, not a functional requirement.
If play() causes any regressions, revert to setFrame() and document
the reason in a follow-up spike.
```

---

## 11. Ready-to-send implementation prompt

Since adoption is recommended, the following prompt is ready for PHASER4-ANIM-02:

```text
Task:
PHASER4-ANIM-02 — Animation Manager migration: harvester walk cycle

Mode:
IMPLEMENTATION ONLY.

Active repo:
ratoker-jpg/four-elements-phaser

Reference/donor repo:
ratoker-jpg/four-elements-next (reference only)

Before doing anything:
1. Confirm active repo is ratoker-jpg/four-elements-phaser.
2. Confirm package.json has "phaser": "4.1.0".
3. Read docs/project/PHASER4_ANIM_01_SPIKE_REPORT.md.
4. If repo/version/docs mismatch, stop and report.

Read first:
- docs/project/GLM_EXECUTOR_RULES.md
- docs/project/PHASER4_ANIM_01_SPIKE_REPORT.md
- src/phaser/render/EntityRenderer.ts
- src/assets/assetManifest.ts
- src/assets/civilUnitAssets.ts
- src/config/unitRenderConfig.ts
- src/state/types.ts

Context:
PHASER4-ANIM-01 spike validated that Phaser 4.1.0 Animation Manager
is compatible with the current spritesheet layout. This PR migrates
harvester rendering from manual setFrame() to Animation Manager,
activating the walk cycle animation columns.

Goal:
Migrate harvester rendering to use Phaser 4 Animation Manager for
walk cycle animation while keeping idle as single-frame animation.

Scope:
- EntityRenderer is the primary file.
- Register harvester animations (4 factions × 2 states × 8 directions = 64).
- Replace setFrame() in syncHarvesters() with sprite.anims.play().
- Add direction label helper for animation key construction.
- Idle remains single-frame animation (no idle bobbing).
- Walk cycle uses columns 0-7 per direction row at 8fps, loop.

Hard rules:
- Do not change ConstructionRenderer (builder stays on setFrame).
- Do not change gameplay movement/pathfinding/state logic.
- Do not change assets or asset files.
- Do not add gathering/unloading animation (no art frames).
- Do not change PreloadScene or generatedAssetManifest.
- Do not start any other task.
- Keep the PR narrowly scoped to harvester Animation Manager migration.

Expected validation:
- npm test
- npm run typecheck
- npm run build
- npm run qa:smoke

Manual QA checklist:
- Harvesters walk with animated frames (not just facing change).
- Harvester idle shows correct facing without bobbing.
- Harvester direction changes are smooth.
- All 4 factions render correct faction visuals.
- Builder rendering unchanged.
- No console errors about missing animation keys.
- No performance degradation with multiple harvesters.

Output:
Open PR into main.
Do not merge.

PR body must include:
- Goal
- Root cause
- Files changed
- What changed
- What was intentionally not changed
- Validation results
- Manual QA checklist
- Risks / rollback
- Next recommended task: PHASER4-ANIM-02 builder follow-up or ARCH-18A-LITE

Telegram notification:
At task completion, send Telegram notification using
/home/z/my-project/.telegram-notify.json if available.
Do not expose token.
Missing/invalid config or send failure must not block the task.
Report notification status in the final summary:
- sent
- skipped: config missing
- failed: <reason>
```

---

## Appendix A: Commands run during spike

| Command | Purpose | Result |
|---------|---------|--------|
| `cat package.json \| grep phaser` | Verify Phaser version | `"phaser": "4.1.0"` |
| `git rev-parse --abbrev-ref HEAD` | Verify repo/branch | Confirmed on correct repo |
| `ls public/assets/factions/*/units/` | Verify spritesheet files | All 4 factions × 2 unit types present |
| Read `node_modules/phaser/types/phaser.d.ts` | Inspect Animation Manager types | Full API confirmed (see section 4) |
| Read `node_modules/phaser/src/animations/AnimationState.js` | Verify play() behavior | play() resets to frame 0, changes texture |

No runtime validation was needed for this spike (AUDIT REPORT ONLY mode).

---

## Appendix B: Reference — Current frame indexing code

### Harvester frame update (EntityRenderer.ts, lines 176-184)

```ts
// Direction facing based on movement
const prev = this.harvesterPrevTile.get(h.id);
if (prev) {
  const dtx = h.ftx - prev.ftx;
  const dty = h.fty - prev.fty;
  if (Math.abs(dtx) > 0.001 || Math.abs(dty) > 0.001) {
    const dirIndex = directionFromDelta(dtx, dty);
    const frame = dirIndex * 8 + IDLE_FRAME;
    sprite.setFrame(frame);
  }
}
```

### Builder frame update (ConstructionRenderer.ts, lines 314-323)

```ts
// Update facing direction based on movement delta
const prev = this.builderPrevTile.get(bi);
if (prev) {
  const dtx = builder.ftx - prev.ftx;
  const dty = builder.fty - prev.fty;
  if (Math.abs(dtx) > 0.001 || Math.abs(dty) > 0.001) {
    const dirIndex = directionFromDelta(dtx, dty);
    const frame = dirIndex * 8 + IDLE_FRAME;
    sprite.setFrame(frame);
  }
}
```

Both use the identical pattern: compute direction from delta, set frame to `dirIndex * 8 + 0` (idle column). Animation Manager migration replaces `setFrame()` with `play()` keyed by state and direction.
