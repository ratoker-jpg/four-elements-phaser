# VISUAL-SPIKE-01 — Normal Maps / Lighting Feasibility Spike Report

Status: spike report — docs only, no runtime changes  
Project: Four Elements Phaser  
Active repo: `ratoker-jpg/four-elements-phaser`  
Phaser version: 4.1.0  
Reference/donor repo: `ratoker-jpg/four-elements-next` (donor/reference only)  
Date: 2026-05-29

---

## 1. Executive Summary

This spike evaluates whether normal maps and dynamic lighting are worth adding to the Four Elements Phaser 4.1.0 2D isometric RTS project. The investigation covers Phaser 4.1.0's built-in lighting APIs, compatibility with the current renderer architecture, asset pipeline impact, performance risks, art production costs, and the five comparison options.

**Key finding**: Phaser 4.1.0 has a mature, first-class 2D lighting system with normal map support built into Sprite, Image, and 14 other GameObject types. The APIs are stable (since 4.0.0) and well-typed. However, the system has critical compatibility limitations with the project's current rendering architecture — specifically, the RenderTexture-based terrain stamping model and the per-entity depth-sorting required for isometric rendering.

**Verdict: DEFER** — not worth investing in now, revisit after assets and combat are in place.

---

## 2. Phaser 4.1.0 Lighting / Normal Map API Findings

### 2.1 Lighting System

Phaser 4.1.0 includes a complete per-pixel 2D lighting system:

| API | Description | Status |
|-----|-------------|--------|
| `Phaser.GameObjects.Light` | Per-pixel point light with normal map interaction. Properties: x, y, radius, color, intensity, z (height). | Stable (since 3.0.0, z-height in 4.0.0) |
| `Phaser.GameObjects.LightsManager` | Manages all Light objects and ambient color per Scene. Access via `this.lights`. | Stable (since 3.0.0) |
| `Phaser.GameObjects.LightsPlugin` | Scene plugin extending LightsManager. Auto-registered as `scene.lights`. | Stable (since 3.0.0) |
| `Phaser.GameObjects.PointLight` | Visual light-effect glow sprite (no normal map interaction). Faster than Light. | Stable (since 3.50.0) |

**Important**: There is NO `DirectionalLight` class. Only point-based lights exist. Sunlight / global illumination must be simulated by placing multiple point lights or by using the `FilterImageLight` camera filter with an environment map.

**The Light.z property** controls the "height" of the light above the scene, which affects the relief angle of normal-mapped shading. This is relevant for isometric view — a higher z creates steeper shading on raised surfaces, a lower z creates softer, more diffuse shading.

### 2.2 Normal Map Support

Normal maps are a first-class feature:

| Feature | Status | Detail |
|---------|--------|--------|
| `Texture.dataSource[]` | Stable | Stores normal map TextureSource alongside diffuse |
| Built-in `__NORMAL` fallback | Stable | 1x1 flat normal map (127, 127, 255) used when no custom normal map exists |
| Image loader paired loading | Stable | `this.load.image('key', ['diffuse.png', 'normal.png'])` or `{ key, url, normalMap }` |
| Spritesheet loader paired loading | Stable | `SpriteSheetFileConfig.normalMap` property |
| Atlas loader paired loading | Stable | All atlas loaders support `normalMap` config |
| GLSL shader integration | Stable | `GetNormalFromMap.glsl`, `DefineLights.glsl`, `ApplyLighting.glsl` — automatic shader additions |
| Self-shadowing | Stable (4.0.0) | Contact shadows based on normal maps; configurable per-object |

### 2.3 Lighting Component on GameObjects

14 GameObject types include the `Lighting` component:

```typescript
sprite.setLighting(true);   // Enable per-pixel lighting
sprite.setSelfShadow(true); // Enable self-shadowing from normal map
```

Included on: Sprite, Image, Blitter, Text, Graphics, TileSprite, Stamp, BitmapText, ParticleEmitter, Video, Shape, SpriteGPULayer.

### 2.4 RenderNode Pipeline (Phaser 4 replacement for "pipelines")

Phaser 4 replaced the Phaser 3 WebGLPipeline architecture with a composable RenderNode graph:

- `BatchHandlerQuad` — batches Image/Sprite quads with full lighting support
- `SubmitterQuad` — submits single quads with lighting + normal map resolution
- `ProgramManager` — manages shader compilation, variants, and GLSL "additions" injection
- Custom render nodes via `game.config.render.renderNodes` or `gameObject.customRenderNodes`
- Filters replace PostPipeline: `FilterImageLight` (IBL), `FilterNormalTools`, `FilterShadow`, `FilterGlow`

### 2.5 What Does NOT Exist

| Feature | Status |
|---------|--------|
| DirectionalLight | Not available |
| Depth-based light occlusion / shadow maps | Not available |
| Per-member normal maps in SpriteGPULayer | Not available (single shared normal map) |
| RenderTexture Lighting component | Not available |
| Shadow casting between objects | Not available (only self-shadowing) |

---

## 3. Compatibility Analysis with Current Renderer

### 3.1 Does Phaser 4.1.0 support the needed 2D lighting / normal map path for our current renderer?

**Partially.** The API surface exists and works well for individual Sprites and Images. However, the current TerrainRenderer uses a RenderTexture stamp model, and RenderTexture does NOT include the Lighting component. This is the single biggest compatibility gap.

| Renderer component | Lighting compatible? | Reason |
|--------------------|---------------------|--------|
| TerrainRenderer (RenderTexture stamp) | **No** | RenderTexture has no Lighting component; terrain stamped once cannot be re-lit |
| EntityRenderer — HQ (Image) | **Yes** | Image includes Lighting component; `setLighting(true)` works |
| EntityRenderer — Harvesters (Sprite) | **Yes** | Sprite includes Lighting component; normal map via spritesheet loader |
| EntityRenderer — Resources (Image) | **Yes** | Image includes Lighting component |
| ConstructionRenderer — Buildings (Image) | **Yes** | Image includes Lighting component |
| ConstructionRenderer — Builders (Sprite) | **Yes** | Sprite includes Lighting component |
| ModularTankRenderer — Hull/Turret (Image) | **Yes** | Image includes Lighting component |

### 3.2 Is it compatible with our isometric depth sorting model?

**Yes, with caveats.** The lighting system does not interact with depth sorting — lights affect all lit objects within their radius regardless of depth value. There is no depth-based light occlusion, meaning light passes through objects at different depths. In an isometric view, this means a light behind a tall building will illuminate units in front of it, which is physically incorrect but may be visually acceptable for a stylized RTS.

The depth model (`depth = 100 + worldY` for painter's algorithm) is independent of the lighting system and would continue to work unchanged. The only interaction is that all lit objects must be within a Light's radius to receive illumination.

### 3.3 Is it compatible with RenderTexture terrain stamping?

**No — this is the critical incompatibility.** The TerrainRenderer stamps all terrain tiles onto a single RenderTexture once during construction. After stamping, the RenderTexture is a flat image that the camera scrolls over. There is no way to apply per-pixel lighting to the RenderTexture itself because:

1. RenderTexture does NOT include the Lighting component (no `setLighting()` method)
2. The terrain has already been flattened into a single texture — per-tile normal information is lost
3. You cannot re-stamp the terrain with lighting every frame without catastrophic performance cost

**Workaround options:**

| Workaround | Feasibility | Cost |
|------------|-------------|------|
| Render terrain as individual Sprites instead of RenderTexture stamp | Technically possible | Major renderer rewrite; 2304 sprites for 48x48 map; per-frame depth sorting cost; breaks current camera model |
| Use camera-level `FilterImageLight` on the terrain RenderTexture | Possible | Requires an environment map and a single normal map for the entire terrain surface; cannot have per-tile normal variation; IBL look is different from point-light per-pixel shading |
| Stamp lit terrain into the RenderTexture using a "pre-bake" approach | Possible | Light positions must be known at stamp time; lights cannot move; no dynamic lighting |
| Split terrain into zones, each zone a lit Sprite | Possible | Major architecture change; many sprites; depth sorting complexity |

### 3.4 Is it compatible with separate entity sprites, buildings, resources, decals, and future props?

**Yes for all entity sprites and buildings** — they use Image or Sprite GameObjects which include the Lighting component. Each can be individually lit with `setLighting(true)` and paired normal maps.

**Partial for decals** — if decals are stamped onto the RenderTexture (as planned in MAPLIFE-01), they inherit the RenderTexture's lighting limitation (not lit). If decals are rendered as individual Sprites, they can be lit.

**Yes for future props** — standing props (bushes, rocks, wrecks) would be Sprites with lighting enabled.

---

## 4. Asset Pipeline Impact

### 4.1 Would every asset need a paired `*_normal.png`?

**No — the system gracefully degrades.** Phaser 4.1.0 automatically falls back to the built-in `__NORMAL` flat normal map (pointing straight up, RGB 127,127,255) when no custom normal map is provided. An object with `setLighting(true)` but no custom normal map receives uniform ambient shading with no surface relief — essentially flat lighting.

This means you could enable lighting on only a subset of assets (e.g., buildings and units) while keeping terrain and small props unlit or flat-lit.

However, for lighting to have visible impact, you need custom normal maps on at least the major surfaces. Flat normals produce no surface relief, making the lighting effect subtle — ambient color shifts and intensity falloff only.

### 4.2 How would asset naming/loading need to work if we used normal maps?

Phaser's loader supports two patterns for paired diffuse + normal PNGs:

**Array syntax:**
```typescript
this.load.image('hq_cyan', [
  'assets/factions/cyan/buildings/hq_t1.png',
  'assets/factions/cyan/buildings/hq_t1_normal.png',
]);
```

**Config syntax:**
```typescript
this.load.spritesheet('harvester_cyan', {
  key: 'harvester_cyan',
  url: 'assets/factions/cyan/units/harvester_8x8_256.png',
  normalMap: 'assets/factions/cyan/units/harvester_8x8_256_normal.png',
  frameConfig: { frameWidth: 256, frameHeight: 256 },
});
```

**Naming convention proposal:**
```
{asset}_normal.png   — paired normal map using same directory + _normal suffix
```

Examples:
```
hq_t1.png            → hq_t1_normal.png
separator.png         → separator_normal.png
harvester_8x8_256.png → harvester_8x8_256_normal.png
mineral_large_02.png  → mineral_large_02_normal.png
sand_tile.png         → sand_tile_normal.png
```

### 4.3 How would this affect ASSET-WORKFLOW-01?

ASSET-WORKFLOW-01 defines the animated unit asset pipeline. Adding normal maps would require:

1. **Normal map spritesheet generation**: Each unit spritesheet needs a paired normal map spritesheet with identical frame layout (8 directions x N states, 256x256 frames). The normal map encodes the 3D surface relief of each frame.

2. **Loader changes**: `runtimeGeneratedAssets.ts` must pass `normalMap` parameter to `scene.load.spritesheet()` for civil units.

3. **Art pipeline expansion**: The Blender/render pipeline must generate normal maps alongside diffuse textures. This is a standard capability of 3D renderers — Blender can bake normal maps from geometry.

4. **File count doubling**: 4 factions x 2 unit types x 2 files (diffuse + normal) = 16 files instead of 8.

5. **Frame consistency requirement**: The normal map spritesheet must have exactly the same frame layout, frame count, and frame dimensions as the diffuse spritesheet. Any mismatch causes incorrect lighting.

6. **Texture memory increase**: Each normal map spritesheet is an additional 2048x2048 RGBA texture per faction per unit type. For the current 8 civil unit sheets, this adds ~8 additional 2048x2048 textures (~32 MB uncompressed GPU memory total).

### 4.4 How would this affect MAPLIFE props/decal assets?

MAPLIFE-01 is currently blocked on asset availability (per MAPLIFE_01_ASSET_READINESS.md). If normal maps were added:

1. **Decals** (sand_crack, sand_bump): These are stamped onto the RenderTexture, so normal maps for decals would be irrelevant — the RenderTexture cannot be lit. Decals would need to be rendered as individual Sprites to benefit from normal maps, which contradicts the MAPLIFE design that stamps decals for zero runtime cost.

2. **Standing props** (bush, rock, wreck): Each prop PNG would need a paired normal map PNG. This doubles the art production work for MAPLIFE props and doubles the asset file count.

3. **Recommended approach**: Do NOT add normal maps to MAPLIFE props in the initial pass. Props are small visual details — the lighting payoff on a 32x32 pixel bush is negligible compared to the art cost.

### 4.5 How would this affect animated unit spritesheets?

See section 4.3 above. The primary impact is:
- Double the spritesheet file count (diffuse + normal per faction per unit)
- Double the texture memory for civil units
- Art pipeline must generate normal maps per animation frame
- Frame layout must be identical between diffuse and normal sheets
- Normal maps must be consistent across animation frames (no "swimming" normals during walk cycles)

The normal map consistency requirement is particularly challenging: if the normal map changes incorrectly between walk cycle frames, the lighting will flicker or "swim," creating a worse visual result than no lighting at all.

### 4.6 How would this affect future weapon VFX / recoil / arena work?

**Positive impact for VFX, neutral for recoil.**

1. **Muzzle flash / beam VFX**: PointLight objects can be attached to weapon firing positions, creating dynamic illumination that affects nearby lit objects. This is a strong use case — a Smoky turret firing would briefly illuminate nearby buildings and units.

2. **Recoil**: Recoil is visual displacement (tweens), not lighting. Normal maps do not affect recoil implementation.

3. **Explosion / impact effects**: PointLight bursts at impact points would create convincing flash illumination. This is the most compelling near-term use case for dynamic lighting.

4. **Arena mode**: The 20x20 arena map with a handful of combat units is the ideal testbed for lighting — fewer objects, more dynamic action, and a controlled environment where the RenderTexture terrain limitation could be worked around (arena terrain could be rendered as individual sprites instead of a RenderTexture stamp).

---

## 5. Technical Requirements

### 5.1 Does it require custom shaders/pipelines?

**No — for basic per-pixel lighting with normal maps.** Phaser 4.1.0's built-in RenderNode pipeline handles lighting automatically. Enabling lighting on a Sprite or Image triggers the shader "additions" system (DefineLights, GetNormalFromMap, ApplyLighting), which compiles the correct shader variant at runtime. No custom GLSL is needed.

**Yes — for advanced effects.** If you want:
- Directional light simulation → custom RenderNode or multiple point lights
- Shadow casting between objects → custom shadow map implementation
- Normal-mapped terrain on RenderTexture → custom rendering approach
- Per-tile normal maps on terrain → custom terrain renderer replacing RenderTexture

These would require custom RenderNode implementations, which is a significant development effort.

### 5.2 What are the performance risks for browser/mobile?

| Risk | Severity | Detail |
|------|----------|--------|
| GPU texture memory | **High** | Each normal map is a full RGBA texture. Adding normals for all current assets roughly doubles GPU texture memory (~16-32 MB additional) |
| Shader complexity | **Medium** | Lit objects use multi-pass shaders (diffuse + normal sampling + light computation). On low-end GPUs, this may cause frame drops |
| maxLights limit | **Medium** | Default `maxLights = 10` per camera. Exceeding this causes furthest lights to be culled. A large RTS map may need more lights than this limit |
| Fill rate | **Medium** | Lit objects with normal maps require two texture samples per pixel (diffuse + normal). On fill-rate-limited GPUs (mobile integrated), this is more expensive than unlit rendering |
| Sprite count increase | **Low** | If terrain switches from RenderTexture to individual Sprites, sprite count jumps from 1 to 2304+ |
| Batch breaking | **Medium** | Lit and unlit objects cannot be batched together. Mixing lit entities and unlit terrain forces separate draw calls |

**Mobile risk assessment**: On mobile GPUs (Mali, Adreno, PowerVR), the combination of normal map sampling + per-pixel lighting calculations + multiple texture units can push frame time above 16ms for scenes with many lit objects. The project currently targets desktop browsers with mobile as a future consideration, but adding lighting would make mobile support harder.

### 5.3 What are the art production costs?

| Asset type | Current count | Normal maps needed | Estimated art effort |
|------------|---------------|--------------------|---------------------|
| Terrain tiles (3) | 3 | 3 | Low — flat/slightly bumpy sand normals |
| HQ buildings (4 factions) | 4 | 4 | Medium — complex geometry normals |
| Other buildings (6 types x 4 factions) | 24 | 24 | Medium — each needs custom normals |
| Harvester spritesheets (4 factions) | 4 | 4 | High — per-frame normals for 64 frames each |
| Builder spritesheets (4 factions) | 4 | 4 | High — per-frame normals for 64 frames each |
| Resource minerals (3) | 3 | 3 | Medium — crystal/rock normals |
| Combat units (64 modular images) | 64 | 64 | High — per-direction normals |
| Props/doodads (7 types) | 7 | 7 | Medium — if MAPLIFE proceeds |
| **Total** | **113** | **113** | **Significant** |

Normal maps can be auto-generated from 3D renders (Blender bake), but they still require:
- Proper 3D geometry or high-poly sculpts to bake from
- Verification that normals look correct in isometric view
- Consistency checking across animation frames
- Manual touch-up for 2D-drawn assets without 3D source

For assets generated by AI or painted in 2D, normal map creation requires either:
- A 3D proxy model for baking (additional art effort)
- Depth-from-shading algorithms (often produce artifacts)
- Manual painting of normal maps (very labor-intensive)

### 5.4 What are the debugging/QA risks?

| Risk | Severity | Detail |
|------|----------|--------|
| Normal map orientation | **High** | Incorrect normals cause lighting from wrong directions. In isometric view, the "up" direction is diagonal, making normal map verification harder |
| Frame-to-frame normal consistency | **High** | Inconsistent normals across animation frames cause lighting "swimming" — a distracting artifact worse than no lighting |
| RenderTexture vs lit object mismatch | **High** | Lit entities on top of unlit terrain creates a jarring visual discontinuity — the entity looks 3D-lit while the ground beneath it is flat |
| maxLights culling | **Medium** | Lights appearing/disappearing as camera moves (when exceeding maxLights) causes visible popping |
| WebGL compatibility | **Medium** | Some older mobile GPUs may not support the multi-texture shader variants needed for lighting |
| Debugging complexity | **Medium** | Lighting bugs (wrong direction, wrong intensity, flickering) are harder to diagnose than rendering bugs because they involve 3D math in a 2D context |

---

## 6. Options Comparison

### Option A — Do nothing, keep baked lighting in sprites/tiles

**What it is**: Continue with the current approach — all lighting is pre-baked into the PNG assets. No dynamic lighting, no normal maps. Visual depth comes from hand-painted highlights and shadows in the sprites.

| Aspect | Assessment |
|--------|-----------|
| Risk | None — zero code changes |
| Benefit | Stable, predictable, fast on all devices |
| Cost | None |
| Visual quality | Adequate for current prototype stage; depends entirely on art quality |
| Compatibility | Perfect — no changes needed |
| When preferred | Now — the project has no approved assets yet and many systems are still being built |

### Option B — Use Phaser built-in lighting/normal map support if available and safe

**What it is**: Enable `setLighting(true)` on all Sprite/Image entities, load paired normal maps for every asset, use Light objects for dynamic illumination (e.g., weapon fire, building glow).

| Aspect | Assessment |
|--------|-----------|
| Risk | **High** — RenderTexture incompatibility, art production doubling, mobile performance |
| Benefit | Per-pixel dynamic lighting on entities; muzzle flash illumination; building relief shading |
| Cost | 113 normal map textures, renderer changes for terrain, loader changes, art pipeline changes |
| Visual quality | Excellent on entities, poor on terrain (unlit), creating visual inconsistency |
| Compatibility | **Broken** for terrain; entities work fine; depth sorting unaffected |
| When preferred | Only if terrain is rewritten from RenderTexture to individual sprites (major effort) |

### Option C — Use normal maps only for selected large/static objects later

**What it is**: Enable lighting on a small subset of objects (HQ buildings, large resource nodes) while keeping terrain, units, and small props unlit. Provides a subtle lighting effect on the most prominent objects.

| Aspect | Assessment |
|--------|-----------|
| Risk | **Medium** — limited scope reduces risk; visual inconsistency between lit/unlit objects |
| Benefit | Subtle but noticeable depth on key objects; limited art cost (4-7 normal maps) |
| Cost | 4-7 normal maps, minor loader/renderer changes |
| Visual quality | Good for targeted objects; potential mismatch with unlit surroundings |
| Compatibility | Works with current renderer for entity Images; no terrain changes needed |
| When preferred | After assets exist and the visual direction is confirmed; as a low-risk trial |

### Option D — Custom shader/pipeline later

**What it is**: Write a custom RenderNode that handles normal-mapped terrain on RenderTexture or implements directional lighting. Requires deep WebGL and Phaser 4 internal knowledge.

| Aspect | Assessment |
|--------|-----------|
| Risk | **Very High** — custom shader development is error-prone, hard to debug, and may break with Phaser updates |
| Benefit | Could solve the RenderTexture limitation; could implement directional light |
| Cost | Significant development time (weeks); ongoing maintenance |
| Visual quality | Potentially excellent if done well; potentially broken if done poorly |
| Compatibility | Requires deep integration with Phaser 4's RenderNode system |
| When preferred | Only if the project commits to lighting as a core visual pillar and allocates dedicated engineering time |

### Option E — Hybrid: baked lighting for units/terrain, small dynamic effects for weapons only

**What it is**: Keep all diffuse textures with baked lighting as-is. Use PointLight objects (not Light) for weapon firing effects — muzzle flashes, explosions, beam impacts. PointLights are visual glow sprites, not per-pixel lighting, so they require no normal maps and work with the current renderer.

| Aspect | Assessment |
|--------|-----------|
| Risk | **Low** — PointLights are visual effects, not per-pixel lighting; no normal maps needed |
| Benefit | Dynamic visual feedback for combat (weapon flash, explosion glow); atmospheric lighting in arena |
| Cost | Minimal — a few PointLight objects per weapon event; no asset changes |
| Visual quality | Good for action feedback; no surface relief shading (but baked shadows in sprites) |
| Compatibility | Perfect — PointLights work with any renderer; no normal maps; no entity changes |
| When preferred | When WEAPON-WORKFLOW-01 is implemented; as part of arena combat VFX |

---

## 7. What Should Stay Baked Into PNGs

The following visual effects should remain baked into sprite/tile PNGs rather than implemented via normal maps / dynamic lighting:

1. **Terrain base lighting**: The sand tiles already have baked highlights and shadows. Normal-mapping terrain requires replacing the RenderTexture stamp approach, which is too costly. Baked terrain lighting is sufficient and performant.

2. **Ambient occlusion / contact shadows**: AO around building bases, under units, and in corners should be baked into sprites or applied via tints. Per-pixel lighting does not provide AO.

3. **Directional sunlight**: Since Phaser has no DirectionalLight, baking a consistent sun direction into all sprites is more reliable than simulating it with multiple point lights.

4. **Small prop detail**: Bushes, pebbles, cracks, and other small MAPLIFE props are too small for normal-map detail to be visible. Baked shading suffices.

5. **Unit shadow/ground contact**: The shadow beneath a unit's feet should remain baked or rendered as a separate Graphics object. Per-pixel lighting does not cast drop shadows.

6. **UI elements, HUD, progress bars**: These are DOM or Phaser Graphics, not candidates for normal mapping.

---

## 8. Simplest Proof-of-Concept (If Justified Later)

If the project decides to explore lighting after assets and combat are in place, the simplest safe proof-of-concept would be:

**POC: PointLight weapon flash in Arena mode**

1. Add a PointLight at the turret muzzle position when a Smoky fires.
2. PointLight lasts 100-200ms, radius ~100px, warm orange color.
3. No normal maps required. No entity changes. No loader changes.
4. Confirms that dynamic lighting effects feel good in the arena context.
5. Can be implemented in a single afternoon with zero risk.

This POC uses Option E and validates whether dynamic lighting effects are visually valuable before investing in the more expensive normal-map path.

---

## 9. Final Recommendation

### Verdict: **DEFER**

Normal maps and dynamic lighting should not be invested in now. Revisit after assets and combat are in place.

### Rationale

1. **RenderTexture terrain incompatibility**: The single largest visual surface on screen (terrain) cannot be lit with the current renderer. Rewriting TerrainRenderer from RenderTexture to individual sprites is a major architectural change with high risk.

2. **No approved assets exist**: UNIT-ANIM-01, MAPLIFE-01, and WEAPON-WORKFLOW-01 are all blocked on asset availability. Creating normal maps for assets that don't exist yet is premature.

3. **Visual inconsistency risk**: Lit entities on unlit terrain would look jarring — the "uncanny valley" of partial lighting. Either commit to full lighting (expensive) or keep it consistent (baked).

4. **Art pipeline not ready**: The ASSET-WORKFLOW-01 pipeline does not include normal map generation. Adding this doubles art production complexity before the base pipeline is validated.

5. **Mobile performance unknown**: The project has not established mobile performance baselines. Adding normal map sampling and per-pixel lighting could exclude mobile devices before the game even runs on them.

6. **Phaser 4.1.0 has no DirectionalLight**: Without directional light, simulating outdoor desert sunlight requires either many point lights (expensive) or an IBL filter (looks different from expected). This is a fundamental limitation for a desert RTS.

7. **Weapon VFX can use PointLight**: The most compelling use case (weapon flash, explosion glow) can be achieved with PointLight objects that require no normal maps and work with the current renderer.

### Risk Rating

| Dimension | Rating | Explanation |
|-----------|--------|-------------|
| Technical risk | Medium | APIs work, but RenderTexture incompatibility requires significant work |
| Art production risk | High | Doubles asset count; requires 3D source for normal baking |
| Performance risk | Medium-High | Unknown mobile impact; terrain rewrite carries frame-time risk |
| Visual quality risk | Medium | Partial lighting may look worse than consistent baked lighting |
| Integration risk | Low | Phaser APIs are stable and well-typed |

### Expected Benefit

| If accepted | Low-Medium — subtle surface relief on entities; dynamic weapon illumination; better visual depth in arena |
| If deferred | None lost — baked lighting is sufficient for current prototype stage; PointLight VFX covers the most valuable use case |

### Required Asset Pipeline Changes (If Accepted Later)

1. Add `normalMap` parameter to all `scene.load.image()` and `scene.load.spritesheet()` calls
2. Generate paired `*_normal.png` files for every diffuse texture
3. Extend ASSET-WORKFLOW-01 to include normal map generation step
4. Extend `process_art_assets.mjs` to process normal map variants
5. Extend `generatedAssetManifest.ts` to include normal map paths

### Required Runtime Changes (If Accepted Later)

1. Rewrite TerrainRenderer to use individual Sprites instead of RenderTexture (major)
2. Call `sprite.setLighting(true)` on all lit entities
3. Add `scene.lights.enable()` in GameScene
4. Place Light objects for key light sources (buildings, environment)
5. Configure `render.maxLights` in game config
6. Handle lit/unlit batch separation in render pipeline

### Implementation Blockers

1. **RenderTexture cannot be lit** — must rewrite TerrainRenderer
2. **No approved assets** — cannot create normal maps for non-existent art
3. **No DirectionalLight** — must simulate sunlight with workarounds
4. **Mobile performance unknown** — cannot commit to lighting without baseline

### Proposed Next Task (If Accepted)

Create a VISUAL-SPIKE-02 prototype that:
1. Renders arena terrain (20x20) as individual Sprites instead of RenderTexture
2. Enables lighting on arena entities with `setLighting(true)`
3. Uses flat normal maps (no custom normals) to verify lighting works in isometric view
4. Adds 2-3 Light objects at fixed positions
5. Measures frame time on desktop and mobile
6. Does NOT modify the production renderer — arena-only experiment

### Proposed Next Task (If Deferred)

Proceed with **WEAPON-WORKFLOW-01** and implement **Option E** (PointLight weapon VFX) as part of the weapon visual design. This provides dynamic lighting feedback for combat without requiring normal maps or renderer changes.

---

## 10. Comparison Summary

| Criterion | Option A (Baked) | Option B (Full Lighting) | Option C (Selective) | Option D (Custom Shader) | Option E (Hybrid/PointLight) |
|-----------|------------------|--------------------------|----------------------|--------------------------|------------------------------|
| Terrain lit | No (baked) | Requires rewrite | No (baked) | Possible with custom | No (baked) |
| Entities lit | No (baked) | Yes (full per-pixel) | Partial (large only) | Yes (full per-pixel) | No (glow effects only) |
| Normal maps needed | 0 | 113 | 4-7 | 113 | 0 |
| Art production cost | None | Very High | Low | Very High | None |
| Renderer changes | None | Major | Minor | Major | None |
| Mobile safe | Yes | Unknown | Likely yes | Unknown | Yes |
| Visual consistency | High (all baked) | Low (terrain vs entities) | Low (mixed) | High (if done right) | High (all baked + glow) |
| Weapon VFX | No dynamic lighting | Full dynamic lighting | Limited | Full dynamic lighting | PointLight glow |
| Development time | 0 | Weeks | Days | Weeks+ | Hours |
| Recommended for now | **Yes** | No | No | No | **Yes (later)** |

---

## 11. No Runtime Code Changes

This spike report makes **zero changes** to runtime code. The following files were NOT modified:

- `src/phaser/PreloadScene.ts` — no changes
- `src/phaser/GameScene.ts` — no changes
- `src/phaser/render/TerrainRenderer.ts` — no changes
- `src/phaser/render/EntityRenderer.ts` — no changes
- `src/phaser/render/isometric.ts` — no changes
- `src/assets/assetManifest.ts` — no changes
- `src/assets/generatedAssetManifest.ts` — no changes
- `src/assets/runtimeGeneratedAssets.ts` — no changes
- `package.json` — no changes
- Any shader files — none created
- Any PNG files — none created or modified

The only artifact of this task is this document:
`docs/project/VISUAL_SPIKE_01_NORMAL_MAPS_LIGHTING_FEASIBILITY.md`

---

## 12. Source References

All findings in this report are from:

| Source | Purpose |
|--------|---------|
| `node_modules/phaser/src/gameobjects/lights/` | Lighting API inspection |
| `node_modules/phaser/src/gameobjects/pointlight/` | PointLight API inspection |
| `node_modules/phaser/src/textures/Texture.js` | Normal map dataSource API |
| `node_modules/phaser/src/textures/TextureManager.js` | `__NORMAL` default normal map |
| `node_modules/phaser/src/renderer/webgl/renderNodes/` | RenderNode pipeline, lighting shader additions |
| `node_modules/phaser/src/renderer/webgl/shaders/` | GLSL lighting shader source |
| `node_modules/phaser/src/loader/filetypes/` | Normal map loading API |
| `node_modules/phaser/types/phaser.d.ts` | TypeScript type definitions |
| `src/phaser/render/TerrainRenderer.ts` | Current terrain rendering model |
| `src/phaser/render/EntityRenderer.ts` | Current entity rendering model |
| `src/phaser/render/isometric.ts` | Isometric coordinate system |
| `src/assets/runtimeGeneratedAssets.ts` | Asset loading pipeline |
| `docs/project/PHASER4_GPU_01_SPIKE_REPORT.md` | GPU layer findings (RenderTexture, depth model) |
| `docs/project/MAPLIFE_01_ASSET_READINESS.md` | MAPLIFE asset availability |
| `docs/project/UNIT_ANIM_01_HARVESTER_ASSET_READINESS.md` | Unit animation asset availability |
| `docs/project/ASSET_WORKFLOW_01_ANIMATED_UNIT_PIPELINE.md` | Asset pipeline design |
| `docs/project/PHASE_2_ROADMAP.md` | Phase 2 task list and scope |
| `docs/project/PHASE_2_ROADMAP_AUDIT.md` | Phase 2 audit gate |
