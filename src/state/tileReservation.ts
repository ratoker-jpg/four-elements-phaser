/**
 * Tile reservation system — pure TypeScript, no Phaser.
 *
 * CORE-STEP-06H+: Implements tile reservation for ground units.
 * A unit reserves the next tile before entering it, preventing
 * other units from pathing into or entering the reserved tile.
 *
 * Key rules:
 * - Unit reserves next tile before entering
 * - Other units cannot path into occupied/reserved tiles
 * - If next tile is occupied, unit waits briefly, then repaths
 * - If no path is available, unit stops with feedback
 * - Reservation is cleaned up on: arrival, stop, cancel, death, repath failure
 *
 * Territory does NOT block movement.
 */

// ─── Public types ──────────────────────────────────────────────────

/** Who holds a reservation on a tile. */
export interface ReservationHolder {
  /** Unique identifier for the unit. */
  unitId: string;
  /** Type of unit holding the reservation. */
  unitType: 'harvester' | 'builder' | 'combat-vehicle';
}

/** A single tile reservation entry. */
export interface TileReservation {
  /** Tile X coordinate. */
  tx: number;
  /** Tile Y coordinate. */
  ty: number;
  /** Who holds this reservation. */
  holder: ReservationHolder;
  /** Timestamp when the reservation was created (ms). */
  createdAt: number;
}

/** Tile reservation map — tracks which tiles are reserved by which units. */
export class TileReservationMap {
  /** Map from flat tile key → reservation entry. */
  private reservations = new Map<number, TileReservation>();

  /** Map width for key computation. */
  private width: number;

  constructor(width: number) {
    this.width = width;
  }

  // ─── Key helpers ────────────────────────────────────────────────

  /** Compute flat numeric key for a tile position. */
  private key(tx: number, ty: number): number {
    return tx + ty * this.width;
  }

  // ─── Query ─────────────────────────────────────────────────────

  /** Check if a tile is currently reserved. */
  isReserved(tx: number, ty: number): boolean {
    return this.reservations.has(this.key(tx, ty));
  }

  /** Check if a tile is reserved by a specific unit. */
  isReservedBy(tx: number, ty: number, unitId: string): boolean {
    const r = this.reservations.get(this.key(tx, ty));
    return (r?.holder.unitId ?? undefined) === unitId;
  }

  /** Get the reservation for a tile, if any. */
  getReservation(tx: number, ty: number): TileReservation | undefined {
    return this.reservations.get(this.key(tx, ty));
  }

  /** Check if a tile is reserved by a different unit (not the excluded one). */
  isReservedByOther(tx: number, ty: number, excludeUnitId: string): boolean {
    const r = this.reservations.get(this.key(tx, ty));
    if (!r) return false;
    return r.holder.unitId !== excludeUnitId;
  }

  // ─── Mutation ──────────────────────────────────────────────────

  /**
   * Reserve a tile for a unit.
   * Returns false if the tile is already reserved by a different unit.
   */
  reserve(tx: number, ty: number, holder: ReservationHolder, nowMs: number): boolean {
    const k = this.key(tx, ty);
    const existing = this.reservations.get(k);
    if (existing && existing.holder.unitId !== holder.unitId) {
      return false; // already reserved by another unit
    }
    this.reservations.set(k, { tx, ty, holder, createdAt: nowMs });
    return true;
  }

  /**
   * Release a specific tile reservation for a unit.
   * Only releases if the reservation belongs to the specified unit.
   */
  release(tx: number, ty: number, unitId: string): void {
    const k = this.key(tx, ty);
    const r = this.reservations.get(k);
    if (r && r.holder.unitId === unitId) {
      this.reservations.delete(k);
    }
  }

  /**
   * Release ALL reservations held by a specific unit.
   * Used when a unit: arrives, stops, cancels, dies, or repath fails.
   */
  releaseAll(unitId: string): void {
    for (const [k, r] of this.reservations) {
      if (r.holder.unitId === unitId) {
        this.reservations.delete(k);
      }
    }
  }

  /**
   * Clean up stale reservations older than the given age.
   * Returns the number of reservations cleaned up.
   */
  cleanStale(nowMs: number, maxAgeMs: number): number {
    let count = 0;
    for (const [k, r] of this.reservations) {
      if (nowMs - r.createdAt > maxAgeMs) {
        this.reservations.delete(k);
        count++;
      }
    }
    return count;
  }

  /** Get the number of active reservations. */
  get size(): number {
    return this.reservations.size;
  }

  /** Clear all reservations. */
  clear(): void {
    this.reservations.clear();
  }
}

// ─── Reservation constants ─────────────────────────────────────────

/** How long a unit waits (ms) when next tile is occupied before repathing. */
export const WAIT_BEFORE_REPATH_MS = 500;

/** How long a unit waits (ms) after a failed repath before trying again. */
export const REPATH_RETRY_INTERVAL_MS = 1000;

/** Maximum age (ms) before a reservation is considered stale and cleaned up. */
export const RESERVATION_MAX_AGE_MS = 10000;

// ─── Movement feedback ─────────────────────────────────────────────

/** Feedback status for a unit that cannot proceed. */
export type MovementBlockStatus =
  | { status: 'ok' }
  | { status: 'waiting'; reason: 'tile-occupied'; waitRemainingMs: number }
  | { status: 'repathing'; reason: 'tile-occupied' }
  | { status: 'blocked'; reason: 'no-path' }
  | { status: 'stopped'; reason: 'stop-command' | 'cancel' | 'arrival' };
