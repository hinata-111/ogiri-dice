import { describe, expect, it } from 'vitest';
import { createRoom, joinRoom, connectMember, disconnectMember, leaveRoom, command, tick, evaluated, roundEvaluated, snapshot } from './roomModel';
import { ANSWER_TIME_LIMIT_MS, ONLINE_ROUND_ANSWER_MS, ONLINE_MOVE_MS, ONLINE_RESULT_MS, ROOM_TTL_MS } from '../../app/src/game/rules';
import { nextStepToward, buildNodeMap } from '../../app/src/game/graph';

function lobby() {
  const r = createRoom('ABC234', '太郎', 'token-a', 1000);
  joinRoom(r, '花子', 'token-b', 1000);
  connectMember(r, 'token-a', 'a', 1000);
  connectMember(r, 'token-b', 'b', 1000);
  return r;
}
function started() {
  const r = lobby();
  command(r, 'token-a', { type: 'start', revision: r.revision }, 1000);
  tick(r, r.deadline!);
  return r;
}

describe('authoritative room', () => {
  it('requires two connected players and host to start', () => {
    const r = lobby();
    expect(() => command(r, 'token-b', { type: 'start', revision: r.revision }, 1000)).toThrow();
    disconnectMember(r, 'token-b', 'b', 1000);
    expect(() => command(r, 'token-a', { type: 'start', revision: r.revision }, 1000)).toThrow();
    connectMember(r, 'token-b', 'b2', 1001);
    command(r, 'token-a', { type: 'start', revision: r.revision }, 1001);
    expect(r.game.phase.name).toBe('turnStart');
    expect(() => joinRoom(r, '後入り', 'c', 1002)).toThrow();
  });
  it('validates names and caps a room at four', () => {
    const r = lobby();
    expect(() => joinRoom(r, ' ', 'c', 1000)).toThrow();
    joinRoom(r, '三郎', 'c', 1000); joinRoom(r, '四郎', 'd', 1000);
    expect(() => joinRoom(r, '五郎', 'e', 1000)).toThrow();
  });
  it('never exposes tokens or connection IDs in public snapshots', () => {
    const r = lobby();
    const wire = JSON.stringify(snapshot(r, 1000));
    expect(wire).not.toContain('token-');
    expect(wire).not.toContain('connectionId');
  });
  it('rejects forged, out of turn, empty and stale commands', () => {
    const r = started(); const rev = r.revision;
    expect(() => command(r, 'invalid', { type: 'answer', answer: '答え', round: 1, revision: rev }, 2000)).toThrow();
    expect(() => command(r, 'token-a', { type: 'answer', answer: ' ', revision: rev }, 2000)).toThrow();
    expect(() => command(r, 'token-a', { type: 'EVALUATED', revision: rev }, 2000)).toThrow();
    command(r, 'token-a', { type: 'answer', answer: '答え', round: 1, revision: rev }, 2000);
    expect(r.game.phase.name).toBe('roundAnswering');
    expect(() => command(r, 'token-a', { type: 'answer', answer: '二重', revision: rev }, 2000)).toThrow();
  });
  it('uses server deadlines even if a client submits just after expiry', () => {
    const r = started(); const due = r.deadline!;
    expect(due).toBe(1800 + ONLINE_ROUND_ANSWER_MS);
    expect(() => command(r, 'token-a', { type: 'answer', answer: '遅い', revision: r.revision }, due)).toThrow();
    tick(r, due);
    expect(r.game.phase.name).toBe('roundResults');
    expect(r.game.sharedRound?.entries.map(e => e.result?.score)).toEqual([1, 1]);
    const rev = r.revision; tick(r, due);
    expect(r.revision).toBe(rev);
    tick(r, due + ONLINE_RESULT_MS);
    expect(r.game.phase.name).toBe('moving');
    tick(r, r.deadline!);
    expect(r.game.players[0].position).not.toBe('shinjuku');
  });
  it('accepts an evaluation only for its current job and ignores late completions', () => {
    const r = started();
    // Additional challenges keep the original single-player job validation.
    r.game.phase = { name: 'awaitingAnswer', topic: r.game.sharedRound!.topic, context: { kind: 'blue' } };
    command(r, 'token-a', { type: 'answer', answer: '答え', revision: r.revision }, 2000);
    const job = r.gameRevision;
    connectMember(r, 'token-b', 'new-b', 2100);
    evaluated(r, job, { score: 6, comment: '最高' }, 2200);
    expect(r.game.phase).toMatchObject({ name: 'showingResult', result: { score: 6 } });
    const rev = r.revision;
    evaluated(r, job, { score: 1, comment: '遅延' }, 2300);
    expect(r.revision).toBe(rev);
  });
  it('recovers stuck evaluations after restart via the stored deadline', () => {
    const r = started();
    command(r, 'token-a', { type: 'answer', answer: '答え', round: 1, revision: r.revision }, 2000);
    tick(r, r.deadline!);
    const restored = JSON.parse(JSON.stringify(r)); tick(restored, restored.deadline);
    expect(restored.game.phase.name).toBe('roundResults');
    expect(restored.game.sharedRound.entries[0].result).toMatchObject({ score: 3, fallback: true });
    expect(restored.game.sharedRound.entries[1].result.score).toBe(1);
  });
  it('rejects illegal moves and stale duplicate steps', () => {
    const r = started(); tick(r, r.deadline!); tick(r, r.deadline!);
    const now = r.deadline! - ONLINE_MOVE_MS; const rev = r.revision;
    expect(() => command(r, 'token-a', { type: 'step', nodeId: 'nope', revision: rev }, now)).toThrow();
    const step = nextStepToward(buildNodeMap(r.game.nodes), 'shinjuku', null, r.game.destinationId!);
    command(r, 'token-a', { type: 'step', nodeId: step, revision: rev }, now);
    expect(() => command(r, 'token-a', { type: 'step', nodeId: step, revision: rev }, now)).toThrow();
  });
  it('preserves the seat on reconnect and ignores old socket close events', () => {
    const r = lobby(); const id = r.members[0].id;
    connectMember(r, 'token-a', 'replacement', 2000);
    disconnectMember(r, 'token-a', 'a', 2100);
    expect(r.members[0]).toMatchObject({ id, connectionId: 'replacement', disconnectedAt: null });
    disconnectMember(r, 'token-a', 'replacement', 2200); tick(r, 62200);
    expect(r.members).toHaveLength(1); expect(r.hostId).toBe(r.members[0].id);
  });
  it('transfers host on explicit exit and invalidates the departed token', () => {
    const r = lobby(); leaveRoom(r, 'token-a', 2000);
    expect(r.hostId).toBe(r.members[0].id);
    expect(() => connectMember(r, 'token-a', 'a2', 2000)).toThrow();
  });
  it('expires rooms after 24h', () => {
    const r = lobby(); tick(r, 1000 + ROOM_TTL_MS);
    expect(r.expired).toBe(true);
    expect(() => joinRoom(r, '新規', 'new', 1000 + ROOM_TTL_MS)).toThrow();
  });
  it('finishes a complete unattended game without any connected phones', () => {
    const r = started(); disconnectMember(r, 'token-a', 'a', 2000); disconnectMember(r, 'token-b', 'b', 2000);
    for (let i = 0; i < 2000 && r.game.phase.name !== 'gameResult'; i++) tick(r, r.deadline!);
    expect(r.game.phase.name).toBe('gameResult');
    expect(r.game.players).toHaveLength(2);
    expect(r.game.round).toBeLessThanOrEqual(30);
  });
});

describe('shared online answers', () => {
  it('accepts simultaneous submissions from the same snapshot and keeps one common deadline', () => {
    const r = started(); const rev = r.revision; const due = r.deadline;
    command(r, 'token-b', { type: 'answer', revision: rev, round: 1, answer: '花子の秘密' }, 2000);
    expect(r.deadline).toBe(due);
    const wire = JSON.stringify(snapshot(r, 2100));
    expect(wire).not.toContain('花子の秘密');
    expect(snapshot(r, 2100).game.sharedRound?.entries[1].submitted).toBe(true);
    expect(r.game.sharedRound?.entries[1].answer).toBe('花子の秘密');
    expect(() => command(r, 'token-b', { type: 'answer', revision: rev, round: 1, answer: '二重' }, 2100)).toThrow();
    expect(() => command(r, 'token-a', { type: 'answer', revision: rev, round: 0, answer: '前の周' }, 2100)).toThrow();
    command(r, 'token-a', { type: 'answer', revision: rev, round: 1, answer: '太郎の回答' }, 2200);
    expect(r.game.phase.name).toBe('roundEvaluating');
    const evaluationDue = r.deadline;
    roundEvaluated(r, 1, 1, { score: 6, comment: '最高' }, 2300);
    expect(r.deadline).toBe(evaluationDue);
    connectMember(r, 'token-a', 'a2', 2301);
    roundEvaluated(r, 1, 0, { score: 2, comment: '良い' }, 2400);
    expect(r.game.phase.name).toBe('roundResults');
    const done = r.revision;
    roundEvaluated(r, 1, 0, { score: 5, comment: '重複' }, 2500);
    expect(r.revision).toBe(done);
    tick(r, r.deadline!);
    expect(r.game.currentPlayerIndex).toBe(0);
    expect(r.game.phase).toMatchObject({ name: 'moving', remaining: 2 });
    expect(() => command(r, 'token-b', { type: 'step', revision: r.revision, nodeId: 'shibuya' }, r.deadline! - 1)).toThrow('手番');
  });
  it('uses 15 seconds and active-player authorization for additional topics', () => {
    const r = started();
    r.game.phase = { name: 'challengeIntro', cellKind: 'red' };
    const now = r.deadline!;
    tick(r, now);
    expect(r.deadline).toBe(now + ANSWER_TIME_LIMIT_MS);
    expect(() => command(r, 'token-b', { type: 'answer', revision: r.revision, answer: '横取り' }, now + 1)).toThrow('手番');
  });
  it('keeps completed scores when another evaluation times out and rejects late completion', () => {
    const r = started(); const rev = r.revision;
    for (const token of ['token-a', 'token-b']) command(r, token, { type: 'answer', round: 1, revision: rev, answer: token }, 2000);
    roundEvaluated(r, 1, 0, { score: 6, comment: '' }, 2100);
    const due = r.deadline!;
    const restored = JSON.parse(JSON.stringify(r));
    roundEvaluated(restored, 1, 1, { score: 5, comment: '遅延' }, due);
    expect(restored.game.sharedRound.entries.map((e: { result: { score: number } }) => e.result.score)).toEqual([6, 3]);
  });
});

it('keeps the host during its reconnect grace period', () => {
  const r = lobby();
  joinRoom(r, '三郎', 'token-c', 1000);
  disconnectMember(r, 'token-a', 'a', 2000);
  connectMember(r, 'token-c', 'c', 2100);
  expect(r.hostId).toBe('1');
  tick(r, 62000);
  expect(r.hostId).toBe(r.members.find(m => m.token === 'token-b')?.id);
});
