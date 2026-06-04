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
import { getWeaponConfig } from '../../config/weaponData';

// ─── Depth ──────────────────────────────────────────────────────────

/** HUD depth — above everything else. */
const HUD_DEPTH = 200;

// ─── Weapon resource status helper (CORE-STEP-08H+ FIXUP Blocker 5) ──

/**
 * Build weapon resource status lines for the HUD.
 * Shows canister level, overheat gauge, wind-up state, magazine/drum/reload state.
 */
function getWeaponResourceLines(vehicle: BlockoutVehicleState): string[] {
  const lines: string[] = [];
  const rt = vehicle.weaponRuntime;
  const cfg = getWeaponConfig(vehicle.weaponId);

  // M-level
  lines.push(`M${vehicle.modificationLevel}`);

  // Canister (Flamethrower, Freeze, Isida)
  if (rt.canister) {
    const capacity = cfg?.canister
      ? (cfg.canister.capacity[vehicle.modificationLevel] ?? cfg.canister.capacity[0])
      : 100;
    const pct = Math.round((rt.canister.current / capacity) * 100);
    const empty = rt.canister.isEmpty ? ' EMPTY' : '';
    lines.push(`Canister: ${pct}%${empty}`);
  }

  // Overheat (Vulcan)
  if (rt.overheat) {
    const maxHeat = cfg?.overheat?.maxHeat ?? 100;
    const pct = Math.round((rt.overheat.heat / maxHeat) * 100);
    const status = rt.overheat.isOverheated ? ' OVERHEATED' : rt.overheat.isSpunUp ? ' SPUN UP' : '';
    lines.push(`Heat: ${pct}%${status}`);
  }

  // Wind-up (Railgun)
  if (rt.windUp) {
    const state = rt.windUp.isReady ? 'READY' : rt.windUp.isCharging ? 'CHARGING' : 'idle';
    lines.push(`WindUp: ${state}`);
  }

  // Magazine (Ricochet)
  if (rt.magazine) {
    const stockSize = cfg?.magazine
      ? (cfg.magazine.stockSize[vehicle.modificationLevel] ?? cfg.magazine.stockSize[0])
      : 5;
    const empty = rt.magazine.isEmpty ? ' EMPTY' : '';
    lines.push(`Mag: ${Math.round(rt.magazine.currentStock)}/${stockSize}${empty}`);
  }

  // Drum (Hammer)
  if (rt.drum) {
    const volleyCount = cfg?.drum?.volleyCount ?? 5;
    if (rt.drum.isReloading) {
      lines.push(`Drum: RELOADING`);
    } else if (rt.drum.isBursting) {
      lines.push(`Drum: ${rt.drum.currentVolley}/${volleyCount} BURST`);
    } else {
      lines.push(`Drum: ${rt.drum.currentVolley}/${volleyCount}`);
    }
  }

  return lines;
}

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
  'C: Camera calibration overlay',
  'R: Reset scenario',
  'T: Cycle selected vehicle',
];

/** ARENA-04H+: Arena-specific help overlay lines. */
const ARENA_HELP_LINES = [
  '─── Arena Controls ───',
  'LMB click Ally: select',
  'LMB click Enemy: assign target',
  'RMB: move selected Ally',
  'Space/F: fire at target',
  'T: cycle selected ally',
  'H: toggle this help',
  'C: camera calibration overlay',
  '',
  '─── Arena Rules ───',
  'Allies are controllable',
  'Enemies are targets only',
  'Turret aims at target, not mouse',
  'No fire without target',
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

  /** ARENA-04H+: Whether Arena-specific help should be shown. */
  private _isArenaMode = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** ARENA-04H+: Set Arena mode for context-specific help. */
  setArenaMode(isArena: boolean): void {
    this._isArenaMode = isArena;
    // Re-create help text if it already exists so it picks up Arena lines
    if (this.helpText) {
      this.helpText.destroy();
      this.helpText = null;
    }
    // In Arena mode, default help overlay to hidden (ArenaMenu has its own help)
    if (isArena) {
      this.helpVisible = false;
    }
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

  /**
   * ARENA-04H+: Update with Arena context.
   * Same as syncFromState but also shows Arena-specific status.
   */
  syncFromStateArena(
    vehicles: BlockoutVehicleState[] | undefined,
    selectedVehicleId: string | null,
    targetVehicleId: string | null,
    nowMs: number,
  ): void {
    this.ensureHelpText();
    const selected = vehicles?.find(v => v.id === selectedVehicleId) ?? null;
    this.updateStatusPanelArena(selected, targetVehicleId, vehicles, nowMs);
  }

  // ─── Help overlay ────────────────────────────────────────────────

  private ensureHelpText(): void {
    if (!this.helpText) {
      const lines = this._isArenaMode ? ARENA_HELP_LINES : HELP_LINES;
      this.helpText = this.scene.add.text(8, 8, lines.join('\n'), {
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

  /**
   * ARENA-04H+: Update status panel with Arena context (target info).
   */
  private updateStatusPanelArena(
    vehicle: BlockoutVehicleState | null,
    targetVehicleId: string | null,
    vehicles: BlockoutVehicleState[] | undefined,
    nowMs: number,
  ): void {
    if (!vehicle) {
      if (this.statusText) this.statusText.setVisible(false);
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
      this.statusText.setScrollFactor(0);
      this.statusText.setOrigin(1, 0);
    }

    const lines: string[] = [];
    const teamLabel = vehicle.team === 'ally' ? 'ALLY' : 'ENEMY';
    lines.push(`[${teamLabel}] ${vehicle.bodyId} + ${vehicle.weaponId}`);

    if (vehicle.isDestroyed) {
      lines.push('DESTROYED');
    } else {
      lines.push(`HP: ${Math.round(vehicle.hp)} / ${vehicle.maxHp}`);
    }

    // Target info
    if (targetVehicleId && vehicles) {
      const target = vehicles.find(v => v.id === targetVehicleId);
      if (target) {
        const tLabel = target.isDestroyed ? 'DESTROYED' : `HP:${Math.round(target.hp)}`;
        lines.push(`Target: ${target.bodyId} ${tLabel}`);
      } else {
        lines.push('Target: lost');
      }
    } else {
      lines.push('No target');
    }

    // Movement
    if (!vehicle.isDestroyed) {
      lines.push(vehicle.hasMoveTarget ? 'moving' : 'stopped');
      const canFire = canFireBlockoutWeapon(vehicle, nowMs);
      lines.push(canFire ? 'ready' : 'cooldown');
      // CORE-STEP-08H+ FIXUP Blocker 5: Show weapon resource state
      lines.push(...getWeaponResourceLines(vehicle));
    }

    this.statusText.setText(lines.join('\n'));
    this.statusText.setVisible(true);
    const camera = this.scene.cameras.main;
    this.statusText.setPosition(camera.width - 8, 8);
  }

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
      // CORE-STEP-08H+ FIXUP Blocker 5: Show weapon resource state
      lines.push(...getWeaponResourceLines(vehicle));
    }

    this.statusText.setText(lines.join('\n'));
    this.statusText.setVisible(true);

    // Position: top-right corner of screen (scrollFactor=0 → screen-space)
    const camera = this.scene.cameras.main;
    const rightX = camera.width - 8;
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
