import { describe, expect, it } from 'vitest';
import { initialState, type GameState } from '../game/state';
import { cuesForTransition, normalizePreferences } from './events';

const moving: GameState = { ...initialState, phase: { name: 'moving', remaining: 1, cameFrom: null }, players: [
  { id: 0, name: '太郎', kind: 'human', money: 100000, arrivals: 0, position: 'a' },
  { id: 1, name: '花子', kind: 'human', money: 100000, arrivals: 0, position: 'c' },
] };
describe('presentation cues observe game state without advancing it', () => {
  it('ignores repeated snapshots and connection-only copies', () => {
    expect(cuesForTransition(moving, structuredClone(moving))).toEqual([]);
  });
  it('hears the final step by player id even when the turn changes', () => {
    const next: GameState = { ...moving, currentPlayerIndex: 1, phase: { name: 'turnStart' }, players: moving.players.map(p => p.id === 0 ? { ...p, position: 'b' } : p) };
    expect(cuesForTransition(moving, next)).toEqual(['step', 'depart']);
    expect(cuesForTransition(moving, { ...next, players: moving.players })).toEqual(['depart']);
  });
  it('uses one arrival fanfare rather than overlapping it with a step', () => {
    expect(cuesForTransition(moving, { ...moving, phase: { name: 'arrival', nodeId: 'b' }, players: [{ ...moving.players[0], position: 'b' }, moving.players[1]] })).toEqual(['arrival']);
  });
  it('does not announce a score before the visual reveal', () => {
    const next: GameState = { ...moving, phase: { name: 'showingResult', topic: { id: '1', prompt: 'お題', category: '日常', difficulty: 'Easy' }, answer: '回答', context: { kind: 'main' }, result: { score: 6, comment: '大笑い' }, moneyDelta: 0 } };
    expect(cuesForTransition(moving, next)).toEqual(['roll']);
  });
  it('bounds and repairs persisted sound settings', () => {
    expect(normalizePreferences({ music: 9, effects: -1, muted: 'false' })).toEqual({ music: 1, effects: 0, muted: false });
    expect(normalizePreferences(null)).toEqual({ music: .35, effects: .65, muted: false });
    expect(normalizePreferences({ music: NaN, effects: 'loud', muted: true })).toEqual({ music: .35, effects: .65, muted: true });
  });
});
