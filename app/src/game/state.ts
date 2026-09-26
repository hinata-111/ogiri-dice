import { buildNodeMap, moveOptions } from "./graph";
import { FALLBACK_EVALUATION } from '../ai/evaluator';
import {
  applyMoney, ARRIVAL_PRIZE, BEST_ANSWER_MIN_SCORE, blueGain, INITIAL_MONEY,
  MAX_ROUNDS, redLoss, TIME_UP_RESULT, WIN_MONEY,
} from "./rules";
import type {
  BestAnswer, EvaluationResult, MapNode, Player, PlayerConfig, Topic,
} from "./types";

export type AnswerContext =
  | { kind: "main" }
  | { kind: "blue" }
  | { kind: "red"; target: number };

export type Phase =
  | { name: "title" }
  | { name: "setup" }
  | { name: "turnStart" }
  | { name: "roundAnswering" }
  | { name: "roundEvaluating" }
  | { name: "roundResults" }
  | { name: "awaitingAnswer"; topic: Topic; context: AnswerContext }
  | { name: "evaluating"; topic: Topic; answer: string; context: AnswerContext }
  | {
      name: "showingResult";
      topic: Topic;
      answer: string;
      result: EvaluationResult;
      context: AnswerContext;
      moneyDelta: number; // チャレンジの増減額(mainは0)。PROCEEDで適用
    }
  | { name: "moving"; remaining: number; cameFrom: string | null }
  | { name: "challengeIntro"; cellKind: "blue" | "red" }
  | { name: "arrival"; nodeId: string }
  | { name: "gameResult" };

export interface GameState {
  simultaneous?: boolean;
  sharedRound?: SharedRound | null;
  phase: Phase;
  nodes: MapNode[];
  players: Player[];
  currentPlayerIndex: number;
  destinationId: string | null;
  round: number; // 1始まり。全員が1手番終えると+1
  usedTopicIds: string[];
  bestAnswers: BestAnswer[];
  winnerId: number | null; // 100万達成者。round切れ終了時はnull
}

export interface SharedRound {
  topic: Topic;
  entries: { playerId: number; submitted: boolean; answer: string; result: EvaluationResult | null }[];
}

export type GameAction =
  | { type: "SHOW_SETUP" }
  | {
      type: "START_GAME";
      players: PlayerConfig[];
      nodes: MapNode[];
      startId: string;
      destinationId: string;
      simultaneous?: boolean;
    }
  | { type: "BEGIN_ROUND"; topic: Topic }
  | { type: "SUBMIT_ROUND_ANSWER"; round: number; playerId: number; answer: string }
  | { type: "CLOSE_ROUND" }
  | { type: "ROUND_EVALUATED"; round: number; playerId: number; result: EvaluationResult }
  | { type: "ROUND_EVALUATION_TIMEOUT" }
  | { type: "BEGIN_TURN"; topic: Topic }
  | { type: "BEGIN_CHALLENGE"; topic: Topic; target?: number }
  | { type: "SUBMIT_ANSWER"; answer: string }
  | { type: "TIME_UP" }
  | { type: "EVALUATED"; result: EvaluationResult }
  | { type: "RE_EVALUATE" }
  | { type: "PROCEED" }
  | { type: "STEP_TO"; nodeId: string }
  | { type: "ARRIVAL_DONE"; nextDestinationId: string }
  | { type: "RESTART" };

export const initialState: GameState = {
  phase: { name: "title" },
  nodes: [],
  players: [],
  currentPlayerIndex: 0,
  destinationId: null,
  round: 1,
  usedTopicIds: [],
  bestAnswers: [],
  winnerId: null,
};

export function currentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex];
}

function updateCurrentPlayer(state: GameState, patch: Partial<Player>): Player[] {
  return state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, ...patch } : p,
  );
}

function findNode(state: GameState, id: string): MapNode {
  const node = state.nodes.find((n) => n.id === id);
  if (!node) throw new Error(`unknown node: ${id}`);
  return node;
}

/** ターン終了処理: 勝利判定→周回判定→次手番 */
function endTurn(state: GameState): GameState {
  const player = currentPlayer(state);
  if (player.money >= WIN_MONEY) {
    return { ...state, winnerId: player.id, phase: { name: "gameResult" } };
  }
  const isLastPlayer = state.currentPlayerIndex === state.players.length - 1;
  if (isLastPlayer && state.round >= MAX_ROUNDS) {
    return { ...state, phase: { name: "gameResult" } };
  }
  return {
    ...state,
    currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length,
    round: isLastPlayer ? state.round + 1 : state.round,
    sharedRound: isLastPlayer ? null : state.sharedRound,
    phase: state.sharedRound && !isLastPlayer
      ? { name: 'moving', remaining: state.sharedRound.entries[state.currentPlayerIndex + 1].result!.score, cameFrom: null }
      : { name: "turnStart" },
  };
}

function closeRound(state: GameState): GameState {
  const sharedRound = state.sharedRound!;
  const entries = sharedRound.entries.map(entry => entry.submitted ? entry : { ...entry, result: TIME_UP_RESULT });
  return { ...state, sharedRound: { ...sharedRound, entries },
    phase: { name: entries.every(entry => entry.result) ? 'roundResults' : 'roundEvaluating' } };
}

/** 記録対象ならベスト回答に追加 */
function recordBest(
  state: GameState, topic: Topic, answer: string, result: EvaluationResult,
): BestAnswer[] {
  if (result.score < BEST_ANSWER_MIN_SCORE || answer === "") return state.bestAnswers;
  const player = currentPlayer(state);
  return [
    ...state.bestAnswers,
    {
      playerName: player.name,
      topicPrompt: topic.prompt,
      answer,
      score: result.score,
      comment: result.comment,
    },
  ];
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const phase = state.phase;

  switch (action.type) {
    case "SHOW_SETUP":
      if (phase.name !== "title") return state;
      return { ...state, phase: { name: "setup" } };

    case "START_GAME": {
      if (phase.name !== "setup") return state;
      buildNodeMap(action.nodes); // 整合性検証(不正ならthrow)
      const players: Player[] = action.players.map((c, i) => ({
        id: i,
        name: c.name,
        kind: c.kind,
        personality: c.personality,
        position: action.startId,
        money: INITIAL_MONEY,
        arrivals: 0,
      }));
      return {
        ...initialState,
        nodes: action.nodes,
        players,
        destinationId: action.destinationId,
        simultaneous: action.simultaneous ?? false,
        sharedRound: null,
        phase: { name: "turnStart" },
      };
    }

    case "BEGIN_TURN":
      if (phase.name !== "turnStart" || state.simultaneous) return state;
      return {
        ...state,
        usedTopicIds: [...state.usedTopicIds, action.topic.id],
        phase: { name: "awaitingAnswer", topic: action.topic, context: { kind: "main" } },
      };

    case 'BEGIN_ROUND':
      if (phase.name !== 'turnStart' || !state.simultaneous || state.currentPlayerIndex !== 0) return state;
      return { ...state, usedTopicIds: [...state.usedTopicIds, action.topic.id],
        sharedRound: { topic: action.topic, entries: state.players.map(p => ({ playerId: p.id, submitted: false, answer: '', result: null })) },
        phase: { name: 'roundAnswering' } };

    case 'SUBMIT_ROUND_ANSWER': {
      const round = state.sharedRound;
      if (phase.name !== 'roundAnswering' || !round || action.round !== state.round) return state;
      const entry = round.entries.find(e => e.playerId === action.playerId);
      if (!entry || entry.submitted || !action.answer.trim() || action.answer.trim().length > 120) return state;
      const entries = round.entries.map(e => e === entry ? { ...e, submitted: true, answer: action.answer.trim() } : e);
      const next: GameState = { ...state, sharedRound: { ...round, entries } };
      return entries.every(e => e.submitted) ? closeRound(next) : next;
    }

    case 'CLOSE_ROUND':
      return phase.name === 'roundAnswering' && state.sharedRound ? closeRound(state) : state;

    case 'ROUND_EVALUATED': {
      const round = state.sharedRound;
      if (phase.name !== 'roundEvaluating' || !round || action.round !== state.round) return state;
      const entry = round.entries.find(e => e.playerId === action.playerId);
      if (!entry || entry.result || !entry.submitted) return state;
      if (!Number.isInteger(action.result.score) || action.result.score < 1 || action.result.score > 6) return state;
      const entries = round.entries.map(e => e === entry ? { ...e, result: action.result } : e);
      return { ...state, sharedRound: { ...round, entries },
        phase: { name: entries.every(e => e.result) ? 'roundResults' : 'roundEvaluating' } };
    }

    case 'ROUND_EVALUATION_TIMEOUT':
      if (phase.name !== 'roundEvaluating' || !state.sharedRound) return state;
      return { ...state, phase: { name: 'roundResults' }, sharedRound: { ...state.sharedRound,
        entries: state.sharedRound.entries.map(e => e.result ? e : { ...e, result: FALLBACK_EVALUATION }) } };

    case "BEGIN_CHALLENGE": {
      if (phase.name !== "challengeIntro") return state;
      const context: AnswerContext =
        phase.cellKind === "red"
          ? { kind: "red", target: action.target ?? 1 }
          : { kind: "blue" };
      return {
        ...state,
        usedTopicIds: [...state.usedTopicIds, action.topic.id],
        phase: { name: "awaitingAnswer", topic: action.topic, context },
      };
    }

    case "SUBMIT_ANSWER":
      if (phase.name !== "awaitingAnswer") return state;
      return {
        ...state,
        phase: {
          name: "evaluating", topic: phase.topic, answer: action.answer, context: phase.context,
        },
      };

    case "TIME_UP":
      if (phase.name !== "awaitingAnswer") return state;
      return {
        ...state,
        phase: {
          name: "showingResult",
          topic: phase.topic,
          answer: "",
          result: TIME_UP_RESULT,
          context: phase.context,
          moneyDelta: challengeDelta(phase.context, TIME_UP_RESULT.score),
        },
      };

    case "EVALUATED":
      if (phase.name !== "evaluating") return state;
      return {
        ...state,
        phase: {
          name: "showingResult",
          topic: phase.topic,
          answer: phase.answer,
          result: action.result,
          context: phase.context,
          moneyDelta: challengeDelta(phase.context, action.result.score),
        },
      };

    case "RE_EVALUATE":
      if (phase.name !== "showingResult") return state;
      return {
        ...state,
        phase: {
          name: "evaluating", topic: phase.topic, answer: phase.answer, context: phase.context,
        },
      };

    case "PROCEED": {
      if (phase.name === 'roundResults' && state.sharedRound) {
        const round = state.sharedRound;
        const bestAnswers = [...state.bestAnswers, ...round.entries.filter(e => e.result!.score >= BEST_ANSWER_MIN_SCORE && e.answer).map(e => ({
          playerName: state.players.find(p => p.id === e.playerId)!.name,
          topicPrompt: round.topic.prompt, answer: e.answer, score: e.result!.score, comment: e.result!.comment,
        }))];
        return { ...state, bestAnswers, currentPlayerIndex: 0,
          phase: { name: 'moving', remaining: round.entries[0].result!.score, cameFrom: null } };
      }
      if (phase.name !== "showingResult") return state;
      const bestAnswers = recordBest(state, phase.topic, phase.answer, phase.result);
      if (phase.context.kind === "main") {
        return {
          ...state,
          bestAnswers,
          phase: { name: "moving", remaining: phase.result.score, cameFrom: null },
        };
      }
      // チャレンジ: 金銭適用してターン終了
      const player = currentPlayer(state);
      const withMoney: GameState = {
        ...state,
        bestAnswers,
        players: updateCurrentPlayer(state, {
          money: applyMoney(player.money, phase.moneyDelta),
        }),
      };
      return endTurn(withMoney);
    }

    case "STEP_TO": {
      if (phase.name !== "moving") return state;
      const player = currentPlayer(state);
      const nodeMap = buildNodeMap(state.nodes);
      const options = moveOptions(nodeMap, player.position, phase.cameFrom);
      if (!options.includes(action.nodeId)) return state;

      const moved: GameState = {
        ...state,
        players: updateCurrentPlayer(state, { position: action.nodeId }),
      };

      // 目的地通過=即到着(残歩数切捨て)
      if (action.nodeId === state.destinationId) {
        return {
          ...moved,
          players: moved.players.map((p, i) =>
            i === state.currentPlayerIndex
              ? { ...p, money: applyMoney(p.money, ARRIVAL_PRIZE), arrivals: p.arrivals + 1 }
              : p,
          ),
          phase: { name: "arrival", nodeId: action.nodeId },
        };
      }

      const remaining = phase.remaining - 1;
      if (remaining > 0) {
        return {
          ...moved,
          phase: { name: "moving", remaining, cameFrom: player.position },
        };
      }

      // 停止: マス効果判定
      const cell = findNode(state, action.nodeId).cell;
      if (cell === "blue" || cell === "red") {
        return { ...moved, phase: { name: "challengeIntro", cellKind: cell } };
      }
      return endTurn(moved);
    }

    case "ARRIVAL_DONE":
      if (phase.name !== "arrival") return state;
      return endTurn({ ...state, destinationId: action.nextDestinationId });

    case "RESTART":
      if (phase.name !== "gameResult") return state;
      return initialState;

    default:
      return state;
  }
}

/** チャレンジ文脈での金銭増減(mainは0) */
function challengeDelta(context: AnswerContext, score: number): number {
  if (context.kind === "blue") return blueGain(score);
  if (context.kind === "red") return 0 - redLoss(context.target, score); // 0-x で -0 を回避
  return 0;
}
