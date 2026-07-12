import type Phaser from 'phaser';
import type { GameState, MatchSetupSnapshot } from '../../state/types';
import {
  DEFAULT_SETUP,
  resolveResourceStyleForMapStyle,
  type GameSetupConfig,
} from '../../state/gameSetup';
import { evaluateMatchResult, resolveRestartSetup } from '../../state/matchResult';
import { MatchResultOverlay } from '../ui/MatchResultOverlay';

export function resolveLoadedGameSetup(
  state: GameState,
  mapId?: string,
): GameSetupConfig {
  if (state.matchSetup) return { ...state.matchSetup };
  const mapStyle = state.mapData.terrain.some(row =>
    row.some(tile => tile === 'industrial'),
  ) ? 'industrial' : 'sand';
  return {
    ...DEFAULT_SETUP,
    faction: state.playerFaction,
    mapId: mapId ?? 'customMap1',
    mapStyle,
    resourceStyle: resolveResourceStyleForMapStyle(mapStyle),
  };
}

export interface MatchResultSceneDeps {
  scene: Phaser.Scene;
  getState: () => GameState;
  getSetup: () => GameSetupConfig;
  setPaused: (paused: boolean) => void;
  disableInput: () => void;
}

export class MatchResultSceneController {
  private readonly overlay = new MatchResultOverlay();

  constructor(private readonly deps: MatchResultSceneDeps) {
    const state = deps.getState();
    state.matchSetup = { ...deps.getSetup() } as MatchSetupSnapshot;
    evaluateMatchResult(state);
  }

  showIfFinished(): boolean {
    const state = this.deps.getState();
    const result = evaluateMatchResult(state);
    if (result.outcome === 'ongoing') return false;
    if (this.overlay.isVisible()) return true;

    this.deps.setPaused(true);
    this.deps.disableInput();
    this.overlay.show(result, {
      onRestart: () => {
        const setup = resolveRestartSetup(
          state,
          this.deps.getSetup() as MatchSetupSnapshot,
        );
        this.deps.setPaused(false);
        this.deps.scene.scene.restart({ ...setup });
      },
      onMainMenu: () => {
        this.deps.setPaused(false);
        this.deps.scene.scene.start('MainMenuScene');
      },
    });
    return true;
  }

  destroy(): void {
    this.overlay.destroy();
  }
}
