import Phaser from 'phaser';
import { ASSET_KEYS, DIR_ROW, IDLE_FRAME } from '../../assets/assetManifest';
import { tileToScreen, IsoPoint } from './isometric';

/**
 * EntityRenderer — places static entities (HQ, minerals, harvester) on the scene.
 *
 * PR1 constraints:
 * - HQ: static Image, no animation
 * - Minerals: static Images, no animation
 * - Harvester: Sprite showing idle frame only, no movement logic
 * - All entities positioned using isometric coordinates
 */

export interface EntityPlacement {
  tx: number;
  ty: number;
  type: 'hq' | 'mineral_small' | 'mineral_medium' | 'mineral_large' | 'harvester';
}

/** Pre-defined entity placements for PR1 static scene. */
export function getPR1EntityPlacements(): EntityPlacement[] {
  return [
    // HQ near the center
    { tx: 24, ty: 24, type: 'hq' },

    // Mineral clusters near HQ
    { tx: 20, ty: 20, type: 'mineral_large' },
    { tx: 21, ty: 19, type: 'mineral_medium' },
    { tx: 19, ty: 21, type: 'mineral_small' },
    { tx: 28, ty: 27, type: 'mineral_large' },
    { tx: 29, ty: 28, type: 'mineral_medium' },
    { tx: 27, ty: 29, type: 'mineral_small' },

    // One harvester near HQ
    { tx: 25, ty: 23, type: 'harvester' },
  ];
}

export class EntityRenderer {
  private scene: Phaser.Scene;
  private offset: IsoPoint;
  private entities: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.scene = scene;
    this.offset = offset;
  }

  /** Place all entities from the placement list. */
  placeEntities(placements: EntityPlacement[]): void {
    for (const placement of placements) {
      this.placeEntity(placement);
    }
  }

  private placeEntity(placement: EntityPlacement): void {
    const screenPos = tileToScreen(placement.tx, placement.ty);
    const worldX = screenPos.x + this.offset.x;
    const worldY = screenPos.y + this.offset.y;

    switch (placement.type) {
      case 'hq':
        this.placeHQ(worldX, worldY);
        break;
      case 'mineral_small':
        this.placeMineral(worldX, worldY, ASSET_KEYS.MINERAL_SMALL, 0.3);
        break;
      case 'mineral_medium':
        this.placeMineral(worldX, worldY, ASSET_KEYS.MINERAL_MEDIUM, 0.4);
        break;
      case 'mineral_large':
        this.placeMineral(worldX, worldY, ASSET_KEYS.MINERAL_LARGE, 0.5);
        break;
      case 'harvester':
        this.placeHarvester(worldX, worldY);
        break;
    }
  }

  private placeHQ(x: number, y: number): void {
    // HQ is a large building sprite — scale it to fit reasonably on the map
    const img = this.scene.add.image(x, y, ASSET_KEYS.HQ_CYAN);
    // Original is 1114×835; scale down to ~120×90 for the isometric view
    const scale = 120 / img.width;
    img.setScale(scale);
    img.setOrigin(0.5, 0.75); // Anchor at bottom-center so it sits on the tile
    img.setDepth(100 + y); // Depth sort by Y for painter's algorithm
    this.entities.push(img);
  }

  private placeMineral(
    x: number,
    y: number,
    key: string,
    scale: number,
  ): void {
    const img = this.scene.add.image(x, y, key);
    // Original 256×256; scale to appropriate iso size
    img.setScale(scale);
    img.setOrigin(0.5, 0.75);
    img.setDepth(100 + y);
    this.entities.push(img);
  }

  private placeHarvester(x: number, y: number): void {
    // Frame index: row S (2) * 8 + col IDLE (0) = frame 16
    // Show the harvester facing south in idle pose
    const idleFrame = DIR_ROW.S * 8 + IDLE_FRAME;
    const sprite = this.scene.add.sprite(x, y, ASSET_KEYS.HARVESTER_CYAN, idleFrame);

    // Original frame is 256×256; scale to fit the isometric grid
    // Harvester profile in donor game: size [41, 41], groundOffset 8
    const scale = 41 / 256;
    sprite.setScale(scale);
    sprite.setOrigin(0.5, 0.75);
    sprite.setDepth(100 + y);
    this.entities.push(sprite);
  }

  destroy(): void {
    for (const entity of this.entities) {
      entity.destroy();
    }
    this.entities = [];
  }
}
