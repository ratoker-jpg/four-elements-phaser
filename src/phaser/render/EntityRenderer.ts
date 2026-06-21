import Phaser from 'phaser';
import { ASSET_KEYS, DIR_ROW, IDLE_FRAME } from '../../assets/assetManifest';
import {
  type ModularTankDirection,
} from '../../config/worldConfig';
import { tileToScreen, footprintSouthVertex, IsoPoint } from './isometric';
import { computeDepthValue } from './depthSorting';
import { ModularTankRenderer } from './ModularTankRenderer';
import {
  ModularVehicleLiveAdapter,
  ENABLE_MODULAR_VEHICLE_RENDER,
} from './ModularVehicleLiveAdapter';
import { ConstructionRenderer } from './ConstructionRenderer';
import type {
  Faction,
  RenderableEntity,
  EntityKind,
  ResourceType,
  GameState,
  HarvesterState,
  ResourceNodeState,
} from '../../state/types';
import { directionFromDelta } from '../../state/updateGameState';
import { HARVESTER_RENDER_SCALE } from '../../config/unitRenderConfig';
import { getHqAssetKey } from '../../assets/buildingAssets';
import { computeTargetDisplayWidth } from '../../assets/buildingPlacementMeta';
import { getCivilUnitKey, CIVIL_FACTIONS } from '../../assets/civilUnitAssets';
import type { ResourceStyle } from '../../state/gameSetup';
import { getTileVisibility, type VisionState } from '../../state/visibility';
import { EXPLORED_RESOURCE_ALPHA } from './FogRenderer';

/**
 * EntityRenderer — renders and syncs entities from GameState onto the scene.
 *
 * PR3 changes:
 * - Static entities (HQ, builder, obstacles, decor) are rendered once from RenderableEntity[].
 * - Harvesters are rendered from HarvesterState[] with fractional positions and direction facing.
 * - Resources are rendered from ResourceNodeState[] with depletion support.
 * - syncFromState() updates harvester positions and resource visibility each frame.
 *
 * PR7 changes:
 * - Modular tank has separate bodyDir and turretDir.
 * - Hull texture uses bodyDir; turret texture uses turretDir.
 * - Hull position = anchor + hullOffsetsByBodyDir[bodyDir].
 * - Turret mount position = anchor + turretMountByBodyDir[bodyDir] (depends on bodyDir, NOT turretDir).
 * - Q/E cycles bodyDir, Z/X cycles turretDir (overlay ON only).
 *
 * ARCH-13B changes:
 * - Modular tank rendering and debug overlay extracted to ModularTankRenderer
 *   and ModularTankDebugOverlay. EntityRenderer delegates modular-combat
 *   placement and all tuner/debug methods to ModularTankRenderer.
 *
 * ARCH-05Y changes:
 * - Removed render-side smoothing. Harvester sprite position is set directly
 *   from state ftx/fty each frame. With ARRIVAL_THRESHOLD reduced to 0.03
 *   (matching builder), the waypoint snap is sub-pixel and invisible.
 * - Selection ring anchoring is now done in GameScene via tileToScreen from
 *   state coordinates, not via sprite position queries.
 *
 * Entities with stateOnly=true are skipped with a console warning.
 */

/** Direction labels for animation key construction. Index matches directionFromDelta output. */
const DIR_LABELS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const;

/** Frame rate for harvester walk cycle animation. 7 frames at 8 fps = ~0.875s per cycle. */
const HARVESTER_WALK_FPS = 8;

/** Scale for infinite resources — rendered as a large mineral at bigger scale. */
const INFINITE_MINERAL_SCALE = 0.65;

/**
 * VISUAL-06E: Resource type → asset key mapping, parametrized by resourceStyle.
 * Legacy keeps the original sand mineral crystal keys.
 * Industrial maps to approved VISUAL-06 crystal assets.
 *
 * Preferred first mapping (per VISUAL-06E task):
 *   small  -> resource_industrial_poor_01
 *   medium -> resource_industrial_medium_01
 *   large  -> resource_industrial_rich_01
 *   infinite -> resource_industrial_infinite_center_2x2_01
 *
 * very_poor and very_rich are preloaded but reserved for future mapgen/richness PR.
 */
const RESOURCE_ASSET_MAPS: Record<ResourceStyle, Record<ResourceType, string>> = {
  legacy: {
    small: ASSET_KEYS.MINERAL_SMALL,
    medium: ASSET_KEYS.MINERAL_MEDIUM,
    large: ASSET_KEYS.MINERAL_LARGE,
    infinite: ASSET_KEYS.MINERAL_LARGE, // No infinite-specific asset; use large
  },
  industrial: {
    small: ASSET_KEYS.RESOURCE_INDUSTRIAL_POOR_01,
    medium: ASSET_KEYS.RESOURCE_INDUSTRIAL_MEDIUM_01,
    large: ASSET_KEYS.RESOURCE_INDUSTRIAL_RICH_01,
    infinite: ASSET_KEYS.RESOURCE_INDUSTRIAL_INFINITE_CENTER_2X2_01,
  },
};

/**
 * VISUAL-06E: Resource type → display scale, parametrized by resourceStyle.
 * Legacy scales match the original mineral crystal rendering.
 * Industrial scales are calibrated for the approved variable-cropped PNG assets.
 *
 * Industrial resources are larger source images (155–247px wide vs 384px mineral
 * canvases), so they need smaller scale factors to fit the 76×38 isometric cell.
 * The infinite 2×2 asset uses a moderate scale to visually fill the 2×2 footprint.
 *
 * These are initial conservative values; VISUAL-06F may adjust for polish.
 */
const RESOURCE_SCALE_MAPS: Record<ResourceStyle, Record<ResourceType, number>> = {
  legacy: {
    small: 0.3,
    medium: 0.4,
    large: 0.5,
    infinite: INFINITE_MINERAL_SCALE,
  },
  industrial: {
    small: 0.20,
    medium: 0.22,
    large: 0.22,
    infinite: 0.35,
  },
};

/**
 * VISUAL-06E: Get the asset key for a resource type given the current resourceStyle.
 * Falls back to legacy keys if the industrial texture is not loaded.
 *
 * Exported for testing — production code should use EntityRenderer which
 * calls this internally via createResourceSprite().
 */
export function getResourceAssetKey(resourceType: ResourceType, resourceStyle: ResourceStyle, textureManager: Phaser.Textures.TextureManager): string {
  const preferredKey = RESOURCE_ASSET_MAPS[resourceStyle][resourceType];
  if (textureManager.exists(preferredKey)) return preferredKey;
  // Fallback: if the preferred style's texture is missing, use legacy
  const legacyKey = RESOURCE_ASSET_MAPS.legacy[resourceType];
  if (textureManager.exists(legacyKey)) return legacyKey;
  // Last resort: return the preferred key anyway (will produce a missing texture warning)
  return preferredKey;
}

/**
 * VISUAL-06E: Get the display scale for a resource type given the current resourceStyle.
 * Uses legacy scale when falling back to legacy textures.
 *
 * Exported for testing.
 */
export function getResourceScale(resourceType: ResourceType, resourceStyle: ResourceStyle, assetKey: string): number {
  // If using a legacy key (fallback), use legacy scale
  const isLegacyKey = Object.values(RESOURCE_ASSET_MAPS.legacy).includes(assetKey);
  return isLegacyKey
    ? RESOURCE_SCALE_MAPS.legacy[resourceType]
    : RESOURCE_SCALE_MAPS[resourceStyle][resourceType];
}

/**
 * VISUAL-06E: Exported for testing — returns the asset map for a given resourceStyle.
 * Pure data lookup, no texture fallback.
 */
export { RESOURCE_ASSET_MAPS, RESOURCE_SCALE_MAPS };

export class EntityRenderer {
  private scene: Phaser.Scene;
  private offset: IsoPoint;

  /** Static game objects (HQ, builder) — rendered once, never updated per frame. */
  private staticObjects: Phaser.GameObjects.GameObject[] = [];

  /** Harvester sprites keyed by harvester ID. */
  private harvesterSprites = new Map<string, Phaser.GameObjects.Sprite>();

  /** Previous harvester tile positions for direction calculation. */
  private harvesterPrevTile = new Map<string, { ftx: number; fty: number }>();

  /** Last facing direction per harvester (for idle animation key). Default: 2 (S). */
  private harvesterFacing = new Map<string, number>();

  /** Effective faction per harvester (accounts for texture fallback). */
  private harvesterFaction = new Map<string, Faction>();

  /** Whether harvester animations have been registered with the Animation Manager. */
  private harvesterAnimRegistered = false;

  /** Resource image objects keyed by resource node ID. */
  private resourceSprites = new Map<string, Phaser.GameObjects.Image>();

  /** Count of state-only entities skipped during initial render. */
  private skippedCount: number = 0;

  /** Modular tank renderer — owns hull/turret placement, direction, debug overlay. */
  private modularTankRenderer: ModularTankRenderer;

  /** MODULAR-RUNTIME-03B: Modular adapter for normal-runtime clean modular rendering. */
  private modularAdapter: ModularVehicleLiveAdapter;

  /** Construction renderer — owns construction site + building placeholder graphics. */
  private constructionRenderer: ConstructionRenderer;

  /** VISUAL-06E: Active resource visual style. */
  private resourceStyle: ResourceStyle;

  constructor(scene: Phaser.Scene, offset: IsoPoint, resourceStyle: ResourceStyle = 'legacy') {
    this.scene = scene;
    this.offset = offset;
    this.resourceStyle = resourceStyle;
    this.modularTankRenderer = new ModularTankRenderer(scene, offset);
    this.modularAdapter = new ModularVehicleLiveAdapter(scene, offset, 100);
    this.constructionRenderer = new ConstructionRenderer(scene, offset);
  }

  // ─── Static entity rendering (called once) ─────────────────────

  /** Render static entities (HQ, builder, state-only) from the renderable entity list. */
  renderStaticEntities(entities: RenderableEntity[]): void {
    this.skippedCount = 0;
    for (const entity of entities) {
      // Skip harvester and resource — handled dynamically from runtime state
      if (entity.kind === 'harvester' || entity.kind === 'resource') continue;

      // Skip state-only entities (no visual asset exists)
      if (entity.stateOnly) {
        this.skippedCount++;
        continue;
      }
      this.renderStaticEntity(entity);
    }
    if (this.skippedCount > 0) {
      console.warn(
        `[EntityRenderer] Skipped ${this.skippedCount} state-only entities ` +
        `(obstacles, decor, and placeholder buildings without approved assets).`,
      );
    }
  }

  // ─── Dynamic entity rendering (called once at init) ────────────

  /** Create initial sprites for all harvesters and resource nodes. */
  renderDynamicInit(harvesters: HarvesterState[], resourceNodes: ResourceNodeState[]): void {
    for (const h of harvesters) {
      this.createHarvesterSprite(h);
    }
    for (const r of resourceNodes) {
      this.createResourceSprite(r);
    }
  }

  // ─── Frame-by-frame sync (called every frame) ─────────────────

  /** Sync all dynamic sprites from the current GameState. */
  syncFromState(state: GameState): void {
    this.syncHarvesters(state.harvesters);
    this.syncResources(state.resourceNodes, state.vision);
    this.constructionRenderer.syncFromState(state);

    // MODULAR-RUNTIME-03B: Retry clean modular placement while assets are loading.
    // Called each frame so that when textures finish loading, the modular
    // sprites are applied and legacy hull/turret are suppressed.
    if (ENABLE_MODULAR_VEHICLE_RENDER) {
      this.modularTankRenderer.retryCleanModular();
    }
  }

  private syncHarvesters(harvesters: HarvesterState[]): void {
    // Track which harvester IDs are still in state so we can clean up stale sprites
    const activeIds = new Set<string>();

    for (const h of harvesters) {
      activeIds.add(h.id);

      let sprite = this.harvesterSprites.get(h.id);
      if (!sprite) {
        // ARCH-11A fixup: Create sprite on-the-fly for dev-spawned harvesters
        // so they become visible immediately without scene restart.
        this.createHarvesterSprite(h);
        sprite = this.harvesterSprites.get(h.id);
        if (!sprite) continue; // safety guard
      }

      // Set sprite position directly from state (no render-side smoothing).
      // With ARRIVAL_THRESHOLD = 0.03, waypoint snap is sub-pixel (~0.57px)
      // and invisible — no smoothing layer needed.
      const screenPos = tileToScreen(h.ftx, h.fty);
      const worldX = screenPos.x + this.offset.x;
      const worldY = screenPos.y + this.offset.y;

      sprite.setPosition(worldX, worldY);
      // CORE-STEP-06H+ fixup: Use unified depth sorting for correct unit/building ordering
      sprite.setDepth(computeDepthValue({
        id: h.id, type: 'unit', tx: h.ftx, ty: h.fty,
        offsetX: this.offset.x, offsetY: this.offset.y,
      }));

      // Animation state: determine facing direction and whether moving
      const prev = this.harvesterPrevTile.get(h.id);
      const isMoving =
        prev !== undefined &&
        (Math.abs(h.ftx - prev.ftx) > 0.001 || Math.abs(h.fty - prev.fty) > 0.001);

      let dirIndex = this.harvesterFacing.get(h.id) ?? DIR_ROW.S; // default: S
      if (isMoving && prev) {
        dirIndex = directionFromDelta(h.ftx - prev.ftx, h.fty - prev.fty);
        this.harvesterFacing.set(h.id, dirIndex);
      }

      // Construct animation key using effective faction (accounts for texture fallback)
      const animFaction = this.harvesterFaction.get(h.id) ?? h.faction;
      const dirLabel = DIR_LABELS[dirIndex];
      const animKey = `harvester_${animFaction}_${isMoving ? 'move' : 'idle'}_${dirLabel}`;

      if (this.scene.anims.exists(animKey)) {
        // ignoreIfPlaying=true avoids restarting the same animation every frame
        sprite.anims.play(animKey, true);
      } else {
        // Fallback: manual frame indexing (original approach)
        // Stop any playing animation before manually setting the frame,
        // otherwise a running animation may continue ticking.
        sprite.anims.stop();
        const frame = dirIndex * 8 + IDLE_FRAME;
        sprite.setFrame(frame);
      }

      this.harvesterPrevTile.set(h.id, { ftx: h.ftx, fty: h.fty });
    }

    // Clean up stale harvester sprites (sprites for harvesters no longer in state)
    for (const [id, sprite] of this.harvesterSprites) {
      if (!activeIds.has(id)) {
        sprite.destroy();
        this.harvesterSprites.delete(id);
        this.harvesterPrevTile.delete(id);
        this.harvesterFacing.delete(id);
        this.harvesterFaction.delete(id);
      }
    }
  }

  /**
   * Sync resource sprites with current state and fog visibility.
   * FIXUP-2: Resources now respect fog state:
   * - depleted → hidden (preserved from pre-fog behavior)
   * - unexplored → hidden
   * - explored but not visible → visible, dimmed alpha
   * - visible → visible, full alpha
   */
  private syncResources(resourceNodes: ResourceNodeState[], vision: VisionState | undefined): void {
    for (const r of resourceNodes) {
      const img = this.resourceSprites.get(r.id);
      if (!img) continue;

      // Depleted resources are always hidden
      if (r.depleted) {
        if (img.visible) img.setVisible(false);
        continue;
      }

      // No vision state (e.g. Arena) → show normally
      if (!vision) {
        if (!img.visible) img.setVisible(true);
        img.setAlpha(1);
        continue;
      }

      const tileVis = getTileVisibility(vision, r.tx, r.ty);
      switch (tileVis) {
        case 'unexplored':
          img.setVisible(false);
          break;
        case 'explored':
          img.setVisible(true);
          img.setAlpha(EXPLORED_RESOURCE_ALPHA);
          break;
        case 'visible':
          img.setVisible(true);
          img.setAlpha(1);
          break;
      }
    }
  }

  // ─── Static entity factory ─────────────────────────────────────

  private renderStaticEntity(entity: RenderableEntity): void {
    switch (entity.kind) {
      case 'hq':
        // BASE-ANCHOR-01: HQ uses south-vertex placement (like other buildings),
        // not top-left tile center. Pass tile coords so placeHQ can compute
        // the correct footprint south vertex.
        this.placeHQ(entity.tx, entity.ty, entity.faction);
        break;
      case 'builder':
      case 'modular-combat': {
        const screenPos = tileToScreen(entity.tx, entity.ty);
        const worldX = screenPos.x + this.offset.x;
        const worldY = screenPos.y + this.offset.y;
        if (entity.kind === 'builder') {
          this.placeBuilder(worldX, worldY, entity);
        } else {
          this.modularTankRenderer.place(entity, this.modularAdapter);
        }
        break;
      }
      default:
        break;
    }
  }

  /**
   * HQ footprint dimensions — 3×3 tiles.
   *
   * BASE-ANCHOR-01: HQ now uses south-vertex placement, matching the
   * metadata-driven model used by ConstructionRenderer for other buildings.
   * Previously HQ was placed at the top-left tile center with origin(0.5, 0.75),
   * causing the building to visually float above its 3×3 footprint.
   */
  private static readonly HQ_FOOTPRINT_W = 3;
  private static readonly HQ_FOOTPRINT_H = 3;

  /**
   * HQ ground-line ratio — alpha bounds bottom / source height.
   *
   * All four faction HQ PNGs are 1114×835 with alpha bounds [3, 3, 1111, 832],
   * giving groundLineRatio = 832 / 835 = 0.996407.
   * This is consistent with other buildings (all ~0.996).
   */
  private static readonly HQ_GROUND_LINE_RATIO = 0.996407;

  private placeHQ(tx: number, ty: number, faction?: string): void {
    const effectiveFaction: Faction =
      (faction === 'cyan' || faction === 'green' || faction === 'yellow' || faction === 'purple')
        ? (faction as Faction)
        : 'cyan';
    let hqKey = getHqAssetKey(effectiveFaction);

    if (!this.scene.textures.exists(hqKey)) {
      console.error(
        `[EntityRenderer] HQ texture "${hqKey}" missing for faction "${effectiveFaction}" ` +
        `— falling back to cyan.`,
      );
      hqKey = getHqAssetKey('cyan');
      if (!this.scene.textures.exists(hqKey)) {
        console.error(
          `[EntityRenderer] Fallback HQ texture "${hqKey}" also missing — skipping HQ render.`,
        );
        return;
      }
    }

    // BASE-ANCHOR-01: South-vertex placement — same model as ConstructionRenderer.
    // Compute the south vertex of the 3×3 isometric footprint diamond.
    const sv = footprintSouthVertex(tx, ty, EntityRenderer.HQ_FOOTPRINT_W, EntityRenderer.HQ_FOOTPRINT_H);
    const worldX = sv.x + this.offset.x;
    const worldY = sv.y + this.offset.y;

    const img = this.scene.add.image(worldX, worldY, hqKey);

    // Scale from metadata-driven display width (3×3 footprint → 200px)
    const targetWidth = computeTargetDisplayWidth(EntityRenderer.HQ_FOOTPRINT_W, EntityRenderer.HQ_FOOTPRINT_H);
    const scale = targetWidth / img.width;
    img.setScale(scale);

    // Origin: center-X, ground-line ratio (consistent with other buildings ~0.996)
    img.setOrigin(0.5, EntityRenderer.HQ_GROUND_LINE_RATIO);

    // CORE-STEP-06H+ fixup: Use unified depth sorting for correct building/unit ordering
    img.setDepth(computeDepthValue({
      id: `hq-${tx}-${ty}`, type: 'building', tx, ty,
      footprintW: EntityRenderer.HQ_FOOTPRINT_W, footprintH: EntityRenderer.HQ_FOOTPRINT_H,
      offsetX: this.offset.x, offsetY: this.offset.y,
    }));

    this.staticObjects.push(img);
  }

  private placeBuilder(_x: number, _y: number, entity: RenderableEntity): void {
    // ARCH-13E3: Builder rendering is now handled by ConstructionRenderer
    // using fractional tile positions for smooth movement.
    // The static builder placeholder in entities is no longer rendered here.
    void entity;
  }

  // ─── Animation registration ─────────────────────────────────────

  /**
   * Register all harvester animations with the Phaser Animation Manager.
   *
   * Registers 64 animation keys: 4 factions × 2 states (idle/move) × 8 directions.
   * Idle animations are single-frame (no bobbing).
   * Move animations use frames 1–7 per direction row (walk cycle, excluding idle column 0).
   *
   * Called lazily on first harvester sprite creation; guarded by harvesterAnimRegistered.
   */
  private registerHarvesterAnimations(): void {
    if (this.harvesterAnimRegistered) return;

    for (const faction of CIVIL_FACTIONS) {
      const textureKey = getCivilUnitKey(faction, 'harvester');

      // Skip factions whose texture is not loaded
      if (!this.scene.textures.exists(textureKey)) continue;

      for (let dirIndex = 0; dirIndex < 8; dirIndex++) {
        const dirLabel = DIR_LABELS[dirIndex];
        const rowStart = dirIndex * 8; // first frame in this direction row

        // Idle: single frame (column 0), loops at 1 fps but visually never changes
        const idleKey = `harvester_${faction}_idle_${dirLabel}`;
        if (!this.scene.anims.exists(idleKey)) {
          this.scene.anims.create({
            key: idleKey,
            frames: [{ key: textureKey, frame: rowStart + 0 }],
            frameRate: 1,
            repeat: -1,
          });
        }

        // Move: walk cycle frames 1–7 (7 frames), loops at HARVESTER_WALK_FPS
        // Frame 0 is the idle/standing pose — excluded for smoother walk cycle.
        const moveKey = `harvester_${faction}_move_${dirLabel}`;
        if (!this.scene.anims.exists(moveKey)) {
          this.scene.anims.create({
            key: moveKey,
            frames: this.scene.anims.generateFrameNumbers(textureKey, {
              start: rowStart + 1,
              end: rowStart + 7,
            }),
            frameRate: HARVESTER_WALK_FPS,
            repeat: -1,
          });
        }
      }
    }

    this.harvesterAnimRegistered = true;
  }

  // ─── Dynamic entity factories ──────────────────────────────────

  private createHarvesterSprite(h: HarvesterState): void {
    // Ensure animations are registered before creating sprites
    this.registerHarvesterAnimations();

    const screenPos = tileToScreen(h.ftx, h.fty);
    const worldX = screenPos.x + this.offset.x;
    const worldY = screenPos.y + this.offset.y;

    let harvesterKey = getCivilUnitKey(h.faction, 'harvester');
    let effectiveFaction: Faction = h.faction;
    if (!this.scene.textures.exists(harvesterKey)) {
      console.error(
        `[EntityRenderer] Harvester texture "${harvesterKey}" missing for faction "${h.faction}" ` +
        `— falling back to cyan.`,
      );
      harvesterKey = getCivilUnitKey('cyan', 'harvester');
      effectiveFaction = 'cyan';
      if (!this.scene.textures.exists(harvesterKey)) {
        console.error(
          `[EntityRenderer] Fallback harvester texture "${harvesterKey}" also missing — skipping sprite.`,
        );
        return;
      }
    }

    // Frame index: row S (2) * 8 + col IDLE (0) = frame 16
    const idleFrame = DIR_ROW.S * 8 + IDLE_FRAME;
    const sprite = this.scene.add.sprite(worldX, worldY, harvesterKey, idleFrame);
    sprite.setScale(HARVESTER_RENDER_SCALE);
    sprite.setOrigin(0.5, 0.75);
    sprite.setDepth(computeDepthValue({
      id: h.id, type: 'unit', tx: h.ftx, ty: h.fty,
      offsetX: this.offset.x, offsetY: this.offset.y,
    }));

    // Play initial idle animation (south-facing)
    const initialAnimKey = `harvester_${effectiveFaction}_idle_s`;
    if (this.scene.anims.exists(initialAnimKey)) {
      sprite.anims.play(initialAnimKey);
    }

    // Track effective faction and default facing direction
    this.harvesterFaction.set(h.id, effectiveFaction);
    this.harvesterFacing.set(h.id, DIR_ROW.S);
    this.harvesterSprites.set(h.id, sprite);
    this.harvesterPrevTile.set(h.id, { ftx: h.ftx, fty: h.fty });
  }

  private createResourceSprite(r: ResourceNodeState): void {
    // VISUAL-06E: Use resourceStyle-aware asset key and scale lookup.
    // Falls back to legacy key if industrial texture is not loaded.
    const assetKey = getResourceAssetKey(r.resourceType, this.resourceStyle, this.scene.textures);
    const scale = getResourceScale(r.resourceType, this.resourceStyle, assetKey);

    const screenPos = tileToScreen(r.tx, r.ty);
    const worldX = screenPos.x + this.offset.x;
    const worldY = screenPos.y + this.offset.y;

    const img = this.scene.add.image(worldX, worldY, assetKey);
    img.setScale(scale);
    // VISUAL-06E: Industrial infinite (2×2) uses a slightly different origin
    // to center the larger asset over the 2×2 footprint. For 1×1 nodes,
    // the standard (0.5, 0.75) origin keeps crystals visually grounded.
    // The infinite 2×2 asset needs origin closer to center to align properly.
    if (r.resourceType === 'infinite' && this.resourceStyle === 'industrial' && assetKey === RESOURCE_ASSET_MAPS.industrial.infinite) {
      img.setOrigin(0.5, 0.72);
    } else {
      img.setOrigin(0.5, 0.75);
    }
    // CORE-STEP-06H+ fixup: Use unified depth sorting for correct resource/unit ordering
    img.setDepth(computeDepthValue({
      id: r.id, type: 'resource', tx: r.tx, ty: r.ty,
      offsetX: this.offset.x, offsetY: this.offset.y,
    }));

    this.resourceSprites.set(r.id, img);
  }

  // ─── Utility ───────────────────────────────────────────────────

  /** Count how many visible entities of each kind exist (excludes stateOnly). */
  static countByKind(entities: RenderableEntity[]): Record<EntityKind, number> {
    const counts: Record<EntityKind, number> = {
      hq: 0,
      builder: 0,
      harvester: 0,
      resource: 0,
      'modular-combat': 0,
    };
    for (const entity of entities) {
      if (!entity.stateOnly) {
        counts[entity.kind]++;
      }
    }
    return counts;
  }

  // ─── Modular tank facade methods (delegate to ModularTankRenderer) ──

  /** Whether the debug overlay is currently visible. */
  isDebugOverlayVisible(): boolean {
    return this.modularTankRenderer.isDebugOverlayVisible();
  }

  /** Toggle the modular tank debug overlay. Returns new visibility state. */
  toggleModularTankDebug(): boolean {
    return this.modularTankRenderer.toggleDebug();
  }

  /** Change the body direction of the modular tank. */
  setModularTankBodyDir(dir: ModularTankDirection): void {
    this.modularTankRenderer.setBodyDir(dir);
  }

  /** Change the turret direction of the modular tank. */
  setModularTankTurretDir(dir: ModularTankDirection): void {
    this.modularTankRenderer.setTurretDir(dir);
  }

  /** Reposition hull/turret and rebuild debug overlay. */
  updateModularTankVisuals(): void {
    this.modularTankRenderer.updateVisuals();
  }

  /** Print mutable runtime offset tables to console. */
  printOffsetTables(): void {
    this.modularTankRenderer.printOffsetTables();
  }

  // ─── MODULAR-RUNTIME-03B: Toggle-off cleanup ──────────────────────

  /**
   * Clear all modular vehicle sprites for normal runtime.
   * Called when ENABLE_MODULAR_VEHICLE_RENDER is toggled OFF.
   * Delegates to ModularTankRenderer.clearModularVehicleRender().
   */
  clearModularVehicleRender(): void {
    this.modularTankRenderer.clearModularVehicleRender();
  }

  // ─── MODULAR-RUNTIME-03B: Activation on Live Render ON ───────────

  /**
   * Activate clean modular rendering for normal-runtime entities.
   * Called when ENABLE_MODULAR_VEHICLE_RENDER is toggled ON after
   * scene initialization (flag was off during place()).
   * Delegates to ModularTankRenderer.activateCleanModularRender().
   */
  activateModularVehicleRender(): void {
    this.modularTankRenderer.activateCleanModularRender();
  }

  destroy(): void {
    for (const obj of this.staticObjects) {
      obj.destroy();
    }
    this.staticObjects = [];

    this.modularAdapter.destroy();
    this.modularTankRenderer.destroy();
    this.constructionRenderer.destroy();

    for (const sprite of this.harvesterSprites.values()) {
      sprite.destroy();
    }
    this.harvesterSprites.clear();
    this.harvesterPrevTile.clear();
    this.harvesterFacing.clear();
    this.harvesterFaction.clear();

    for (const img of this.resourceSprites.values()) {
      img.destroy();
    }
    this.resourceSprites.clear();
  }
}
