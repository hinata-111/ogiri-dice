import { useEffect, useRef, useState } from 'react';
import type { RoomCommand, RoomSnapshot, Seat, ServerMessage } from './protocol';

export const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
class RoomRequestError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
export async function roomRequest(path: string, body: unknown) {
  const response = await fetch(`${API_BASE}/api/rooms${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await response.json();
  if (!response.ok) throw new RoomRequestError(data.error ?? '接続できませんでした', response.status);
  return data;
}
export const seatKey = (code: string) => `ogiri-room:${code}`;
export function loadSeat(code: string): Seat | null {
  try {
    const seat = JSON.parse(localStorage.getItem(seatKey(code)) ?? 'null');
    return seat?.code === code && typeof seat.token === 'string' && typeof seat.memberId === 'string' ? seat : null;
  } catch { return null; }
}

export function useRoom(seat: Seat | null) {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'replaced' | 'expired' | 'rejected'>('connecting');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const socket = useRef<WebSocket | null>(null);
  const latest = useRef<RoomSnapshot | null>(null);
  const previousSeat = useRef<Seat | null>(null);
  const pendingRef = useRef(false);
  const clock = useRef({ received: 0, remaining: 0 });

  useEffect(() => {
    if (!seat) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let terminal = false;
    if (previousSeat.current?.token !== seat.token || previousSeat.current?.code !== seat.code) {
      latest.current = null; setRoom(null);
    }
    previousSeat.current = seat; setError('');
    const connect = async () => {
      if (cancelled || terminal) return;
      setStatus('connecting'); setPending(false); pendingRef.current = false;
      try { await roomRequest(`/${seat.code}/resume`, { token: seat.token }); }
      catch (e) {
        if (cancelled) return;
        if (e instanceof RoomRequestError && [400, 403, 404, 410].includes(e.status)) {
          terminal = true; setStatus(e.status === 404 || e.status === 410 ? 'expired' : 'rejected'); return;
        }
        setStatus('disconnected'); retry = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 10_000)); return;
      }
      if (cancelled || terminal) return;
      const url = new URL(`${API_BASE}/api/rooms/${seat.code}/socket`, window.location.href);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(url); socket.current = ws;
      watchdog = setTimeout(() => ws.close(), 12_000);
      ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token: seat.token }));
      ws.onmessage = event => {
        if (cancelled || socket.current !== ws) return;
        let message: ServerMessage;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'snapshot') {
          if (latest.current && message.room.revision < latest.current.revision) return;
          clearTimeout(watchdog); attempts = 0;
          latest.current = message.room; setRoom(message.room); setStatus('connected');
          clock.current = { received: performance.now(), remaining: Math.max(0, (message.room.deadline ?? message.room.serverNow) - message.room.serverNow) };
          setRemaining(clock.current.remaining); pendingRef.current = false; setPending(false);
        } else if (message.type === 'error') { setError(message.message); pendingRef.current = false; setPending(false); }
        else if (message.type === 'replaced' || message.type === 'expired') { terminal = true; setStatus(message.type); }
      };
      ws.onclose = event => {
        if (cancelled || socket.current !== ws) return;
        clearTimeout(watchdog); pendingRef.current = false; setPending(false);
        if (event.code === 4001) { terminal = true; setStatus('replaced'); }
        if (event.code === 4003) { terminal = true; setStatus('rejected'); }
        if (event.code === 4004) { terminal = true; setStatus('expired'); }
        if (terminal) return;
        setStatus('disconnected');
        retry = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 10_000));
      };
      ws.onerror = () => { if (!cancelled && !terminal) setStatus('disconnected'); };
    };
    connect();
    const wake = () => {
      if (document.visibilityState === 'visible' && !terminal) {
        // Rebuild the connection effect even when there is no live socket to close.
        clearTimeout(retry);
        setGeneration(x => x + 1);
      }
    };
    document.addEventListener('visibilitychange', wake);
    return () => { cancelled = true; clearTimeout(retry); clearTimeout(watchdog); socket.current?.close(); document.removeEventListener('visibilitychange', wake); };
  }, [seat, generation]);

  useEffect(() => {
    const interval = setInterval(() => setRemaining(Math.max(0, clock.current.remaining - (performance.now() - clock.current.received))), 100);
    return () => clearInterval(interval);
  }, []);

  const send = (command: RoomCommand) => {
    if (status !== 'connected' || socket.current?.readyState !== WebSocket.OPEN || pendingRef.current) return;
    setError(''); pendingRef.current = true; setPending(true);
    socket.current.send(JSON.stringify(command));
  };
  return { room, status, error, pending, remaining, send, reconnect: () => setGeneration(x => x + 1) };
}
