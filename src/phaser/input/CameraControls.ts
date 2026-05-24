import Phaser from 'phaser';

/**
 * CameraControls — pan (drag), zoom (scroll wheel), and reset for the main camera.
 *
 * PR1.1 changes:
 * - Multiplicative zoom (factor ~1.12) instead of additive
 * - Zoom keeps the world point under the cursor stable
 * - resetTo() method for camera reset hotkey
 * - bindResetKey() for wiring keyboard reset
 */

const ZOOM_FACTOR = 1.12;

export class CameraControls {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private camStartScrollX: number = 0;
  private camStartScrollY: number = 0;
  private minZoom: number = 0.3;
  private maxZoom: number = 3.0;
  private resetKey: Phaser.Input.Keyboard.Key | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;

    this.setupPan();
    this.setupZoom();
  }

  /** Set camera bounds from the terrain renderer. */
  setBounds(bounds: Phaser.Geom.Rectangle): void {
    this.camera.setBounds(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
    );
  }

  /** Center the camera on a specific world position. */
  centerOn(worldX: number, worldY: number): void {
    this.camera.centerOn(worldX, worldY);
  }

  /**
   * Reset camera to a specific world position and zoom level 1.0.
   * Used by the R hotkey to snap back to HQ.
   */
  resetTo(worldX: number, worldY: number): void {
    this.camera.setZoom(1.0);
    this.camera.centerOn(worldX, worldY);
  }

  /**
   * Bind a keyboard key to reset the camera.
   * Call this after construction to wire the reset hotkey.
   */
  bindResetKey(keyCode: string, targetWorldX: number, targetWorldY: number): void {
    if (this.resetKey) {
      this.resetKey.destroy();
    }
    this.resetKey = this.scene.input.keyboard?.addKey(keyCode) ?? null;
    if (this.resetKey) {
      this.resetKey.on('down', () => {
        this.resetTo(targetWorldX, targetWorldY);
      });
    }
  }

  private setupPan(): void {
    // Pointer drag to pan
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return; // Ignore right-click
      this.isDragging = true;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
      this.camStartScrollX = this.camera.scrollX;
      this.camStartScrollY = this.camera.scrollY;
    });

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;

      const dx = pointer.x - this.dragStartX;
      const dy = pointer.y - this.dragStartY;

      // Move camera in the opposite direction of the drag
      this.camera.scrollX = this.camStartScrollX - dx / this.camera.zoom;
      this.camera.scrollY = this.camStartScrollY - dy / this.camera.zoom;
    });

    this.scene.input.on('pointerup', () => {
      this.isDragging = false;
    });

    this.scene.input.on('pointerupoutside', () => {
      this.isDragging = false;
    });
  }

  private setupZoom(): void {
    this.scene.input.on(
      'wheel',
      (
        pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _dx: number,
        dy: number,
        _dz: number,
      ) => {
        if (dy === 0) return;

        const oldZoom = this.camera.zoom;
        const factor = dy > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;
        const newZoom = Phaser.Math.Clamp(
          oldZoom * factor,
          this.minZoom,
          this.maxZoom,
        );
        if (newZoom === oldZoom) return;

        // Use Phaser camera transforms instead of manual pointer math.
        // This keeps zoom-to-cursor correct with scaled / expanded canvases.
        const before = this.camera.getWorldPoint(pointer.x, pointer.y);
        this.camera.setZoom(newZoom);
        const after = this.camera.getWorldPoint(pointer.x, pointer.y);

        this.camera.scrollX += before.x - after.x;
        this.camera.scrollY += before.y - after.y;
      },
    );
  }

  /** Get current camera info for HUD display. */
  getCameraInfo(): { scrollX: number; scrollY: number; zoom: number } {
    return {
      scrollX: this.camera.scrollX,
      scrollY: this.camera.scrollY,
      zoom: this.camera.zoom,
    };
  }

  destroy(): void {
    this.scene.input.off('pointerdown');
    this.scene.input.off('pointermove');
    this.scene.input.off('pointerup');
    this.scene.input.off('pointerupoutside');
    this.scene.input.off('wheel');
    if (this.resetKey) {
      this.resetKey.destroy();
      this.resetKey = null;
    }
  }
}
