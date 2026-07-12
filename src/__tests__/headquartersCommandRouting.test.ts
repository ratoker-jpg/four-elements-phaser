import { describe, expect, it } from 'vitest';
import {
  determineCursorFeedback,
  routeRmbClick,
  type ClickTarget,
} from '../state/commandRouter';
import { selectOne } from '../state/unitSelection';

describe('SKIRMISH-P8B Headquarters command routing', () => {
  const enemyHeadquarters: ClickTarget = {
    kind: 'enemy-building',
    id: 'hq-team-green',
    tx: 4,
    ty: 4,
  };

  it('routes a selected production tank to attack an enemy Headquarters', () => {
    const selection = selectOne({ kind: 'combat', id: 'tank-1' });
    expect(routeRmbClick(enemyHeadquarters, selection)).toEqual({
      action: 'attack',
      targetId: 'hq-team-green',
      tx: 4,
      ty: 4,
    });
    expect(determineCursorFeedback(enemyHeadquarters, selection, false)).toBe('attack');
  });

  it('keeps non-combat units on movement behavior around enemy buildings', () => {
    const selection = selectOne({ kind: 'builder', id: 'builder-1' });
    expect(routeRmbClick(enemyHeadquarters, selection)).toEqual({
      action: 'move',
      tx: 4,
      ty: 4,
    });
    expect(determineCursorFeedback(enemyHeadquarters, selection, false)).toBe('move');
  });
});
