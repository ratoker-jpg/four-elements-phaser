# WEAPON-WORKFLOW-01 — Weapon VFX and Recoil Design

Status: design/workflow document — docs only, no runtime changes  
Project: Four Elements Phaser  
Active repo: `ratoker-jpg/four-elements-phaser`  
Phaser version: 4.1.0  
Reference/donor repo: `ratoker-jpg/four-elements-next` (donor/reference only)  
Date: 2026-05-29

---

## 1. Weapon Visual Architecture

### 1.1 Layered Rendering Model

The project uses a modular tank rendering model where each combat unit is composed of independent sprite layers. The current `ModularTankRenderer` renders two layers per tank: hull (body) and turret (weapon mount). Weapon VFX extends this model with additional transient layers that appear during firing events and disappear afterward.

**Layer stack (bottom to top):**

```
Layer 0: Hull / body sprite         — always visible, controls bodyDir
Layer 1: Turret / weapon sprite     — always visible, controls turretDir
Layer 2: Muzzle flash VFX           — visible during fire event (~100-200ms)
Layer 3: Projectile / beam VFX      — visible during travel (~50-500ms)
Layer 4: Impact VFX                 — visible at impact point (~200-400ms)
Layer 5: PointLight glow            — visible during fire + impact (~150-300ms)
```

Each layer is a separate Phaser GameObject with its own depth value. The hull and turret are persistent Image objects. The VFX layers are transient — created on fire, destroyed on completion. The PointLight layer is optional and deferred (see VISUAL-SPIKE-01 Option E).

### 1.2 Weapon VFX Controller

The design introduces a logical `WeaponVfxController` concept (not a concrete class yet — implementation is a later task). This controller would:

1. Receive a "fire event" from the combat state layer (weapon fired at target).
2. Look up the weapon type's VFX configuration (muzzle flash, projectile, impact, recoil parameters).
3. Create transient VFX GameObjects at the correct positions and depths.
4. Manage VFX lifecycle (auto-destroy on animation/tween completion).
5. Apply recoil tweens to the turret and hull sprites.

The controller does NOT own combat logic. It receives fire events and produces visual feedback. This separation between weapon logic (state layer) and weapon visuals (render layer) is critical for the project's architecture boundaries.

### 1.3 Depth Sorting Model

All VFX objects participate in the existing depth model: `depth = 100 + worldY`. This means:

- A muzzle flash at world position (x=300, y=200) gets `depth = 300`.
- An impact effect at world position (x=400, y=350) gets `depth = 450`.
- VFX objects correctly interleave with other game objects (buildings, units, terrain) based on their Y position.

**Depth offset convention for VFX:**

| VFX type | Depth offset from entity base | Reason |
|----------|-------------------------------|--------|
| Muzzle flash | `baseDepth + 2` | Above turret (baseDepth + 1) |
| Projectile (flying) | `baseDepth + 3` | Above muzzle flash |
| Impact effect | `100 + impactWorldY` | Independent depth at impact point |
| PointLight | `baseDepth + 4` | Above all other layers; additive blend |
| Smoke trail | `baseDepth - 1` | Below turret, above hull |

**Important depth gotchas:**

1. **ParticleEmitter renders all particles at one depth.** If a smoke emitter produces particles that drift to different Y positions, they all render at the emitter's depth. For scattered particles, `sortProperty: 'y'` sorts particles internally but they still batch as one depth relative to other game objects.
2. **Graphics (rail beams) render at one depth.** A beam spanning multiple Y positions renders as a single Graphics object at one depth. Long beams should be segmented or use a RenderTexture stamp approach.
3. **Tween-driven position changes must also update depth.** If a projectile tween moves its Y position, the depth must be updated per frame or in the tween's `onUpdate` callback.

---

## 2. Weapon Logic vs. Weapon Visuals

### 2.1 Strict Separation

The project's architecture boundaries require strict separation between the state/logic layer and the render/visual layer. This applies to weapon systems as well:

| Aspect | Weapon Logic (State Layer) | Weapon Visuals (Render Layer) |
|--------|---------------------------|-------------------------------|
| Language | Pure TypeScript, no Phaser | Phaser 4.1.0 GameObjects |
| Responsibility | Decide when/where/what to fire | Show the visual feedback of firing |
| Data | Cooldowns, damage, range, projectile speed | VFX sprites, tweens, particles, recoil |
| Timing | Game tick resolution | Frame-by-frame visual resolution |
| Ownership | `GameState` / combat state | `WeaponVfxController` / render layer |
| Testing | Unit tests (Vitest) | Visual QA (manual, smoke test) |

### 2.2 Communication Pattern

When combat is implemented later, the communication between logic and visuals should follow this pattern:

1. **State layer** resolves a fire action: unit X fires weapon Y at target Z.
2. **State layer** emits a fire event or updates state with a "firing" flag.
3. **Render layer** reads the fire event/flag and creates VFX accordingly.
4. **Render layer** does NOT feed back into combat logic (no "VFX complete → damage applied" loop).
5. **State layer** applies damage immediately on fire, regardless of VFX duration.

This "instant damage + cosmetic VFX" pattern is standard in RTS games. The visual projectile is cosmetic — damage is resolved immediately by the state layer. This avoids sync issues between VFX timing and game logic timing, and is simpler to implement and test.

### 2.3 Why This Matters for Design

This design document focuses exclusively on the visual layer. It does not define combat state, damage calculations, hit chance, cooldown timers, or projectile physics. Those are combat logic concerns that belong in a separate combat design document and a separate implementation task.

---

## 3. Arena as Safe Testbed

### 3.1 Why Arena First

The arena mode (`?devtools=1&arena=1`, 20x20 map) is the designated safe testbed for weapon VFX implementation. Reasons:

1. **Controlled environment**: Only a handful of modular combat units, no economy loop, no pathfinding conflicts.
2. **Small map**: 20x20 terrain (400 tiles) means fewer objects to manage and debug.
3. **Devtools access**: The devtools panel provides diagnostic controls, spawn buttons, and overlay toggles.
4. **Isolation from main sandbox**: Arena VFX bugs cannot break the main sandbox civil economy loop.
5. **Easy reset**: Arena can be reset via dev command without affecting saved game state.

### 3.2 Arena VFX Testing Strategy

When weapon VFX implementation proceeds (future task), the testing strategy should be:

1. **Phase 1 — Standalone VFX**: Create muzzle flash, projectile, and impact effects in isolation (no combat state). Trigger via dev command or keyboard shortcut.
2. **Phase 2 — Connected to modular tank**: Wire VFX to the existing Wasp/Smoky modular tank in arena mode. Fire triggered by dev command.
3. **Phase 3 — Connected to combat state**: Wire VFX to the future combat state layer. Fire triggered by combat logic.
4. **Phase 4 — Main sandbox**: Only after arena validation is complete, connect VFX to the main sandbox game loop.

### 3.3 Arena Must Not Receive Full Combat

This design does NOT add combat behavior to the arena. The arena currently shows modular tanks that can be direction-controlled via dev hotkeys (Q/E for body, Z/X for turret). Future VFX implementation should add visual-only fire effects triggered by a dev command, not by AI or combat logic.

---

## 4. Weapon Categories

### 4.1 Smoky — Fast Cannon Style

**Visual identity**: Rapid-fire, moderate-impact cannon with visible smoke and small muzzle flash. Think of a light autocannon — fast rhythm, moderate visual weight.

| Property | Smoky Value | Rationale |
|----------|-------------|-----------|
| Fire rate | Fast (~0.5s cooldown) | Rapid-fire feel, multiple shots visible |
| Muzzle flash | Small, warm orange/yellow | Quick burst, 100-150ms duration |
| Projectile | Small bright dot or short streak | Fast travel, 300-500px/s screen speed |
| Recoil | Small — turret kicks back 2-4px | Subtle, fast return (80-120ms) |
| Chassis response | None or minimal | Wasp hull does not react to Smoky |
| Smoke | Light puff from barrel tip | 5-10 particles, rises slowly |
| Impact flash | Small bright dot | 100ms duration, 2-3 particles |
| Impact dust | Small dust puff | 5-8 particles, settles quickly |
| Sound style (future) | Sharp crack, not heavy boom | Fast cannon feel |

**VFX configuration sketch:**
```typescript
const SMOKY_VFX_CONFIG = {
  muzzleFlash: { sprite: 'vfx_muzzle_smoky', duration: 120, scale: 0.6 },
  projectile: { type: 'sprite', speed: 400, sprite: 'vfx_bullet_smoky' },
  recoil: { turretOffset: -3, duration: 80, ease: 'Quad.easeOut', returnDuration: 120 },
  smoke: { particleCount: 8, lifespan: 500, speed: { min: 20, max: 60 }, scale: { start: 0.4, end: 0 } },
  impactFlash: { duration: 100, particleCount: 4, scale: 0.3 },
  impactDust: { particleCount: 6, lifespan: 400, speed: { min: 30, max: 80 } },
  pointLight: { color: 0xffaa44, radius: 60, intensity: 2, duration: 150 },
};
```

### 4.2 Railgun — Strong Recoil Beam Style

**Visual identity**: High-impact, slow-firing energy weapon with a bright beam/trail and strong chassis kick. Think of a tank destroyer — one devastating shot, dramatic visual feedback.

| Property | Railgun Value | Rationale |
|----------|---------------|-----------|
| Fire rate | Slow (~2.0s cooldown) | Heavy weapon, one powerful shot |
| Muzzle flash | Large, bright cyan/white | Dramatic flash, 150-250ms duration |
| Projectile | Bright beam/trail from muzzle to impact | Instant or very fast, visible line |
| Recoil | Strong — turret kicks back 6-10px | Dramatic, slow return (150-250ms) |
| Chassis response | Visible — Wasp hull rocks back 3-5px | Wasp is light, feels the kick |
| Smoke | None or minimal energy vapor | Railguns are clean, not smoky |
| Impact flash | Large bright burst | 200ms duration, 10-15 particles |
| Impact dust | Significant dust + sparks ring | 15-25 particles, wider spread |
| Sound style (future) | Deep charge-up, heavy discharge | Heavy weapon feel |

**VFX configuration sketch:**
```typescript
const RAILGUN_VFX_CONFIG = {
  muzzleFlash: { sprite: 'vfx_muzzle_railgun', duration: 200, scale: 1.0 },
  projectile: { type: 'beam', width: 3, color: 0x00ffff, glowWidth: 8, glowColor: 0x00aaff },
  recoil: { turretOffset: -8, duration: 150, ease: 'Power2.easeOut', returnDuration: 250 },
  chassisRecoil: { offset: -4, duration: 180, ease: 'Cubic.easeOut', returnDuration: 300 },
  smoke: null, // Railgun is clean
  impactFlash: { duration: 200, particleCount: 12, scale: 0.8 },
  impactDust: { particleCount: 20, lifespan: 600, speed: { min: 40, max: 120 } },
  pointLight: { color: 0x44ccff, radius: 100, intensity: 3, duration: 250 },
};
```

### 4.3 Future Generic Projectile Weapons

The design should support additional weapon types without architectural changes. Future candidates include:

- **Shotgun/Scatter**: Multiple small projectiles in a cone. VFX: wide muzzle flash, multiple short trails, scattered impact points.
- **Missile/Launcher**: Slow projectile with tracking trail. VFX: smoke trail, larger impact explosion, longer projectile lifespan.
- **Laser/Continuous Beam**: Sustained beam while firing. VFX: continuous line from muzzle to target, no recoil per tick, target glow.
- **Plasma/AoE**: Charged shot with area impact. VFX: charging glow at barrel, large impact sphere, wider dust ring.

All future weapons should follow the same VFX configuration pattern and controller lifecycle defined in this document.

---

## 5. VFX Components

### 5.1 Muzzle Flash

**What it is**: A brief bright visual at the weapon's barrel tip when firing. Provides instant feedback that the weapon has fired.

**Implementation approach**:
- **Primary**: Sprite-based. A muzzle flash PNG (or animation) positioned at the barrel tip offset for the current turret direction.
- **Fallback**: If no muzzle flash PNG exists, a small Phaser Graphics circle with additive blend mode and alpha fade.
- **Timing**: 100-250ms depending on weapon type. Always shorter than the weapon's cooldown.

**Position calculation**:
The muzzle position depends on the turret direction and the turret's mount position on the hull. The existing `MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR` provides the turret mount offset per body direction. A muzzle offset per turret direction would be added:

```typescript
// Conceptual — not implemented in this design task
const MUZZLE_OFFSETS_BY_TURRET_DIR: Record<number, { x: number; y: number }> = {
  0: { x: 12, y: -2 },   // E — barrel points right
  1: { x: 10, y: -6 },   // SE
  2: { x: 0, y: -10 },   // S — barrel points down
  3: { x: -10, y: -6 },  // SW
  4: { x: -12, y: -2 },  // W
  5: { x: -10, y: 4 },   // NW
  6: { x: 0, y: 8 },     // N — barrel points up
  7: { x: 10, y: 4 },    // NE
};
```

These offsets are in local sprite coordinates and must be scaled by `MODULAR_TANK_SCALE`.

### 5.2 Projectile / Beam / Trail

**What it is**: The visual representation of the projectile traveling from the muzzle to the impact point. For Smoky, this is a small fast-moving sprite. For Railgun, this is an instant beam line.

**Implementation approaches by weapon type**:

| Weapon | Projectile type | Implementation |
|--------|----------------|----------------|
| Smoky | Sprite projectile | Small Image sprite, tween from muzzle to impact, destroy on arrival |
| Railgun | Instant beam | Phaser Graphics line from muzzle to impact, fade out over 200ms |
| Future missile | Sprite with trail | Moving sprite + ParticleEmitter for smoke trail |

**Sprite projectile (Smoky style)**:
- Create an Image at the muzzle position.
- Tween its position to the impact position over `distance / speed` milliseconds.
- On arrival, destroy the projectile sprite and spawn impact VFX.
- Duration: typically 50-300ms depending on distance and speed.

**Beam (Railgun style)**:
- Create a Graphics object at the muzzle position.
- Draw a line from the muzzle position to the impact position.
- Use `lineStyle(width, color, alpha)` for the beam core and a second wider, more transparent line for the glow.
- Tween alpha from 1.0 to 0.0 over 150-300ms.
- Destroy the Graphics object on completion.

**Depth considerations**: Both approaches use `depth = 100 + worldY` where worldY is the muzzle Y position (not the impact Y). This means long beams or fast projectiles may render behind objects they visually cross. For the initial implementation, this is acceptable — perfect depth-interleaving of projectiles is a refinement, not a requirement.

### 5.3 Smoke

**What it is**: Particle effects that simulate smoke from the barrel (Smoky) or energy vapor (Railgun). Smoke adds visual weight and atmosphere to firing events.

**Implementation approach**:
- Use Phaser's `ParticleEmitter` with a small smoke particle texture.
- Position at the muzzle point.
- Configuration: low speed, upward drift (negative speedY), fade out over lifespan, scale down to zero.
- For Smoky: light gray smoke, 5-10 particles, lifespan 400-600ms.
- For Railgun: no smoke (energy weapon is clean), optionally very faint cyan vapor.

**Particle system details**:
```typescript
// Conceptual Smoky smoke config
const smokeConfig = {
  speed: { min: 20, max: 60 },
  angle: { min: 250, max: 290 },  // upward cone
  lifespan: 500,
  scale: { start: 0.4, end: 0 },
  alpha: { start: 0.6, end: 0 },
  quantity: 8,
  emitting: false,     // burst mode
  blendMode: Phaser.BlendModes.NORMAL,
};
```

**Note on ParticleEmitter depth**: All particles render at the emitter's depth. If smoke drifts to a different Y position, it still renders at the emitter's original depth. For the small particle counts and short lifespans in weapon VFX, this is acceptable — the visual discrepancy is minimal.

### 5.4 Impact Flash

**What it is**: A bright burst at the point where the projectile hits. Provides visual feedback that damage has been dealt at the target location.

**Implementation approach**:
- **Primary**: Small sprite or particle burst at the impact point. Bright, short-lived (100-200ms).
- **Alternative**: Phaser Graphics circle with additive blend mode and fast alpha fade.
- For Smoky: small flash, 4-6 particles, 100ms.
- For Railgun: large flash, 10-15 particles, 200ms.

**Position**: The impact world position derived from the target unit's screen position or the target tile's screen position.

**Depth**: `depth = 100 + impactWorldY`. This places the impact effect at the correct depth relative to other game objects at the same Y position.

### 5.5 Impact Dust / Sparks

**What it is**: Secondary particles at the impact point that simulate dust, debris, or sparks. Adds visual weight to the impact beyond the bright flash.

**Implementation approach**:
- ParticleEmitter at the impact point.
- Radial emission (particles spread outward from center).
- For Smoky: 5-8 dust particles, slow speed, short lifespan, sandy/brown color.
- For Railgun: 15-25 spark/dust particles, higher speed, longer lifespan, mixed bright and sandy colors.
- Particles should decelerate (use `accelerationX/Y` opposing initial velocity or simply use short lifespan with low speed).

### 5.6 Short PointLight Flash/Glow (Future Option)

**What it is**: A brief PointLight glow at the muzzle (on fire) and impact (on hit) positions. This is the Option E from VISUAL-SPIKE-01 — baked lighting for assets + PointLight flashes/glows for weapon fire and impacts.

**Status**: Deferred. Not implemented as part of WEAPON-WORKFLOW-01. This is a future direction to evaluate.

**If implemented later**:
- Create a `PointLight` at the muzzle position when firing.
- Set color, radius, intensity per weapon config.
- Tween intensity from max to 0 over 100-300ms.
- Destroy the PointLight on tween completion.
- `PointLight` extends `GameObject` with full `setDepth()` support.
- `PointLight` uses additive blend mode by default — visually appears as a soft glow.
- No normal maps required. No per-pixel lighting setup. No `scene.lights.enable()`.

**PointLight parameters by weapon**:

| Weapon | Color | Radius | Intensity | Attenuation | Duration |
|--------|-------|--------|-----------|-------------|----------|
| Smoky | 0xffaa44 (warm orange) | 50-70 | 2.0 | 0.1 | 120ms |
| Railgun | 0x44ccff (cyan) | 80-120 | 3.0 | 0.08 | 200ms |

---

## 6. Recoil Model

### 6.1 Core Principle: Visual Feedback, Not Physics

Recoil in this project is **purely visual feedback**. It does not affect:
- Unit position on the grid (tx, ty remain unchanged).
- Combat calculations (damage, hit chance).
- Movement or pathfinding.
- Physics simulation (no velocity, no knockback, no flipping).

Recoil is implemented as **tweens on the turret and hull sprite positions**. The sprites are displaced along the barrel direction axis and then eased back to their original positions. The game state is never modified — only the visual positions of the render objects.

### 6.2 Turret Recoil

When a weapon fires, the turret sprite is displaced backward along the barrel axis. The displacement amount and timing depend on the weapon type.

**Mechanism**:
1. Calculate the recoil direction: opposite of the turret facing direction.
2. Calculate the recoil offset: a small pixel displacement (2-10px) along that direction.
3. Apply a tween to the turret's position:
   - Move backward: `duration: recoilDuration, ease: 'Quad.easeOut'`
   - Return to original: `duration: returnDuration, ease: 'Cubic.easeOut'`
4. The return tween can be a separate tween or a `yoyo: true` on the recoil tween.

**Per-weapon recoil parameters**:

| Weapon | Turret offset | Recoil duration | Return duration | Ease (recoil) | Ease (return) |
|--------|---------------|-----------------|-----------------|----------------|----------------|
| Smoky | 2-4px | 80ms | 120ms | Quad.easeOut | Cubic.easeOut |
| Railgun | 6-10px | 150ms | 250ms | Power2.easeOut | Cubic.easeOut |

**Direction-to-offset mapping**:
The recoil offset must be calculated from the turret's facing direction. In isometric coordinates, "backward" from the barrel direction depends on the 8-direction facing:

```typescript
// Conceptual recoil direction offsets (unit vectors)
const RECOIL_DIR_OFFSETS: Record<number, { dx: number; dy: number }> = {
  0: { dx: -1, dy: 0 },    // E barrel → recoil W
  1: { dx: -0.7, dy: 0.7 }, // SE barrel → recoil NW
  2: { dx: 0, dy: 1 },     // S barrel → recoil N
  3: { dx: 0.7, dy: 0.7 }, // SW barrel → recoil NE
  4: { dx: 1, dy: 0 },     // W barrel → recoil E
  5: { dx: 0.7, dy: -0.7 },// NW barrel → recoil SE
  6: { dx: 0, dy: -1 },    // N barrel → recoil S
  7: { dx: -0.7, dy: -0.7 },// NE barrel → recoil SW
};
```

The actual pixel offset is: `offsetPx * RECOIL_DIR_OFFSETS[turretDir]` applied to the turret sprite position.

### 6.3 Chassis Response

For heavy weapons (Railgun), the hull sprite also reacts with a small displacement. This simulates the chassis being pushed by the weapon's recoil.

**Wasp chassis response for Railgun**:
- Hull displaces 3-5px in the barrel's recoil direction.
- Slightly slower than turret recoil — the hull is heavier.
- Return is slower and more damped.
- The hull displacement does NOT move the unit on the grid. It is a visual-only offset that returns to the original position.

**Smoky has no chassis response**: The Smoky is a light weapon. The Wasp chassis absorbs the recoil without visible movement. Only the turret kicks.

### 6.4 No Physical Flip Mechanics

The design explicitly excludes:
- Units being flipped, knocked over, or spun by weapon impacts.
- Physics-based knockback that changes grid position.
- Ragdoll or damage-based visual deformation.
- Any mechanic where the unit's visual representation permanently departs from its logical position.

If a unit is destroyed, it plays a destruction animation and is removed from the game. There is no "stunned" or "knocked back" visual state in the current design scope.

### 6.5 Visual-Only Recoil Using Tweens

**Implementation pattern** (conceptual — not implemented in this design task):

```typescript
function applyRecoil(
  turret: Phaser.GameObjects.Image,
  hull: Phaser.GameObjects.Image,
  turretDir: number,
  config: RecoilConfig
): void {
  const dirOffset = RECOIL_DIR_OFFSETS[turretDir];
  
  // Turret recoil
  const turretDx = dirOffset.dx * config.turretOffset;
  const turretDy = dirOffset.dy * config.turretOffset;
  scene.tweens.add({
    targets: turret,
    x: turret.x + turretDx,
    y: turret.y + turretDy,
    duration: config.recoilDuration,
    ease: config.recoilEase,
    yoyo: true,
    yoyoEase: config.returnEase,
  });

  // Hull recoil (if applicable)
  if (config.chassisOffset > 0) {
    const hullDx = dirOffset.dx * config.chassisOffset;
    const hullDy = dirOffset.dy * config.chassisOffset;
    scene.tweens.add({
      targets: hull,
      x: hull.x + hullDx,
      y: hull.y + hullDy,
      duration: config.recoilDuration * 1.2,
      ease: config.recoilEase,
      yoyo: true,
      yoyoEase: config.returnEase,
    });
  }
}
```

**Key consideration**: The turret and hull sprites are managed by `ModularTankRenderer`. Recoil tweens modify sprite positions temporarily, which means the `updateVisuals()` method must not overwrite recoil positions when called during a recoil tween. The implementation task must handle this interaction — either by pausing `updateVisuals()` during recoil, or by tracking a "recoil offset" that is added to the base position.

---

## 7. Chassis + Weapon Layering Model

### 7.1 Current Rendering Model

The `ModularTankRenderer` currently renders two Image objects per tank:

```
Hull Image:  position = anchorWorld + hullOffsetsByBodyDir[bodyDir]
             origin = (0.5, 0.75)  — bottom-center
             depth = 100 + hullWorldY
             scale = MODULAR_TANK_SCALE

Turret Image: position = anchorWorld + turretMountByBodyDir[bodyDir]
              origin = (0.5, 0.5)  — center
              depth = hullDepth + 1
              scale = MODULAR_TANK_SCALE
```

The `anchorWorld` is the tile center in screen space plus the map offset. Hull and turret positions are computed from the anchor plus per-direction offsets.

### 7.2 Extended Layering for VFX

When weapon VFX is implemented, the layer model extends to:

```
Layer 0 — Hull (Image)
  | position: anchorWorld + hullOffset[bodyDir]
  | depth: baseDepth
  | persistent: always visible

Layer 1 — Turret (Image)
  | position: anchorWorld + turretMount[bodyDir]
  | depth: baseDepth + 1
  | persistent: always visible
  | recoil: tweened offset during fire

Layer 2 — Muzzle Flash (Sprite or Image)
  | position: turretWorld + muzzleOffset[turretDir]
  | depth: baseDepth + 2
  | persistent: no — created/destroyed per fire event
  | lifetime: 100-250ms

Layer 3 — Projectile (Image or Graphics)
  | position: muzzleWorld → impactWorld (tweened)
  | depth: baseDepth + 3 (sprite) or varies (beam)
  | persistent: no — created/destroyed per fire event
  | lifetime: 50-500ms

Layer 4 — Impact VFX (Sprite + ParticleEmitter)
  | position: impactWorld
  | depth: 100 + impactWorldY
  | persistent: no — created/destroyed per fire event
  | lifetime: 200-600ms

Layer 5 — PointLight (deferred)
  | position: muzzleWorld / impactWorld
  | depth: baseDepth + 4
  | persistent: no — created/destroyed per fire event
  | lifetime: 100-300ms
```

### 7.3 Muzzle Point Calculation

The muzzle point is the barrel tip position in world space. It depends on:

1. **Turret mount position**: `anchorWorld + turretMount[bodyDir]` (already computed by `ModularTankRenderer`).
2. **Muzzle offset per turret direction**: An additional offset from the turret center to the barrel tip, varying by turret direction.
3. **Recoil offset** (during recoil): The muzzle position shifts with the turret during recoil.

The muzzle offset must be calibrated per turret sprite. Different turret sprites (Smoky, future Railgun) will have different barrel lengths and barrel directions. This requires per-weapon muzzle offset data.

### 7.4 Impact Point Calculation

The impact point is the target's world position. It depends on:

1. **Target unit's tile position** → `tileToScreen(tx, ty)` + offset.
2. **Target unit's render center** — could be the entity's anchor world position.
3. **Random scatter** — for weapons with spread, add a small random offset from the target center.

For the initial implementation, the impact point is simply the target entity's world position. Scatter and precision are future refinements.

---

## 8. Asset Requirements

### 8.1 PNGs Needed Later

The following asset files are needed for weapon VFX implementation. None of these are created in this design task. They are listed here as requirements for the art pipeline.

| Asset | Dimensions | Format | Description |
|-------|------------|--------|-------------|
| `vfx_muzzle_smoky.png` | 64x64 | RGBA | Smoky muzzle flash sprite — warm orange/yellow burst |
| `vfx_muzzle_railgun.png` | 64x64 | RGBA | Railgun muzzle flash sprite — bright cyan/white burst |
| `vfx_bullet_smoky.png` | 16x16 | RGBA | Smoky projectile dot — small bright tracer |
| `vfx_impact_smoky.png` | 48x48 | RGBA | Smoky impact burst — small bright flash |
| `vfx_impact_railgun.png` | 64x64 | RGBA | Railgun impact burst — large bright explosion |
| `vfx_smoke_particle.png` | 32x32 | RGBA | Generic smoke puff particle — soft gray circle |
| `vfx_spark_particle.png` | 8x8 | RGBA | Generic spark particle — bright yellow/white dot |
| `vfx_dust_particle.png` | 24x24 | RGBA | Generic dust puff particle — sandy brown soft circle |

**Total new PNGs**: 8 (minimum). Additional weapon types will add more muzzle/impact sprites.

### 8.2 Naming Conventions

```
vfx_{weapon}_{component}.png       — weapon-specific VFX
vfx_{component}_particle.png       — generic reusable particles

Examples:
vfx_muzzle_smoky.png               — Smoky muzzle flash
vfx_muzzle_railgun.png             — Railgun muzzle flash
vfx_bullet_smoky.png               — Smoky projectile
vfx_impact_smoky.png               — Smoky impact burst
vfx_smoke_particle.png             — Generic smoke (shared across weapons)
vfx_spark_particle.png             — Generic spark (shared across weapons)
vfx_dust_particle.png              — Generic dust (shared across weapons)
```

**Directory**: `public/assets/vfx/` — new directory for VFX sprites, separate from faction/unit/building assets.

### 8.3 Muzzle Flash Sprites

Muzzle flash sprites should be:
- Circular or starburst shape with soft edges (alpha gradient to transparent).
- Centered at (0.5, 0.5) origin.
- Warm colors for ballistic weapons (Smoky), cool colors for energy weapons (Railgun).
- Designed for additive blend mode — dark areas become transparent when rendered with `Phaser.BlendModes.ADD`.
- Multiple frames optional — a 3-4 frame animation can give a flickering effect, but a single frame with alpha tween is simpler and often sufficient.

### 8.4 Smoke Particles/Sprites

Smoke particle sprites should be:
- Soft, circular, no hard edges.
- Light gray to white coloring.
- Designed for normal blend mode with alpha fade.
- A single 32x32 sprite is sufficient for all smoke effects — the particle system handles scaling, rotation, and lifetime.

### 8.5 Rail Beam/Trail Sprite or Generated Geometry

For the Railgun beam, there are two approaches:

**Option 1 — Generated Graphics line**:
- No sprite asset needed.
- Use `Phaser.GameObjects.Graphics` to draw a line from muzzle to impact.
- Core line: 2-3px width, bright cyan, full alpha.
- Glow line: 6-8px width, softer cyan, 40% alpha, behind core line.
- Fade out via alpha tween over 150-300ms.
- Advantage: No asset, dynamically sized to any distance.
- Disadvantage: Graphics objects are less batchable than sprites.

**Option 2 — Stretched sprite**:
- A single beam segment PNG (e.g., 128x4px gradient line).
- Scale and rotate the sprite to stretch from muzzle to impact.
- Advantage: Sprite batching, simpler rendering.
- Disadvantage: Rotated sprites may have visual artifacts at extreme angles.

**Recommended**: Option 1 (Graphics line) for initial implementation. It requires no assets and handles any beam length/angle naturally.

### 8.6 Impact Sprites

Impact sprites should be:
- Centered at (0.5, 0.5) origin.
- Starburst or radial burst shape.
- Bright center, fading to transparent edges.
- Designed for additive blend mode.
- Smoky: small (48x48), warm colors.
- Railgun: large (64x64), cool/bright colors.

### 8.7 Optional PointLight Parameters

PointLight is a runtime Phaser object — no PNG asset needed. Parameters are defined in the weapon VFX config:

| Parameter | Type | Smoky Default | Railgun Default |
|-----------|------|---------------|-----------------|
| `color` | number | 0xffaa44 | 0x44ccff |
| `radius` | number | 60 | 100 |
| `intensity` | number | 2.0 | 3.0 |
| `attenuation` | number | 0.1 | 0.08 |
| `duration` | number | 150ms | 250ms |

---

## 9. Phaser 4 Feature Candidates

### 9.1 Tweens for Recoil — SELECTED

**Phaser 4.1.0 Tween API** provides everything needed for recoil:

- `scene.tweens.add(config)` creates and starts a tween immediately.
- `yoyo: true` automatically returns the value to its starting position.
- `ease` functions control the acceleration/deceleration curve.
- `onComplete` callback enables cleanup after the recoil returns.
- Multiple tweens can target different objects (turret, hull) simultaneously.

**Why selected**: Tweens are the correct Phaser 4 mechanism for visual recoil. They are lightweight, frame-rate independent, and well-tested. No alternative approach (manual position updates, physics simulation) is simpler or more reliable.

**Risk**: Low. Tweens are a core Phaser feature used throughout the project already.

### 9.2 Particles for Smoke/Sparks — SELECTED (Later)

**Phaser 4.1.0 ParticleEmitter API** provides:

- `scene.add.particles(x, y, texture, config)` creates a particle emitter.
- Full control over speed, lifespan, scale, alpha, quantity, blend mode.
- `emitter.explode(count)` for burst effects (weapon smoke, impact dust).
- `emitter.setDepth(value)` for depth sorting integration.
- `emitter.destroy()` for cleanup when all particles are dead.

**Why selected**: Particles are the standard approach for smoke, dust, and spark effects in 2D games. Phaser 4's particle system is mature and well-documented.

**Timing**: Particles require texture assets (smoke, dust, spark PNGs). Since no VFX assets exist yet, particle implementation is blocked on asset creation. Initial VFX implementation should use sprite-based approaches where possible, with particles added when assets are available.

**Risk**: Low for small particle counts (5-25 particles per event). Medium for larger effects — many simultaneous emitters could affect performance on low-end devices.

### 9.3 PointLight for Weapon Flash/Glow — SELECTED (Future, Deferred)

**Phaser 4.1.0 PointLight API** provides:

- `scene.add.pointlight(x, y, color, radius, intensity, attenuation)` creates a glow effect.
- PointLight extends GameObject with `setDepth()`, `setAlpha()`, `setVisible()`.
- Additive blend mode by default — creates a soft glow effect.
- Very fast rendering (no normal map processing).
- No `scene.lights.enable()` required (unlike per-pixel Light objects).

**Why selected**: PointLight is the simplest way to add dynamic illumination to weapon fire. It requires no normal maps, no lighting system setup, and no per-entity changes. A brief PointLight at the muzzle position creates convincing "weapon flash" feedback.

**Timing**: Deferred. Per VISUAL-SPIKE-01, PointLight VFX is a preferred future direction, not immediate implementation. The implementation requires a separate approved task after this design is accepted.

**Risk**: Very low. PointLight is a visual-only effect with no interaction with the game's rendering architecture. If it looks wrong, it can be removed with zero impact.

### 9.4 Animation Manager for Firing States — SELECTED (Later)

**Phaser 4.1.0 Animation Manager** provides:

- `scene.anims.create(config)` registers animation keys globally.
- `sprite.anims.play(key)` plays an animation on a sprite.
- `sprite.anims.chain(key)` queues the next animation after the current one completes.
- Events: `animationcomplete-{key}` for chaining fire → idle transitions.

**Use case**: When weapon turret sprites have firing animation frames (recoil, flash baked into sprite), the Animation Manager handles the state transition. This is relevant when the art pipeline produces spritesheets with firing states.

**Timing**: Later. Current Smoky turret sprites are single-frame per direction. Firing animations would require new spritesheets with additional frames per direction. This is blocked on art production.

**Alternative for now**: Tween-based recoil + sprite-based muzzle flash (no firing animation frames needed).

**Risk**: Low. Animation Manager is already proven in the project (harvester walk cycle).

### 9.5 Depth Sorting Implications — ACCEPTED

The existing depth model (`depth = 100 + worldY`) is compatible with all VFX approaches:

| VFX Type | Depth Strategy | Compatible? |
|----------|----------------|-------------|
| Recoil tweens | Depth unchanged (turret depth stays the same) | Yes |
| Muzzle flash sprite | `baseDepth + 2` (above turret) | Yes |
| Projectile sprite | `baseDepth + 3` or `100 + projectileWorldY` | Yes |
| Beam (Graphics) | `baseDepth + 3` | Partial (long beams may overlap incorrectly) |
| ParticleEmitter | `emitter.setDepth(baseDepth + 1)` | Yes (all particles at one depth) |
| PointLight | `light.setDepth(baseDepth + 4)` | Yes |
| Impact effects | `100 + impactWorldY` | Yes |

**Known limitation**: Long beam Graphics render at a single depth. A Railgun beam from Y=100 to Y=400 renders at depth 103, but a building at Y=200 with depth 300 would render on top of the beam, even though the beam visually passes in front of the building. This is acceptable for the initial implementation — the beam is so brief (200ms) that the incorrect depth ordering is barely noticeable.

### 9.6 Features Rejected for Now

| Feature | Reason |
|---------|--------|
| Per-pixel Light (with normal maps) | Deferred by VISUAL-SPIKE-01 |
| Custom RenderNode/shader | Too complex, too risky for VFX |
| SpriteGPULayer for VFX | Rejected by PHASER4-GPU-01 |
| Canvas fallback VFX | Project is WebGL-only |
| Physics-based recoil | Not wanted — visual-only recoil per design |
| Sound integration | Out of scope — future audio task |

---

## 10. Baked Into Assets vs. Runtime VFX

### 10.1 What Should Be Baked Into PNGs

The following visual effects should be pre-baked into sprite/tile PNGs and NOT generated at runtime:

1. **Ambient lighting on all sprites**: Directional sunlight, ambient occlusion, shadow gradients baked into hull, turret, and building PNGs. Runtime lighting is deferred (VISUAL-SPIKE-01).

2. **Unit shadow/ground contact**: The soft shadow beneath a unit's feet should be baked into the sprite or rendered as a separate semi-transparent Graphics ellipse at a fixed offset.

3. **Base turret appearance**: The idle/default appearance of each turret direction is baked into the direction-specific PNGs. Firing states may add animation frames later, but the base look is baked.

4. **Hull detail and wear**: Surface detail, paint chips, scratches, and weathering on hull sprites are baked into the PNG. No runtime surface effects.

5. **Building impact marks**: Scorched earth, bullet holes, and blast marks on buildings should be baked into building sprites or applied as separate decal sprites — not generated by a shader.

### 10.2 What Should Be Runtime VFX

The following visual effects should be generated at runtime using Phaser's VFX APIs:

1. **Muzzle flash**: Brief bright burst at barrel tip. Duration too short to justify a baked sprite overlay. A small sprite or Graphics circle is more flexible and can be positioned precisely per direction.

2. **Projectile travel**: A moving sprite or beam from muzzle to impact. The trajectory is computed at runtime based on fire source and target positions. Cannot be baked.

3. **Recoil displacement**: Turret and hull position offsets during firing. These are tween-driven position changes on existing sprites. Cannot be baked.

4. **Impact flash and dust**: Burst effects at the impact point. Position depends on target location. Duration and particle spread are runtime parameters.

5. **PointLight glow**: Brief illumination at muzzle/impact. Per VISUAL-SPIKE-01 Option E, this is a runtime effect using Phaser's PointLight GameObject.

6. **Smoke particles**: Barrel smoke and impact dust. Particle positions, velocities, and lifetimes are computed at runtime.

### 10.3 Rationale for the Split

The baked-vs-runtime split is driven by three principles:

1. **Performance**: Baked effects are free at runtime (zero GPU cost beyond the texture sample that already happens). Runtime VFX add draw calls, particle updates, and tween calculations. Keep runtime VFX to transient effects that cannot be baked.

2. **Flexibility**: Effects that depend on runtime positions, directions, or timing must be runtime VFX. Effects that are the same regardless of game state can be baked.

3. **Consistency**: VISUAL-SPIKE-01 established that full dynamic lighting (normal maps, per-pixel lighting) is deferred. Baking ambient light and shadows into sprites ensures visual consistency across all objects.

---

## 11. Performance Risks

### 11.1 Risk Matrix

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Many simultaneous fire events | Medium | Low (arena only initially) | Limit max concurrent VFX per frame; queue excess events |
| Particle count explosion | Medium | Low (small particle counts per event) | Cap total alive particles; use `maxAliveParticles` on emitters |
| Tween accumulation (leaked tweens) | Medium | Medium (if VFX not properly cleaned up) | Always set `onComplete` to destroy; use `persist: false` (default) |
| Beam Graphics overhead | Low | Low (only Railgun uses beams) | Destroy Graphics immediately after fade; do not accumulate |
| PointLight batch breaking | Low | Low (deferred feature) | Group PointLights consecutively on display list; use Layer |
| Depth sorting overhead | Low | Low (depth is already computed per frame) | VFX objects use same `100 + worldY` formula |
| Memory pressure from VFX textures | Low | Low (8 small PNGs, ~500KB total) | Keep VFX sprites small (64x64 max); reuse shared particles |

### 11.2 Performance Budget

**Recommended budget for weapon VFX in arena mode (5-10 active units)**:

| Metric | Budget | Notes |
|--------|--------|-------|
| Max concurrent VFX sprites | 20 | 2 per active firing unit |
| Max concurrent particles | 100 | Across all emitters |
| Max concurrent tweens | 30 | Recoil + alpha fades + projectile movement |
| Max concurrent PointLights | 5 | Deferred feature |
| VFX GPU memory | < 2MB | 8 VFX PNGs at 64x64 RGBA |
| VFX frame time impact | < 2ms | On desktop; measured after implementation |

### 11.3 Mobile Considerations

The project currently targets desktop browsers. Mobile performance is unknown. Weapon VFX adds:

- Particle systems: moderate GPU cost (fill rate for blended particles).
- Tweens: negligible CPU cost.
- PointLights: moderate GPU cost (additive blend quads).
- Additional texture memory: minimal (8 small PNGs).

If mobile becomes a target, the VFX system should support a "low VFX" mode that:
- Reduces particle counts by 50-70%.
- Removes PointLights entirely.
- Simplifies beam rendering (thinner, shorter fade).
- Skips muzzle flash sprites (use alpha tween on turret instead).

---

## 12. QA / Testing Plan

### 12.1 Visual QA Checklist

When weapon VFX is implemented, the following visual QA must pass:

**Smoky VFX:**
- [ ] Muzzle flash appears at barrel tip for all 8 turret directions
- [ ] Projectile sprite travels from muzzle to target position
- [ ] Turret kicks back slightly and returns smoothly
- [ ] Hull does not move during Smoky recoil
- [ ] Light smoke puff appears at barrel tip
- [ ] Small impact flash appears at target
- [ ] Small dust puff appears at target
- [ ] VFX auto-cleans up (no stale sprites, emitters, tweens)
- [ ] VFX depth ordering looks correct (flash above turret, impact at target Y)

**Railgun VFX:**
- [ ] Large muzzle flash appears at barrel tip for all 8 turret directions
- [ ] Beam line appears from muzzle to target and fades out
- [ ] Turret kicks back strongly and returns smoothly
- [ ] Hull rocks back slightly and returns smoothly (chassis response)
- [ ] No smoke appears (Railgun is clean)
- [ ] Large impact burst appears at target
- [ ] Significant dust/spark burst appears at target
- [ ] VFX auto-cleans up (no stale sprites, emitters, tweens)
- [ ] Beam does not persist after fade

**General VFX:**
- [ ] Rapid firing (multiple events) does not accumulate stale VFX objects
- [ ] VFX does not affect game state (economy, unit position, pathfinding)
- [ ] Arena mode works correctly with VFX active
- [ ] Standard mode (no modular units) is unaffected
- [ ] qa:smoke passes with VFX code present (even if not triggered in standard mode)
- [ ] Frame rate remains above 55fps on desktop with 5-10 units firing

### 12.2 Automated Testing

Weapon VFX is primarily visual and cannot be fully tested by unit tests. However, the following can be tested:

- **VFX configuration validation**: Ensure all weapon VFX configs have required fields (muzzle, projectile, recoil, impact).
- **Recoil offset calculation**: Pure function that takes turret direction and returns offset — can be unit tested.
- **Muzzle position calculation**: Pure function that takes turret mount position and turret direction — can be unit tested.
- **VFX cleanup**: Test that VFX objects are destroyed after their lifetime expires.

### 12.3 Smoke Test Compatibility

The existing `qa:smoke` dual-mode test must continue to pass. Since weapon VFX is only triggered by fire events (which require combat logic), the smoke test in standard mode should not encounter any VFX code. In arena mode, VFX would only appear if combat is triggered, which the smoke test does not do.

**Requirement**: VFX code must be inert when no fire events occur. It must not affect startup, asset loading, or idle rendering.

---

## 13. Implementation Sequence After Design Acceptance

When this design is accepted and a future implementation task is approved, the recommended implementation sequence is:

### Phase 1 — Foundation (1-2 days)

1. **VFX config types**: Define TypeScript interfaces for weapon VFX configurations in the state layer (no Phaser imports).
2. **VFX config data**: Create configuration objects for Smoky and Railgun weapons.
3. **Recoil math helpers**: Pure TypeScript functions for recoil direction offsets and muzzle position calculation. Unit test these.
4. **Muzzle offset data**: Per-turret-direction muzzle offset constants for each weapon type.

### Phase 2 — Core VFX (2-3 days)

5. **WeaponVfxController**: Create the VFX controller class in the render layer. Handles VFX creation, lifecycle, and cleanup.
6. **Muzzle flash**: Implement sprite-based muzzle flash at calculated muzzle position with alpha fade.
7. **Projectile (Smoky)**: Implement moving sprite from muzzle to impact position.
8. **Beam (Railgun)**: Implement Graphics line from muzzle to impact with alpha fade.
9. **Recoil (turret)**: Implement tween-based turret recoil with direction-dependent offset.
10. **Recoil (hull/chassis)**: Implement hull chassis response for heavy weapons (Railgun only).

### Phase 3 — Particles (1-2 days, blocked on assets)

11. **Smoke particles**: Add ParticleEmitter for barrel smoke (Smoky).
12. **Impact particles**: Add ParticleEmitter for dust/sparks at impact point.
13. **Particle cleanup**: Ensure emitters are destroyed when all particles die.

### Phase 4 — PointLight (1 day, deferred, blocked on separate approval)

14. **PointLight muzzle glow**: Add brief PointLight at muzzle position on fire.
15. **PointLight impact glow**: Add brief PointLight at impact position on hit.
16. **PointLight cleanup**: Ensure PointLights are destroyed after fade.

### Phase 5 — Arena Integration (1 day)

17. **Dev fire command**: Add a dev keyboard shortcut to trigger a fire event on the selected modular tank.
18. **Arena VFX testing**: Manual QA in arena mode with dev fire command.
19. **Smoke test verification**: Ensure qa:smoke still passes in both modes.

### Phase 6 — Combat Integration (future task)

20. **Wire VFX to combat state**: When combat logic is implemented, wire fire events from combat state to WeaponVfxController.
21. **Main sandbox integration**: Connect VFX to main sandbox game loop after arena validation.

---

## 14. First Future Implementation Task Prompt

When the design is accepted and implementation is approved, the first implementation task prompt should be:

---

**Task: WEAPON-VFX-IMPL-01 — Weapon VFX implementation (Smoky + Railgun)**

**Mode: IMPLEMENTATION ONLY**

**Read first:**
- `docs/project/WEAPON_WORKFLOW_01_VFX_RECOIL_DESIGN.md`
- `src/phaser/render/ModularTankRenderer.ts`
- `src/phaser/render/EntityRenderer.ts`
- `src/phaser/render/isometric.ts`
- `src/assets/modularUnitAssets.ts`
- `src/state/types.ts`

**Goal:**
Implement weapon VFX for the Smoky and Railgun weapons in arena mode only. This includes muzzle flash sprites, projectile/beam rendering, recoil tweens, and VFX lifecycle management. PointLight and particle effects are deferred to a later task.

**Scope:**
- Create `src/phaser/render/WeaponVfxController.ts` — VFX creation, lifecycle, and cleanup.
- Create `src/config/weaponVfxConfig.ts` — VFX configuration data and types.
- Create minimal VFX sprite PNGs (or use placeholder Graphics) for muzzle flash and projectile.
- Wire a dev fire command in arena mode to trigger VFX.
- Do NOT implement combat logic, damage, or AI.
- Do NOT modify main sandbox behavior.

**Hard rules:**
- Do not modify game state or combat logic.
- Do not add PointLight implementation (deferred).
- Do not add particle effects (deferred until assets exist).
- Do not add new dependencies.
- Do not modify the main sandbox economy or civil loop.
- Arena-only VFX — standard mode must be unaffected.
- All VFX must auto-clean up (no leaked tweens, sprites, or emitters).

**Validation:**
- npm test
- npm run typecheck
- npm run build
- npm run qa:smoke (both modes)
- Manual QA in arena: fire VFX visible, recoil smooth, no stale objects

---

## 15. What Must Not Be Implemented Until Assets/Combat Sandbox Are Ready

The following items are explicitly out of scope for any near-term implementation and must not be started until the prerequisites are met:

1. **Combat state/logic**: No damage calculations, hit chance, cooldown timers, or weapon stats in the game state. Combat state requires a separate combat design document and approved implementation task.

2. **PointLight VFX implementation**: Deferred per VISUAL-SPIKE-01. Implementation requires a separate approved task after this design is accepted. PointLight is a future direction, not an immediate deliverable.

3. **Particle effects without assets**: ParticleEmitter requires texture PNGs (smoke, dust, sparks). These assets do not exist yet. Do not implement particle effects with placeholder textures that would need to be replaced later.

4. **Bot/enemy AI**: No enemy behavior, targeting logic, or AI-driven firing. This is explicitly out of scope for Phase 2.

5. **Full combat in main sandbox**: Weapon VFX must be validated in arena mode first. Do not connect VFX to the main sandbox game loop until arena testing is complete and the combat state layer is implemented.

6. **Animation Manager firing states**: Current turret sprites are single-frame per direction. Firing animation frames do not exist. Do not implement Animation Manager firing states until the art pipeline produces spritesheets with firing frames.

7. **Sound effects**: Audio is out of scope. Sound design requires a separate audio system implementation and asset production.

8. **Projectile physics**: No parabolic trajectories, wind effects, or physics-based projectile movement. Projectiles travel in straight lines from muzzle to impact (or appear instantly as beams).

---

## 16. Options Comparison

### Option A — Purely Sprite-Based VFX, No Lights

**What it is**: All weapon VFX uses Phaser Sprites and Images only. Muzzle flash is a sprite, projectile is a moving sprite, impact is a sprite. No PointLight, no particles, no Graphics. Recoil uses Tweens on existing sprites.

| Aspect | Assessment |
|--------|-----------|
| Visual benefit | Moderate — muzzle flash and projectile provide clear fire feedback; impact burst gives hit confirmation. No atmospheric glow or smoke. |
| Implementation risk | **Very Low** — sprites are the simplest Phaser GameObject; tween API is proven. |
| Asset requirements | 4-5 small PNGs (muzzle flash, projectile, impact for each weapon type). |
| Performance cost | Negligible — a few extra sprites per fire event, auto-destroyed. |
| Compatibility | **Perfect** — sprites work with the current renderer, depth model, and asset pipeline. |
| When to use | **Now** — this is the safest first implementation step. |

### Option B — Sprite-Based VFX + PointLight Flashes

**What it is**: Same sprite-based VFX as Option A, plus brief PointLight objects at muzzle and impact positions. PointLights are visual glow effects (additive blend), not per-pixel lighting.

| Aspect | Assessment |
|--------|-----------|
| Visual benefit | **High** — PointLight glow adds convincing illumination feedback. Muzzle flash feels warm and bright; impact feels powerful. This is the most impactful single VFX addition. |
| Implementation risk | **Low** — PointLight is a simple GameObject, no setup required, auto-culled by renderer. |
| Asset requirements | Same as Option A (no additional PNGs — PointLight is a runtime object). |
| Performance cost | Low — each PointLight is one draw call with additive blend. 2-4 concurrent PointLights during combat is negligible. |
| Compatibility | **Good** — PointLight works with any renderer. Per VISUAL-SPIKE-01, PointLight has no interaction with the RenderTexture terrain or per-pixel lighting system. Must group PointLights on display list for batch efficiency. |
| When to use | **Soon after Option A** — PointLight is the single highest-value VFX addition with minimal risk. Implementation requires a separate approved task per VISUAL-SPIKE-01. |

### Option C — Phaser Particles for Smoke/Sparks

**What it is**: Use Phaser's ParticleEmitter for smoke (barrel puff), dust (impact), and sparks (impact). Requires texture PNGs for each particle type.

| Aspect | Assessment |
|--------|-----------|
| Visual benefit | **High** — smoke and dust particles add significant atmosphere and visual weight. A Smoky without smoke feels wrong. Impact dust sells the hit. |
| Implementation risk | **Low-Medium** — Particle API is mature, but requires texture assets that do not exist yet. Particle depth sorting has limitations (all particles at one depth). |
| Asset requirements | 3-4 additional PNGs (smoke particle, dust particle, spark particle). These are small (32x32 or less) and reusable across all weapons. |
| Performance cost | **Medium** — each emitter with 5-25 particles adds fill rate cost. Many simultaneous emitters could affect low-end devices. Use `maxAliveParticles` to cap. |
| Compatibility | **Good** — ParticleEmitter extends GameObject with `setDepth()`. Works with the current renderer. All particles at one depth is a known limitation but acceptable for small particle counts. |
| When to use | **After assets are created** — blocked on VFX texture PNGs. Not the first implementation step, but should follow soon after. |

### Option D — Generated Geometry for Railgun Beam/Trails

**What it is**: Use Phaser's Graphics object to draw beam lines (Railgun) and trail effects. No sprite assets needed for the beam itself — it is drawn procedurally at runtime.

| Aspect | Assessment |
|--------|-----------|
| Visual benefit | **Moderate-High** — beams are visually distinctive and require no sprite asset. Graphics lines can be drawn with any width, color, and alpha. |
| Implementation risk | **Medium** — Graphics objects are straightforward but have limitations: single depth for the entire object, not batched with sprites, must be manually cleared/destroyed. A beam spanning different Y positions renders at one depth. |
| Asset requirements | None for the beam itself. Impact and muzzle effects still need sprites or particles. |
| Performance cost | **Low** — one Graphics object per beam, drawn once, then alpha-faded and destroyed. No per-frame redraw needed if using a static line + alpha tween. |
| Compatibility | **Partial** — Graphics at a single depth means long beams may render behind objects they visually cross. Acceptable for the brief beam duration (150-300ms). Alternative: bake beam to RenderTexture via `generateTexture()`, then use as sprite for correct depth. |
| When to use | **For Railgun beam only** — this is the best approach for the Railgun beam. Not needed for Smoky (uses sprite projectile). |

### Option E — Hybrid Staged Approach

**What it is**: Implement VFX in stages, starting with the lowest-risk components and adding complexity only after each stage is validated. This is the recommended approach.

**Stage breakdown:**

| Stage | Components | Prerequisites | Risk |
|-------|------------|---------------|------|
| 1 | Sprite muzzle flash + sprite projectile + tween recoil | None | Very Low |
| 2 | Graphics beam (Railgun) + chassis recoil | Stage 1 complete | Low |
| 3 | PointLight muzzle/impact glow | Stage 1 complete + separate approval | Low |
| 4 | Particle smoke/dust/sparks | VFX texture assets created | Low-Medium |
| 5 | Animation Manager firing states | Spritesheets with firing frames | Medium |
| 6 | Combat state integration | Combat logic implemented | Medium |

| Aspect | Assessment |
|--------|-----------|
| Visual benefit | **Progressive** — each stage adds visible improvement. Stage 1 alone provides clear fire feedback. Stage 3 (PointLight) is the biggest visual jump. |
| Implementation risk | **Low** — each stage is independently testable and rollback-safe. If a stage fails, previous stages still work. |
| Asset requirements | Progressive — Stage 1 needs 3-4 PNGs. Stage 4 needs particle textures. Stage 5 needs firing frame spritesheets. |
| Performance cost | **Incremental** — each stage adds measurable cost. Can measure after each stage and adjust. |
| Compatibility | **Excellent** — each stage is compatible with the current renderer. No stage requires changes to TerrainRenderer, EntityRenderer, or the depth model. |
| When to use | **Now** — this is the recommended approach. Start with Stage 1, validate in arena, add stages incrementally. |

---

## 17. Comparison Summary

| Criterion | Option A (Sprites) | Option B (Sprites+Light) | Option C (Particles) | Option D (Graphics) | Option E (Hybrid) |
|-----------|-------------------|--------------------------|---------------------|--------------------|--------------------|
| Muzzle flash | Sprite | Sprite + glow | Sprite/particle | Sprite | Sprite (stage 1) + glow (stage 3) |
| Projectile | Moving sprite | Moving sprite | Particle trail | Graphics beam | Sprite (Smoky, stage 1) + beam (Railgun, stage 2) |
| Recoil | Tween | Tween | Tween | Tween | Tween (stage 1) |
| Smoke | None | None | ParticleEmitter | None | Particle (stage 4) |
| Impact | Sprite | Sprite + glow | Particle burst | Sprite | Sprite (stage 1) + glow (stage 3) + particles (stage 4) |
| Asset needs | 4-5 PNGs | 4-5 PNGs | 7-8 PNGs | 3-4 PNGs | Progressive |
| Performance | Negligible | Low | Medium | Low | Incremental |
| Compatibility | Perfect | Good | Good | Partial | Excellent |
| Risk | Very Low | Low | Low-Medium | Medium | **Low** |
| Recommended | As stage 1 | As stage 3 | As stage 4 | As stage 2 (Railgun) | **Yes — recommended approach** |

---

## 18. Final Recommendation

### Verdict: ACCEPT — Design Approved for Future Implementation

Weapon VFX and recoil should be implemented following the Option E hybrid staged approach. The design is complete and ready for a future implementation task.

### Recommended Approach

**Option E — Hybrid staged approach**, starting with Stage 1 (sprite muzzle flash, sprite projectile, tween recoil) in arena mode only. Each subsequent stage adds visual quality and requires its own validation pass.

### Risk Rating

| Dimension | Rating | Explanation |
|-----------|--------|-------------|
| Technical risk | Low | All selected Phaser APIs (Tweens, Sprites, Graphics, PointLight, Particles) are mature and well-typed |
| Art production risk | Low | Only 4-5 small VFX PNGs needed for Stage 1; particle textures are small and reusable |
| Performance risk | Low | Small VFX counts per fire event; progressive addition allows measurement at each stage |
| Integration risk | Low | VFX is isolated to render layer; no game state changes; arena-only initially |
| Architecture risk | Low | Strict separation between weapon logic (state) and weapon visuals (render); no boundary violations |

### Expected Benefit

| If implemented | Medium-High — weapon VFX provides essential combat feedback; recoil makes firing feel satisfying; PointLight glow adds atmospheric lighting without normal maps |
| If deferred | Low — current prototype has no combat, so no VFX is needed yet; design document serves as the specification for when combat is ready |

### Required Pipeline Changes (If Implemented Later)

1. Create `public/assets/vfx/` directory for VFX sprite PNGs
2. Add VFX texture keys to `generatedAssetManifest.ts` (or create a separate VFX manifest)
3. Add VFX loader to `PreloadScene` (conditional: arena/devtools mode only, or always)
4. Extend `process_art_assets.mjs` to include VFX directory if VFX assets are auto-generated

### Required Runtime Changes (If Implemented Later)

1. Create `src/phaser/render/WeaponVfxController.ts` — VFX creation, lifecycle, cleanup
2. Create `src/config/weaponVfxConfig.ts` — VFX configuration types and data
3. Add recoil offset helpers (pure TypeScript, testable)
4. Add muzzle offset data per weapon type per direction
5. Add dev fire command in arena mode for testing
6. Wire VFX controller to `ModularTankRenderer` (fire event → VFX creation)

### Implementation Blockers

1. **No combat state** — VFX needs fire events; currently no combat logic produces them. Workaround: dev-triggered fire command in arena.
2. **No VFX texture assets** — Need muzzle flash, projectile, and impact PNGs. Workaround: use Phaser Graphics as placeholders for initial development.
3. **No approved turret firing frames** — Animation Manager firing states blocked until art provides spritesheets with firing animation frames.

### Proposed Next Task

After this design is accepted, the next recommended task is **a separate implementation task** that implements Stage 1 of Option E (sprite muzzle flash, sprite projectile, tween recoil) in arena mode with a dev fire command. This implementation task must be separately approved before work begins.

---

## 19. No Runtime Code Changes

This design document makes **zero changes** to runtime code. The following files were NOT modified:

- `src/phaser/PreloadScene.ts` — no changes
- `src/phaser/GameScene.ts` — no changes
- `src/phaser/render/TerrainRenderer.ts` — no changes
- `src/phaser/render/EntityRenderer.ts` — no changes
- `src/phaser/render/ModularTankRenderer.ts` — no changes
- `src/phaser/render/isometric.ts` — no changes
- `src/assets/assetManifest.ts` — no changes
- `src/assets/generatedAssetManifest.ts` — no changes
- `src/assets/runtimeGeneratedAssets.ts` — no changes
- `src/state/types.ts` — no changes
- `src/state/devArena.ts` — no changes
- `src/state/devCommands.ts` — no changes
- `package.json` — no changes
- Any shader files — none created
- Any PNG files — none created or modified
- Any VFX implementation — none created

The only artifact of this task is this document:
`docs/project/WEAPON_WORKFLOW_01_VFX_RECOIL_DESIGN.md`

---

## 20. Source References

All findings in this report are from:

| Source | Purpose |
|--------|---------|
| `node_modules/phaser/src/tween/` | Tween API inspection |
| `node_modules/phaser/src/gameobjects/particles/` | ParticleEmitter API inspection |
| `node_modules/phaser/src/gameobjects/pointlight/` | PointLight API inspection |
| `node_modules/phaser/src/gameobjects/graphics/` | Graphics API inspection |
| `node_modules/phaser/src/gameobjects/renderTexture/` | RenderTexture API inspection |
| `node_modules/phaser/src/animations/` | Animation Manager API inspection |
| `node_modules/phaser/types/phaser.d.ts` | TypeScript type definitions |
| `src/phaser/render/ModularTankRenderer.ts` | Current modular tank rendering model |
| `src/phaser/render/EntityRenderer.ts` | Current entity rendering model |
| `src/phaser/render/isometric.ts` | Isometric coordinate system |
| `src/assets/generatedAssetManifest.ts` | Current asset manifest (Wasp/Smoky keys) |
| `src/assets/runtimeGeneratedAssets.ts` | Asset loading pipeline |
| `src/state/types.ts` | ModularCombatUnit type, combat constants |
| `src/state/devArena.ts` | Arena map and mode detection |
| `docs/project/VISUAL_SPIKE_01_NORMAL_MAPS_LIGHTING_FEASIBILITY.md` | VISUAL-SPIKE-01 findings (PointLight, deferred lighting) |
| `docs/project/PHASE_2_ROADMAP.md` | Phase 2 WEAPON-WORKFLOW-01 task definition |
| `docs/project/PHASE_2_ROADMAP_AUDIT.md` | Phase 2 audit gate |
