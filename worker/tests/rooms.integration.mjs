import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';

const options = { modules: true, scriptPath: '.wrangler/test/index.js', compatibilityDate: '2026-07-01', durableObjects: { ROOMS: { className: 'GameRoom', useSQLite: true } }, bindings: { USE_MOCK: '1' } };
async function post(mf, path, data) {
  const res = await mf.dispatchFetch(`http://localhost${path}`, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
  return { status: res.status, data: await res.json() };
}
async function socket(mf, seat) {
  const res = await mf.dispatchFetch(`http://localhost/api/rooms/${seat.code}/socket`, { headers: { Upgrade: 'websocket' } });
  assert.equal(res.status, 101);
  const ws = res.webSocket; ws.accept();
  const history = []; const listeners = new Set();
  ws.addEventListener('message', e => { const msg = JSON.parse(e.data); history.push(msg); for (const f of listeners) f(msg); });
  const wait = (pred, timeout = 6000) => new Promise((resolve, reject) => {
    const previous = history.findLast(pred); if (previous) return resolve(previous);
    const timer = setTimeout(() => { listeners.delete(onMessage); reject(new Error('Timed out: ' + JSON.stringify(history.slice(-2)))); }, timeout);
    function onMessage(msg) { if (pred(msg)) { clearTimeout(timer); listeners.delete(onMessage); resolve(msg); } }
    listeners.add(onMessage);
  });
  ws.send(JSON.stringify({ type: 'auth', token: seat.token }));
  await wait(m => m.type === 'snapshot');
  return { ws, history, wait, room: () => history.findLast(m => m.type === 'snapshot').room };
}

test('two authenticated phones share game, reject forged turns, recover seat and advance alarms', { timeout: 45000 }, async () => {
  const mf = new Miniflare(options);
  const sockets = [];
  try {
    const created = await post(mf, '/api/rooms', { name: '太郎' });
    assert.equal(created.status, 201);
    const a = created.data;
    const joined = await post(mf, `/api/rooms/${a.code}/join`, { name: '花子' });
    assert.equal(joined.status, 200);
    const b = joined.data;
    const ca = await socket(mf, a); sockets.push(ca.ws);
    const cb = await socket(mf, b); sockets.push(cb.ws);
    await ca.wait(m => m.type === 'snapshot' && m.room.members.every(x => x.connected));
    assert.equal(JSON.stringify(ca.room()).includes(a.token), false);
    ca.ws.send(JSON.stringify({ type: 'start', revision: ca.room().revision }));
    const turn = await ca.wait(m => m.type === 'snapshot' && m.room.game.phase.name === 'roundAnswering');
    await cb.wait(m => m.type === 'snapshot' && m.room.revision === turn.room.revision);
    assert.deepEqual(ca.room().game, cb.room().game);
    cb.ws.send(JSON.stringify({ type: 'answer', round: 1, revision: turn.room.revision, answer: '花子の秘密の回答' }));
    const submitted = await ca.wait(m => m.type === 'snapshot' && m.room.game.sharedRound?.entries[1].submitted);
    assert.equal(submitted.room.deadline, turn.room.deadline);
    assert.equal(JSON.stringify(submitted).includes('花子の秘密の回答'), false);
    // Both commands intentionally use the same revision, as simultaneous phones do.
    ca.ws.send(JSON.stringify({ type: 'answer', round: 1, revision: turn.room.revision, answer: '座布団が全部低反発' }));
    const result = await ca.wait(m => m.type === 'snapshot' && m.room.game.phase.name === 'roundResults');
    await cb.wait(m => m.type === 'snapshot' && m.room.revision === result.room.revision);
    assert.deepEqual(ca.room().game, cb.room().game);
    const replacement = await socket(mf, a); sockets.push(replacement.ws);
    await ca.wait(m => m.type === 'replaced');
    assert.equal(replacement.room().members.find(m => m.id === a.memberId).playerId, 0);
    await replacement.wait(m => m.type === 'snapshot' && m.room.game.phase.name === 'moving', 8000);
    const room = replacement.room();
    cb.ws.send(JSON.stringify({ type: 'step', revision: room.revision, nodeId: 'shibuya' }));
    assert.equal((await cb.wait(m => m.type === 'error')).message, 'あなたの手番ではありません');
    const current = room.game.players[0]; const node = room.game.nodes.find(n => n.id === current.position);
    replacement.ws.send(JSON.stringify({ type: 'step', revision: room.revision, nodeId: node.neighbors[0] }));
    const moved = await replacement.wait(m => m.type === 'snapshot' && m.room.game.players[0].position !== current.position);
    await cb.wait(m => m.type === 'snapshot' && m.room.revision === moved.room.revision);
    assert.deepEqual(replacement.room().game.players, cb.room().game.players);
  } finally { sockets.forEach(ws => { try { ws.close(); } catch {} }); await mf.dispose(); }
});

test('invalid credentials receive no snapshot and unknown rooms cannot be joined', { timeout: 15000 }, async () => {
  const mf = new Miniflare(options);
  try {
    assert.equal((await post(mf, '/api/rooms/ABC234/join', { name: '誰か' })).status, 404);
    const { data: seat } = await post(mf, '/api/rooms', { name: '太郎' });
    const res = await mf.dispatchFetch(`http://localhost/api/rooms/${seat.code}/socket`, { headers: { Upgrade: 'websocket' } });
    const ws = res.webSocket; ws.accept(); const messages = [];
    const closed = new Promise(resolve => ws.addEventListener('close', resolve));
    ws.addEventListener('message', e => messages.push(JSON.parse(e.data)));
    ws.send(JSON.stringify({ type: 'auth', token: 'not-a-seat' }));
    await closed;
    assert.equal(messages.some(m => m.type === 'snapshot'), false);
  } finally { await mf.dispose(); }
});

test('persistent room survives runtime restart and drops stale connections', { timeout: 20000 }, async () => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const dir = await mkdtemp(resolve('.wrangler/room-persistence-'));
  let mf = new Miniflare({ ...options, durableObjectsPersist: dir });
  try {
    const { data: a } = await post(mf, '/api/rooms', { name: '太郎' });
    const { data: b } = await post(mf, `/api/rooms/${a.code}/join`, { name: '花子' });
    const ca = await socket(mf, a); await socket(mf, b);
    await ca.wait(m => m.type === 'snapshot' && m.room.members.every(x => x.connected));
    ca.ws.send(JSON.stringify({ type: 'start', revision: ca.room().revision }));
    const before = await ca.wait(m => m.type === 'snapshot' && m.room.game.phase.name === 'roundAnswering');
    ca.ws.send(JSON.stringify({ type: 'answer', round: 1, revision: before.room.revision, answer: '保存した回答' }));
    const submitted = await ca.wait(m => m.type === 'snapshot' && m.room.game.sharedRound?.entries[0].submitted);
    await mf.dispose();
    mf = new Miniflare({ ...options, durableObjectsPersist: dir });
    const restored = await socket(mf, a);
    assert.deepEqual(restored.room().game, submitted.room.game);
    assert.equal(restored.room().deadline, before.room.deadline);
    assert.equal(restored.room().members.find(m => m.id === b.memberId).connected, false);
    restored.ws.close();
  } finally { await mf.dispose(); await rm(dir, { recursive: true, force: true }); }
});

test('concurrent joins respect capacity and a missing room has terminal reconnect response', { timeout: 15000 }, async () => {
  const mf = new Miniflare(options);
  try {
    const { data: a } = await post(mf, '/api/rooms', { name: '太郎' });
    const joins = await Promise.all(Array.from({length:4}, (_, i) => post(mf, `/api/rooms/${a.code}/join`, {name:'参加'+i})));
    assert.equal(joins.filter(r => r.status === 200).length, 3);
    const missing = await post(mf, '/api/rooms/ABCDEFGH/resume', { token: 'old' });
    assert.equal(missing.status, 404);
    const resume = await post(mf, `/api/rooms/${a.code}/resume`, { token: a.token });
    assert.equal(resume.status, 200);
    assert.equal((await post(mf, `/api/rooms/${a.code}/resume`, { token: 'bad' })).status, 403);
  } finally { await mf.dispose(); }
});

test('server alarm closes common answers and evaluates submitted answers after the other phone disconnects', { timeout: 45000 }, async () => {
  const mf = new Miniflare(options); const sockets = [];
  try {
    const { data: a } = await post(mf, '/api/rooms', { name: '太郎' });
    const { data: b } = await post(mf, `/api/rooms/${a.code}/join`, { name: '花子' });
    const ca = await socket(mf, a); sockets.push(ca.ws);
    const cb = await socket(mf, b); sockets.push(cb.ws);
    await ca.wait(m => m.type === 'snapshot' && m.room.members.every(x => x.connected));
    ca.ws.send(JSON.stringify({type:'start', revision:ca.room().revision}));
    const turn = await cb.wait(m => m.type === 'snapshot' && m.room.game.phase.name === 'roundAnswering');
    cb.ws.send(JSON.stringify({type:'answer', round:1, revision:turn.room.revision, answer:'締切から採点される回答'}));
    ca.ws.close();
    const timedOut = await cb.wait(m => m.type === 'snapshot' && m.room.game.phase.name === 'roundResults', 35000);
    assert.equal(timedOut.room.game.sharedRound.entries[0].result.score, 1);
    assert.equal(timedOut.room.game.sharedRound.entries[0].result.comment, '時間切れ！');
    assert.ok(timedOut.room.game.sharedRound.entries[1].result.score >= 1);
    assert.equal(timedOut.room.game.sharedRound.entries[1].result.fallback, undefined);
    assert.equal(timedOut.room.members.find(m => m.id === a.memberId).connected, false);
  } finally { sockets.forEach(ws => { try { ws.close(); } catch {} }); await mf.dispose(); }
});
