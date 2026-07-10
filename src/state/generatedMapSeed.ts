import type { MapSizeOption } from './generatedMapTypes';

/** Dimensions for each map size option. */
export const MAP_SIZE_DIMENSIONS: Record<MapSizeOption, { width: number; height: number }> = {
  small: { width: 32, height: 32 },
  standard: { width: 48, height: 48 },
  large: { width: 64, height: 64 },
};

/** Map ID prefix for generated maps. */
export const GENERATED_MAP_ID_PREFIX = 'generated';

/** Mulberry32 deterministic PRNG. */
export function createSeededRng(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normalize a numeric or textual seed to a signed 32-bit integer. */
export function normalizeSeed(input: string): number {
  const trimmed = input.trim();
  if (/^-?\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10) | 0;
  }

  let hash = 5381;
  for (let i = 0; i < trimmed.length; i++) {
    hash = ((hash << 5) + hash + trimmed.charCodeAt(i)) | 0;
  }
  return hash;
}

/** Create an 8-character hexadecimal seed for the UI randomize action. */
export function createRandomSeed(): string {
  return Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0');
}

export function mapSizeToDimensions(size: MapSizeOption): { width: number; height: number } {
  return MAP_SIZE_DIMENSIONS[size];
}

export function generatedMapName(seed: string, size: MapSizeOption): string {
  return `Generated (${size}, seed:${seed})`;
}

export function generatedMapId(seed: string, size: MapSizeOption): string {
  return `${GENERATED_MAP_ID_PREFIX}-${size}-${seed}`;
}

/** Detect a generated runtime state through the canonical generated map name. */
export function isGeneratedRuntimeState(state: { mapName: string }): boolean {
  return state.mapName.startsWith('Generated');
}
