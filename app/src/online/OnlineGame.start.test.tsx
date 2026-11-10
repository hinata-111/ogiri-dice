import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OnlineGame } from './OnlineGame';
import { GameView } from '../components/GameView';
import { seatKey, useRoom } from './useRoom';
import { gameReducer, initialState } from '../game/state';
import type { RoomSnapshot } from './protocol';
import type { MapNode } from '../game/types';
import mapData from '../data/map.json';

vi.mock('./useRoom', async (original) => ({
  ...await original<typeof import('./useRoom')>(), useRoom: vi.fn(),
}));

beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

function waitingRoom(): RoomSnapshot {
  const game = gameReducer(gameReducer(initialState, { type: 'SHOW_SETUP' }), {
    type: 'START_GAME', simultaneous: true, nodes: mapData.nodes as MapNode[],
    players: [{ name: '太郎', kind: 'human' }, { name: '花子', kind: 'human' }],
    startId: 'shinjuku', destinationId: 'shibuya',
  });
  return {
    code: 'ABCD2345', revision: 10, gameRevision: 1, hostId: 'host', game,
    members: [{ id: 'host', name: '太郎', connected: true, playerId: 0 }, { id: 'guest', name: '花子', connected: true, playerId: 1 }],
    deadline: null, expiresAt: 10000000, serverNow: 1000, expired: false,
  };
}

function show(room: RoomSnapshot, memberId: string, pending = false, status: 'connected' | 'disconnected' = 'connected') {
  localStorage.setItem(seatKey(room.code), JSON.stringify({ code: room.code, memberId, token: 'test-token' }));
  const send = vi.fn();
  vi.mocked(useRoom).mockReturnValue({ room, pending, status, send, remaining: 0, error: '', reconnect: vi.fn() });
  render(<OnlineGame initialCode={room.code} onExit={() => {}} />);
  return send;
}

it('shows the rules and lets the host explicitly start the common round', () => {
  const send = show(waitingRoom(), 'host');
  expect(screen.getByRole('list', { name: 'ゲームのルール' })).toBeTruthy();
  expect(screen.queryByLabelText('あなたの回答')).toBeNull();
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '大喜利をはじめる' }));
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'beginRound', revision: 10 });
});

it('lets other players read the rules while waiting for the host', () => {
  const send = show(waitingRoom(), 'guest');
  expect(screen.getByRole('list', { name: 'ゲームのルール' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
  expect(screen.getByText('太郎の開始操作を待っています')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '大喜利をはじめる' }));
  expect(send).not.toHaveBeenCalled();
});

it.each([{ pending: true, status: 'connected' as const }, { pending: false, status: 'disconnected' as const }])(
  'disables round start when pending=$pending and status=$status', ({ pending, status }) => {
    const send = show(waitingRoom(), 'host', pending, status);
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect((screen.getByRole('button', { name: '大喜利をはじめる' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '大喜利をはじめる' }));
    expect(send).not.toHaveBeenCalled();
  },
);

it('allows player 2 to start for a disconnected host even though it is not their movement turn', () => {
  const room = waitingRoom(); room.members[0].connected = false; room.game.round = 2;
  const send = show(room, 'guest');
  expect(screen.queryByRole('list', { name: 'ゲームのルール' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '大喜利をはじめる' }));
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'beginRound', revision: 10 });
});

it('does not reopen the rules next turn when another participant starts while I am reading', () => {
  const waiting = waitingRoom().game;
  const props = { dispatch: vi.fn(), remaining: 30000, cpuAnswer: null, online: true, canAct: false };
  const { rerender } = render(<GameView state={waiting} {...props}/>);
  expect(screen.getByRole('dialog',{name:'まずはルールを確認！'})).toBeTruthy();
  const answering = gameReducer(waiting, { type:'BEGIN_ROUND', topic:{ id:'common', prompt:'共通のお題', category:'日常', difficulty:'Easy' } });
  rerender(<GameView state={answering} {...props}/>);
  expect(screen.queryByRole('dialog')).toBeNull();
  rerender(<GameView state={{...waiting, round:2}} {...props}/>);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('heading',{name:'第2ターン'})).toBeTruthy();
});
