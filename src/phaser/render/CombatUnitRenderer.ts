import Phaser from 'phaser';
import type { ModularCombatUnit } from '../../state/types';
import { combatUnitToRenderableEntity } from '../../state/combatUnits';
import { computeDepthValue } from './depthSorting';
import { tileToScreen, type IsoPoint } from './isometric';
import {
  ENABLE_MODULAR_VEHICLE_RENDER,
  ModularVehicleLiveAdapter,
} from './ModularVehicleLiveAdapter';

interface CombatRenderEntry {
  adapter: ModularVehicleLiveAdapter;
  placeholder: Phaser.GameObjects.Graphics;
}

/**
 * Multi-entity normal-runtime renderer for produced combat units.
 *
 * Each unit owns a dedicated adapter. This intentionally isolates the adapter's
 * normal-runtime pending-load slot, so two units loading different modular sets
 * cannot overwrite each other.
 */
export class CombatUnitRenderer {
  private readonly entries = new Map<string, CombatRenderEntry>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly offset: IsoPoint,
  ) {}

  sync(units: ModularCombatUnit[]): void {
    const activeIds = new Set<string>();

    for (const unit of units) {
      activeIds.add(unit.id);
      const entry = this.getOrCreateEntry(unit.id);
      const entity = combatUnitToRenderableEntity(unit);
      const screen = tileToScreen(unit.tx, unit.ty);
      const anchor = {
        x: screen.x + this.offset.x,
        y: screen.y + this.offset.y,
      };
      const depth = computeDepthValue({
        id: unit.id,
        type: 'unit',
        tx: unit.tx,
        ty: unit.ty,
        offsetX: this.offset.x,
        offsetY: this.offset.y,
      });

      // Complete an earlier lazy-load attempt first. A dedicated adapter per
      // unit means the pending state cannot be overwritten by another unit.
      const retrySucceeded = entry.adapter.retryCleanModular();
      if (retrySucceeded) {
        entry.adapter.setNormalRuntimeDepth(unit.id, depth);
      }

      const legacyMod = unit.mod ?? 'm0';
      const result = entry.adapter.placeModularCombat(
        entity,
        anchor,
        unit.bodyId,
        unit.weaponId,
        unit.hullMod ?? legacyMod,
        unit.turretMod ?? legacyMod,
      );

      if (result.usedModular && ENABLE_MODULAR_VEHICLE_RENDER) {
        entry.adapter.setNormalRuntimeDepth(unit.id, depth);
        entry.placeholder.setVisible(false);
      } else {
        entry.adapter.setPendingDepth(depth);
        this.drawPlaceholder(entry.placeholder, anchor.x, anchor.y, depth);
      }
    }

    for (const [id, entry] of this.entries) {
      if (activeIds.has(id)) continue;
      entry.adapter.removeVehicle(id);
      entry.adapter.destroy();
      entry.placeholder.destroy();
      this.entries.delete(id);
    }
  }

  private getOrCreateEntry(id: string): CombatRenderEntry {
    const existing = this.entries.get(id);
    if (existing) return existing;

    const entry: CombatRenderEntry = {
      adapter: new ModularVehicleLiveAdapter(this.scene, this.offset, 100),
      placeholder: this.scene.add.graphics(),
    };
    this.entries.set(id, entry);
    return entry;
  }

  private drawPlaceholder(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    depth: number,
  ): void {
    graphics.clear();
    graphics.lineStyle(2, 0x9aa0a6, 0.9);
    graphics.fillStyle(0x555b63, 0.35);
    graphics.beginPath();
    graphics.moveTo(x, y - 12);
    graphics.lineTo(x + 22, y);
    graphics.lineTo(x, y + 12);
    graphics.lineTo(x - 22, y);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
    graphics.setDepth(depth - 0.3);
    graphics.setVisible(true);
  }

  destroy(): void {
    for (const [id, entry] of this.entries) {
      entry.adapter.removeVehicle(id);
      entry.adapter.destroy();
      entry.placeholder.destroy();
    }
    this.entries.clear();
  }
}
