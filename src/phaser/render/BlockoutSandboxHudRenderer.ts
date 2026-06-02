/**
 * BlockoutSandboxHudRenderer — dev-only help/legend overlay and selected vehicle status panel.
 *
 * BLOCKOUT-10H+: Dev/arena-only combat readability QA overlay.
 *
 * Uses Phaser text objects only (no DOM, no assets).
 * - Help/legend overlay: top-left corner, toggled by H key (default: visible)
 * - Selected vehicle status: top-right corner, only visible when a vehicle is selected
 *
 * This is a dev-only overlay — not persisted in saves, not part of production.
 */

import Phaser from 'phaser';
import type { BlockoutVehicleState } from '../../state/blockoutVehicleState';
import { ALL_UPGRADE_IDS, UPGRADE_PROFILES } from '../../config/blockoutUpgradeData';
import { canFireBlockoutWeapon } from '../../state/blockoutWeaponVfx';

// ─── Depth ──────────────────────────────────────────────────────────

/** HUD depth — above everything else. */
const HUD_DEPTH = 200;

// ─── Help overlay lines ─────────────────────────────────────────────

const HELP_LINES = [
  '─── Controls ───',
  'LMB: Select',
  'RMB: Move',
  'Mouse: Aim',
  'Space/F: Fire',
  'U/1: Mobility upgrade',
  'I/2: Armor upgrade',
  'O/3: Weapon upgrade',
  'P/4: Range upgrade',
  'B/5: Cooling upgrade',
  'H: Toggle this help',
  'R: Reset scenario',
  'T: Cycle selected vehicle',
];

// ─── Renderer ──────────────────────────────────────────────────────

export class BlockoutSandboxHudRenderer {
  private scene: Phaser.Scene;

  /** Help overlay text object. */
  private helpText: Phaser.GameObjects.Text | null = null;

  /** Status panel text object. */
  private statusText: Phaser.GameObjects.Text | null = null;

  /** Whether help overlay is visible. */
  private helpVisible = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ─── Public API ──────────────────────────────────────────────────

  /** Toggle help overlay visibility. Returns new state. */
  toggleHelp(): boolean {
    this.helpVisible = !this.helpVisible;
    if (this.helpText) {
      this.helpText.setVisible(this.helpVisible);
    }
    return this.helpVisible;
  }

  /** Whether help overlay is currently visible. */
  isHelpVisible(): boolean {
    return this.helpVisible;
  }

  /**
   * Update HUD each frame.
   *
   * @param vehicles - Current blockout vehicles
   * @param selectedVehicleId - Currently selected vehicle ID (or null)
   * @param nowMs - Current scene time (for cooldown calculation)
   */
  syncFromState(
    vehicles: BlockoutVehicleState[] | undefined,
    selectedVehicleId: string | null,
    nowMs: number,
  ): void {
    // ── Help overlay ──
    this.ensureHelpText();

    // ── Status panel ──
    const selected = vehicles?.find(v => v.id === selectedVehicleId) ?? null;
    this.updateStatusPanel(selected, nowMs);
  }

  // ─── Help overlay ────────────────────────────────────────────────

  private ensureHelpText(): void {
    if (!this.helpText) {
      this.helpText = this.scene.add.text(8, 8, HELP_LINES.join('\n'), {
        fontSize: '10px',
        color: '#cccccc',
        backgroundColor: '#000000aa',
        padding: { x: 6, y: 4 },
        lineSpacing: 2,
      });
      this.helpText.setDepth(HUD_DEPTH);
      this.helpText.setScrollFactor(0); // Fixed to camera
      this.helpText.setVisible(this.helpVisible);
    }
  }

  // ─── Status panel ────────────────────────────────────────────────

  private updateStatusPanel(vehicle: BlockoutVehicleState | null, nowMs: number): void {
    if (!vehicle) {
      // No vehicle selected — hide status panel
      if (this.statusText) {
        this.statusText.setVisible(false);
      }
      return;
    }

    if (!this.statusText) {
      this.statusText = this.scene.add.text(0, 8, '', {
        fontSize: '10px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 6, y: 4 },
        lineSpacing: 2,
        align: 'left',
      });
      this.statusText.setDepth(HUD_DEPTH);
      this.statusText.setScrollFactor(0); // Fixed to camera
      this.statusText.setOrigin(1, 0); // Right-aligned
    }

    const lines: string[] = [];

    // Vehicle name
    lines.push(`${vehicle.bodyId} + ${vehicle.weaponId}`);

    // HP
    if (vehicle.isDestroyed) {
      lines.push('DESTROYED');
    } else {
      lines.push(`HP: ${Math.round(vehicle.hp)} / ${vehicle.maxHp}`);
    }

    // Upgrade levels
    const upgradeParts: string[] = [];
    for (const id of ALL_UPGRADE_IDS) {
      const level = vehicle.upgradeLevels[id] ?? 0;
      const profile = UPGRADE_PROFILES[id];
      const label = profile?.marker.label ?? id.substring(0, 3).toUpperCase();
      upgradeParts.push(`${label}:${level}`);
    }
    lines.push(upgradeParts.join(' '));

    // Movement state
    if (vehicle.isDestroyed) {
      // No movement info for destroyed
    } else if (vehicle.hasMoveTarget) {
      lines.push('moving');
    } else {
      lines.push('stopped');
    }

    // Fire/cooldown state
    if (!vehicle.isDestroyed) {
      const canFire = canFireBlockoutWeapon(vehicle, nowMs);
      lines.push(canFire ? 'ready' : 'cooldown');
    }

    this.statusText.setText(lines.join('\n'));
    this.statusText.setVisible(true);

    // Position: top-right corner of camera view
    const camera = this.scene.cameras.main;
    const rightX = camera.scrollX + camera.width - 8;
    this.statusText.setPosition(rightX, 8);
  }

  // ─── Cleanup ──────────────────────────────────────────────────────

  destroy(): void {
    if (this.helpText) {
      this.helpText.destroy();
      this.helpText = null;
    }
    if (this.statusText) {
      this.statusText.destroy();
      this.statusText = null;
    }
  }
}
