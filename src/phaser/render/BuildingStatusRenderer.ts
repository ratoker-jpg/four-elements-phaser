import Phaser from 'phaser';
import { tileToScreen, IsoPoint } from './isometric';
import { BUILDING_CONFIG } from '../../state/construction';
import {
  getSeparatorStatus,
  getFactoryStatus,
  separatorStatusLabel,
  factoryStatusLabel,
  type SeparatorStatus,
  type FactoryStatus,
} from '../../state/statusHelpers';
import type { GameState, SeparatorRuntimeState, UnitFactoryRuntimeState } from '../../state/types';
import { QUEUE_LIMIT } from '../../state/types';

/**
 * BuildingStatusRenderer — in-world status indicators for completed buildings.
 *
 * ARCH-07A: Renders progress bars and status text above separator and
 * units-factory buildings to make the production loop readable during
 * playtesting.
 *
 * Separator display:
 * - Progress bar showing current cycle progress (0–100%)
 * - Short status text (Processing / No Raw / Matter Full / etc.)
 *
 * Factory display:
 * - Progress bar showing current production item progress
 * - Queue slot indicators (filled/empty segments)
 * - Short status text (Builder 45% / Idle / Queue Full / etc.)
 *
 * Construction site display:
 * - Building type label above the existing progress bar
 *   (the progress bar itself is drawn by ConstructionRenderer)
 *
 * All indicators are rendered using Phaser Graphics for minimal overhead.
 * Text labels use Phaser Text objects for readability.
 */

// ─── Visual constants ──────────────────────────────────────────────

/** Progress bar dimensions. */
const BAR_WIDTH = 50;
const BAR_HEIGHT = 5;

/** Colors for separator progress bar. */
const SEP_BAR_BG = 0x333333;
const SEP_BAR_BG_ALPHA = 0.7;
const SEP_BAR_FILL = 0x44aaff;
const SEP_BAR_FILL_ALPHA = 0.9;

/** Colors for factory progress bar. */
const FACTORY_BAR_FILL = 0xffaa33;
const FACTORY_BAR_FILL_ALPHA = 0.9;

/** Queue slot indicator dimensions. */
const SLOT_WIDTH = 12;
const SLOT_HEIGHT = 5;
const SLOT_GAP = 2;
const SLOT_FILL_ACTIVE = 0xffcc00;
const SLOT_FILL_EMPTY = 0x444444;
const SLOT_ALPHA = 0.8;

/** Status text style. */
const STATUS_FONT_SIZE = '10px';
const STATUS_COLOR_OK = '#66bbff';     // blue for processing
const STATUS_COLOR_BLOCKED = '#ff8866'; // red-orange for blocked
const STATUS_COLOR_IDLE = '#999999';    // gray for idle
const STATUS_COLOR_PRODUCING = '#ffcc44'; // yellow for producing

/** Y offset above building center for status indicators. */
const STATUS_Y_OFFSET = -35;

/** Building type display labels. */
const BUILDING_TYPE_LABELS: Record<string, string> = {
  'separator': 'Separator',
  'power-plant': 'Power Plant',
  'units-factory': 'Factory',
  'raw-storage': 'Raw Storage',
  'matter-storage': 'Matter Storage',
  'command-relay': 'Command Relay',
};

export class BuildingStatusRenderer {
  private scene: Phaser.Scene;
  private offset: IsoPoint;

  /** Graphics objects for separator progress bars keyed by `${tx},${ty}`. */
  private separatorGraphics = new Map<string, Phaser.GameObjects.Graphics>();

  /** Text objects for separator status keyed by `${tx},${ty}`. */
  private separatorTexts = new Map<string, Phaser.GameObjects.Text>();

  /** Graphics objects for factory progress bars keyed by `${tx},${ty}`. */
  private factoryGraphics = new Map<string, Phaser.GameObjects.Graphics>();

  /** Text objects for factory status keyed by `${tx},${ty}`. */
  private factoryTexts = new Map<string, Phaser.GameObjects.Text>();

  /** Text objects for construction site type labels keyed by site numeric ID. */
  private constructionLabels = new Map<number, Phaser.GameObjects.Text>();

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.scene = scene;
    this.offset = offset;
  }

  // ─── Frame sync ────────────────────────────────────────────────

  /** Sync all building status indicators from current GameState. */
  syncFromState(state: GameState): void {
    this.syncSeparators(state);
    this.syncFactories(state);
    this.syncConstructionLabels(state);
  }

  // ─── Separator status ─────────────────────────────────────────

  private syncSeparators(state: GameState): void {
    const activeKeys = new Set<string>();

    for (const sep of state.economy.separators) {
      const key = `${sep.tx},${sep.ty}`;
      activeKeys.add(key);

      const status = getSeparatorStatus(state, sep);
      const centerPos = this.getBuildingCenter(sep.tx, sep.ty, 'separator');

      // Ensure graphics and text exist
      if (!this.separatorGraphics.has(key)) {
        const g = this.scene.add.graphics();
        g.setDepth(200);
        this.separatorGraphics.set(key, g);
      }
      if (!this.separatorTexts.has(key)) {
        const t = this.scene.add.text(0, 0, '', {
          fontSize: STATUS_FONT_SIZE,
          fontFamily: 'monospace',
          color: STATUS_COLOR_OK,
          align: 'center',
        });
        t.setOrigin(0.5, 0.5);
        t.setDepth(201);
        this.separatorTexts.set(key, t);
      }

      // Redraw progress bar
      const g = this.separatorGraphics.get(key)!;
      g.clear();
      this.drawSeparatorBar(g, centerPos.x, centerPos.y + STATUS_Y_OFFSET, sep, status);

      // Update status text
      const t = this.separatorTexts.get(key)!;
      const label = separatorStatusLabel(status);
      t.setText(label);
      t.setPosition(centerPos.x, centerPos.y + STATUS_Y_OFFSET - 10);
      t.setColor(this.statusColor(status));
    }

    // Clean up removed separators
    for (const [key, g] of this.separatorGraphics) {
      if (!activeKeys.has(key)) {
        g.destroy();
        this.separatorGraphics.delete(key);
      }
    }
    for (const [key, t] of this.separatorTexts) {
      if (!activeKeys.has(key)) {
        t.destroy();
        this.separatorTexts.delete(key);
      }
    }
  }

  private drawSeparatorBar(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    sep: SeparatorRuntimeState,
    status: SeparatorStatus,
  ): void {
    const barLeft = cx - BAR_WIDTH / 2;
    const barTop = cy - BAR_HEIGHT / 2;

    // Background
    g.fillStyle(SEP_BAR_BG, SEP_BAR_BG_ALPHA);
    g.fillRect(barLeft, barTop, BAR_WIDTH, BAR_HEIGHT);

    // Fill (only if processing)
    if (status === 'processing' && sep.progress > 0) {
      const fillWidth = BAR_WIDTH * Math.min(sep.progress, 1);
      // ARCH-13B: Active separator gets a subtle pulse on the fill
      const pulse = sep.active ? 0.15 * Math.sin(Date.now() / 600 * Math.PI * 2) : 0;
      g.fillStyle(SEP_BAR_FILL, SEP_BAR_FILL_ALPHA + pulse);
      g.fillRect(barLeft, barTop, fillWidth, BAR_HEIGHT);
    }

    // Border
    g.lineStyle(1, 0x666666, 0.5);
    g.strokeRect(barLeft, barTop, BAR_WIDTH, BAR_HEIGHT);

    // ARCH-13B: Active separator glow pulse
    if (sep.active) {
      const glowPulse = 0.2 + 0.2 * Math.sin(Date.now() / 500 * Math.PI * 2);
      g.lineStyle(1, SEP_BAR_FILL, glowPulse);
      g.strokeRect(barLeft - 1, barTop - 1, BAR_WIDTH + 2, BAR_HEIGHT + 2);
    }
  }

  // ─── Factory status ───────────────────────────────────────────

  private syncFactories(state: GameState): void {
    const activeKeys = new Set<string>();

    for (const factory of state.production.factories) {
      const key = `${factory.tx},${factory.ty}`;
      activeKeys.add(key);

      const status = getFactoryStatus(state, factory);
      const centerPos = this.getBuildingCenter(factory.tx, factory.ty, 'units-factory');

      // Ensure graphics and text exist
      if (!this.factoryGraphics.has(key)) {
        const g = this.scene.add.graphics();
        g.setDepth(200);
        this.factoryGraphics.set(key, g);
      }
      if (!this.factoryTexts.has(key)) {
        const t = this.scene.add.text(0, 0, '', {
          fontSize: STATUS_FONT_SIZE,
          fontFamily: 'monospace',
          color: STATUS_COLOR_PRODUCING,
          align: 'center',
        });
        t.setOrigin(0.5, 0.5);
        t.setDepth(201);
        this.factoryTexts.set(key, t);
      }

      // Redraw progress bar + queue slots
      const g = this.factoryGraphics.get(key)!;
      g.clear();
      this.drawFactoryBar(g, centerPos.x, centerPos.y + STATUS_Y_OFFSET, factory, status);

      // Update status text
      const t = this.factoryTexts.get(key)!;
      const label = this.factoryDisplayLabel(factory, status);
      t.setText(label);
      t.setPosition(centerPos.x, centerPos.y + STATUS_Y_OFFSET - 10);
      t.setColor(this.factoryStatusColor(status));
    }

    // Clean up removed factories
    for (const [key, g] of this.factoryGraphics) {
      if (!activeKeys.has(key)) {
        g.destroy();
        this.factoryGraphics.delete(key);
      }
    }
    for (const [key, t] of this.factoryTexts) {
      if (!activeKeys.has(key)) {
        t.destroy();
        this.factoryTexts.delete(key);
      }
    }
  }

  private drawFactoryBar(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    factory: UnitFactoryRuntimeState,
    _status: FactoryStatus,
  ): void {
    const barLeft = cx - BAR_WIDTH / 2;
    const barTop = cy - BAR_HEIGHT / 2;

    // Progress bar background
    g.fillStyle(SEP_BAR_BG, SEP_BAR_BG_ALPHA);
    g.fillRect(barLeft, barTop, BAR_WIDTH, BAR_HEIGHT);

    // Fill (if producing)
    const activeItem = factory.queue.find(item => !item.completed);
    if (activeItem && factory.active) {
      const fillWidth = BAR_WIDTH * Math.min(activeItem.progress, 1);
      g.fillStyle(FACTORY_BAR_FILL, FACTORY_BAR_FILL_ALPHA);
      g.fillRect(barLeft, barTop, fillWidth, BAR_HEIGHT);
    }

    // Border
    g.lineStyle(1, 0x666666, 0.5);
    g.strokeRect(barLeft, barTop, BAR_WIDTH, BAR_HEIGHT);

    // Queue slot indicators below the progress bar
    const slotsY = barTop + BAR_HEIGHT + 3;
    const totalSlotsWidth = QUEUE_LIMIT * SLOT_WIDTH + (QUEUE_LIMIT - 1) * SLOT_GAP;
    const slotsStartX = cx - totalSlotsWidth / 2;

    for (let i = 0; i < QUEUE_LIMIT; i++) {
      const slotX = slotsStartX + i * (SLOT_WIDTH + SLOT_GAP);
      const filled = i < factory.queue.length;
      g.fillStyle(filled ? SLOT_FILL_ACTIVE : SLOT_FILL_EMPTY, SLOT_ALPHA);
      g.fillRect(slotX, slotsY, SLOT_WIDTH, SLOT_HEIGHT);
      g.lineStyle(1, 0x888888, 0.4);
      g.strokeRect(slotX, slotsY, SLOT_WIDTH, SLOT_HEIGHT);
    }

    // ARCH-13B: Active factory glow pulse
    if (factory.active) {
      const glowPulse = 0.2 + 0.2 * Math.sin(Date.now() / 500 * Math.PI * 2);
      g.lineStyle(1, FACTORY_BAR_FILL, glowPulse);
      g.strokeRect(barLeft - 1, barTop - 1, BAR_WIDTH + 2, BAR_HEIGHT + 2);
    }
  }

  private factoryDisplayLabel(factory: UnitFactoryRuntimeState, status: FactoryStatus): string {
    const baseLabel = factoryStatusLabel(status);
    const activeItem = factory.queue.find(item => !item.completed);

    if ((status === 'producing-builder' || status === 'producing-harvester') && activeItem) {
      const pct = Math.round(activeItem.progress * 100);
      return `${baseLabel} ${pct}%`;
    }

    return baseLabel;
  }

  // ─── Construction site type labels ──────────────────────────────

  private syncConstructionLabels(state: GameState): void {
    const activeIds = new Set<number>();

    for (const site of state.mapData.constructionSites) {
      activeIds.add(site.id);

      if (!this.constructionLabels.has(site.id)) {
        const centerPos = this.getBuildingCenter(site.tx, site.ty, site.type);
        const t = this.scene.add.text(
          centerPos.x,
          centerPos.y + STATUS_Y_OFFSET - 20,
          BUILDING_TYPE_LABELS[site.type] ?? site.type,
          {
            fontSize: '10px',
            fontFamily: 'monospace',
            color: '#ffcc66',
            align: 'center',
          },
        );
        t.setOrigin(0.5, 0.5);
        t.setDepth(201);
        this.constructionLabels.set(site.id, t);
      }
    }

    // Clean up completed/removed sites
    for (const [id, t] of this.constructionLabels) {
      if (!activeIds.has(id)) {
        t.destroy();
        this.constructionLabels.delete(id);
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  /** Get the screen center of a building footprint. */
  private getBuildingCenter(tx: number, ty: number, buildingType: string): { x: number; y: number } {
    const config = BUILDING_CONFIG[buildingType as keyof typeof BUILDING_CONFIG];
    const fpW = config?.footprintW ?? 1;
    const fpH = config?.footprintH ?? 1;

    // Center of the footprint
    const centerScreen = tileToScreen(tx + fpW / 2, ty + fpH / 2);
    return {
      x: centerScreen.x + this.offset.x,
      y: centerScreen.y + this.offset.y,
    };
  }

  /** Get display color for separator status. */
  private statusColor(status: SeparatorStatus): string {
    switch (status) {
      case 'processing': return STATUS_COLOR_OK;
      case 'idle': return STATUS_COLOR_IDLE;
      default: return STATUS_COLOR_BLOCKED; // all blocked-* statuses
    }
  }

  /** Get display color for factory status. */
  private factoryStatusColor(status: FactoryStatus): string {
    switch (status) {
      case 'producing-builder':
      case 'producing-harvester':
        return STATUS_COLOR_PRODUCING;
      case 'idle': return STATUS_COLOR_IDLE;
      default: return STATUS_COLOR_BLOCKED; // all blocked-* statuses
    }
  }

  // ─── Cleanup ───────────────────────────────────────────────────

  destroy(): void {
    for (const g of this.separatorGraphics.values()) g.destroy();
    this.separatorGraphics.clear();
    for (const t of this.separatorTexts.values()) t.destroy();
    this.separatorTexts.clear();
    for (const g of this.factoryGraphics.values()) g.destroy();
    this.factoryGraphics.clear();
    for (const t of this.factoryTexts.values()) t.destroy();
    this.factoryTexts.clear();
    for (const t of this.constructionLabels.values()) t.destroy();
    this.constructionLabels.clear();
  }
}
