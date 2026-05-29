import Phaser from 'phaser';
import { TILE_W } from '../../config/worldConfig';
import { MAPLIFE_DECOR_CELL_SOURCE_PX, getMaplifeDecorConfig } from '../../assets/maplifeDecor';
import type { DecorPlacement } from '../../state/types';
import { footprintSouthVertex, tileToScreen, type IsoPoint } from './isometric';

/**
 * DecorRenderer renders MAPLIFE decorative-only placements.
 *
 * Decals sit above terrain and below gameplay entities.
 * Props sit above terrain/decals and below resources, buildings, and units.
 */
export class DecorRenderer {
  private readonly objects: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly offset: IsoPoint,
  ) {}

  render(decor: DecorPlacement[]): void {
    for (const placement of decor) {
      const config = getMaplifeDecorConfig(placement.type);
      const image = this.scene.add.image(0, 0, config.key);
      const scale = (placement.footprint * TILE_W) / MAPLIFE_DECOR_CELL_SOURCE_PX;

      image.setScale(scale);
      image.setOrigin(0.5, config.originY);

      if (placement.category === 'decal') {
        const centerTx = placement.tx + (placement.footprint - 1) / 2;
        const centerTy = placement.ty + (placement.footprint - 1) / 2;
        const screenPos = tileToScreen(centerTx, centerTy);
        const worldX = screenPos.x + this.offset.x;
        const worldY = screenPos.y + this.offset.y;

        image.setPosition(worldX, worldY);
        image.setDepth(20 + worldY);
        image.setAlpha(0.95);
      } else {
        const southVertex = footprintSouthVertex(
          placement.tx,
          placement.ty,
          placement.footprint,
          placement.footprint,
        );
        const worldX = southVertex.x + this.offset.x;
        const worldY = southVertex.y + this.offset.y;

        image.setPosition(worldX, worldY);
        image.setDepth(90 + worldY);
      }

      this.objects.push(image);
    }
  }

  destroy(): void {
    for (const obj of this.objects) {
      obj.destroy();
    }
    this.objects.length = 0;
  }
}
