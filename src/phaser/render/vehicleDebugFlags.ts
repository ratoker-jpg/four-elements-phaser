/**
 * vehicleDebugFlags — MODULAR-RUNTIME-04B debug overlay gate.
 *
 * Single source of truth for whether intrusive vehicle debug visuals are drawn.
 * Default state for ALL flags is `false`, so default live / Arena gameplay shows
 * NONE of these artifacts:
 *   - movementLine     → green vehicle→target movement/aim line;
 *   - aimLine          → red dashed turret aim line;
 *   - directionArrow   → arrow/marker drawn on the selection ring;
 *   - mountPoints      → red socket/mount-point debug circles;
 *   - turretCursorAim  → turret rotating to follow the raw mouse cursor.
 *
 * These were previously always-on whenever a vehicle was selected (or, for
 * turret-cursor aim, in any non-Arena devtools mode), which leaked debug
 * visuals into normal gameplay. They are now gated behind explicit flags that a
 * devtools/debug panel may enable; production rendering never enables them.
 *
 * Selection rings, hover rings, HP bars, target indicators and labels are NOT
 * gated here — they are legitimate gameplay/devtools UI, not debug artifacts.
 */

export interface VehicleDebugOverlayFlags {
  /** Green line from a selected vehicle to its move target. */
  movementLine: boolean;
  /** Red dashed aim line from the turret. */
  aimLine: boolean;
  /** Direction arrow rendered outside the selection ring. */
  directionArrow: boolean;
  /** Red mount-point / socket debug circles. */
  mountPoints: boolean;
  /** Turret tracks the raw mouse cursor (manual/debug aim only). */
  turretCursorAim: boolean;
}

/**
 * The live flag state. Mutated only by explicit debug tooling. Defaults to all
 * `false` so nothing intrusive renders by default.
 */
export const vehicleDebugOverlays: VehicleDebugOverlayFlags = {
  movementLine: false,
  aimLine: false,
  directionArrow: false,
  mountPoints: false,
  turretCursorAim: false,
};

/** Set one debug overlay flag. Returns the new value. */
export function setVehicleDebugOverlay(
  key: keyof VehicleDebugOverlayFlags,
  value: boolean,
): boolean {
  vehicleDebugOverlays[key] = value;
  return value;
}

/** Toggle one debug overlay flag. Returns the new value. */
export function toggleVehicleDebugOverlay(
  key: keyof VehicleDebugOverlayFlags,
): boolean {
  vehicleDebugOverlays[key] = !vehicleDebugOverlays[key];
  return vehicleDebugOverlays[key];
}

/** Enable every debug overlay (debug panel "show all"). */
export function enableAllVehicleDebugOverlays(): void {
  (Object.keys(vehicleDebugOverlays) as Array<keyof VehicleDebugOverlayFlags>)
    .forEach((k) => { vehicleDebugOverlays[k] = true; });
}

/** Disable every debug overlay (restore the clean default view). */
export function disableAllVehicleDebugOverlays(): void {
  (Object.keys(vehicleDebugOverlays) as Array<keyof VehicleDebugOverlayFlags>)
    .forEach((k) => { vehicleDebugOverlays[k] = false; });
}
