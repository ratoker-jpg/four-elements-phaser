/**
 * BlockoutUpgradeRenderer — renders upgrade visual indicators on blockout vehicles.
 *
 * BLOCKOUT-09H: Dev/arena-only upgrade skeleton and visual indicators.
 *
 * Uses Phaser Graphics primitives only:
 * - no PNG
 * - no asset manifest
 * - no generated manifest
 * - no final art
 *
 * Each upgrade type has a distinct visual marker:
 * - mobility_boost: cyan/blue speed arcs around vehicle body edges
 * - armor_plating: gray/white L-brackets on body corners
 * - weapon_tuning: red/orange glow dot near barrel tip
 * - range_extender: purple/green range circle for selected vehicle
 * - cooling_system: teal dots near turret base
 *
 * Only active when devtools is active.
 * Upgrade state is dev/arena-only, not persisted in saves.
 */

import Phaser from 'phaser';
import type { IsoPoint } from './isometric';
import type { BlockoutVehicleState } from '../../state/blockoutVehicleState';
import { UPGRADE_PROFILES, ALL_UPGRADE_IDS } from '../../config/blockoutUpgradeData';
import { getBodyPixelSize, computeBodyWorldCenter, computeTurretWorldOrigin } from './blockoutVehicleGeometry';
import { getRangeMultiplier } from '../../state/blockoutUpgrades';
import { getWeaponProfile } from '../../config/blockoutWeaponData';

// ─── Visual constants ──────────────────────────────────────────────

/** Depth for upgrade markers (above vehicles at depth 120). */
const UPGRADE_DEPTH = 130;

/** Debug label color. */
const DEBUG_LABEL_COLOR = '#dddddd';

/** Arc radius offset from body edge for mobility arcs. */
const ARC_RADIUS_OFFSET = 3;

/** L-bracket arm length for armor. */
const BRACKET_ARM = 6;

/** Glow dot radius for weapon tuning. */
const GLOW_DOT_RADIUS = 3;

/** Cooling dot radius. */
const COOL_DOT_RADIUS = 2;

/** Cooling dot count per level. */
const COOL_DOTS_PER_LEVEL = 2;

/** Range circle alpha. */
const RANGE_CIRCLE_ALPHA = 0.3;

/** Range circle line width. */
const RANGE_CIRCLE_LINE_WIDTH = 1.5;

// ─── Renderer ──────────────────────────────────────────────────────

export class BlockoutUpgradeRenderer {
  private scene: Phaser.Scene;
  private offset: IsoPoint;

  /** Graphics objects keyed by vehicle ID. */
  private graphics = new Map<string, Phaser.GameObjects.Graphics>();

  /** Debug text labels keyed by vehicle ID. */
  private debugLabels = new Map<string, Phaser.GameObjects.Text>();

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.scene = scene;
    this.offset = offset;
  }

  // ─── Frame sync ──────────────────────────────────────────────────

  /**
   * Sync upgrade rendering from current vehicle state.
   * Called each frame. Destroys stale graphics, creates new ones for new vehicles.
   *
   * @param vehicles - All blockout vehicles
   * @param selectedVehicleId - Currently selected vehicle ID (for range circle)
   */
  syncFromState(vehicles: BlockoutVehicleState[], selectedVehicleId: string | null): void {
    const activeIds = new Set<string>();

    for (const vehicle of vehicles) {
      // Skip destroyed vehicles or vehicles with no upgrades
      if (vehicle.isDestroyed) continue;
      if (!this.hasAnyUpgrade(vehicle)) continue;

      activeIds.add(vehicle.id);

      let g = this.graphics.get(vehicle.id);
      if (!g) {
        g = this.scene.add.graphics();
        g.setDepth(UPGRADE_DEPTH);
        this.graphics.set(vehicle.id, g);
      }

      // Redraw upgrade markers for this vehicle
      this.renderUpgradeMarkers(g, vehicle, vehicle.id === selectedVehicleId);

      // Debug label with upgrade info
      let label = this.debugLabels.get(vehicle.id);
      if (!label) {
        label = this.scene.add.text(0, 0, '', {
          fontSize: '8px',
          color: DEBUG_LABEL_COLOR,
          backgroundColor: '#00000088',
          padding: { x: 2, y: 1 },
        });
        label.setDepth(UPGRADE_DEPTH + 1);
        label.setOrigin(0.5, 0);
        this.debugLabels.set(vehicle.id, label);
      }

      // Build debug label text: "SPD:2 ARM:1" etc.
      const parts: string[] = [];
      for (const id of ALL_UPGRADE_IDS) {
        const level = vehicle.upgradeLevels[id] ?? 0;
        if (level > 0) {
          const profile = UPGRADE_PROFILES[id];
          parts.push(`${profile.marker.label}:${level}`);
        }
      }
      label.setText(parts.join(' '));

      // Position label below vehicle body
      const bodyCenter = computeBodyWorldCenter(vehicle, this.offset);
      const bodySize = getBodyPixelSize(vehicle.bodyId);
      label.setPosition(bodyCenter.x, bodyCenter.y + bodySize.h / 2 + 3);
    }

    // Clean up stale vehicles
    for (const [id, g] of this.graphics) {
      if (!activeIds.has(id)) {
        g.destroy();
        this.graphics.delete(id);
      }
    }
    for (const [id, label] of this.debugLabels) {
      if (!activeIds.has(id)) {
        label.destroy();
        this.debugLabels.delete(id);
      }
    }
  }

  // ─── Upgrade check ──────────────────────────────────────────────

  private hasAnyUpgrade(vehicle: BlockoutVehicleState): boolean {
    for (const id of ALL_UPGRADE_IDS) {
      if ((vehicle.upgradeLevels[id] ?? 0) > 0) return true;
    }
    return false;
  }

  // ─── Rendering ──────────────────────────────────────────────────

  private renderUpgradeMarkers(
    g: Phaser.GameObjects.Graphics,
    vehicle: BlockoutVehicleState,
    isSelected: boolean,
  ): void {
    g.clear();

    const bodyCenter = computeBodyWorldCenter(vehicle, this.offset);
    const bodySize = getBodyPixelSize(vehicle.bodyId);
    const halfW = bodySize.w / 2;
    const halfH = bodySize.h / 2;
    const cosA = Math.cos(vehicle.bodyAngle);
    const sinA = Math.sin(vehicle.bodyAngle);

    // Mobility boost: cyan/blue speed arcs around body edges
    const mobilityLevel = vehicle.upgradeLevels.mobility_boost ?? 0;
    if (mobilityLevel > 0) {
      const profile = UPGRADE_PROFILES.mobility_boost;
      const color = profile.marker.color;
      const outlineColor = profile.marker.outlineColor;
      const arcRadius = Math.max(halfW, halfH) + ARC_RADIUS_OFFSET;

      // Draw small arcs at body corners (speed indicator arcs)
      g.lineStyle(1.5 + mobilityLevel * 0.5, color, 0.7 + mobilityLevel * 0.1);

      // Front-left and front-right arcs
      for (let i = 0; i < mobilityLevel + 1; i++) {
        const startAngle = vehicle.bodyAngle - Math.PI / 3 - i * 0.2;
        const endAngle = vehicle.bodyAngle - Math.PI / 6 + i * 0.1;
        g.beginPath();
        g.arc(bodyCenter.x, bodyCenter.y, arcRadius + i * 2, startAngle, endAngle, false);
        g.strokePath();

        // Mirror on other side
        const startAngle2 = vehicle.bodyAngle + Math.PI / 6 - i * 0.1;
        const endAngle2 = vehicle.bodyAngle + Math.PI / 3 + i * 0.2;
        g.beginPath();
        g.arc(bodyCenter.x, bodyCenter.y, arcRadius + i * 2, startAngle2, endAngle2, false);
        g.strokePath();
      }

      // Outline arcs
      g.lineStyle(1, outlineColor, 0.5);
      const startOutline = vehicle.bodyAngle - Math.PI / 3;
      const endOutline = vehicle.bodyAngle + Math.PI / 3;
      g.beginPath();
      g.arc(bodyCenter.x, bodyCenter.y, arcRadius + mobilityLevel * 2 + 2, startOutline, endOutline, false);
      g.strokePath();
    }

    // Armor plating: gray/white L-brackets on body corners
    const armorLevel = vehicle.upgradeLevels.armor_plating ?? 0;
    if (armorLevel > 0) {
      const profile = UPGRADE_PROFILES.armor_plating;
      const color = profile.marker.color;
      const outlineColor = profile.marker.outlineColor;

      // Four corners in body-local space
      const corners = [
        { lx: -halfW, ly: -halfH }, // top-left
        { lx: halfW, ly: -halfH },  // top-right
        { lx: halfW, ly: halfH },   // bottom-right
        { lx: -halfW, ly: halfH },  // bottom-left
      ];

      // Bracket directions: which way the L points for each corner
      const bracketDirs = [
        { dx: 1, dy: 1 },   // top-left: right+down
        { dx: -1, dy: 1 },  // top-right: left+down
        { dx: -1, dy: -1 }, // bottom-right: left+up
        { dx: 1, dy: -1 },  // bottom-left: right+up
      ];

      const armLen = BRACKET_ARM + armorLevel;

      g.lineStyle(1.5 + armorLevel * 0.3, color, 0.9);
      for (let i = 0; i < corners.length; i++) {
        const corner = corners[i];
        const dir = bracketDirs[i];

        // Rotate corner from body-local to world space
        const wx = bodyCenter.x + corner.lx * cosA - corner.ly * sinA;
        const wy = bodyCenter.y + corner.lx * sinA + corner.ly * cosA;

        // Bracket arms in world space (rotated)
        const armX = dir.dx * cosA - dir.dy * sinA;
        const armY = dir.dx * sinA + dir.dy * cosA;
        const armX2 = dir.dy * cosA - (-dir.dx) * sinA;
        const armY2 = dir.dy * sinA + (-dir.dx) * cosA;

        // Draw L-bracket
        g.beginPath();
        g.moveTo(wx + armX * armLen, wy + armY * armLen);
        g.lineTo(wx, wy);
        g.lineTo(wx + armX2 * armLen, wy + armY2 * armLen);
        g.strokePath();
      }

      // Outline brackets
      g.lineStyle(1, outlineColor, 0.4);
      for (let i = 0; i < corners.length; i++) {
        const corner = corners[i];
        const dir = bracketDirs[i];
        const wx = bodyCenter.x + corner.lx * cosA - corner.ly * sinA;
        const wy = bodyCenter.y + corner.lx * sinA + corner.ly * cosA;
        const armX = dir.dx * cosA - dir.dy * sinA;
        const armY = dir.dx * sinA + dir.dy * cosA;
        const armX2 = dir.dy * cosA - (-dir.dx) * sinA;
        const armY2 = dir.dy * sinA + (-dir.dx) * cosA;
        const outerArm = armLen + 1;
        g.beginPath();
        g.moveTo(wx + armX * outerArm, wy + armY * outerArm);
        g.lineTo(wx, wy);
        g.lineTo(wx + armX2 * outerArm, wy + armY2 * outerArm);
        g.strokePath();
      }
    }

    // Weapon tuning: red/orange glow dot near barrel tip
    const weaponLevel = vehicle.upgradeLevels.weapon_tuning ?? 0;
    if (weaponLevel > 0) {
      const profile = UPGRADE_PROFILES.weapon_tuning;
      const color = profile.marker.color;
      const outlineColor = profile.marker.outlineColor;

      const turretOrigin = computeTurretWorldOrigin(vehicle, this.offset);
      const weaponProfile = getWeaponProfile(vehicle.weaponId);
      const barrelLength = weaponProfile ? weaponProfile.blockoutBarrelLength : 12;
      const turretSizeW = 10; // matches BlockoutVehicleRenderer
      const totalBarrelLength = turretSizeW / 2 + barrelLength;

      // Barrel tip position
      const barrelTipX = turretOrigin.x + Math.cos(vehicle.turretAngle) * totalBarrelLength;
      const barrelTipY = turretOrigin.y + Math.sin(vehicle.turretAngle) * totalBarrelLength;

      // Glow dot: filled circle with alpha based on level
      const radius = GLOW_DOT_RADIUS + weaponLevel;
      g.fillStyle(color, 0.6 + weaponLevel * 0.15);
      g.fillCircle(barrelTipX, barrelTipY, radius);

      // Outer glow
      g.fillStyle(color, 0.2);
      g.fillCircle(barrelTipX, barrelTipY, radius + 2);

      // Outline
      g.lineStyle(1, outlineColor, 0.6);
      g.strokeCircle(barrelTipX, barrelTipY, radius);
    }

    // Range extender: purple/green range circle for selected vehicle
    const rangeLevel = vehicle.upgradeLevels.range_extender ?? 0;
    if (rangeLevel > 0 && isSelected) {
      const profile = UPGRADE_PROFILES.range_extender;
      const color = profile.marker.color;
      const outlineColor = profile.marker.outlineColor;

      // Compute effective range
      const weaponProfile = getWeaponProfile(vehicle.weaponId);
      const baseRange = weaponProfile?.blockoutRangePx ?? 200;
      const rangeMultiplier = getRangeMultiplier(vehicle);
      const effectiveRange = baseRange * rangeMultiplier;

      // Draw range circle from turret origin
      const turretOrigin = computeTurretWorldOrigin(vehicle, this.offset);

      g.lineStyle(RANGE_CIRCLE_LINE_WIDTH, color, RANGE_CIRCLE_ALPHA);
      g.strokeCircle(turretOrigin.x, turretOrigin.y, effectiveRange);

      // Inner outline
      g.lineStyle(1, outlineColor, RANGE_CIRCLE_ALPHA * 0.6);
      g.strokeCircle(turretOrigin.x, turretOrigin.y, effectiveRange);

      // Subtle fill
      g.fillStyle(color, 0.04);
      g.fillCircle(turretOrigin.x, turretOrigin.y, effectiveRange);
    }

    // Cooling system: teal dots near turret base
    const coolingLevel = vehicle.upgradeLevels.cooling_system ?? 0;
    if (coolingLevel > 0) {
      const profile = UPGRADE_PROFILES.cooling_system;
      const color = profile.marker.color;
      const outlineColor = profile.marker.outlineColor;

      const turretOrigin = computeTurretWorldOrigin(vehicle, this.offset);
      const dotCount = COOL_DOTS_PER_LEVEL * coolingLevel;

      // Place dots in a small arc behind the turret origin
      for (let i = 0; i < dotCount; i++) {
        const fraction = dotCount > 1 ? i / (dotCount - 1) : 0.5;
        const arcAngle = vehicle.turretAngle + Math.PI - 0.5 + fraction * 1.0;
        const dist = 5 + (i % 2) * 2;
        const dotX = turretOrigin.x + Math.cos(arcAngle) * dist;
        const dotY = turretOrigin.y + Math.sin(arcAngle) * dist;

        g.fillStyle(color, 0.8);
        g.fillCircle(dotX, dotY, COOL_DOT_RADIUS);

        g.lineStyle(0.5, outlineColor, 0.5);
        g.strokeCircle(dotX, dotY, COOL_DOT_RADIUS);
      }
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────

  destroy(): void {
    for (const [, g] of this.graphics) {
      g.destroy();
    }
    this.graphics.clear();

    for (const [, label] of this.debugLabels) {
      label.destroy();
    }
    this.debugLabels.clear();
  }
}
