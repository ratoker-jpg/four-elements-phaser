import Phaser from 'phaser';
import { ASSET_KEYS, DIR_ROW, IDLE_FRAME } from '../../assets/assetManifest';
import {
  getSmokyTurretKey,
  getWaspHullKey,
  type ModularDirection,
} from '../../assets/modularUnitAssets';
import { TILE_H, TILE_W } from '../../config/worldConfig';
import { tileToScreen, IsoPoint } from './isometric';
import type {
  RenderableEntity,
  EntityKind,
  Faction,
  ResourceType,
  GameState,
  HarvesterState,
  ResourceNodeState,
} from '../../state/types';
import { directionFromDelta } from '../../state/updateGameState';

/**
 * EntityRenderer — renders and syncs entities from GameState onto the scene.
 *
 * PR3 changes:
 * - Static entities (HQ, builder, obstacles, decor) are rendered once from RenderableEntity[].
 * - Harvesters are rendered from HarvesterState[] with fractional positions and direction facing.
 * - Resources are rendered from ResourceNodeState[] with depletion support.
 * - syncFromState() updates harvester positions and resource visibility each frame.
 *
 * Entities with stateOnly=true are skipped with a console warning.
 */

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

const MODULAR_TANK_DEBUG = true;
const MODULAR_TANK_SCALE = 0.32;
const MODULAR_TANK_DIRECTION: ModularDirection = 2;
const MODULAR_TANK_HULL_ORIGIN = { x: 0.5, y: 0.75 };
const MODULAR_TANK_TURRET_ORIGIN = { x: 0.5, y: 0.5 };
const MODULAR_TANK_HULL_OFFSET = { x: 18, y: 8 };
const MODULAR_TANK_TURRET_OFFSET = { x: 2, y: -30 };

interface ModularTankDebugOverlay {
  graphics: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
}

export class EntityRenderer {
  private scene: Phaser.Scene;
  private offset: IsoPoint;

  /** Static game objects (HQ, builder) — rendered once, never updated per frame. */
  private staticObjects: Phaser.GameObjects.GameObject[] = [];

  /** Harvester sprites keyed by harvester ID. */
  private harvesterSprites = new Map<string, Phaser.GameObjects.Sprite>();

  /** Previous harvester tile positions for direction calculation. */
  private harvesterPrevTile = new Map<string, { ftx: number; fty: number }>();

  /** Resource image objects keyed by resource node ID. */
  private resourceSprites = new Map<string, Phaser.GameObjects.Image>();

  /** Count of state-only entities skipped during initial render. */
  private skippedCount: number = 0;

  /** Optional one-time render confirmation for the modular combat MVP. */
  private modularCombatLogged: boolean = false;

  /** Debug overlays for modular combat anchor/socket tuning. */
  private modularTankDebugOverlays: ModularTankDebugOverlay[] = [];

  /** Current visibility state for the modular-combat debug overlay. */
  private modularTankDebugVisible: boolean = MODULAR_TANK_DEBUG;

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.scene = scene;
    this.offset = offset;
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
  }

  private syncHarvesters(harvesters: HarvesterState[]): void {
    for (const h of harvesters) {
      const sprite = this.harvesterSprites.get(h.id);
      if (!sprite) continue;

      // Compute world position from fractional tile
      const screenPos = tileToScreen(h.ftx, h.fty);
      const worldX = screenPos.x + this.offset.x;
      const worldY = screenPos.y + this.offset.y;

      sprite.setPosition(worldX, worldY);
      sprite.setDepth(100 + worldY);

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
      this.harvesterPrevTile.set(h.id, { ftx: h.ftx, fty: h.fty });
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
        this.placeModularCombat(worldX, worldY, entity);
        break;
      default:
        break;
    }
  }

  private placeHQ(x: number, y: number, faction?: string): void {
    if (faction !== 'cyan') {
      console.warn(`[EntityRenderer] No HQ asset for faction "${faction}" — skipping.`);
      return;
    }
    const img = this.scene.add.image(x, y, ASSET_KEYS.HQ_CYAN);
    const scale = 120 / img.width;
    img.setScale(scale);
    img.setOrigin(0.5, 0.75);
    img.setDepth(100 + y);
    this.staticObjects.push(img);
  }

  private placeBuilder(x: number, y: number, entity: RenderableEntity): void {
    // No approved builder asset exists in the new repo.
    console.warn(
      `[EntityRenderer] TODO: No builder asset — skipping builder at (${entity.tx}, ${entity.ty}).`,
    );
    void x;
    void y;
  }

  private placeModularCombat(x: number, y: number, entity: RenderableEntity): void {
    const faction: Faction = entity.faction ?? 'cyan';
    const hullKey = getWaspHullKey(faction, MODULAR_TANK_DIRECTION);
    const turretKey = getSmokyTurretKey(faction, MODULAR_TANK_DIRECTION);
    const tileAnchor = tileToScreen(entity.tx, entity.ty);
    const anchorWorldX = tileAnchor.x + this.offset.x;
    const anchorWorldY = tileAnchor.y + this.offset.y;

    const hullWorldX = x + MODULAR_TANK_HULL_OFFSET.x;
    const hullWorldY = y + MODULAR_TANK_HULL_OFFSET.y;
    const baseDepth = 100 + hullWorldY;
    const hull = this.scene.add.image(hullWorldX, hullWorldY, hullKey);
    hull.setScale(MODULAR_TANK_SCALE);
    hull.setOrigin(MODULAR_TANK_HULL_ORIGIN.x, MODULAR_TANK_HULL_ORIGIN.y);
    hull.setDepth(baseDepth);

    // Socket alignment is intentionally approximate for the visual MVP.
    // We will refine the turret offset after in-game approval.
    const turretWorldX = x + MODULAR_TANK_TURRET_OFFSET.x;
    const turretWorldY = y + MODULAR_TANK_TURRET_OFFSET.y;
    const turret = this.scene.add.image(
      turretWorldX,
      turretWorldY,
      turretKey,
    );
    turret.setScale(MODULAR_TANK_SCALE);
    turret.setOrigin(MODULAR_TANK_TURRET_ORIGIN.x, MODULAR_TANK_TURRET_ORIGIN.y);
    turret.setDepth(baseDepth + 1);

    this.staticObjects.push(hull, turret);
    this.createModularTankDebugOverlay({
      tx: entity.tx,
      ty: entity.ty,
      anchorWorldX,
      anchorWorldY,
      hullWorldX,
      hullWorldY,
      turretWorldX,
      turretWorldY,
      baseDepth,
    });

    if (!this.modularCombatLogged) {
      console.log('[EntityRenderer] Rendered modular combat: wasp_m0 + smoky_m0');
      this.modularCombatLogged = true;
    }
  }

  private createModularTankDebugOverlay(data: {
    tx: number;
    ty: number;
    anchorWorldX: number;
    anchorWorldY: number;
    hullWorldX: number;
    hullWorldY: number;
    turretWorldX: number;
    turretWorldY: number;
    baseDepth: number;
  }): void {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(data.baseDepth + 10);
    graphics.setVisible(this.modularTankDebugVisible);

    const halfTileW = TILE_W / 2;
    const halfTileH = TILE_H / 2;

    // Logical tile footprint diamond for the modular unit anchor tile.
    graphics.lineStyle(2, 0x7cff7c, 0.95);
    graphics.beginPath();
    graphics.moveTo(data.anchorWorldX, data.anchorWorldY - halfTileH);
    graphics.lineTo(data.anchorWorldX + halfTileW, data.anchorWorldY);
    graphics.lineTo(data.anchorWorldX, data.anchorWorldY + halfTileH);
    graphics.lineTo(data.anchorWorldX - halfTileW, data.anchorWorldY);
    graphics.closePath();
    graphics.strokePath();

    // Logical tile anchor.
    graphics.lineStyle(2, 0xffd54f, 0.95);
    graphics.strokeCircle(data.anchorWorldX, data.anchorWorldY, 7);
    graphics.lineBetween(data.anchorWorldX - 10, data.anchorWorldY, data.anchorWorldX + 10, data.anchorWorldY);
    graphics.lineBetween(data.anchorWorldX, data.anchorWorldY - 10, data.anchorWorldX, data.anchorWorldY + 10);

    // Hull sprite origin marker.
    graphics.lineStyle(2, 0x26c6da, 0.95);
    graphics.strokeCircle(data.hullWorldX, data.hullWorldY, 6);
    graphics.lineBetween(data.hullWorldX - 8, data.hullWorldY - 8, data.hullWorldX + 8, data.hullWorldY + 8);
    graphics.lineBetween(data.hullWorldX - 8, data.hullWorldY + 8, data.hullWorldX + 8, data.hullWorldY - 8);

    // Turret sprite origin marker + line from hull origin to turret origin.
    graphics.lineStyle(2, 0xffffff, 0.9);
    graphics.lineBetween(data.hullWorldX, data.hullWorldY, data.turretWorldX, data.turretWorldY);
    graphics.lineStyle(2, 0xff6b6b, 0.95);
    graphics.strokeCircle(data.turretWorldX, data.turretWorldY, 6);
    graphics.lineBetween(data.turretWorldX - 8, data.turretWorldY, data.turretWorldX + 8, data.turretWorldY);
    graphics.lineBetween(data.turretWorldX, data.turretWorldY - 8, data.turretWorldX, data.turretWorldY + 8);

    const debugText = this.scene.add.text(
      data.hullWorldX + 30,
      data.hullWorldY + 28,
      [
        `tx/ty: ${data.tx}, ${data.ty}`,
        `world: ${Math.round(data.hullWorldX)}, ${Math.round(data.hullWorldY)}`,
        `scale: ${MODULAR_TANK_SCALE.toFixed(2)} dir: ${MODULAR_TANK_DIRECTION}`,
        `hull offset: ${MODULAR_TANK_HULL_OFFSET.x}, ${MODULAR_TANK_HULL_OFFSET.y}`,
        `turret offset: ${MODULAR_TANK_TURRET_OFFSET.x}, ${MODULAR_TANK_TURRET_OFFSET.y}`,
      ].join('\n'),
      {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#f4f7fb',
        backgroundColor: 'rgba(16, 18, 28, 0.76)',
        padding: { x: 4, y: 3 },
      },
    );
    debugText.setDepth(data.baseDepth + 11);
    debugText.setVisible(this.modularTankDebugVisible);

    this.staticObjects.push(graphics, debugText);
    this.modularTankDebugOverlays.push({ graphics, text: debugText });
  }

  // ─── Dynamic entity factories ──────────────────────────────────

  private createHarvesterSprite(h: HarvesterState): void {
    const screenPos = tileToScreen(h.ftx, h.fty);
    const worldX = screenPos.x + this.offset.x;
    const worldY = screenPos.y + this.offset.y;

    // Frame index: row S (2) * 8 + col IDLE (0) = frame 16
    const idleFrame = DIR_ROW.S * 8 + IDLE_FRAME;
    const sprite = this.scene.add.sprite(worldX, worldY, ASSET_KEYS.HARVESTER_CYAN, idleFrame);
    const scale = 41 / 256;
    sprite.setScale(scale);
    sprite.setOrigin(0.5, 0.75);
    sprite.setDepth(100 + worldY);

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

  toggleModularTankDebug(): boolean {
    this.modularTankDebugVisible = !this.modularTankDebugVisible;
    for (const overlay of this.modularTankDebugOverlays) {
      overlay.graphics.setVisible(this.modularTankDebugVisible);
      overlay.text.setVisible(this.modularTankDebugVisible);
    }
    return this.modularTankDebugVisible;
  }

  destroy(): void {
    for (const obj of this.staticObjects) {
      obj.destroy();
    }
    this.staticObjects = [];
    this.modularTankDebugOverlays = [];

    for (const sprite of this.harvesterSprites.values()) {
      sprite.destroy();
    }
    this.harvesterSprites.clear();
    this.harvesterPrevTile.clear();

    for (const img of this.resourceSprites.values()) {
      img.destroy();
    }
    this.resourceSprites.clear();
  }
}
