/**
 * UnitMotionFxRenderer — render-only movement dust particles for units.
 *
 * ARCH-13C-LITE: Emits subtle dust particles behind moving units.
 * Uses Phaser Graphics circles with automatic fade-out — no image assets required.
 *
 * Design decisions:
 * - Single shared Graphics object redrawn each frame (same pattern as FeedbackRenderer).
 * - Particle lifetime tracked via creation timestamp + now, not accumulated delta.
 * - Movement detection uses tile-position delta (same pattern as direction facing).
 * - Dust only when moving; stationary units emit nothing.
 * - Maximum particle cap prevents unbounded growth.
 * - No Phaser particle system — Graphics circles are simpler and sufficient for MVP.
 *
 * Lifecycle:
 * - Created by GameScene in create().
 * - Updated each frame via syncFromState().
 * - Destroyed in GameScene shutdown() or scene restart.
 */

import Phaser from 'phaser';
import { tileToScreen, type IsoPoint } from './isometric';
import {
  isMoving,
  getDustProfile,
  computeDustAlpha,
  computeDustRadius,
} from '../../state/motionFx';
import type { GameState, HarvesterState, BuilderPlacement } from '../../state/types';

// ─── Dust particle structure ──────────────────────────────────────

interface DustParticle {
  /** World X position. */
  x: number;
  /** World Y position. */
  y: number;
  /** Base radius in pixels. */
  baseRadius: number;
  /** Maximum alpha (before fade). */
  alphaMax: number;
  /** Total lifetime in milliseconds. */
  lifetimeMs: number;
  /** Creation timestamp (scene.time.now). */
  createdAt: number;
  /** Fill color as hex. */
  color: number;
}

/** Per-unit tracking state for movement detection and emit throttling. */
interface UnitTrackState {
  /** Previous fractional tile X. */
  prevFtx: number;
  /** Previous fractional tile Y. */
  prevFty: number;
  /** Last emit timestamp (scene.time.now). */
  lastEmitTime: number;
}

// ─── Constants ────────────────────────────────────────────────────

/** Maximum number of live particles (performance cap). */
const MAX_PARTICLES = 60;

/** Maximum random offset from unit position for dust placement (pixels). */
const DUST_SPREAD_PX = 4;

/**
 * UnitMotionFxRenderer — owns dust particle lifecycle and rendering.
 */
export class UnitMotionFxRenderer {
  private offset: IsoPoint;

  /** Graphics object for drawing all dust particles. */
  private graphics: Phaser.GameObjects.Graphics;

  /** Active dust particles. */
  private particles: DustParticle[] = [];

  /** Previous harvester positions for movement detection. */
  private harvesterTracks = new Map<string, UnitTrackState>();

  /** Previous builder positions for movement detection. */
  private builderTracks = new Map<number, UnitTrackState>();

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.offset = offset;

    this.graphics = scene.add.graphics();
    // Depth below units (100+) but above terrain (50) and grid (50)
    this.graphics.setDepth(95);
  }

  /**
   * Sync from game state — detect movement, emit dust, age and render particles.
   * Called each frame from GameScene.update().
   */
  syncFromState(state: GameState, now: number): void {
    // 1. Age and prune expired particles
    this.pruneParticles(now);

    // 2. Emit new particles for moving units
    this.emitHarvesterDust(state.harvesters, now);
    this.emitBuilderDust(state.mapData.builders, now);

    // 3. Clean up stale tracks (units removed from state)
    this.cleanStaleHarvesterTracks(state.harvesters);

    // 4. Render all active particles
    this.renderParticles(now);
  }

  // ─── Harvester dust ──────────────────────────────────────────────

  private emitHarvesterDust(harvesters: HarvesterState[], now: number): void {
    const profile = getDustProfile('harvester');

    for (const h of harvesters) {
      const track = this.harvesterTracks.get(h.id);

      if (track) {
        // Check movement delta
        const moving = isMoving(track.prevFtx, track.prevFty, h.ftx, h.fty);

        if (moving && now - track.lastEmitTime >= profile.emitIntervalMs) {
          const screenPos = tileToScreen(h.ftx, h.fty);
          const worldX = screenPos.x + this.offset.x;
          const worldY = screenPos.y + this.offset.y;

          this.emitDust(worldX, worldY, profile, now);
          track.lastEmitTime = now;
        }
      }

      // Update track position
      if (track) {
        track.prevFtx = h.ftx;
        track.prevFty = h.fty;
      } else {
        this.harvesterTracks.set(h.id, {
          prevFtx: h.ftx,
          prevFty: h.fty,
          lastEmitTime: now,
        });
      }
    }
  }

  // ─── Builder dust ────────────────────────────────────────────────

  private emitBuilderDust(builders: BuilderPlacement[], now: number): void {
    const profile = getDustProfile('builder');

    for (let bi = 0; bi < builders.length; bi++) {
      const builder = builders[bi];
      const track = this.builderTracks.get(bi);

      if (track) {
        // Check movement delta
        const moving = isMoving(track.prevFtx, track.prevFty, builder.ftx, builder.fty);

        if (moving && now - track.lastEmitTime >= profile.emitIntervalMs) {
          const screenPos = tileToScreen(builder.ftx, builder.fty);
          const worldX = screenPos.x + this.offset.x;
          const worldY = screenPos.y + this.offset.y;

          this.emitDust(worldX, worldY, profile, now);
          track.lastEmitTime = now;
        }
      }

      // Update track position
      if (track) {
        track.prevFtx = builder.ftx;
        track.prevFty = builder.fty;
      } else {
        this.builderTracks.set(bi, {
          prevFtx: builder.ftx,
          prevFty: builder.fty,
          lastEmitTime: now,
        });
      }
    }
  }

  // ─── Dust emission ───────────────────────────────────────────────

  /**
   * Emit dust particles at the given world position.
   * Applies speed-based alpha scaling if speed > 0.
   */
  private emitDust(worldX: number, worldY: number, profile: ReturnType<typeof getDustProfile>, now: number): void {
    for (let i = 0; i < profile.countPerEmit; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;

      // Random offset for natural spread
      const offX = (Math.random() - 0.5) * DUST_SPREAD_PX * 2;
      const offY = (Math.random() - 0.5) * DUST_SPREAD_PX;

      // Random radius within profile range
      const baseRadius = profile.radiusMin + Math.random() * (profile.radiusMax - profile.radiusMin);

      this.particles.push({
        x: worldX + offX,
        y: worldY + offY,
        baseRadius,
        alphaMax: profile.alphaMax,
        lifetimeMs: profile.lifetimeMs,
        createdAt: now,
        color: profile.color,
      });
    }
  }

  // ─── Particle lifecycle ──────────────────────────────────────────

  /** Remove expired particles. */
  private pruneParticles(now: number): void {
    this.particles = this.particles.filter(p => now - p.createdAt < p.lifetimeMs);
  }

  /** Clean up harvester tracks for harvesters no longer in state. */
  private cleanStaleHarvesterTracks(harvesters: HarvesterState[]): void {
    const activeIds = new Set(harvesters.map(h => h.id));
    for (const [id] of this.harvesterTracks) {
      if (!activeIds.has(id)) {
        this.harvesterTracks.delete(id);
      }
    }
  }

  // ─── Rendering ───────────────────────────────────────────────────

  /** Render all active dust particles on the shared Graphics object. */
  private renderParticles(now: number): void {
    this.graphics.clear();

    for (const p of this.particles) {
      const ageMs = now - p.createdAt;
      const alpha = computeDustAlpha(ageMs, p.lifetimeMs, p.alphaMax);
      if (alpha <= 0) continue;

      const radius = computeDustRadius(p.baseRadius, ageMs, p.lifetimeMs);

      this.graphics.fillStyle(p.color, alpha);
      this.graphics.fillCircle(p.x, p.y, radius);
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────

  /** Destroy all particles and the graphics object. Call on scene shutdown. */
  destroy(): void {
    this.graphics.destroy();
    this.particles = [];
    this.harvesterTracks.clear();
    this.builderTracks.clear();
  }
}
