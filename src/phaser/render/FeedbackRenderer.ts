import Phaser from 'phaser';
import { tileToScreen, IsoPoint } from './isometric';
import {
  FeedbackEventQueue,
  detectEconomyChanges,
  getGatheringHarvesters,
  getGatheringPulses,
  type EconomySnapshot,
} from '../../state/feedbackEvents';
import type { GameState } from '../../state/types';

/**
 * FeedbackRenderer — renders gameplay feedback indicators using Phaser Graphics.
 *
 * ARCH-13A: Command feedback indicators (green/red diamonds) and
 * resource flow feedback (floating text).
 *
 * ARCH-13B: Gathering activity indicators near resources.
 *
 * All visuals use Phaser Graphics — no new image assets required.
 * Indicators fade out automatically based on event duration.
 */

// ─── Visual constants ──────────────────────────────────────────────

/** Diamond half-dimensions for isometric tile indicators. */
const DW = 76 / 4; // smaller than full tile
const DH = 38 / 4;

/** Colors for command feedback. */
const CMD_OK_COLOR = 0x44ff44;
const CMD_FAIL_COLOR = 0xff4444;

/** Colors for resource feedback. */
const RAW_GAIN_COLOR = 0x81c784;

/** Colors for gathering activity. */
const GATHERING_COLOR = 0xffcc44;

/** Y offset for floating text above the indicator. */
const FLOAT_TEXT_Y = -20;

/** Floating text style. */
const FLOAT_TEXT_CONFIG: Phaser.Types.GameObjects.Text.TextStyle = {
  fontSize: '11px',
  fontFamily: 'monospace',
  color: '#81c784',
  align: 'center',
};

/**
 * FeedbackRenderer — owns the feedback event queue and renders
 * transient gameplay feedback indicators each frame.
 */
export class FeedbackRenderer {
  private scene: Phaser.Scene;
  private offset: IsoPoint;

  /** The feedback event queue (visual-only, not part of GameState). */
  readonly queue = new FeedbackEventQueue();

  /** Graphics object for drawing diamond indicators. */
  private graphics: Phaser.GameObjects.Graphics;

  /** Floating text objects — reused from a pool. */
  private textPool: Phaser.GameObjects.Text[] = [];
  private activeTexts: Phaser.GameObjects.Text[] = [];

  /** Previous economy snapshot for detecting changes. */
  private prevEconomy: EconomySnapshot = { raw: 0, matter: 0 };
  private economyInitialized = false;

  /** Last pulse time per gathering tile key (for repeating activity pulses). */
  private lastGatheringPulseTime = new Map<string, number>();

  constructor(scene: Phaser.Scene, offset: IsoPoint) {
    this.scene = scene;
    this.offset = offset;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(160);
  }

  // ─── Public API ────────────────────────────────────────────────

  /** Push a command-ok indicator at the given tile. */
  addCommandOk(tx: number, ty: number, now: number): void {
    this.queue.add('command-ok', tx, ty, now);
  }

  /** Push a command-fail indicator at the given tile. */
  addCommandFail(tx: number, ty: number, now: number): void {
    this.queue.add('command-fail', tx, ty, now);
  }

  /**
   * Sync from game state — detect resource changes and gathering activity.
   * Called each frame from GameScene.update().
   */
  syncFromState(state: GameState, now: number): void {
    // Age and prune old events
    this.queue.ageAndPrune(now);

    // Detect economy changes (raw gain from harvester unload)
    if (!this.economyInitialized) {
      this.prevEconomy = { raw: state.economy.raw, matter: state.economy.matter };
      this.economyInitialized = true;
    } else {
      const changes = detectEconomyChanges(
        this.prevEconomy,
        { raw: state.economy.raw, matter: state.economy.matter },
        state.mapData.hq.tx,
        state.mapData.hq.ty,
      );
      for (const c of changes) {
        this.queue.add(c.type, c.tx, c.ty, now, c.value);
      }
      this.prevEconomy = { raw: state.economy.raw, matter: state.economy.matter };
    }

    // Detect gathering activity (repeating pulse while harvester is gathering)
    const gatheringPositions = getGatheringHarvesters(state.harvesters);
    const { pulses, updatedMap } = getGatheringPulses(
      gatheringPositions,
      this.lastGatheringPulseTime,
      now,
    );
    for (const pos of pulses) {
      this.queue.add('gathering-activity', pos.tx, pos.ty, now);
    }
    this.lastGatheringPulseTime = updatedMap;

    // Render all active feedback events
    this.renderFeedback(now);
  }

  // ─── Rendering ──────────────────────────────────────────────────

  private renderFeedback(now: number): void {
    this.graphics.clear();

    // Return all active texts to pool
    for (const t of this.activeTexts) {
      t.setVisible(false);
      this.textPool.push(t);
    }
    this.activeTexts = [];

    const events = this.queue.getActive();

    for (const event of events) {
      const alpha = this.queue.getAlpha(event, now);
      if (alpha <= 0) continue;

      const screenPos = tileToScreen(event.tx, event.ty);
      const cx = screenPos.x + this.offset.x;
      const cy = screenPos.y + this.offset.y;

      switch (event.type) {
        case 'command-ok':
          this.drawDiamond(cx, cy, CMD_OK_COLOR, alpha);
          break;
        case 'command-fail':
          this.drawDiamond(cx, cy, CMD_FAIL_COLOR, alpha);
          break;
        case 'resource-raw-gain':
          this.drawDiamond(cx, cy, RAW_GAIN_COLOR, alpha * 0.7);
          if (event.value !== undefined) {
            this.showFloatingText(cx, cy + FLOAT_TEXT_Y, `+${event.value} Raw`, alpha);
          }
          break;
        case 'gathering-activity':
          this.drawDiamond(cx, cy - 5, GATHERING_COLOR, alpha * 0.6);
          break;
      }
    }
  }

  /** Draw a small isometric diamond at the given screen position. */
  private drawDiamond(cx: number, cy: number, color: number, alpha: number): void {
    this.graphics.fillStyle(color, alpha);
    this.graphics.beginPath();
    this.graphics.moveTo(cx, cy - DH);
    this.graphics.lineTo(cx + DW, cy);
    this.graphics.lineTo(cx, cy + DH);
    this.graphics.lineTo(cx - DW, cy);
    this.graphics.closePath();
    this.graphics.fillPath();

    // Bright outline
    this.graphics.lineStyle(1, color, Math.min(alpha * 1.5, 1.0));
    this.graphics.beginPath();
    this.graphics.moveTo(cx, cy - DH);
    this.graphics.lineTo(cx + DW, cy);
    this.graphics.lineTo(cx, cy + DH);
    this.graphics.lineTo(cx - DW, cy);
    this.graphics.closePath();
    this.graphics.strokePath();
  }

  /** Show a floating text at the given position. */
  private showFloatingText(x: number, y: number, text: string, alpha: number): void {
    let t: Phaser.GameObjects.Text;
    if (this.textPool.length > 0) {
      t = this.textPool.pop()!;
      t.setText(text);
      t.setPosition(x, y);
      t.setAlpha(alpha);
      t.setVisible(true);
    } else {
      t = this.scene.add.text(x, y, text, FLOAT_TEXT_CONFIG);
      t.setOrigin(0.5, 0.5);
      t.setDepth(161);
      t.setAlpha(alpha);
    }
    this.activeTexts.push(t);
  }

  // ─── Cleanup ────────────────────────────────────────────────────

  destroy(): void {
    this.graphics.destroy();
    for (const t of this.textPool) t.destroy();
    for (const t of this.activeTexts) t.destroy();
    this.textPool = [];
    this.activeTexts = [];
    this.lastGatheringPulseTime.clear();
    this.queue.clear();
  }
}
