/** Supported generated-map size options. */
export type MapSizeOption = 'small' | 'standard' | 'large';

/** Result of generated-map validation with deterministic retry fallback. */
export interface ValidatedGeneratedMapResult<TMapData> {
  mapData: TMapData;
  attempts: number;
  valid: boolean;
  warnings: string[];
}
