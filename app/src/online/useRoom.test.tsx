import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useRoom } from './useRoom';
import type { RoomSnapshot } from './protocol';
import { initialState } from '../game/state';

class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 1; sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { Socket.instances.push(this); }
  send(s: string) { this.sent.push(s); }
  close(code = 1000) { this.readyState = 3; this.onclose?.({ code }); }
  receive(msg: unknown) { this.onmessage?.({ data: JSON.stringify(msg) }); }
}
const seat = { code: 'ABCD2345', token: 'secret', memberId: '1' };
const room: RoomSnapshot = { code: seat.code, revision: 5, gameRevision: 2, hostId: '1', members: [], game: initialState, deadline: 17000, expiresAt: 100000, serverNow: 2000, expired: false };
beforeEach(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 }))); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); Socket.instances = []; });
describe('online connection lifecycle', async () => {
  it('authenticates off-URL, ignores older snapshots and blocks double send', async () => {
    vi.stubGlobal('WebSocket', Socket);
    const { result } = renderHook(() => useRoom(seat)); await act(async () => {}); const ws = Socket.instances[0];
    act(() => { ws.onopen?.(); ws.receive({ type: 'snapshot', room }); });
    expect(JSON.parse(ws.sent[0])).toEqual({ type: 'auth', token: 'secret' });
    act(() => result.current.send({ type: 'start', revision: 5 }));
    act(() => result.current.send({ type: 'start', revision: 5 }));
    expect(ws.sent).toHaveLength(2);
    act(() => ws.receive({ type: 'snapshot', room: { ...room, revision: 3 } }));
    expect(result.current.room?.revision).toBe(5);
    expect(result.current.pending).toBe(true);
  });
  it('locks input on disconnect and reauthenticates after reconnect', async () => {
    vi.useFakeTimers(); vi.stubGlobal('WebSocket', Socket);
    const { result } = renderHook(() => useRoom(seat)); await act(async () => {}); const ws = Socket.instances[0];
    act(() => ws.receive({ type: 'snapshot', room }));
    act(() => ws.close(1006));
    expect(result.current.status).toBe('disconnected');
    act(() => result.current.send({ type: 'start', revision: 5 }));
    expect(ws.sent).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(Socket.instances).toHaveLength(2);
  });
  it('does not reconnect over a replacement session', async () => {
    vi.useFakeTimers(); vi.stubGlobal('WebSocket', Socket);
    const { result } = renderHook(() => useRoom(seat)); await act(async () => {}); const ws = Socket.instances[0];
    act(() => { ws.receive({ type: 'replaced' }); ws.close(4001); vi.advanceTimersByTime(20000); });
    expect(result.current.status).toBe('replaced'); expect(Socket.instances).toHaveLength(1);
  });
});

it('stops reconnecting when a stored room no longer exists', async () => {
  vi.stubGlobal('WebSocket', Socket);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: '部屋がありません' }), { status: 404 })));
  const { result } = renderHook(() => useRoom(seat));
  await act(async () => {});
  expect(result.current.status).toBe('expired');
  expect(Socket.instances).toHaveLength(0);
});

it('resumes retrying when the phone becomes visible with an already closed socket', async () => {
  vi.useFakeTimers(); vi.stubGlobal('WebSocket', Socket);
  const { result } = renderHook(() => useRoom(seat)); await act(async () => {});
  const ws = Socket.instances[0];
  act(() => ws.close(1006));
  // Browsers do not dispatch another close event when close() is called on CLOSED.
  ws.close = () => {};
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(1500); });
  expect(Socket.instances).toHaveLength(2);
  act(() => Socket.instances[1].receive({ type: 'snapshot', room }));
  expect(result.current.status).toBe('connected');
});

it('retries after visibility returns when resume failed before a socket existed', async () => {
  vi.useFakeTimers(); vi.stubGlobal('WebSocket', Socket);
  const fetchFn = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetchFn);
  const { result } = renderHook(() => useRoom(seat)); await act(async () => {});
  expect(result.current.status).toBe('disconnected');
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(Socket.instances).toHaveLength(1);
  act(() => Socket.instances[0].receive({ type: 'snapshot', room }));
  expect(result.current.status).toBe('connected');
});
