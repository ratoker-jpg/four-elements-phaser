import Phaser from 'phaser';
import { ASSET_KEYS, DIR_ROW, IDLE_FRAME } from '../../assets/assetManifest';
import {
  type ModularTankDirection,
} from '../../config/worldConfig';
import { tileToScreen, IsoPoint } from './isometric';
import { ModularTankRenderer } from './ModularTankRenderer';
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
import { getCivilUnitKey, CIVIL_FACTIONS } from '../../assets/civilUnitAssets';

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

/** Resource type → asset key mapping. */
const RESOURCE_ASSET_MAP: Record<ResourceType, string> = {
  small: ASSET_KEYS.MINERAL_SMALL,
  medium: ASSET_KEYS.MINERAL_MEDIUM,
  large: ASSET_KEYS.MINERAL_LARGE,
  infinite: ASSET_KEYS.MINERAL_LARGE, // No infinite-specific asset; use large
};

/** Resource type → display scale. */
const RESOURCE_SCALE_MAP: Record<ResourceType, number> = {
  small: 0.3,
  medium: 0.4,
  large: 0.5,
  infinite: INFINITE_MINERAL_SCALE,
};

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

  /** Construction renderer — owns construction site + building placeholder graphics. */
  private constructionRenderer: ConstructionRenderer;

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.scene = scene;
    this.offset = offset;
    this.modularTankRenderer = new ModularTankRenderer(scene, offset);
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
    this.syncResources(state.resourceNodes);
    this.constructionRenderer.syncFromState(state);
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
      sprite.setDepth(100 + worldY);

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

  private syncResources(resourceNodes: ResourceNodeState[]): void {
    for (const r of resourceNodes) {
      const img = this.resourceSprites.get(r.id);
      if (!img) continue;

      if (r.depleted && img.visible) {
        img.setVisible(false);
      }
    }
  }

  // ─── Static entity factory ─────────────────────────────────────

  private renderStaticEntity(entity: RenderableEntity): void {
    const screenPos = tileToScreen(entity.tx, entity.ty);
    const worldX = screenPos.x + this.offset.x;
    const worldY = screenPos.y + this.offset.y;

    switch (entity.kind) {
      case 'hq':
        this.placeHQ(worldX, worldY, entity.faction);
        break;
      case 'builder':
        this.placeBuilder(worldX, worldY, entity);
        break;
      case 'modular-combat':
        this.modularTankRenderer.place(entity);
        break;
      default:
        break;
    }
  }

  private placeHQ(x: number, y: number, faction?: string): void {
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

    const img = this.scene.add.image(x, y, hqKey);
    const scale = 120 / img.width;
    img.setScale(scale);
    img.setOrigin(0.5, 0.75);
    img.setDepth(100 + y);
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
    sprite.setDepth(100 + worldY);

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
    const assetKey = RESOURCE_ASSET_MAP[r.resourceType];
    const scale = RESOURCE_SCALE_MAP[r.resourceType];

    const screenPos = tileToScreen(r.tx, r.ty);
    const worldX = screenPos.x + this.offset.x;
    const worldY = screenPos.y + this.offset.y;

    const img = this.scene.add.image(worldX, worldY, assetKey);
    img.setScale(scale);
    img.setOrigin(0.5, 0.75);
    img.setDepth(100 + worldY);

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

  destroy(): void {
    for (const obj of this.staticObjects) {
      obj.destroy();
    }
    this.staticObjects = [];

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
