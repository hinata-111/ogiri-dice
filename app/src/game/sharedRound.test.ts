import { describe, expect, it } from 'vitest';
import { gameReducer as reduce, initialState, type GameState } from './state';
import type { MapNode, Topic } from './types';

const topic: Topic = { id: 'common', prompt: '共通のお題', category: '日常', difficulty: 'Easy' };
const nodes: MapNode[] = [
  { id: 'start', name: '駅', kind: 'station', cell: 'normal', x: 0, y: 0, neighbors: ['blue'] },
  { id: 'blue', name: '', kind: 'stop', cell: 'blue', x: 1, y: 0, neighbors: ['start', 'red'] },
  { id: 'red', name: '', kind: 'stop', cell: 'red', x: 2, y: 0, neighbors: ['blue', 'dest'] },
  { id: 'dest', name: '劇場', kind: 'theater', cell: 'normal', x: 3, y: 0, neighbors: ['red'] },
];
function started() {
  return reduce(reduce(initialState, { type: 'SHOW_SETUP' }), { type: 'START_GAME',
    players: [{ name: '太郎', kind: 'human' }, { name: '花子', kind: 'human' }], nodes,
    startId: 'start', destinationId: 'dest', simultaneous: true });
}
function answering() { return reduce(started(), { type: 'BEGIN_ROUND', topic }); }
function submit(s: GameState, playerId: number) {
  return reduce(s, { type: 'SUBMIT_ROUND_ANSWER', round: s.round, playerId, answer: `回答${playerId}` });
}
function score(s: GameState, playerId: number, value: number) {
  return reduce(s, { type: 'ROUND_EVALUATED', round: s.round, playerId, result: { score: value, comment: '採点' } });
}

describe('共通お題ラウンド', () => {
  it('accepts every player once, and closes early only when everyone submitted', () => {
    let s = answering();
    expect(s.phase.name).toBe('roundAnswering');
    expect(s.usedTopicIds).toEqual(['common']);
    s = submit(s, 1);
    expect(s.phase.name).toBe('roundAnswering');
    expect(submit(s, 1)).toBe(s);
    expect(submit(s, 99)).toBe(s);
    expect(reduce(s, { type: 'SUBMIT_ANSWER', answer: '別経路' })).toBe(s);
    expect(reduce(s, { type: 'SUBMIT_ROUND_ANSWER', round: 0, playerId: 0, answer: '古い' })).toBe(s);
    s = submit(s, 0);
    expect(s.phase.name).toBe('roundEvaluating');
  });
  it('scores in any order without losing results and ignores stale/duplicate jobs', () => {
    let s = submit(submit(answering(), 1), 0);
    s = score(s, 1, 6);
    expect(s.phase.name).toBe('roundEvaluating');
    expect(score(s, 1, 1)).toBe(s);
    expect(reduce(s, { type: 'ROUND_EVALUATED', round: 0, playerId: 0, result: { score: 1, comment: '' } })).toBe(s);
    s = score(s, 0, 2);
    expect(s.phase.name).toBe('roundResults');
    s = reduce(s, { type: 'PROCEED' });
    expect(s.currentPlayerIndex).toBe(0);
    expect(s.phase).toEqual({ name: 'moving', remaining: 2, cameFrom: null });
    expect(s.bestAnswers).toMatchObject([{ playerName: '花子', answer: '回答1' }]);
  });
  it('times out only missing answers and falls back only unfinished evaluations', () => {
    let s = submit(answering(), 0);
    s = reduce(s, { type: 'CLOSE_ROUND' });
    expect(s.sharedRound?.entries[1].result?.score).toBe(1);
    s = reduce(s, { type: 'ROUND_EVALUATION_TIMEOUT' });
    expect(s.phase.name).toBe('roundResults');
    expect(s.sharedRound?.entries[0].result).toMatchObject({ score: 3, fallback: true });
    expect(s.sharedRound?.entries[1].result?.score).toBe(1);
    expect(score(s, 0, 6)).toBe(s);
  });
  it('retains the next player steps across blue and red challenges and starts a new round only after everyone moves', () => {
    let s = score(score(submit(submit(answering(), 0), 1), 0, 1), 1, 2);
    s = reduce(s, { type: 'PROCEED' });
    s = reduce(s, { type: 'STEP_TO', nodeId: 'blue' });
    expect(s.phase).toEqual({ name: 'challengeIntro', cellKind: 'blue' });
    s = reduce(s, { type: 'BEGIN_CHALLENGE', topic: { ...topic, id: 'extra-blue' } });
    s = reduce(s, { type: 'SUBMIT_ANSWER', answer: '追加' });
    s = reduce(s, { type: 'EVALUATED', result: { score: 4, comment: '' } });
    s = reduce(s, { type: 'PROCEED' });
    expect(s.players[0].money).toBe(220000);
    expect(s.currentPlayerIndex).toBe(1);
    expect(s.phase).toEqual({ name: 'moving', remaining: 2, cameFrom: null });
    s = reduce(s, { type: 'STEP_TO', nodeId: 'blue' });
    s = reduce(s, { type: 'STEP_TO', nodeId: 'red' });
    s = reduce(s, { type: 'BEGIN_CHALLENGE', topic: { ...topic, id: 'extra-red' }, target: 4 });
    s = reduce(s, { type: 'TIME_UP' });
    s = reduce(s, { type: 'PROCEED' });
    expect(s.players[1].money).toBe(10000);
    expect(s.round).toBe(2);
    expect(s.currentPlayerIndex).toBe(0);
    expect(s.sharedRound).toBeNull();
    expect(s.phase.name).toBe('turnStart');
    s = reduce(s, { type: 'BEGIN_ROUND', topic: { ...topic, id: 'next' } });
    expect(s.phase.name).toBe('roundAnswering');
  });
  it('ends immediately after a winning arrival, preserving the existing victory rule', () => {
    let s = score(score(submit(submit(answering(), 0), 1), 0, 3), 1, 2);
    s = { ...s, players: s.players.map((p, i) => ({ ...p, money: i === 0 ? 700000 : p.money })) };
    s = reduce(s, { type: 'PROCEED' });
    for (const nodeId of ['blue', 'red', 'dest']) s = reduce(s, { type: 'STEP_TO', nodeId });
    s = reduce(s, { type: 'ARRIVAL_DONE', nextDestinationId: 'start' });
    expect(s.phase.name).toBe('gameResult');
    expect(s.winnerId).toBe(0);
  });
});
