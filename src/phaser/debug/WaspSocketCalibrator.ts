/**
 * WaspSocketCalibrator — Wasp hull turret-socket calibration tool.
 *
 * TURRET-HULL-CONTRACT-PR-F2: The runtime anchor diagnostic
 * (?turretAnchorDebug=1) proved the renderer math is self-consistent:
 * the computed hull socket world point and the computed turret pivot world
 * point coincide (distance ~ 0). But visual QA shows the marker is NOT on
 * the actual visible turret mount point of the Wasp hull PNG. That means
 * the Wasp socket PROFILE DATA (perDir nx/ny) does not match the real
 * generated hull pixels — the projection-recovered candidates are wrong.
 *
 * This tool lets Denis move the socket marker on the actual runtime hull
 * (per displayed direction) with the keyboard and read off the corrected
 * normalized nx/ny values, which are based on the real 512×512 hull PNG
 * canvas:
 *
 *   nx = socketPixelX / 512
 *   ny = socketPixelY / 512
 *
 * THIS IS A CALIBRATION AID ONLY. It does NOT change renderer math, the
 * turret pivot, gameplay, or persisted data. While ?turretSocketCalibrate=1
 * is active the selected Wasp's turret sprite is re-attached to the
 * calibrated socket each frame so Denis can visually confirm the turret
 * sits on the hull, but nothing is written back to the profile or
 * localStorage.
 *
 * Hotkeys (Arena/devtools only, ?turretSocketCalibrate=1, Wasp+Smoky selected):
 *   ArrowLeft / ArrowRight  — move socket marker -/+ 1 px (in 512-canvas space)
 *   ArrowUp / ArrowDown     — move socket marker -/+ 1 px
 *   Shift + Arrow           — move by 5 px
 *   Alt + Arrow             — move by 0.25 px (fine)
 *
 * Pure TypeScript except the window-guarded query-flag reader, so this
 * module is safe to import in non-DOM (test) environments.
 */

/** The hull PNG canvas size in pixels. Generated hulls are 512×512. */
export const HULL_CANVAS_PX = 512;

// ─── Calibration state ──────────────────────────────────────────

/** Calibrated socket X in hull-PNG-canvas pixels (0..512). */
let socketPixelX = HULL_CANVAS_PX * 0.5;

/** Calibrated socket Y in hull-PNG-canvas pixels (0..512). */
let socketPixelY = HULL_CANVAS_PX * 0.5;

/** The hull visual dir16 the current pixel values were seeded for (null = unseeded). */
let seededDir16: number | null = null;

/** The hull texture key the current pixel values were seeded for. */
let seededHullTextureKey = '';

// ─── Query flag ─────────────────────────────────────────────────

/** Query-param flag: ?turretSocketCalibrate=1 enables socket calibration. */
export function isTurretSocketCalibrateEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const v = params.get('turretSocketCalibrate');
  return v === '1' || v === 'true';
}

// ─── State accessors ────────────────────────────────────────────

/** Current calibrated socket X in canvas pixels (0..512). */
export function getSocketPixelX(): number {
  return socketPixelX;
}

/** Current calibrated socket Y in canvas pixels (0..512). */
export function getSocketPixelY(): number {
  return socketPixelY;
}

/** Current calibrated socket as normalized (0..1) image-local coordinates. */
export function getSocketNormalized(): { nx: number; ny: number } {
  return { nx: socketPixelX / HULL_CANVAS_PX, ny: socketPixelY / HULL_CANVAS_PX };
}

/** The hull visual dir16 the current values are seeded for (null = unseeded). */
export function getSeededDir16(): number | null {
  return seededDir16;
}

/** The hull texture key the current values are seeded for. */
export function getSeededHullTextureKey(): string {
  return seededHullTextureKey;
}

// ─── State mutations ────────────────────────────────────────────

/**
 * Seed the calibrated socket from the current profile value for a direction,
 * but ONLY when the displayed direction (or its texture) has changed.
 *
 * This lets the marker start at the existing profile socket for each
 * direction without discarding the manual adjustments Denis has already
 * made for the direction currently being calibrated.
 */
export function ensureSeededForDir(
  dir16: number,
  baseNx: number,
  baseNy: number,
  hullTextureKey: string,
): void {
  if (seededDir16 !== dir16) {
    socketPixelX = baseNx * HULL_CANVAS_PX;
    socketPixelY = baseNy * HULL_CANVAS_PX;
    seededDir16 = dir16;
  }
  seededHullTextureKey = hullTextureKey;
}

/** Move the calibrated socket by a pixel delta (in 512-canvas space). */
export function moveSocketBy(dxPx: number, dyPx: number): { x: number; y: number } {
  socketPixelX += dxPx;
  socketPixelY += dyPx;
  return { x: socketPixelX, y: socketPixelY };
}

/**
 * Reset the calibrated socket back to the profile value. Clears the seed so
 * the next frame re-seeds from the current direction's profile socket.
 */
export function resetSocketCalibration(): void {
  seededDir16 = null;
}

// ─── Output helpers ─────────────────────────────────────────────

/** Snapshot of the calibrated values, used for display and logging. */
export interface SocketCalibrationSnapshot {
  hullVisualDir16: number;
  hullTextureKey: string;
  socketPixelX: number;
  socketPixelY: number;
  nx: number;
  ny: number;
}

/** Build the current calibration snapshot (single source of truth for output). */
export function buildSocketCalibrationSnapshot(): SocketCalibrationSnapshot {
  return {
    hullVisualDir16: seededDir16 ?? -1,
    hullTextureKey: seededHullTextureKey,
    socketPixelX,
    socketPixelY,
    nx: socketPixelX / HULL_CANVAS_PX,
    ny: socketPixelY / HULL_CANVAS_PX,
  };
}

/** Build the copy-ready perDir line, e.g. `dir04: { nx: 0.401352, ny: 0.422228 }`. */
export function buildCopyReadyLine(snap: SocketCalibrationSnapshot): string {
  const padded = String(Math.max(0, snap.hullVisualDir16)).padStart(2, '0');
  return `dir${padded}: { nx: ${snap.nx.toFixed(6)}, ny: ${snap.ny.toFixed(6)} },`;
}

/** Build the multi-line on-screen overlay text. */
export function buildSocketCalibrationOverlayText(snap: SocketCalibrationSnapshot): string {
  const lines: string[] = [];
  lines.push('=== WASP SOCKET CALIBRATE ===');
  lines.push(`hullVisualDir16: ${snap.hullVisualDir16}`);
  lines.push(`hullTextureKey: ${snap.hullTextureKey}`);
  lines.push(`socketPixelX: ${snap.socketPixelX.toFixed(2)}`);
  lines.push(`socketPixelY: ${snap.socketPixelY.toFixed(2)}`);
  lines.push(`nx: ${snap.nx.toFixed(6)}`);
  lines.push(`ny: ${snap.ny.toFixed(6)}`);
  lines.push(buildCopyReadyLine(snap));
  lines.push('Arrows=1px  Shift=5px  Alt=0.25px');
  return lines.join('\n');
}

/**
 * Print the current calibrated socket values to the console, including a
 * copy-ready perDir line Denis can paste straight into the Wasp profile.
 */
export function logSocketCalibrationValues(): void {
  const snap = buildSocketCalibrationSnapshot();
  console.log('[WaspSocketCalibrate]', {
    hullVisualDir16: snap.hullVisualDir16,
    hullTextureKey: snap.hullTextureKey,
    socketPixelX: Math.round(snap.socketPixelX * 100) / 100,
    socketPixelY: Math.round(snap.socketPixelY * 100) / 100,
    nx: snap.nx,
    ny: snap.ny,
  });
  console.log('[WaspSocketCalibrate] copy-ready:', buildCopyReadyLine(snap));
}
