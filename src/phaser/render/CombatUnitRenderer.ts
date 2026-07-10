import Phaser from 'phaser';
import type { ModularCombatUnit } from '../../state/types';
import {
  PRODUCTION_COMBAT_EXPLOSION_MS,
  PRODUCTION_COMBAT_WRECK_LIFETIME_MS,
} from '../../state/combatUnitCombat';
import { combatUnitToRenderableEntity, getCombatUnitPosition } from '../../state/combatUnits';
import { computeDepthValue } from './depthSorting';
import { tileToScreen, type IsoPoint } from './isometric';
import {
  ENABLE_MODULAR_VEHICLE_RENDER,
  ModularVehicleLiveAdapter,
} from './ModularVehicleLiveAdapter';

interface CombatRenderEntry {
  adapter: ModularVehicleLiveAdapter;
  placeholder: Phaser.GameObjects.Graphics;
  overlay: Phaser.GameObjects.Graphics;
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

  sync(units: ModularCombatUnit[], combatClockMs: number = 0): void {
    const activeIds = new Set<string>();

    for (const unit of units) {
      activeIds.add(unit.id);
      const entry = this.getOrCreateEntry(unit.id);
      const entity = combatUnitToRenderableEntity(unit);
      const position = getCombatUnitPosition(unit);
      const screen = tileToScreen(position.tx, position.ty);
      const anchor = {
        x: screen.x + this.offset.x,
        y: screen.y + this.offset.y,
      };
      const depth = computeDepthValue({
        id: unit.id,
        type: 'unit',
        tx: position.tx,
        ty: position.ty,
        offsetX: this.offset.x,
        offsetY: this.offset.y,
      });

      this.drawCombatOverlay(entry.overlay, unit, anchor.x, anchor.y, depth, combatClockMs);

      if (unit.runtime?.isDestroyed) {
        entry.adapter.removeVehicle(unit.id);
        entry.placeholder.setVisible(false);
        continue;
      }

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
      entry.overlay.destroy();
      this.entries.delete(id);
    }
  }

  private getOrCreateEntry(id: string): CombatRenderEntry {
    const existing = this.entries.get(id);
    if (existing) return existing;

    const entry: CombatRenderEntry = {
      adapter: new ModularVehicleLiveAdapter(this.scene, this.offset, 100),
      placeholder: this.scene.add.graphics(),
      overlay: this.scene.add.graphics(),
    };
    this.entries.set(id, entry);
    return entry;
  }

  private drawCombatOverlay(
    graphics: Phaser.GameObjects.Graphics,
    unit: ModularCombatUnit,
    x: number,
    y: number,
    depth: number,
    clock: number,
  ): void {
    graphics.clear();
    graphics.setDepth(depth + 20);
    const runtime = unit.runtime;
    if (!runtime) return;

    if (runtime.isDestroyed) {
      const age = runtime.destroyedAt === null ? 0 : Math.max(0, clock - runtime.destroyedAt);
      const fade = Math.max(0, 1 - age / PRODUCTION_COMBAT_WRECK_LIFETIME_MS);
      graphics.fillStyle(0x171717, 0.58 * fade);
      graphics.fillEllipse(x, y - 3, 42, 20);
      if (age < PRODUCTION_COMBAT_EXPLOSION_MS) {
        const t = age / PRODUCTION_COMBAT_EXPLOSION_MS;
        const alpha = 1 - t;
        graphics.fillStyle(0xffb020, 0.75 * alpha);
        graphics.fillCircle(x, y - 14, 7 + t * 16);
        graphics.lineStyle(2, 0xff6200, alpha);
        graphics.strokeCircle(x, y - 14, 12 + t * 23);
      }
      return;
    }

    const hpRatio = Math.max(0, Math.min(1, runtime.hp / runtime.maxHp));
    if (hpRatio < 0.999) {
      graphics.fillStyle(0x101010, 0.82);
      graphics.fillRect(x - 22, y - 38, 44, 6);
      graphics.fillStyle(hpRatio > 0.5 ? 0x63d66f : hpRatio > 0.25 ? 0xffc247 : 0xff5656, 0.95);
      graphics.fillRect(x - 21, y - 37, 42 * hpRatio, 4);
    }
    if (clock < runtime.damageFlashUntilMs) {
      graphics.lineStyle(3, 0xff4242, 0.9);
      graphics.strokeCircle(x, y - 8, 25);
    }
    if (clock < runtime.muzzleFlashUntilMs) {
      const angle = runtime.turretAngleDeg * Math.PI / 180;
      const mx = x + Math.cos(angle) * 34;
      const my = y - 10 + Math.sin(angle) * 34;
      graphics.lineStyle(4, unit.weaponId === 'railgun' ? 0x8cf8ff : 0xffd36a, 0.95);
      graphics.beginPath();
      graphics.moveTo(x + Math.cos(angle) * 16, y - 10 + Math.sin(angle) * 16);
      graphics.lineTo(mx, my);
      graphics.strokePath();
      graphics.fillStyle(0xffffff, 0.9);
      graphics.fillCircle(mx, my, 4);
    }
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
      entry.overlay.destroy();
    }
    this.entries.clear();
  }
}
