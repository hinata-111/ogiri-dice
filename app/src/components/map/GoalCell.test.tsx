import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TokyoBoard } from './TokyoBoard';
import { initialState, type GameState } from '../../game/state';
import type { MapNode } from '../../game/types';
import data from '../../data/map.json';

const nodes = data.nodes as MapNode[];
const stateAt = (position = 'shinjuku'): GameState => ({
  ...initialState, nodes, destinationId: 'odaiba',
  players: [{ id: 0, name: 'プレイヤー1', kind: 'human', position, money: 100000, arrivals: 0 }],
  phase: { name: 'moving', remaining: 4, cameFrom: null },
});
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('金色に光るマスは現在の目的地だけで、切り替え・解除・終了時は元に戻る', () => {
  const state = stateAt();
  const { rerender } = render(<TokyoBoard state={state} onStep={() => {}} />);
  const goldenCell = () => document.querySelectorAll('.tokyo-cell.goal');
  expect(goldenCell()).toHaveLength(1);
  expect(goldenCell()[0].getAttribute('data-cell-id')).toBe('odaiba');

  rerender(<TokyoBoard state={{ ...state, destinationId: 'asakusa' }} onStep={() => {}} />);
  expect(goldenCell()).toHaveLength(1);
  expect(goldenCell()[0].getAttribute('data-cell-id')).toBe('asakusa');
  const oldGoal = document.querySelector('[data-cell-id="odaiba"]')!;
  expect(oldGoal.classList.contains('goal')).toBe(false);
  expect(oldGoal.classList.contains('normal')).toBe(true);

  for (const next of [{ ...state, destinationId: null }, { ...state, phase: { name: 'gameResult' as const } }]) {
    rerender(<TokyoBoard state={next} onStep={() => {}} />);
    expect(goldenCell()).toHaveLength(0);
  }
});

it('金色のゴールでも移動できる輪郭と直接タップの操作を保つ', () => {
  const onStep = vi.fn();
  render(<TokyoBoard state={stateAt(nodes.find(n => n.id === 'odaiba')!.neighbors[0])} onStep={onStep} />);
  expect(document.querySelector('.tokyo-cell.goal.can-step')?.getAttribute('data-cell-id')).toBe('odaiba');
  fireEvent.click(screen.getByRole('button', { name: 'お台場へ進む' }));
  expect(onStep).toHaveBeenCalledExactlyOnceWith('odaiba');
});
