/**
 * VEHICLE-RENDER-UNIFY-04-VH Stage 4 — RenderManager tests.
 *
 * Tests cover:
 *   - RenderManager exports the expected class;
 *   - GameScene no longer directly imports individual renderer classes
 *     that are now owned by RenderManager;
 *   - RenderManager has create/syncFromState/destroy API;
 *   - no legacy renderer resurrection.
 */

import { describe, it, expect } from 'vitest';

// Raw source imports for contract tests
import gameSceneSrc from '../phaser/GameScene?raw';
import renderManagerSrc from '../phaser/render/RenderManager?raw';

describe('VEHICLE-RENDER-UNIFY-04-VH: RenderManager exists and has correct API', () => {
  it('RenderManager.ts file is non-empty', () => {
    expect(renderManagerSrc.length).toBeGreaterThan(0);
  });

  it('RenderManager exports class RenderManager', () => {
    expect(renderManagerSrc).toMatch(/export class RenderManager/);
  });

  it('RenderManager has create() method', () => {
    expect(renderManagerSrc).toMatch(/create\(state.*opts.*\): void/);
  });

  it('RenderManager has syncFromState() method', () => {
    expect(renderManagerSrc).toMatch(/syncFromState\(/);
  });

  it('RenderManager has destroy() method', () => {
    expect(renderManagerSrc).toMatch(/destroy\(\): void/);
  });

  it('RenderManager owns all expected renderer fields', () => {
    expect(renderManagerSrc).toMatch(/terrainRenderer/);
    expect(renderManagerSrc).toMatch(/industrialFrameRenderer/);
    expect(renderManagerSrc).toMatch(/entityRenderer/);
    expect(renderManagerSrc).toMatch(/buildingStatusRenderer/);
    expect(renderManagerSrc).toMatch(/feedbackRenderer/);
    expect(renderManagerSrc).toMatch(/motionFxRenderer/);
    expect(renderManagerSrc).toMatch(/debugOverlayRenderer/);
    expect(renderManagerSrc).toMatch(/blockoutVehicleRenderer/);
    expect(renderManagerSrc).toMatch(/blockoutWeaponVfxRenderer/);
    expect(renderManagerSrc).toMatch(/blockoutDamageRenderer/);
    expect(renderManagerSrc).toMatch(/blockoutObstacleRenderer/);
    expect(renderManagerSrc).toMatch(/blockoutUpgradeRenderer/);
    expect(renderManagerSrc).toMatch(/blockoutSandboxHudRenderer/);
    expect(renderManagerSrc).toMatch(/cameraProjectionDebugRenderer/);
    expect(renderManagerSrc).toMatch(/generatedModularVehicleRenderer/);
    expect(renderManagerSrc).toMatch(/modularVehicleDevtoolsPanel/);
    expect(renderManagerSrc).toMatch(/assetPreviewTool/);
    expect(renderManagerSrc).toMatch(/assetPreviewPanel/);
  });
});

describe('VEHICLE-RENDER-UNIFY-04-VH: GameScene uses RenderManager', () => {
  it('GameScene imports RenderManager', () => {
    expect(gameSceneSrc).toMatch(/import.*RenderManager.*from.*render\/RenderManager/);
  });

  it('GameScene has renderManager field', () => {
    expect(gameSceneSrc).toMatch(/private renderManager.*RenderManager.*null/);
  });

  it('GameScene creates RenderManager in create()', () => {
    expect(gameSceneSrc).toMatch(/this\.renderManager = new RenderManager/);
    expect(gameSceneSrc).toMatch(/this\.renderManager\.create\(/);
  });

  it('GameScene calls renderManager.destroy() in shutdown()', () => {
    expect(gameSceneSrc).toMatch(/this\.renderManager\?\.destroy\(\)/);
  });

  it('GameScene no longer directly imports TerrainRenderer', () => {
    // Should not have a direct import statement
    const lines = gameSceneSrc.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('//')) continue;
      if (/^import.*TerrainRenderer.*from/.test(line)) {
        throw new Error(`GameScene still imports TerrainRenderer: ${line.trim()}`);
      }
    }
  });

  it('GameScene no longer directly imports BlockoutVehicleRenderer', () => {
    const lines = gameSceneSrc.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('//')) continue;
      if (/^import.*BlockoutVehicleRenderer.*from/.test(line)) {
        throw new Error(`GameScene still imports BlockoutVehicleRenderer: ${line.trim()}`);
      }
    }
  });

  it('GameScene no longer directly imports DebugOverlayRenderer', () => {
    const lines = gameSceneSrc.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('//')) continue;
      if (/^import.*DebugOverlayRenderer.*from/.test(line)) {
        throw new Error(`GameScene still imports DebugOverlayRenderer: ${line.trim()}`);
      }
    }
  });

  it('GameScene no longer directly imports FeedbackRenderer', () => {
    const lines = gameSceneSrc.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('//')) continue;
      if (/^import.*FeedbackRenderer.*from/.test(line)) {
        throw new Error(`GameScene still imports FeedbackRenderer: ${line.trim()}`);
      }
    }
  });

  it('GameScene line count reduced (was 1361, should be < 1300)', () => {
    const lineCount = gameSceneSrc.split('\n').length;
    expect(lineCount).toBeLessThan(1300);
  });
});

describe('VEHICLE-RENDER-UNIFY-04-VH: no legacy renderer resurrection', () => {
  it('no getWaspHullKey/getSmokyTurretKey in RenderManager', () => {
    expect(renderManagerSrc).not.toMatch(/getWaspHullKey/);
    expect(renderManagerSrc).not.toMatch(/getSmokyTurretKey/);
  });

  it('no pilotVehicleLazyLoad in RenderManager', () => {
    expect(renderManagerSrc).not.toMatch(/pilotVehicleLazyLoad/);
  });

  it('no pilotTurretComposition in RenderManager', () => {
    expect(renderManagerSrc).not.toMatch(/pilotTurretComposition/);
  });

  it('no MODULAR_TANK_HULL_OFFSETS in RenderManager', () => {
    expect(renderManagerSrc).not.toMatch(/MODULAR_TANK_HULL_OFFSETS/);
  });

  it('no tunerState in RenderManager', () => {
    expect(renderManagerSrc).not.toMatch(/tunerState/);
  });
});


// ─── FIXUP-1: RenderManager owns sync orchestration ───────────────

import gameSceneSrcFixup1 from '../phaser/GameScene?raw';
import renderManagerSrcFixup1 from '../phaser/render/RenderManager?raw';

describe('VEHICLE-RENDER-UNIFY-04-VH-FIXUP-1: RenderManager owns sync orchestration', () => {
  it('RenderManager has syncCivilRenderState method', () => {
    expect(renderManagerSrcFixup1).toMatch(/syncCivilRenderState\(/);
  });

  it('RenderManager has syncBlockoutInputVisualState method', () => {
    expect(renderManagerSrcFixup1).toMatch(/syncBlockoutInputVisualState\(/);
  });

  it('RenderManager has syncBlockoutRenderState method', () => {
    expect(renderManagerSrcFixup1).toMatch(/syncBlockoutRenderState\(/);
  });

  it('GameScene.update() calls syncCivilRenderState', () => {
    expect(gameSceneSrcFixup1).toMatch(/renderManager\?\.syncCivilRenderState/);
  });

  it('GameScene.update() calls syncBlockoutInputVisualState', () => {
    expect(gameSceneSrcFixup1).toMatch(/renderManager\?\.syncBlockoutInputVisualState/);
  });

  it('GameScene.update() calls syncBlockoutRenderState', () => {
    expect(gameSceneSrcFixup1).toMatch(/renderManager\?\.syncBlockoutRenderState/);
  });

  it('GameScene no longer directly calls entityRenderer?.syncFromState', () => {
    expect(gameSceneSrcFixup1).not.toMatch(/entityRenderer\?\.syncFromState/);
  });

  it('GameScene no longer directly calls buildingStatusRenderer?.syncFromState', () => {
    expect(gameSceneSrcFixup1).not.toMatch(/buildingStatusRenderer\?\.syncFromState/);
  });

  it('GameScene no longer directly calls debugOverlayRenderer?.syncFromState', () => {
    expect(gameSceneSrcFixup1).not.toMatch(/debugOverlayRenderer\?\.syncFromState/);
  });

  it('GameScene no longer directly calls feedbackRenderer?.syncFromState', () => {
    expect(gameSceneSrcFixup1).not.toMatch(/feedbackRenderer\?\.syncFromState/);
  });

  it('GameScene no longer directly calls motionFxRenderer?.syncFromState', () => {
    expect(gameSceneSrcFixup1).not.toMatch(/motionFxRenderer\?\.syncFromState/);
  });

  it('GameScene no longer directly calls assetPreviewTool?.update', () => {
    expect(gameSceneSrcFixup1).not.toMatch(/assetPreviewTool\?\.update/);
  });

  it('GameScene no longer directly calls blockoutVehicleRenderer.syncFromState', () => {
    expect(gameSceneSrcFixup1).not.toMatch(/blockoutVehicleRenderer\.syncFromState/);
  });

  it('GameScene no longer directly calls blockoutWeaponVfxRenderer.syncFromState', () => {
    expect(gameSceneSrcFixup1).not.toMatch(/blockoutWeaponVfxRenderer\.syncFromState/);
  });

  it('GameScene no longer directly calls blockoutDamageRenderer.syncFromState', () => {
    expect(gameSceneSrcFixup1).not.toMatch(/blockoutDamageRenderer\.syncFromState/);
  });

  it('GameScene no longer directly calls blockoutObstacleRenderer.syncFromState', () => {
    expect(gameSceneSrcFixup1).not.toMatch(/blockoutObstacleRenderer\.syncFromState/);
  });

  it('GameScene no longer directly calls blockoutUpgradeRenderer.syncFromState', () => {
    expect(gameSceneSrcFixup1).not.toMatch(/blockoutUpgradeRenderer\.syncFromState/);
  });

  it('GameScene no longer directly calls blockoutSandboxHudRenderer.syncFromState', () => {
    expect(gameSceneSrcFixup1).not.toMatch(/blockoutSandboxHudRenderer\.syncFromState/);
  });

  it('GameScene no longer directly calls blockoutVehicleRenderer.setHoveredVehicleId', () => {
    expect(gameSceneSrcFixup1).not.toMatch(/blockoutVehicleRenderer\.setHoveredVehicleId/);
  });

  it('GameScene no longer directly calls blockoutVehicleRenderer.setTargetedVehicleId', () => {
    expect(gameSceneSrcFixup1).not.toMatch(/blockoutVehicleRenderer\.setTargetedVehicleId/);
  });
});
