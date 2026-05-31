import Phaser from 'phaser';
import { loadGeneratedBuildingAndHqAssets, loadGeneratedCivilUnitAssets, loadGeneratedModularUnitAssets, loadGeneratedTerrainAndResourceAssets, loadGeneratedIndustrialTerrainAssets, loadGeneratedIndustrialFrameAssets, loadGeneratedIndustrialResourceAssets } from '../assets/runtimeGeneratedAssets';
import { isDevtoolsEnabled } from '../state/devCommands';

/**
 * PreloadScene — load all runtime-approved assets, then start MainMenuScene.
 *
 * PHASER4-LOAD-02: modularUnits (64 combat images) are only loaded when
 * devtools/arena mode is active. Standard game startup skips them.
 *
 * LOADING-01: Visual loading screen with game title, progress bar,
 * percentage text, and status text. Uses Phaser Loader events for
 * real progress — no fake progress timers.
 */
export class PreloadScene extends Phaser.Scene {
  private lastLoggedProgressMilestone = -1;
  private container: HTMLDivElement | null = null;
  private progressBarFill: HTMLDivElement | null = null;
  private percentText: HTMLDivElement | null = null;
  private statusText: HTMLDivElement | null = null;

  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    // Create the loading screen overlay before starting asset loading
    this.createLoadingOverlay();

    // --- Terrain + Resources (loaded from generated manifest) ---
    loadGeneratedTerrainAndResourceAssets(this);

    // --- Industrial terrain tiles (VISUAL-05A-PR2: always loaded, small set) ---
    loadGeneratedIndustrialTerrainAssets(this);

    // --- Industrial frame assets (VISUAL-05A-PR3: frame top, wall face, background) ---
    loadGeneratedIndustrialFrameAssets(this);

    // --- Industrial resource assets (VISUAL-06D: always loaded, small set) ---
    loadGeneratedIndustrialResourceAssets(this);

    // --- Buildings + HQ (loaded from generated manifest) ---
    loadGeneratedBuildingAndHqAssets(this);

    // --- Civil unit spritesheets (loaded from generated manifest) ---
    loadGeneratedCivilUnitAssets(this);

    // --- Modular combat images (PHASER4-LOAD-02: devtools/arena only) ---
    if (isDevtoolsEnabled()) {
      loadGeneratedModularUnitAssets(this);
      console.log('[PreloadScene] modularUnits loading enabled (devtools/arena mode).');
    } else {
      console.log('[PreloadScene] modularUnits loading skipped (standard mode).');
    }

    // Loading progress — update visual bar + log milestones
    this.load.on('progress', (value: number) => {
      const percent = Math.round(value * 100);

      // Update visual loading screen
      this.updateProgress(percent);

      // Log only at 0%, 25%, 50%, 75%, 100% milestones
      const milestone = Math.floor(percent / 25) * 25;
      if (milestone > this.lastLoggedProgressMilestone) {
        console.log(`[PreloadScene] Loading: ${milestone}%`);
        this.lastLoggedProgressMilestone = milestone;
      }
    });

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error(`[PreloadScene] Failed to load: ${file.key} (${file.url})`);
    });

    // On complete, show "Starting..." briefly before scene transition
    this.load.on('complete', () => {
      this.updateProgress(100);
      if (this.statusText) {
        this.statusText.textContent = 'Starting...';
      }

      // Brief delay so the player sees "Starting..." before transition
      this.time.delayedCall(300, () => {
        console.log('[PreloadScene] All assets loaded.');
        this.scene.start('MainMenuScene');
      });
    });
  }

  create(): void {
    // Scene transition is handled by the 'complete' event handler above.
    // This create() method is called after preload finishes, but the
    // scene.start is triggered from the 'complete' event with a brief delay.
  }

  shutdown(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.progressBarFill = null;
    this.percentText = null;
    this.statusText = null;
  }

  /**
   * Create the visual loading screen DOM overlay.
   * LOADING-01: Dark background, blue accent, consistent with MainMenuScene.
   */
  private createLoadingOverlay(): void {
    const root = document.createElement('div');
    root.id = 'loading-screen';
    root.innerHTML = '';
    root.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: #1a1a2e;
      z-index: 40;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #e0e0e0;
    `;

    // Title
    const title = document.createElement('div');
    title.textContent = 'Four Elements';
    title.style.cssText = `
      font-size: 48px;
      font-weight: 700;
      color: #4fc3f7;
      margin-bottom: 48px;
      letter-spacing: 2px;
    `;
    root.appendChild(title);

    // Progress bar container
    const progressBarContainer = document.createElement('div');
    progressBarContainer.style.cssText = `
      width: 320px;
      height: 8px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 16px;
    `;

    // Progress bar fill
    this.progressBarFill = document.createElement('div');
    this.progressBarFill.style.cssText = `
      width: 0%;
      height: 100%;
      background: #4fc3f7;
      border-radius: 4px;
      transition: width 0.15s ease-out;
    `;
    progressBarContainer.appendChild(this.progressBarFill);
    root.appendChild(progressBarContainer);

    // Percentage text
    this.percentText = document.createElement('div');
    this.percentText.textContent = '0%';
    this.percentText.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      color: #4fc3f7;
      margin-bottom: 8px;
    `;
    root.appendChild(this.percentText);

    // Status text
    this.statusText = document.createElement('div');
    this.statusText.textContent = 'Loading assets...';
    this.statusText.style.cssText = `
      font-size: 13px;
      color: #888;
    `;
    root.appendChild(this.statusText);

    document.body.appendChild(root);
    this.container = root;

    // Register DOM cleanup on scene shutdown
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  /**
   * Update the loading progress visuals.
   * LOADING-01: Real progress from Phaser Loader, no fake timers.
   */
  private updateProgress(percent: number): void {
    if (this.progressBarFill) {
      this.progressBarFill.style.width = `${percent}%`;
    }
    if (this.percentText) {
      this.percentText.textContent = `${percent}%`;
    }
  }
}
