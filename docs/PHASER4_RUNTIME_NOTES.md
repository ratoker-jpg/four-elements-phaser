# Phaser 4 Runtime Notes — Four Elements Phaser

Date: 2026-05-25
Status: reference notes for future implementation PRs
Source: user-provided Phaser 4 skills notes draft

## 1. Purpose

This document captures practical Phaser 4 runtime notes that are useful for future renderer, construction, and VFX work.

It is not an implementation task.

Use this as a checklist when preparing tasks for:

```text
PR15 — Construction MVP
PR16 — VFX / Feel pass
future renderer cleanup / terrain work
```

---

## 2. Core rule

Prefer native Phaser 4 APIs.

Do not assume Phaser 3 examples still work.

Before using unfamiliar Phaser APIs:

1. check the official Phaser 4 skills;
2. check installed TypeScript typings;
3. use the simplest verified API;
4. document the API decision in the PR body.

---

## 3. RenderTexture / DynamicTexture note

Phaser 4 buffers render texture commands.

When using RenderTexture or DynamicTexture with stamp/draw-style operations, make sure commands are flushed with `render()` where required.

Expected pattern:

```ts
renderTexture.stamp(textureKey, undefined, x, y, config);
// ... more stamps
renderTexture.render();
```

Known project relevance:

- `TerrainRenderer` uses RenderTexture for terrain.
- A previous terrain issue was caused by incorrect RenderTexture usage / coordinate handling.
- Any future static-layer renderer should be checked against this rule.

---

## 4. Coordinate and type notes

### 4.1 Do not use Phaser.Geom.Point

Use project-owned point types or Phaser 4-compatible vector types.

Current project pattern is fine:

```ts
export interface IsoPoint {
  x: number;
  y: number;
}
```

### 4.2 Be careful with map origin offset

Pointer/world-to-tile conversion must account for the map origin offset.

Expected reasoning:

```text
camera world point
minus map origin offset
then screenToTile()
```

Do not duplicate coordinate math in preview/rendering systems. Use existing helpers.

---

## 5. Pixel rounding note

Phaser 4 does not rely on Phaser 3 pixel-rounding assumptions.

Do not blindly enable `roundPixels` globally.

If sprites look blurry or jittery, investigate in a focused visual PR:

- texture resolution;
- scale values;
- camera zoom;
- sprite origin;
- roundPixels setting.

Any roundPixels change should include before/after manual QA.

---

## 6. TilemapGPULayer / SpriteGPULayer note

Do not block current civil-loop work on GPU-layer research.

TilemapGPULayer may not fit the current manual isometric terrain approach and should be treated as a research/spike topic only.

SpriteGPULayer may be useful later for very large numbers of simple repeated sprites, but it is not needed for the current MVP.

Current priority remains:

```text
tests → renderer split → passability/pathfinding → construction
```

---

## 7. ParticleEmitter notes for future VFX

Use Phaser 4 particle patterns, not Phaser 3 manager-style assumptions.

### 7.1 Dust trails

Dust from moving units should use flow/continuous emission.

Conceptual pattern:

```ts
const emitter = scene.add.particles(0, 0, 'dust_particle', {
  speed: { min: 15, max: 30 },
  lifespan: 600,
  scale: { start: 0.3, end: 0 },
  alpha: { start: 0.6, end: 0 },
  follow: unitSprite,
  followOffset: { x: 0, y: 15 },
  frequency: 80,
  quantity: 1,
  emitting: false,
});

// start only while moving
emitter.start();

// stop while idle / gathering / unloading
emitter.stop();
```

Do not spawn new emitters every frame.

### 7.2 Pulses / one-shot bursts

Resource gather, delivery, construction start, and construction completion are better as one-shot bursts.

Conceptual pattern:

```ts
const emitter = scene.add.particles(x, y, 'pulse_particle', {
  speed: { min: 40, max: 80 },
  lifespan: 500,
  scale: { start: 0.6, end: 0 },
  alpha: { start: 1, end: 0 },
  quantity: 15,
  emitting: false,
});

emitter.explode(15);

scene.time.delayedCall(800, () => emitter.destroy());
```

### 7.3 Performance rules

For PR16 VFX:

- use `reserve` where useful;
- set reasonable `maxParticles` / `maxAliveParticles`;
- auto-destroy one-shot emitters;
- keep dust subtle and tied to real movement;
- do not run dust while the unit is idle;
- do not add custom particle processors for MVP.

---

## 8. Tween notes for future VFX

Tweens are appropriate for visual feedback only.

Good future uses:

- resource gather pulse;
- delivery pulse at HQ;
- construction progress feedback;
- small scale pop on building completion;
- camera polish if explicitly approved.

Keep simulation state independent from tweens.

Do not use tween completion as the source of gameplay truth.

Gameplay truth belongs in pure TypeScript state systems.

### 8.1 Fire-and-forget visual pulse

```ts
scene.tweens.add({
  targets: sprite,
  scaleX: 1.1,
  scaleY: 1.1,
  duration: 150,
  yoyo: true,
  ease: 'Sine.easeInOut',
});
```

### 8.2 Progress feedback

For construction progress, prefer state-driven progress and render it from state.

A tween may smooth the visual bar, but the actual progress value must come from state.

---

## 9. Event / VFX boundary

Preferred pattern for PR16:

```text
state update mutates state
state update returns typed events
VFX consumes events
renderer syncs from state
```

Good event examples:

```ts
{ type: 'resource-delivered', harvesterId, amount }
{ type: 'construction-started', siteId, tx, ty }
{ type: 'building-completed', buildingId, tx, ty }
```

Avoid:

```ts
payload: any
```

Use typed event unions instead.

---

## 10. Rex reminder

Rex Rainbow docs can be used as secondary reference.

Rex runtime dependencies are forbidden unless a separate mini-audit explicitly approves them.

Do not import:

- `phaser4-rex-plugins`;
- rexUI;
- rexBoard;
- rexPathFinder;
- plugin packs.

Official Phaser 4 skills and installed typings are the source of truth.

---

## 11. Practical action items

Before PR15 Construction MVP:

- check coordinate conversion with map origin offset;
- keep construction logic pure TS;
- avoid Phaser imports in state logic;
- avoid non-deterministic IDs in state logic;
- test pure placement/progress functions with Vitest.

Before PR16 VFX / Feel pass:

- use ParticleEmitter flow for dust;
- use explode/burst for one-shot feedback;
- use tweens only for visual feedback;
- keep VFX driven by typed events;
- limit particles and avoid per-frame emitter creation.

---

## 12. One-line rule

Use Phaser 4 as a verified runtime API, not as guessed Phaser 3 muscle memory.
