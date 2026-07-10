import type { MapData } from './types';

/** Supported generated-map size options. */
export type MapSizeOption = 'small' | 'standard' | 'large';

/** Result of generated-map validation with deterministic retry fallback. */
export interface ValidatedGeneratedMapResult {
  mapData: MapData;
  attempts: number;
  valid: boolean;
  warnings: string[];
}
