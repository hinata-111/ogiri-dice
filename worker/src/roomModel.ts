import { gameReducer, initialState, currentPlayer, type GameAction, type GameState } from '../../app/src/game/state';
import { pickRandomTopic } from '../../app/src/game/topics';
import { pickDestination } from '../../app/src/game/destination';
import { buildNodeMap, nextStepToward } from '../../app/src/game/graph';
import { ANSWER_TIME_LIMIT_MS, ONLINE_ROUND_ANSWER_MS, ONLINE_MOVE_MS, ONLINE_RESULT_MS, ONLINE_TURN_MS, ONLINE_CHALLENGE_MS, ONLINE_ARRIVAL_MS, ONLINE_EVALUATION_MS, ROOM_TTL_MS, ROOM_RECONNECT_MS, ROOM_MAX_PLAYERS } from '../../app/src/game/rules';
import { FALLBACK_EVALUATION } from '../../app/src/ai/evaluator';
import type { EvaluationResult, MapNode, Topic } from '../../app/src/game/types';
import type { RoomSnapshot } from '../../app/src/online/protocol';
import mapData from '../../app/src/data/map.json';
import topicData from '../../app/src/data/topics.json';

const nodes = mapData.nodes as MapNode[];
const topics = topicData.topics as Topic[];
interface Member {
  id: string; name: string; token: string; connectionId: string | null;
  disconnectedAt: number | null; playerId: number | null;
}
export interface RoomData {
  code: string; revision: number; gameRevision: number; hostId: string;
  members: Member[]; game: GameState; deadline: number | null; expiresAt: number; expired: boolean;
}
function fail(message: string): never { throw new Error(message); }
function active(r: RoomData, now: number) {
  if (r.expired || now >= r.expiresAt) fail('部屋の有効期限が切れました');
}
function member(r: RoomData, token: string): Member {
  return r.members.find(m => m.token === token) ?? fail('参加情報が無効です。部屋に入り直してください');
}
function nameValue(name: string) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 10) fail('名前は1〜10文字で入力してください');
  return name.trim();
}
export function createRoom(code: string, name: string, token: string, now: number): RoomData {
  return {
    code, revision: 1, gameRevision: 0, hostId: '1',
    members: [{ id: '1', name: nameValue(name), token, connectionId: null, disconnectedAt: now, playerId: null }],
    game: gameReducer(initialState, { type: 'SHOW_SETUP' }), deadline: null,
    expiresAt: now + ROOM_TTL_MS, expired: false,
  };
}
export function joinRoom(r: RoomData, name: string, token: string, now: number): Member {
  active(r, now);
  if (r.game.phase.name !== 'setup') fail('この部屋は対戦中です');
  if (r.members.length >= ROOM_MAX_PLAYERS) fail('部屋が満員です');
  const m: Member = { id: String(r.revision + 1), name: nameValue(name), token, connectionId: null, disconnectedAt: now, playerId: null };
  r.members.push(m); r.revision++; return m;
}
export function connectMember(r: RoomData, token: string, connectionId: string, now: number) {
  active(r, now); const m = member(r, token);
  m.connectionId = connectionId; m.disconnectedAt = null; r.revision++;
  if (!r.members.some(x => x.id === r.hostId)) r.hostId = r.members.find(x => x.connectionId)?.id ?? m.id;
  return m;
}
export function disconnectMember(r: RoomData, token: string, connectionId: string, now: number) {
  const m = r.members.find(x => x.token === token);
  if (!m || m.connectionId !== connectionId) return;
  m.connectionId = null; m.disconnectedAt = now; r.revision++;
}
export function leaveRoom(r: RoomData, token: string, now: number) {
  const m = member(r, token);
  if (r.game.phase.name === 'setup') {
    r.members = r.members.filter(x => x !== m);
    if (r.hostId === m.id) r.hostId = (r.members.find(x => x.connectionId) ?? r.members[0])?.id ?? '';
  } else {
    m.connectionId = null; m.disconnectedAt = now;
  }
  r.revision++;
}
function transition(r: RoomData, action: GameAction, now: number): boolean {
  const previousPhase = r.game.phase.name;
  const next = gameReducer(r.game, action);
  if (next === r.game) return false;
  r.game = next; r.gameRevision++; r.revision++;
  // One shared deadline: another player's submission/result never extends it.
  if (previousPhase === next.phase.name && (next.phase.name === 'roundAnswering' || next.phase.name === 'roundEvaluating')) return true;
  const durations: Partial<Record<GameState['phase']['name'], number>> = {
    roundAnswering: ONLINE_ROUND_ANSWER_MS, roundEvaluating: ONLINE_EVALUATION_MS, roundResults: ONLINE_RESULT_MS,
    turnStart: ONLINE_TURN_MS, awaitingAnswer: ANSWER_TIME_LIMIT_MS,
    evaluating: ONLINE_EVALUATION_MS, showingResult: ONLINE_RESULT_MS,
    moving: ONLINE_MOVE_MS, arrival: ONLINE_ARRIVAL_MS, challengeIntro: ONLINE_CHALLENGE_MS,
  };
  const duration = durations[next.phase.name];
  r.deadline = duration === undefined ? null : now + duration;
  return true;
}
export function command(r: RoomData, token: string, raw: unknown, now: number) {
  active(r, now); const m = member(r, token);
  if (!m.connectionId) fail('接続を確認してください');
  if (!raw || typeof raw !== 'object') fail('操作が不正です');
  const c = raw as Record<string, unknown>;
  if (r.game.phase.name === 'roundAnswering' && c.type === 'answer') {
    if (r.deadline === null || now >= r.deadline) fail('操作期限を過ぎました');
    if (m.playerId === null || c.round !== r.game.round) fail('回答するラウンドが変わりました');
    if (typeof c.answer !== 'string' || !c.answer.trim() || c.answer.trim().length > 120) fail('回答を1〜120文字で入力してください');
    if (!transition(r, { type: 'SUBMIT_ROUND_ANSWER', round: r.game.round, playerId: m.playerId, answer: c.answer }, now)) fail('回答は提出済みです');
    return;
  }
  if (c.revision !== r.revision) fail('画面を同期しました。もう一度操作してください');
  if (r.deadline !== null && now >= r.deadline) fail('操作期限を過ぎました');
  if (c.type === 'start') {
    if (r.game.phase.name !== 'setup' || m.id !== r.hostId || r.members.length < 2 || r.members.some(x => !x.connectionId)) fail('全員の接続後、ホストが開始してください');
    r.members.forEach((x, i) => { x.playerId = i; });
    transition(r, { type: 'START_GAME', simultaneous: true, players: r.members.map(x => ({ name: x.name, kind: 'human' })), nodes, startId: 'shinjuku', destinationId: pickDestination(nodes, ['shinjuku']) }, now);
    return;
  }
  if (m.playerId === null || currentPlayer(r.game)?.id !== m.playerId) fail('あなたの手番ではありません');
  if (c.type === 'answer') {
    if (c.round !== undefined) fail('回答するラウンドが変わりました');
    if (r.game.phase.name !== 'awaitingAnswer' || typeof c.answer !== 'string' || !c.answer.trim() || c.answer.trim().length > 120) fail('回答を1〜120文字で入力してください');
    transition(r, { type: 'SUBMIT_ANSWER', answer: c.answer.trim() }, now); return;
  }
  if (c.type === 'step' && typeof c.nodeId === 'string' && transition(r, { type: 'STEP_TO', nodeId: c.nodeId }, now)) return;
  fail('この操作はできません');
}
export function evaluated(r: RoomData, gameRevision: number, result: EvaluationResult, now: number) {
  if (r.expired || now >= r.expiresAt || r.gameRevision !== gameRevision || r.game.phase.name !== 'evaluating') return;
  if (r.deadline !== null && now >= r.deadline) { tick(r, now); return; }
  const valid = Number.isInteger(result.score) && result.score >= 1 && result.score <= 6 && typeof result.comment === 'string';
  transition(r, { type: 'EVALUATED', result: valid ? result : FALLBACK_EVALUATION }, now);
}
export function roundEvaluated(r: RoomData, round: number, playerId: number, result: EvaluationResult, now: number) {
  if (r.expired || now >= r.expiresAt || r.game.round !== round || r.game.phase.name !== 'roundEvaluating') return;
  if (r.deadline !== null && now >= r.deadline) { tick(r, now); return; }
  const valid = Number.isInteger(result.score) && result.score >= 1 && result.score <= 6 && typeof result.comment === 'string';
  transition(r, { type: 'ROUND_EVALUATED', round, playerId, result: valid ? result : FALLBACK_EVALUATION }, now);
}
export function tick(r: RoomData, now: number) {
  if (r.expired) return;
  if (now >= r.expiresAt) { r.expired = true; r.revision++; r.deadline = null; return; }
  if (r.game.phase.name === 'setup') {
    for (const m of [...r.members]) {
      if (m.disconnectedAt !== null && now >= m.disconnectedAt + ROOM_RECONNECT_MS) leaveRoom(r, m.token, now);
    }
    return;
  }
  if (r.deadline === null || now < r.deadline) return;
  const phase = r.game.phase;
  switch (phase.name) {
    case 'turnStart': transition(r, { type: r.game.simultaneous ? 'BEGIN_ROUND' : 'BEGIN_TURN', topic: pickRandomTopic(topics, r.game.usedTopicIds) }, now); break;
    case 'roundAnswering': transition(r, { type: 'CLOSE_ROUND' }, now); break;
    case 'roundEvaluating': transition(r, { type: 'ROUND_EVALUATION_TIMEOUT' }, now); break;
    case 'roundResults': transition(r, { type: 'PROCEED' }, now); break;
    case 'challengeIntro': transition(r, { type: 'BEGIN_CHALLENGE', topic: pickRandomTopic(topics, r.game.usedTopicIds), target: 1 + Math.floor(Math.random() * 4) }, now); break;
    case 'awaitingAnswer': transition(r, { type: 'TIME_UP' }, now); break;
    case 'evaluating': transition(r, { type: 'EVALUATED', result: FALLBACK_EVALUATION }, now); break;
    case 'showingResult': transition(r, { type: 'PROCEED' }, now); break;
    case 'moving': transition(r, { type: 'STEP_TO', nodeId: nextStepToward(buildNodeMap(r.game.nodes), currentPlayer(r.game).position, phase.cameFrom, r.game.destinationId!) }, now); break;
    case 'arrival': transition(r, { type: 'ARRIVAL_DONE', nextDestinationId: pickDestination(nodes, [phase.nodeId, ...r.game.players.map(p => p.position)]) }, now); break;
  }
}
export function nextAlarm(r: RoomData): number {
  const lobbyDeadlines = r.game.phase.name === 'setup'
    ? r.members.flatMap(m => m.disconnectedAt === null ? [] : [m.disconnectedAt + ROOM_RECONNECT_MS]) : [];
  return Math.min(r.expiresAt, r.deadline ?? Infinity, ...lobbyDeadlines);
}
export function snapshot(r: RoomData, now: number): RoomSnapshot {
  const game = r.game.phase.name === 'roundAnswering' && r.game.sharedRound
    ? { ...r.game, sharedRound: { ...r.game.sharedRound, entries: r.game.sharedRound.entries.map(e => ({ ...e, answer: '' })) } }
    : r.game;
  return {
    code: r.code, revision: r.revision, gameRevision: r.gameRevision, hostId: r.hostId,
    members: r.members.map(m => ({ id: m.id, name: m.name, connected: m.connectionId !== null, playerId: m.playerId })),
    game, deadline: r.deadline, expiresAt: r.expiresAt, serverNow: now, expired: r.expired,
  };
}
