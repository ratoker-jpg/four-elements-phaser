import type { MapData, TerrainType, Entity } from '../../state/types';

/**
 * Custom Map 1 — "Карта 1"
 *
 * 48×48 isometric desert map with:
 * - Start position: HQ at (4,4), builder at (3,3), harvester at (5,3)
 * - Start resource clusters near upper-left corner
 * - Central infinite crystal deposit near (23,22)
 * - Scattered medium/large resource clusters around the map
 * - Deterministic terrain pattern (mostly sand with dark/light patches)
 */

// ─── Terrain generation ─────────────────────────────────────────────

function generateTerrain(): TerrainType[][] {
  const map: TerrainType[][] = [];
  for (let ty = 0; ty < 48; ty++) {
    const row: TerrainType[] = [];
    for (let tx = 0; tx < 48; tx++) {
      const hash = ((tx * 7 + ty * 13) >>> 0) % 100;
      if (hash < 10) {
        row.push('sand-dark');
      } else if (hash < 18) {
        row.push('sand-light');
      } else {
        row.push('sand');
      }
    }
    map.push(row);
  }
  return map;
}

// ─── Entity definitions ─────────────────────────────────────────────

function createEntities(): Entity[] {
  const entities: Entity[] = [];
  let nextId = 1;
  const id = () => `e${nextId++}`;

  // ── Player start (upper-left area) ──
  entities.push({ id: id(), kind: 'hq', tx: 4, ty: 4, faction: 'cyan' });
  entities.push({ id: id(), kind: 'builder', tx: 3, ty: 3, faction: 'cyan' });
  entities.push({ id: id(), kind: 'harvester', tx: 5, ty: 3, faction: 'cyan' });

  // ── Start resource cluster near HQ ──
  entities.push({ id: id(), kind: 'resource', tx: 2, ty: 2, resourceType: 'large' });
  entities.push({ id: id(), kind: 'resource', tx: 3, ty: 1, resourceType: 'medium' });
  entities.push({ id: id(), kind: 'resource', tx: 1, ty: 3, resourceType: 'small' });
  entities.push({ id: id(), kind: 'resource', tx: 6, ty: 2, resourceType: 'medium' });
  entities.push({ id: id(), kind: 'resource', tx: 7, ty: 5, resourceType: 'small' });
  entities.push({ id: id(), kind: 'resource', tx: 2, ty: 6, resourceType: 'small' });

  // ── Central infinite crystal deposit near (23, 22) ──
  entities.push({ id: id(), kind: 'resource', tx: 23, ty: 22, resourceType: 'infinite' });
  entities.push({ id: id(), kind: 'resource', tx: 22, ty: 21, resourceType: 'infinite' });
  entities.push({ id: id(), kind: 'resource', tx: 24, ty: 23, resourceType: 'infinite' });
  entities.push({ id: id(), kind: 'resource', tx: 21, ty: 23, resourceType: 'large' });
  entities.push({ id: id(), kind: 'resource', tx: 25, ty: 21, resourceType: 'large' });
  entities.push({ id: id(), kind: 'resource', tx: 23, ty: 24, resourceType: 'medium' });
  entities.push({ id: id(), kind: 'resource', tx: 22, ty: 23, resourceType: 'medium' });

  // ── Resource cluster — upper-right area ──
  entities.push({ id: id(), kind: 'resource', tx: 40, ty: 5, resourceType: 'large' });
  entities.push({ id: id(), kind: 'resource', tx: 42, ty: 4, resourceType: 'medium' });
  entities.push({ id: id(), kind: 'resource', tx: 38, ty: 7, resourceType: 'small' });

  // ── Resource cluster — lower-left area ──
  entities.push({ id: id(), kind: 'resource', tx: 5, ty: 40, resourceType: 'large' });
  entities.push({ id: id(), kind: 'resource', tx: 7, ty: 42, resourceType: 'medium' });
  entities.push({ id: id(), kind: 'resource', tx: 3, ty: 38, resourceType: 'small' });

  // ── Resource cluster — lower-right area ──
  entities.push({ id: id(), kind: 'resource', tx: 40, ty: 40, resourceType: 'large' });
  entities.push({ id: id(), kind: 'resource', tx: 42, ty: 42, resourceType: 'medium' });
  entities.push({ id: id(), kind: 'resource', tx: 38, ty: 43, resourceType: 'small' });

  // ── Scattered resources across the map ──
  entities.push({ id: id(), kind: 'resource', tx: 15, ty: 12, resourceType: 'medium' });
  entities.push({ id: id(), kind: 'resource', tx: 30, ty: 10, resourceType: 'small' });
  entities.push({ id: id(), kind: 'resource', tx: 12, ty: 30, resourceType: 'small' });
  entities.push({ id: id(), kind: 'resource', tx: 35, ty: 35, resourceType: 'medium' });
  entities.push({ id: id(), kind: 'resource', tx: 18, ty: 38, resourceType: 'large' });
  entities.push({ id: id(), kind: 'resource', tx: 33, ty: 15, resourceType: 'large' });

  return entities;
}

// ─── Map definition ─────────────────────────────────────────────────

export const customMap1: MapData = {
  id: 'custom-map-1',
  name: 'Карта 1',
  createdAt: '2026-05-24T00:00:00Z',
  updatedAt: '2026-05-24T00:00:00Z',
  width: 48,
  height: 48,
  terrain: generateTerrain(),
  entities: createEntities(),
  playerFaction: 'cyan',
};
