import Phaser from 'phaser';
import { ASSET_KEYS, DIR_ROW, IDLE_FRAME } from '../../assets/assetManifest';
import { tileToScreen, IsoPoint } from './isometric';
import type { Entity, EntityKind, ResourceType } from '../../state/types';

/**
 * EntityRenderer — renders entities from GameState onto the scene.
 *
 * Each entity kind maps to a specific visual treatment:
 * - hq → cyan HQ image
 * - harvester → cyan harvester spritesheet (idle frame)
 * - builder → TODO: no approved builder asset in repo (logged warning)
 * - resource → mineral image based on resourceType
 *
 * PR2: All entity data comes from GameState. No hardcoded placements.
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

export class EntityRenderer {
  private scene: Phaser.Scene;
  private offset: IsoPoint;
  private entities: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.scene = scene;
    this.offset = offset;
  }

  /** Render all entities from the GameState entity list. */
  renderEntities(entities: Entity[]): void {
    for (const entity of entities) {
      this.renderEntity(entity);
    }
  }

  private renderEntity(entity: Entity): void {
    const screenPos = tileToScreen(entity.tx, entity.ty);
    const worldX = screenPos.x + this.offset.x;
    const worldY = screenPos.y + this.offset.y;

    switch (entity.kind) {
      case 'hq':
        this.placeHQ(worldX, worldY, entity.faction);
        break;
      case 'harvester':
        this.placeHarvester(worldX, worldY, entity.faction);
        break;
      case 'builder':
        this.placeBuilder(worldX, worldY, entity);
        break;
      case 'resource':
        this.placeResource(worldX, worldY, entity.resourceType ?? 'small');
        break;
    }
  }

  private placeHQ(x: number, y: number, faction?: string): void {
    // Only cyan HQ asset available in repo
    if (faction !== 'cyan') {
      console.warn(`[EntityRenderer] No HQ asset for faction "${faction}" — skipping.`);
      return;
    }
    const img = this.scene.add.image(x, y, ASSET_KEYS.HQ_CYAN);
    const scale = 120 / img.width;
    img.setScale(scale);
    img.setOrigin(0.5, 0.75);
    img.setDepth(100 + y);
    this.entities.push(img);
  }

  private placeHarvester(x: number, y: number, faction?: string): void {
    if (faction !== 'cyan') {
      console.warn(`[EntityRenderer] No harvester asset for faction "${faction}" — skipping.`);
      return;
    }
    // Frame index: row S (2) * 8 + col IDLE (0) = frame 16
    const idleFrame = DIR_ROW.S * 8 + IDLE_FRAME;
    const sprite = this.scene.add.sprite(x, y, ASSET_KEYS.HARVESTER_CYAN, idleFrame);
    const scale = 41 / 256;
    sprite.setScale(scale);
    sprite.setOrigin(0.5, 0.75);
    sprite.setDepth(100 + y);
    this.entities.push(sprite);
  }

  private placeBuilder(x: number, y: number, entity: Entity): void {
    // No approved builder asset exists in the new repo.
    // Decision: skip rendering with a TODO warning. Do NOT create placeholder rectangles.
    console.warn(
      `[EntityRenderer] TODO: No builder asset in repo — skipping builder at (${entity.tx}, ${entity.ty}). ` +
      `Add builder_8x8_256.png to approved assets to enable rendering.`,
    );
    void x;
    void y;
  }

  private placeResource(x: number, y: number, resourceType: ResourceType): void {
    const assetKey = RESOURCE_ASSET_MAP[resourceType];
    const scale = RESOURCE_SCALE_MAP[resourceType];
    const img = this.scene.add.image(x, y, assetKey);
    img.setScale(scale);
    img.setOrigin(0.5, 0.75);
    img.setDepth(100 + y);
    this.entities.push(img);
  }

  /** Count how many entities of each kind exist. */
  static countByKind(entities: Entity[]): Record<EntityKind, number> {
    const counts: Record<EntityKind, number> = { hq: 0, builder: 0, harvester: 0, resource: 0 };
    for (const entity of entities) {
      counts[entity.kind]++;
    }
    return counts;
  }

  destroy(): void {
    for (const entity of this.entities) {
      entity.destroy();
    }
    this.entities = [];
  }
}
