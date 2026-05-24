import Phaser from 'phaser';

/**
 * CameraControls — pan (drag) and zoom (scroll wheel) for the main camera.
 *
 * PR1 constraints:
 * - Drag to pan the camera across the terrain
 * - Scroll wheel to zoom in/out
 * - Camera bounds set to the terrain extent
 * - No keyboard controls (PR1 scope)
 */

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
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _dx: number,
        dy: number,
        _dz: number,
      ) => {
        if (dy === 0) return;

        // Phaser wheel uses deltaY for normal mouse-wheel direction.
        // deltaY > 0 means wheel down -> zoom out; deltaY < 0 means wheel up -> zoom in.
        const zoomDirection = dy > 0 ? -1 : 1;
        const zoomDelta = zoomDirection * 0.1;
        const newZoom = Phaser.Math.Clamp(
          this.camera.zoom + zoomDelta,
          this.minZoom,
          this.maxZoom,
        );
        this.camera.setZoom(newZoom);
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
  }
}
