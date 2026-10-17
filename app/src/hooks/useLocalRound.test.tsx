import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useReducer } from 'react';
import { gameReducer, initialState, type GameState } from '../game/state';
import { useLocalRound } from './useLocalRound';
import type { Evaluator } from '../ai/evaluator';
import type { MapNode, EvaluationResult } from '../game/types';
import map from '../data/map.json';
import { ONLINE_EVALUATION_MS } from '../game/rules';

function fixture() {
  let s = gameReducer(gameReducer(initialState, { type: 'SHOW_SETUP' }), { type: 'START_GAME', simultaneous: true,
    players: [{ name: '人', kind: 'human' }, { name: 'CPU', kind: 'cpu' }], nodes: map.nodes as MapNode[], startId: 'shinjuku', destinationId: 'shibuya' });
  return gameReducer(s, { type: 'BEGIN_ROUND', topic: { id: 'shared', prompt: '共通', category: '日常', difficulty: 'Easy' } });
}
function mount(start: GameState, evaluator: Evaluator) {
  return renderHook(() => {
    const [state, dispatch] = useReducer(gameReducer, start);
    useLocalRound(state, evaluator, dispatch);
    return { state, dispatch };
  });
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('does not regenerate CPU answers on a human submission and discards completion after the deadline', async () => {
  let finish!: (answer: string) => void;
  const cpuAnswer = vi.fn(() => new Promise<string>(resolve => { finish = resolve; }));
  const evaluator = { cpuAnswer, evaluate: vi.fn(async () => ({ score: 4, comment: '' })) };
  const { result } = mount(fixture(), evaluator);
  act(() => result.current.dispatch({ type: 'SUBMIT_ROUND_ANSWER', round: 1, playerId: 0, answer: '人の回答' }));
  expect(cpuAnswer).toHaveBeenCalledTimes(1);
  await act(async () => result.current.dispatch({ type: 'CLOSE_ROUND' }));
  await act(async () => finish('遅いCPU回答'));
  expect(result.current.state.sharedRound?.entries[1]).toMatchObject({ submitted: false, answer: '', result: { score: 1 } });
});

it('preserves finished scores, starts each evaluation once and times out only pending jobs', async () => {
  let s = fixture();
  for (const playerId of [0, 1]) s = gameReducer(s, { type: 'SUBMIT_ROUND_ANSWER', round: 1, playerId, answer: String(playerId) });
  let late!: (result: EvaluationResult) => void;
  const evaluate = vi.fn((_topic: string, answer: string) => answer === '0'
    ? Promise.resolve({ score: 6, comment: '完了' }) : new Promise<EvaluationResult>(resolve => { late = resolve; }));
  const { result } = mount(s, { evaluate, cpuAnswer: async () => '' });
  await act(async () => {});
  expect(evaluate).toHaveBeenCalledTimes(2);
  act(() => vi.advanceTimersByTime(ONLINE_EVALUATION_MS));
  expect(result.current.state.sharedRound?.entries.map(e => e.result?.score)).toEqual([6, 3]);
  await act(async () => late({ score: 5, comment: '遅延' }));
  expect(result.current.state.sharedRound?.entries[1].result?.score).toBe(3);
});

it('uses fallback answers and scores when evaluator calls reject', async () => {
  const evaluator = { cpuAnswer: async () => { throw new Error('offline'); }, evaluate: async () => { throw new Error('offline'); } };
  const { result } = mount(fixture(), evaluator);
  await act(async () => {});
  expect(result.current.state.sharedRound?.entries[1].submitted).toBe(true);
  await act(async () => result.current.dispatch({ type: 'SUBMIT_ROUND_ANSWER', round: 1, playerId: 0, answer: '回答' }));
  expect(result.current.state.phase.name).toBe('roundResults');
  expect(result.current.state.sharedRound?.entries.every(e => e.result?.fallback)).toBe(true);
});
