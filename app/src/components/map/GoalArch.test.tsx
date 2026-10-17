import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TokyoBoard } from './TokyoBoard';
import { initialState, type GameState } from '../../game/state';
import data from '../../data/map.json';
import type { MapNode } from '../../game/types';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('ゴールアーチは現在の目的地だけに現れ、切り替え・解除・ゲーム終了で元の地名に戻る', () => {
  const state: GameState = {
    ...initialState, nodes: data.nodes as MapNode[], destinationId: 'odaiba',
    players: [{ id: 0, name: 'プレイヤー1', kind: 'human', position: 'shinjuku', money: 100000, arrivals: 0 }],
    phase: { name: 'moving', remaining: 4, cameFrom: null },
  };
  const onStep = vi.fn();
  const { rerender } = render(<TokyoBoard state={state} onStep={onStep} />);
  expect(screen.getByRole('img', { name: 'お台場：今回のゴール' })).toBeTruthy();
  expect(screen.getAllByRole('img', { name: /今回のゴール/ })).toHaveLength(1);
  expect([...document.querySelectorAll('.tokyo-label')].some(label => label.textContent === 'お台場')).toBe(false);

  rerender(<TokyoBoard state={{ ...state, destinationId: 'asakusa' }} onStep={onStep} />);
  expect(screen.queryByRole('img', { name: 'お台場：今回のゴール' })).toBeNull();
  expect(screen.getByRole('img', { name: '浅草：今回のゴール' })).toBeTruthy();
  expect([...document.querySelectorAll('.tokyo-label')].some(label => label.textContent === 'お台場')).toBe(true);

  for (const next of [{ ...state, destinationId: null }, { ...state, phase: { name: 'gameResult' as const } }]) {
    rerender(<TokyoBoard state={next} onStep={onStep} />);
    expect(screen.queryByRole('img', { name: /今回のゴール/ })).toBeNull();
    expect([...document.querySelectorAll('.tokyo-label')].some(label => label.textContent === 'お台場')).toBe(true);
  }
  expect(onStep).not.toHaveBeenCalled();
});
