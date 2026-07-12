from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'{label}: marker not found')
    return text.replace(old, new, 1)


# ── types.ts: persistent result and restart setup snapshot ────────────
path = 'src/state/types.ts'
text = read(path)
text = replace_once(
    text,
    "export type TeamController = 'human' | 'ai';\nexport type AiDifficulty = 'recruit' | 'lieutenant' | 'veteran';",
    "export type TeamController = 'human' | 'ai';\n"
    "export type AiDifficulty = 'recruit' | 'lieutenant' | 'veteran';\n\n"
    "export type MatchOutcome = 'ongoing' | 'victory' | 'defeat';\n\n"
    "export interface MatchResultState {\n"
    "  outcome: MatchOutcome;\n"
    "  winnerTeamId: TeamId | null;\n"
    "  defeatedTeamIds: TeamId[];\n"
    "  resolvedAtMs: number | null;\n"
    "}\n\n"
    "/** Serializable new-game setup used by result-screen restart. */\n"
    "export interface MatchSetupSnapshot {\n"
    "  faction: Faction;\n"
    "  mapId: string;\n"
    "  mapMode: 'fixed' | 'generated';\n"
    "  mapSize: 'small' | 'standard' | 'large';\n"
    "  seed: string;\n"
    "  gameMode: 'standard' | 'debug' | 'arena';\n"
    "  mapStyle: 'sand' | 'industrial';\n"
    "  resourceStyle: 'legacy' | 'industrial';\n"
    "}",
    'match result types',
)
text = replace_once(
    text,
    "  /** Canonical four-team state. Optional only for old saves and legacy fixtures. */\n"
    "  match?: MatchState;",
    "  /** Canonical four-team state. Optional only for old saves and legacy fixtures. */\n"
    "  match?: MatchState;\n"
    "  /** Persistent match result. Optional only for old saves and fixtures. */\n"
    "  matchResult?: MatchResultState;\n"
    "  /** Serializable setup used to restart with the same map seed/options. */\n"
    "  matchSetup?: MatchSetupSnapshot;",
    'GameState result fields',
)
write(path, text)


# ── matchResult.ts: one-shot deterministic result state ───────────────
match_result = '''import type {
  GameState,
  MatchResultState,
  MatchSetupSnapshot,
  TeamId,
} from './types';
import { ensureMatchState, TEAM_IDS, teamIdForFaction } from './matchState';
import { getMapHeadquarters } from './mapHeadquarters';

const TEAM_ID_SET = new Set<TeamId>(TEAM_IDS);

export function createOngoingMatchResult(): MatchResultState {
  return {
    outcome: 'ongoing',
    winnerTeamId: null,
    defeatedTeamIds: [],
    resolvedAtMs: null,
  };
}

export function normalizeMatchResultState(state: GameState): MatchResultState {
  const raw = state.matchResult;
  const outcome = raw?.outcome === 'victory' || raw?.outcome === 'defeat'
    ? raw.outcome
    : 'ongoing';
  const defeatedTeamIds = Array.isArray(raw?.defeatedTeamIds)
    ? [...new Set(raw.defeatedTeamIds.filter((id): id is TeamId => TEAM_ID_SET.has(id)))]
    : [];
  const winnerTeamId = raw?.winnerTeamId && TEAM_ID_SET.has(raw.winnerTeamId)
    ? raw.winnerTeamId
    : null;
  const resolvedAtMs = outcome === 'ongoing'
    ? null
    : Math.max(0, Number.isFinite(raw?.resolvedAtMs) ? raw!.resolvedAtMs! : state.combatClockMs ?? 0);

  state.matchResult = {
    outcome,
    winnerTeamId: outcome === 'victory' ? winnerTeamId : null,
    defeatedTeamIds,
    resolvedAtMs,
  };
  return state.matchResult;
}

/** Resolve Victory/Defeat exactly once. Defeat wins simultaneous-destruction ties. */
export function evaluateMatchResult(state: GameState): MatchResultState {
  const current = normalizeMatchResultState(state);
  if (current.outcome !== 'ongoing') return current;

  const match = ensureMatchState(state);
  const defeatedTeamIds = TEAM_IDS.filter(teamId => match.teams[teamId].eliminated);
  const resolvedAtMs = Math.max(0, state.combatClockMs ?? 0);

  if (match.teams[match.humanTeamId].eliminated) {
    state.matchResult = {
      outcome: 'defeat',
      winnerTeamId: null,
      defeatedTeamIds,
      resolvedAtMs,
    };
    return state.matchResult;
  }

  const enemyHeadquarters = getMapHeadquarters(state.mapData).filter(hq =>
    (hq.ownerTeamId ?? teamIdForFaction(hq.faction)) !== match.humanTeamId,
  );
  const allThreeEnemiesDefeated = enemyHeadquarters.length === 3
    && enemyHeadquarters.every(hq => {
      const ownerTeamId = hq.ownerTeamId ?? teamIdForFaction(hq.faction);
      return hq.isDestroyed === true || match.teams[ownerTeamId].eliminated;
    });

  if (allThreeEnemiesDefeated) {
    state.matchResult = {
      outcome: 'victory',
      winnerTeamId: match.humanTeamId,
      defeatedTeamIds,
      resolvedAtMs,
    };
  }
  return state.matchResult!;
}

export function isMatchFinished(state: GameState): boolean {
  return normalizeMatchResultState(state).outcome !== 'ongoing';
}

function isSetupSnapshot(value: MatchSetupSnapshot | undefined): value is MatchSetupSnapshot {
  return !!value
    && typeof value.seed === 'string'
    && typeof value.mapId === 'string'
    && (value.mapMode === 'fixed' || value.mapMode === 'generated')
    && (value.mapSize === 'small' || value.mapSize === 'standard' || value.mapSize === 'large')
    && (value.gameMode === 'standard' || value.gameMode === 'debug' || value.gameMode === 'arena')
    && (value.mapStyle === 'sand' || value.mapStyle === 'industrial')
    && (value.resourceStyle === 'legacy' || value.resourceStyle === 'industrial');
}

export function resolveRestartSetup(
  state: GameState,
  fallback: MatchSetupSnapshot,
): MatchSetupSnapshot {
  return { ...(isSetupSnapshot(state.matchSetup) ? state.matchSetup : fallback) };
}
'''
write('src/state/matchResult.ts', match_result)


# ── createInitialState.ts: explicit ongoing result ────────────────────
path = 'src/state/createInitialState.ts'
text = read(path)
text = replace_once(
    text,
    "import { getMapHeadquarters, normalizeMapHeadquarters } from './mapHeadquarters';",
    "import { getMapHeadquarters, normalizeMapHeadquarters } from './mapHeadquarters';\n"
    "import { createOngoingMatchResult } from './matchResult';",
    'initial result import',
)
text = replace_once(
    text,
    "    playerFaction: faction,\n    extraHarvesters,",
    "    playerFaction: faction,\n"
    "    matchResult: createOngoingMatchResult(),\n"
    "    extraHarvesters,",
    'initial ongoing result',
)
write(path, text)


# ── updateGameState.ts: freeze and resolve at pure-state boundary ─────
path = 'src/state/updateGameState.ts'
text = read(path)
text = replace_once(
    text,
    "import { updateAllCombatUnitCombat } from './combatUnitCombat';",
    "import { updateAllCombatUnitCombat } from './combatUnitCombat';\n"
    "import { evaluateMatchResult, isMatchFinished } from './matchResult';",
    'result loop import',
)
text = replace_once(
    text,
    "export function updateGameState(state: GameState, deltaMs: number): void {\n"
    "  ensureMatchState(state);",
    "export function updateGameState(state: GameState, deltaMs: number): void {\n"
    "  if (isMatchFinished(state)) return;\n"
    "  ensureMatchState(state);",
    'finished loop guard',
)
text = replace_once(
    text,
    "  // ARCH-01E: Recompute power state after separator processing and factory production\n"
    "  recomputePower(state);\n}",
    "  // ARCH-01E: Recompute power state after separator processing and factory production\n"
    "  recomputePower(state);\n"
    "  evaluateMatchResult(state);\n}",
    'result evaluation',
)
write(path, text)


# ── saveGame.ts: schema v8 result/setup persistence ───────────────────
path = 'src/state/saveGame.ts'
text = read(path)
text = replace_once(
    text,
    "import { normalizeHeadquartersCombatState } from './headquartersCombat';",
    "import { normalizeHeadquartersCombatState } from './headquartersCombat';\n"
    "import { normalizeMatchResultState } from './matchResult';",
    'save result import',
)
text = replace_once(
    text,
    "/** Current save format version. Phase 8A: canonical Headquarters durability and elimination. */\n"
    "const SAVE_VERSION = 7;",
    "/** Current save format version. Phase 8C: persistent match result and restart setup. */\n"
    "const SAVE_VERSION = 8;",
    'save v8',
)
text = text.replace('Accepts migrations from v1-v7.', 'Accepts migrations from v1-v8.', 1)
text = text.replace('Accept v1-v7; loadGame performs field migrations.', 'Accept v1-v8; loadGame performs field migrations.', 1)
text = replace_once(
    text,
    "  if (![1, 2, 3, 4, 5, 6, 7].includes(s.version as number)) return false;",
    "  if (![1, 2, 3, 4, 5, 6, 7, 8].includes(s.version as number)) return false;",
    'accepted v8',
)
text = replace_once(
    text,
    "  normalizeCivilUnitState(clone);\n  normalizeHeadquartersCombatState(clone);",
    "  normalizeCivilUnitState(clone);\n"
    "  normalizeHeadquartersCombatState(clone);\n"
    "  normalizeMatchResultState(clone);",
    'sanitize match result',
)
text = replace_once(
    text,
    "  normalizeCivilUnitState(gs);\n  normalizeHeadquartersCombatState(gs);",
    "  normalizeCivilUnitState(gs);\n"
    "  normalizeHeadquartersCombatState(gs);\n"
    "  normalizeMatchResultState(gs);",
    'load match result',
)
write(path, text)


# ── MatchResultOverlay.ts: single blocking result UX ──────────────────
overlay = '''import type { MatchResultState } from '../../state/types';

export interface MatchResultOverlayCallbacks {
  onRestart: () => void;
  onMainMenu: () => void;
}

export class MatchResultOverlay {
  private root: HTMLDivElement | null = null;

  show(result: MatchResultState, callbacks: MatchResultOverlayCallbacks): void {
    if (result.outcome === 'ongoing' || this.root) return;

    const root = document.createElement('div');
    root.id = 'match-result-overlay';
    root.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:10000',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(6,10,18,.78)', 'backdrop-filter:blur(5px)',
      'font-family:Arial,sans-serif', 'pointer-events:auto',
    ].join(';');

    const panel = document.createElement('section');
    panel.style.cssText = [
      'min-width:360px', 'max-width:560px', 'padding:36px',
      'border:2px solid #d7a94b', 'border-radius:14px',
      'background:linear-gradient(180deg,#242018,#14130f)',
      'box-shadow:0 24px 80px rgba(0,0,0,.65)', 'text-align:center',
      'color:#f6e4b6',
    ].join(';');

    const title = document.createElement('h1');
    title.textContent = result.outcome === 'victory' ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
    title.style.cssText = `margin:0 0 12px;font-size:46px;letter-spacing:4px;color:${result.outcome === 'victory' ? '#78e08f' : '#ff7675'}`;

    const text = document.createElement('p');
    text.textContent = result.outcome === 'victory'
      ? 'Все три вражеских штаба уничтожены.'
      : 'Твой штаб уничтожен.';
    text.style.cssText = 'margin:0 0 28px;font-size:18px;color:#ddd2b8';

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:12px;justify-content:center';
    actions.append(
      this.button('Повторить тот же бой', callbacks.onRestart, true),
      this.button('В главное меню', callbacks.onMainMenu, false),
    );
    panel.append(title, text, actions);
    root.append(panel);
    document.body.append(root);
    this.root = root;
  }

  isVisible(): boolean {
    return this.root !== null;
  }

  destroy(): void {
    this.root?.remove();
    this.root = null;
  }

  private button(label: string, onClick: () => void, primary: boolean): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = [
      'padding:12px 18px', 'border-radius:8px', 'cursor:pointer',
      `border:1px solid ${primary ? '#e4bd68' : '#6c6250'}`,
      `background:${primary ? '#8a6427' : '#2b2924'}`,
      'color:#fff3d1', 'font-size:15px', 'font-weight:700',
    ].join(';');
    button.addEventListener('click', onClick, { once: true });
    return button;
  }
}
'''
write('src/phaser/ui/MatchResultOverlay.ts', overlay)


# ── GameScene.ts: save setup, freeze input, show result once ──────────
path = 'src/phaser/GameScene.ts'
text = read(path)
text = replace_once(
    text,
    "import type { GameState, BuildingType, ProducibleUnitType, TerrainType } from '../state/types';",
    "import type { GameState, BuildingType, ProducibleUnitType, TerrainType, MatchSetupSnapshot } from '../state/types';",
    'GameScene setup type',
)
text = replace_once(
    text,
    "import { PauseMenu } from './ui/PauseMenu';",
    "import { PauseMenu } from './ui/PauseMenu';\n"
    "import { MatchResultOverlay } from './ui/MatchResultOverlay';\n"
    "import { evaluateMatchResult, isMatchFinished, resolveRestartSetup } from '../state/matchResult';",
    'GameScene result imports',
)
text = replace_once(
    text,
    "  private pauseMenu: PauseMenu | null = null;\n  private gameState!: GameState;",
    "  private pauseMenu: PauseMenu | null = null;\n"
    "  private matchResultOverlay: MatchResultOverlay | null = null;\n"
    "  private gameState!: GameState;",
    'overlay field',
)
text = replace_once(
    text,
    "      this.setupConfig = {\n        ...DEFAULT_SETUP,\n        faction: data.loadedGameState.playerFaction,\n        mapId: data.mapId ?? 'customMap1',\n        mapStyle: inferredStyle,\n        resourceStyle: resolveResourceStyleForMapStyle(inferredStyle),\n      };",
    "      this.setupConfig = data.loadedGameState.matchSetup\n"
    "        ? { ...data.loadedGameState.matchSetup }\n"
    "        : {\n"
    "          ...DEFAULT_SETUP,\n"
    "          faction: data.loadedGameState.playerFaction,\n"
    "          mapId: data.mapId ?? 'customMap1',\n"
    "          mapStyle: inferredStyle,\n"
    "          resourceStyle: resolveResourceStyleForMapStyle(inferredStyle),\n"
    "        };",
    'loaded setup snapshot',
)
text = replace_once(
    text,
    "    // CORE-STEP-06H+: Initialize tile reservation map for grid movement\n"
    "    this.reservationMap = new TileReservationMap(this.gameState.mapWidth);",
    "    this.gameState.matchSetup = { ...this.setupConfig } as MatchSetupSnapshot;\n"
    "    evaluateMatchResult(this.gameState);\n\n"
    "    // CORE-STEP-06H+: Initialize tile reservation map for grid movement\n"
    "    this.reservationMap = new TileReservationMap(this.gameState.mapWidth);",
    'persist setup snapshot',
)
text = replace_once(
    text,
    "      `[GameScene] State-driven scene ready. Map: ${s.mapName} | ` +\n"
    "      `Size: ${s.mapWidth}x${s.mapHeight} | ` +\n"
    "      `Harvesters: ${s.harvesters.length} | ` +\n"
    "      `Resources: ${s.resourceNodes.length} | ` +\n"
    "      `Drag: pan | Wheel: zoom | HOME: reset camera | T: debug overlay | S: Stop | F: Factory | R: Element Storage | 1-9: control groups | Ctrl+1-9: assign group`,\n"
    "    );\n  }",
    "      `[GameScene] State-driven scene ready. Map: ${s.mapName} | ` +\n"
    "      `Size: ${s.mapWidth}x${s.mapHeight} | ` +\n"
    "      `Harvesters: ${s.harvesters.length} | ` +\n"
    "      `Resources: ${s.resourceNodes.length} | ` +\n"
    "      `Drag: pan | Wheel: zoom | HOME: reset camera | T: debug overlay | S: Stop | F: Factory | R: Element Storage | 1-9: control groups | Ctrl+1-9: assign group`,\n"
    "    );\n"
    "    this.finishMatchIfNeeded();\n"
    "  }",
    'show loaded result',
)
text = replace_once(
    text,
    "      updateGameState(this.gameState, delta);\n      assignIdleBuilders(this.gameState);",
    "      updateGameState(this.gameState, delta);\n"
    "      if (this.finishMatchIfNeeded()) return;\n"
    "      assignIdleBuilders(this.gameState);",
    'frame result boundary',
)
helper_marker = """  // ─── Helpers ────────────────────────────────────────────────────

  /**
   * ARENA-VISUAL-COMBAT-FIX-01 Fix 6: Compute barrel tip screen position.
"""
helper = """  // ─── Helpers ────────────────────────────────────────────────────

  private finishMatchIfNeeded(): boolean {
    const result = evaluateMatchResult(this.gameState);
    if (result.outcome === 'ongoing') return false;
    if (this.matchResultOverlay?.isVisible()) return true;

    this.paused = true;
    this.inputController?.destroy();
    this.inputController = null;
    this.matchResultOverlay = new MatchResultOverlay();
    this.matchResultOverlay.show(result, {
      onRestart: () => {
        const restartSetup = resolveRestartSetup(
          this.gameState,
          this.setupConfig as MatchSetupSnapshot,
        );
        this.paused = false;
        this.scene.restart({ ...restartSetup });
      },
      onMainMenu: () => {
        this.paused = false;
        this.scene.start('MainMenuScene');
      },
    });
    return true;
  }

  /**
   * ARENA-VISUAL-COMBAT-FIX-01 Fix 6: Compute barrel tip screen position.
"""
text = replace_once(text, helper_marker, helper, 'finish match helper')
text = replace_once(
    text,
    "    this.pauseMenu?.destroy();\n    this.pauseMenu = null;",
    "    this.pauseMenu?.destroy();\n"
    "    this.pauseMenu = null;\n"
    "    this.matchResultOverlay?.destroy();\n"
    "    this.matchResultOverlay = null;",
    'overlay cleanup',
)
write(path, text)


# ── focused P8C tests ─────────────────────────────────────────────────
test = '''import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGeneratedMapData } from '../state/generatedMap';
import { createInitialState } from '../state/createInitialState';
import { applyHeadquartersDamage } from '../state/headquartersCombat';
import {
  createOngoingMatchResult,
  evaluateMatchResult,
  isMatchFinished,
  resolveRestartSetup,
} from '../state/matchResult';
import { updateGameState } from '../state/updateGameState';
import {
  loadGame,
  resetSaveStorage,
  saveGame,
  setSaveStorage,
  type SaveStorage,
} from '../state/saveGame';
import type { GameState, MatchSetupSnapshot } from '../state/types';

class MemoryStorage implements SaveStorage {
  values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): boolean { this.values.set(key, value); return true; }
  removeItem(key: string): void { this.values.delete(key); }
}

function state(): GameState {
  return createInitialState(
    createGeneratedMapData('p8c-result-seed', 'standard', 'cyan'),
    'cyan',
  );
}

const SETUP: MatchSetupSnapshot = {
  faction: 'cyan',
  mapId: 'generated-standard-p8c-result-seed',
  mapMode: 'generated',
  mapSize: 'standard',
  seed: 'p8c-result-seed',
  gameMode: 'standard',
  mapStyle: 'industrial',
  resourceStyle: 'industrial',
};

describe('SKIRMISH-P8C persistent match result', () => {
  beforeEach(() => setSaveStorage(new MemoryStorage()));
  afterEach(() => resetSaveStorage());

  it('starts ongoing and does not resolve after only one enemy elimination', () => {
    const current = state();
    expect(current.matchResult).toEqual(createOngoingMatchResult());
    applyHeadquartersDamage(current, 'team-cyan', 'hq-team-green', 99999);
    expect(evaluateMatchResult(current).outcome).toBe('ongoing');
    expect(isMatchFinished(current)).toBe(false);
  });

  it('resolves Defeat exactly once when the human Headquarters is destroyed', () => {
    const current = state();
    current.combatClockMs = 1200;
    applyHeadquartersDamage(current, 'team-green', 'hq-team-cyan', 99999);
    const first = evaluateMatchResult(current);
    expect(first).toEqual(expect.objectContaining({
      outcome: 'defeat',
      winnerTeamId: null,
      resolvedAtMs: 1200,
    }));
    current.combatClockMs = 9000;
    const second = evaluateMatchResult(current);
    expect(second).toBe(first);
    expect(second.resolvedAtMs).toBe(1200);
  });

  it('resolves Victory only after all three enemy Headquarters are destroyed', () => {
    const current = state();
    applyHeadquartersDamage(current, 'team-cyan', 'hq-team-green', 99999);
    applyHeadquartersDamage(current, 'team-cyan', 'hq-team-yellow', 99999);
    expect(evaluateMatchResult(current).outcome).toBe('ongoing');
    current.combatClockMs = 5000;
    applyHeadquartersDamage(current, 'team-cyan', 'hq-team-purple', 99999);
    expect(evaluateMatchResult(current)).toEqual(expect.objectContaining({
      outcome: 'victory',
      winnerTeamId: 'team-cyan',
      defeatedTeamIds: ['team-green', 'team-yellow', 'team-purple'],
      resolvedAtMs: 5000,
    }));
  });

  it('freezes pure game-state advancement after a result', () => {
    const current = state();
    applyHeadquartersDamage(current, 'team-green', 'hq-team-cyan', 99999);
    evaluateMatchResult(current);
    const civilClock = current.civilClockMs;
    const combatClock = current.combatClockMs;
    updateGameState(current, 1000);
    expect(current.civilClockMs).toBe(civilClock);
    expect(current.combatClockMs).toBe(combatClock);
  });

  it('round-trips result and same-seed restart setup through save v8', () => {
    const current = state();
    current.matchSetup = { ...SETUP };
    applyHeadquartersDamage(current, 'team-green', 'hq-team-cyan', 99999);
    evaluateMatchResult(current);
    const saved = saveGame(current, current.mapId);
    expect(saved.success).toBe(true);
    const loaded = loadGame(saved.slotId!);
    expect(loaded.success).toBe(true);
    expect(loaded.gameState!.matchResult).toEqual(current.matchResult);
    expect(resolveRestartSetup(loaded.gameState!, { ...SETUP, seed: 'fallback' }))
      .toEqual(SETUP);
  });

  it('uses a safe fallback setup for legacy saves without a snapshot', () => {
    const current = state();
    delete current.matchSetup;
    expect(resolveRestartSetup(current, SETUP)).toEqual(SETUP);
  });
});
'''
write('src/__tests__/matchResult.test.ts', test)

print('SKIRMISH-P8C patch applied')
