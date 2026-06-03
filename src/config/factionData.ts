/**
 * Production faction config data — full accepted data model for 4 factions.
 *
 * CORE-STEP-02B: Creates production faction configs alongside existing
 * blockout/dev faction data. Existing runtime faction data (gameSetup.ts
 * FACTION_LIST, FACTION_COLORS, etc.) remains the active runtime source.
 * Production configs will be wired into gameplay in later steps.
 *
 * All faction bonus values are reference placeholders, not final balance.
 * They follow the accepted faction identity from MECHANICS_DECISIONS:
 * - Passive mechanic only (no active abilities)
 * - Config-driven bonuses visible in faction selection UI
 * - No unique faction tech trees
 * - No direct damage bonuses
 *
 * Passive bonus direction per faction:
 * - cyan (Поток): mobility and fast tempo
 * - green (Росток): building and economy
 * - yellow (Искра): combat production
 * - purple (Око): vision and territory control
 */

import type {
  FactionConfig,
  AcceptedFactionId,
  FactionBonusKind,
} from './coreMechanicsTypes';

// ─── Accepted faction configs ────────────────────────────────────────

/** All 4 accepted production faction configs keyed by ID. */
export const FACTION_CONFIGS: Record<AcceptedFactionId, FactionConfig> = {

  // ── Поток — cyan, mobility and fast tempo ──────────────────────────
  cyan: {
    id: 'cyan',
    displayNameKey: 'faction_cyan',
    colorSubtitleKey: 'faction_color_cyan',
    bonusDescriptionKey: 'faction_bonus_cyan',
    roleKey: 'faction_role_cyan',
    primaryColor: '#00ffff',
    primaryColorNum: 0x00ffff,
    passiveBonus: {
      kind: 'mobility_tempo',
      effects: {
        civilUnitProductionSpeedMultiplier: 1.1,
      },
    },
  },

  // ── Росток — green, building and economy ───────────────────────────
  green: {
    id: 'green',
    displayNameKey: 'faction_green',
    colorSubtitleKey: 'faction_color_green',
    bonusDescriptionKey: 'faction_bonus_green',
    roleKey: 'faction_role_green',
    primaryColor: '#66ff66',
    primaryColorNum: 0x66ff66,
    passiveBonus: {
      kind: 'building_economy',
      effects: {
        buildingSpeedMultiplier: 1.1,
        processingSpeedMultiplier: 1.05,
      },
    },
  },

  // ── Искра — yellow, combat production ──────────────────────────────
  yellow: {
    id: 'yellow',
    displayNameKey: 'faction_yellow',
    colorSubtitleKey: 'faction_color_yellow',
    bonusDescriptionKey: 'faction_bonus_yellow',
    roleKey: 'faction_role_yellow',
    primaryColor: '#ffcc00',
    primaryColorNum: 0xffcc00,
    passiveBonus: {
      kind: 'combat_production',
      effects: {
        combatUnitProductionSpeedMultiplier: 1.1,
      },
    },
  },

  // ── Око — purple, vision and territory control ─────────────────────
  purple: {
    id: 'purple',
    displayNameKey: 'faction_purple',
    colorSubtitleKey: 'faction_color_purple',
    bonusDescriptionKey: 'faction_bonus_purple',
    roleKey: 'faction_role_purple',
    primaryColor: '#cc66ff',
    primaryColorNum: 0xcc66ff,
    passiveBonus: {
      kind: 'vision_territory',
      effects: {
        territoryVisionRadiusBonus: 1,
      },
    },
  },

}; // end FACTION_CONFIGS

// ─── Lookup helpers ──────────────────────────────────────────────────

/** Get a production faction config by ID. Returns undefined if not found. */
export function getFactionConfig(id: string): FactionConfig | undefined {
  return FACTION_CONFIGS[id as AcceptedFactionId];
}

/** All accepted faction IDs in stable order. */
export const ALL_ACCEPTED_FACTION_IDS: readonly AcceptedFactionId[] =
  Object.keys(FACTION_CONFIGS) as AcceptedFactionId[];

/** Mapping from bonus kind to faction id(s). */
export const BONUS_KIND_TO_FACTION: Record<FactionBonusKind, AcceptedFactionId> = {
  mobility_tempo: 'cyan',
  building_economy: 'green',
  combat_production: 'yellow',
  vision_territory: 'purple',
};
