import { DurableObject } from 'cloudflare:workers';
import { createRoom, joinRoom, connectMember, disconnectMember, leaveRoom, command, tick, evaluated, roundEvaluated, nextAlarm, snapshot, type RoomData } from './roomModel';
import { WorkerEvaluator } from './workerEvaluator';
import { MockEvaluator } from '../../app/src/ai/mock';
import type { Evaluator } from '../../app/src/ai/evaluator';
import { FALLBACK_EVALUATION } from '../../app/src/ai/evaluator';

export interface RoomEnv { ROOMS: DurableObjectNamespace; GEMINI_API_KEY: string; USE_MOCK?: string }
interface Attachment { id: string; token?: string; authBy: number; window: number; count: number }
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
export const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('入力が空です');
  let text = ''; let size = 0; const decoder = new TextDecoder();
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new Error('入力が長すぎます'); }
      text += decoder.decode(value, { stream: true });
    }
    const value = JSON.parse(text + decoder.decode());
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('入力が不正です');
    return value;
  } finally { reader.releaseLock(); }
}

export class GameRoom extends DurableObject<RoomEnv> {
  private data: RoomData | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  private evaluator: Evaluator;
  private jobs = new Set<string>();
  constructor(ctx: DurableObjectState, env: RoomEnv) {
    super(ctx, env);
    this.evaluator = env.USE_MOCK === '1' ? new MockEvaluator(50) : new WorkerEvaluator(env.GEMINI_API_KEY);
    ctx.blockConcurrencyWhile(async () => {
      this.data = await ctx.storage.get<RoomData>('room');
      if (!this.data) return;
      const liveIds = new Set(ctx.getWebSockets().map(ws => (ws.deserializeAttachment() as Attachment).id));
      for (const m of this.data.members) {
        if (m.connectionId && !liveIds.has(m.connectionId)) disconnectMember(this.data, m.token, m.connectionId, Date.now());
      }
      tick(this.data, Date.now());
      await this.save();
    });
  }
  // Serialize complete read/validate/persist operations, including across awaits.
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn); this.queue = next.catch(() => {}); return next;
  }
  private send(ws: WebSocket, value: unknown) {
    try { ws.send(JSON.stringify(value)); } catch { /* Close event updates presence. */ }
  }
  private authorized(ws: WebSocket): boolean {
    const a = ws.deserializeAttachment() as Attachment;
    return !!a.token && !!this.data?.members.some(m => m.token === a.token && m.connectionId === a.id);
  }
  private async save() {
    const r = this.data; if (!r) return;
    if (r.expired) {
      for (const ws of this.ctx.getWebSockets()) { this.send(ws, { type: 'expired' }); ws.close(4004, 'expired'); }
      await this.ctx.storage.deleteAlarm(); await this.ctx.storage.deleteAll(); return;
    }
    await this.ctx.storage.put('room', r);
    const unauth = this.ctx.getWebSockets().flatMap(ws => {
      const a = ws.deserializeAttachment() as Attachment;
      return a.token || ws.readyState !== WebSocket.OPEN || a.authBy <= Date.now() ? [] : [a.authBy];
    });
    await this.ctx.storage.setAlarm(Math.min(nextAlarm(r), ...unauth));
    const message = { type: 'snapshot', room: snapshot(r, Date.now()) };
    for (const ws of this.ctx.getWebSockets()) if (this.authorized(ws)) this.send(ws, message);
    this.startEvaluations();
  }
  private startEvaluations() {
    const r = this.data;
    if (!r || r.expired) return;
    const phase = r.game.phase;
    const shared = r.game.sharedRound;
    const round = r.game.round;
    const jobs = phase.name === 'roundEvaluating' && shared
      ? shared.entries.filter(e => e.submitted && !e.result).map(e => ({
        key: `round:${round}:${e.playerId}`, prompt: shared.topic.prompt, answer: e.answer, playerId: e.playerId, revision: r.gameRevision,
      }))
      : phase.name === 'evaluating'
        ? [{ key: `single:${r.gameRevision}`, prompt: phase.topic.prompt, answer: phase.answer, playerId: null, revision: r.gameRevision }]
        : [];
    for (const job of jobs) {
      if (this.jobs.has(job.key)) continue;
      this.jobs.add(job.key);
      this.ctx.waitUntil(this.evaluator.evaluate(job.prompt, job.answer).catch(() => FALLBACK_EVALUATION).then(result => this.serial(async () => {
        if (!this.data || this.data.expired) return;
        if (job.playerId === null) evaluated(this.data, job.revision, result, Date.now());
        else roundEvaluated(this.data, round, job.playerId, result, Date.now());
        await this.save();
      })).finally(() => { this.jobs.delete(job.key); }));
    }
  }
  private async advance() {
    if (!this.data) return;
    const rev = this.data.revision; tick(this.data, Date.now());
    if (rev !== this.data.revision) await this.save();
  }
  async fetch(request: Request): Promise<Response> {
    return this.serial(async () => {
      try {
        const path = new URL(request.url).pathname;
        await this.advance();
        if (path === '/create' && request.method === 'POST') {
          if (this.data) return reply({ error: 'collision' }, 409);
          const body = await readBody(request);
          const token = crypto.randomUUID();
          this.data = createRoom(String(body.code), body.name as string, token, Date.now());
          await this.save();
          return reply({ code: this.data.code, token, memberId: this.data.members[0].id }, 201);
        }
        const r = this.data;
        if (!r || r.expired) return reply({ error: '部屋が見つかりません。有効期限をご確認ください' }, 404);
        if (path === '/socket' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
          if (this.ctx.getWebSockets().length >= 16) return reply({ error: '接続が多すぎます。少し待って再接続してください' }, 429);
          const pair = new WebSocketPair(); const server = pair[1];
          server.serializeAttachment({ id: crypto.randomUUID(), authBy: Date.now() + 10_000, window: Date.now(), count: 0 } satisfies Attachment);
          this.ctx.acceptWebSocket(server);
          await this.ctx.storage.setAlarm(Math.min(nextAlarm(r), Date.now() + 10_000));
          return new Response(null, { status: 101, webSocket: pair[0] });
        }
        if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
        const body = await readBody(request);
        if (path === '/resume') {
          if (typeof body.token !== 'string' || !r.members.some(m => m.token === body.token)) return reply({ error: '参加情報が無効です。部屋に入り直してください' }, 403);
          return reply({ ok: true });
        }
        if (path === '/join') {
          const token = crypto.randomUUID(); const m = joinRoom(r, body.name as string, token, Date.now());
          await this.save(); return reply({ code: r.code, token, memberId: m.id });
        }
        if (path === '/leave' && typeof body.token === 'string') {
          leaveRoom(r, body.token, Date.now());
          for (const ws of this.ctx.getWebSockets()) {
            if ((ws.deserializeAttachment() as Attachment).token === body.token) ws.close(1000, 'left');
          }
          await this.save(); return reply({ ok: true });
        }
        return reply({ error: 'not_found' }, 404);
      } catch (error) { return reply({ error: error instanceof Error ? error.message : '操作に失敗しました' }, 400); }
    });
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    return this.serial(async () => {
      const a = ws.deserializeAttachment() as Attachment;
      try {
        await this.advance();
        const r = this.data;
        if (!r || r.expired) { ws.close(4004, 'expired'); return; }
        if (typeof message !== 'string' || message.length > 4096) { ws.close(1009, 'too large'); return; }
        if (Date.now() - a.window > 10_000) { a.window = Date.now(); a.count = 0; }
        if (++a.count > 30) { ws.close(1008, 'rate limited'); return; }
        ws.serializeAttachment(a);
        const raw = JSON.parse(message);
        if (!a.token) {
          if (Date.now() >= a.authBy || raw?.type !== 'auth' || typeof raw.token !== 'string') throw new Error('参加情報が無効です');
          connectMember(r, raw.token, a.id, Date.now());
          a.token = raw.token; ws.serializeAttachment(a);
          for (const old of this.ctx.getWebSockets()) {
            if (old !== ws && (old.deserializeAttachment() as Attachment).token === a.token) {
              this.send(old, { type: 'replaced' }); old.close(4001, 'replaced');
            }
          }
          await this.save(); return;
        }
        if (!this.authorized(ws)) { ws.close(4001, 'replaced'); return; }
        command(r, a.token, raw, Date.now());
        await this.save();
      } catch (error) {
        this.send(ws, { type: 'error', message: error instanceof Error ? error.message : '操作に失敗しました' });
        if (!a.token) ws.close(4003, 'unauthorized');
        else if (this.data && this.authorized(ws)) this.send(ws, { type: 'snapshot', room: snapshot(this.data, Date.now()) });
      }
    });
  }
  async webSocketClose(ws: WebSocket) {
    return this.serial(async () => {
      const a = ws.deserializeAttachment() as Attachment;
      if (this.data && !this.data.expired && a.token) {
        disconnectMember(this.data, a.token, a.id, Date.now()); await this.save();
      }
      try { ws.close(); } catch { /* Already closed. */ }
    });
  }
  async webSocketError(ws: WebSocket) { return this.webSocketClose(ws); }
  async alarm() {
    return this.serial(async () => {
      for (const ws of this.ctx.getWebSockets()) {
        const a = ws.deserializeAttachment() as Attachment;
        if (!a.token && Date.now() >= a.authBy) ws.close(4003, 'auth timeout');
      }
      if (this.data) { tick(this.data, Date.now()); await this.save(); }
    });
  }
}

export async function roomRoute(request: Request, env: RoomEnv): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === '/api/rooms' && request.method === 'POST') {
    const body = await readBody(request);
    // Reserve the generated code atomically inside its Durable Object.
    for (let attempt = 0; attempt < 5; attempt++) {
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const code = [...bytes].map(x => alphabet[x % alphabet.length]).join('');
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      const response = await stub.fetch('https://room/create', { method: 'POST', body: JSON.stringify({ code, name: body.name }) });
      if (response.status !== 409) return response;
    }
    return reply({ error: '部屋を作成できませんでした。もう一度お試しください' }, 503);
  }
  const match = /^\/api\/rooms\/([A-Z2-9]{6,8})\/(join|leave|resume|socket)$/.exec(path);
  if (!match) return reply({ error: '部屋コードをご確認ください' }, 404);
  const url = new URL(request.url); url.pathname = '/' + match[2]; url.search = '';
  return env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(new Request(url, request));
}
