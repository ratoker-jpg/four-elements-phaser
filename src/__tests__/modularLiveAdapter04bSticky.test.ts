/**
 * MODULAR-RUNTIME-04B — anti-flicker sticky-hold for the live modular adapter.
 *
 * Verifies that once a vehicle has rendered with a fully-available modular plan,
 * a transiently-unavailable plan (e.g. a freshly-rotated direction frame still
 * loading) keeps the last good modular sprites visible (usedModular stays true)
 * instead of flickering back to the blockout placeholder — UNLESS the visual
 * identity (hull/turret/faction/mod) changes.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ModularVehicleLiveAdapter,
} from '../phaser/render/ModularVehicleLiveAdapter';
import { setModularVehicleRender } from '../phaser/render/ModularVehicleLiveAdapter';
import type { BlockoutVehicleState } from '../state/blockoutVehicleState';

// ─── Minimal fake Phaser scene ──────────────────────────────────────

class FakeImage {
  visible = true;
  texture: string;
  constructor(texture: string) { this.texture = texture; }
  setOrigin() { return this; }
  setScale() { return this; }
  setDepth() { return this; }
  setVisible(v: boolean) { this.visible = v; return this; }
  setTexture(t: string) { this.texture = t; return this; }
  setPosition() { return this; }
  destroy() { return this; }
}

function makeFakeScene(existing: Set<string>) {
  return {
    textures: { exists: (key: string) => existing.has(key) },
    add: { image: (_x: number, _y: number, key: string) => new FakeImage(key) },
    load: { image: () => {}, start: () => {}, on: () => {} },
  } as any;
}

function makeVehicle(overrides: Partial<BlockoutVehicleState> = {}): BlockoutVehicleState {
  return {
    id: 'veh-1',
    bodyId: 'wasp',
    weaponId: 'smoky',
    faction: 'green',
    modificationLevel: 0,
    bodyAngle: 0,
    turretAngle: 0,
    worldX: 100,
    worldY: 100,
    ...(overrides as any),
  } as BlockoutVehicleState;
}

describe('MODULAR-RUNTIME-04B sticky anti-flicker', () => {
  let originalFlag: boolean;
  beforeEach(() => { originalFlag = true; setModularVehicleRender(true); });
  afterEach(() => { setModularVehicleRender(originalFlag); });

  it('holds modular sprites when a later frame is transiently unavailable (same visual)', () => {
    // dir0 keys present; dir2 (after rotation) initially absent.
    const present = new Set<string>([
      'modular_hull_wasp_green_m0_dir00',
      'generated_turret_smoky_green_m0_dir00',
    ]);
    const scene = makeFakeScene(present);
    const adapter = new ModularVehicleLiveAdapter(scene, { x: 0, y: 0 });

    // Frame 1: dir0 available → modular active.
    const r1 = adapter.syncVehicle(makeVehicle({ bodyAngle: 0, turretAngle: 0 }));
    expect(r1.usedModular).toBe(true);

    // Frame 2: vehicle rotates to dir2; those frames not loaded yet.
    // Without sticky-hold this would flip to usedModular:false (blockout).
    const r2 = adapter.syncVehicle(makeVehicle({ bodyAngle: Math.PI / 4, turretAngle: Math.PI / 4 }));
    expect(r2.usedModular).toBe(true);
    expect(r2.fallbackReason).toBeNull();
  });

  it('does NOT hold when the visual identity changes and new assets are missing', () => {
    const present = new Set<string>([
      'modular_hull_wasp_green_m0_dir00',
      'generated_turret_smoky_green_m0_dir00',
    ]);
    const scene = makeFakeScene(present);
    const adapter = new ModularVehicleLiveAdapter(scene, { x: 0, y: 0 });

    // Frame 1: wasp/smoky/green available → active.
    expect(adapter.syncVehicle(makeVehicle()).usedModular).toBe(true);

    // Frame 2: faction changes to purple (new visual identity), assets missing →
    // must fall back, not hold the stale green sprites.
    const r2 = adapter.syncVehicle(makeVehicle({ faction: 'purple' as any }));
    expect(r2.usedModular).toBe(false);
  });

  it('does not claim modular before any assets are available (initial load)', () => {
    const scene = makeFakeScene(new Set()); // nothing loaded
    const adapter = new ModularVehicleLiveAdapter(scene, { x: 0, y: 0 });
    const r = adapter.syncVehicle(makeVehicle());
    expect(r.usedModular).toBe(false);
    expect(r.fallbackReason).not.toBeNull();
  });
});
