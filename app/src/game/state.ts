import { cellEffectDelta, isGoal, moveTo } from "./board";
import {
  answerPrize, applyMoney, BEST_ANSWER_MIN_SCORE, goalPrize, TIME_UP_RESULT,
} from "./rules";
import type {
  BestAnswer, BoardCell, EvaluationResult, Player, PlayerConfig, Topic,
} from "./types";

export type Phase =
  | { name: "title" }
  | { name: "setup" }
  | { name: "turnStart" }
  | { name: "awaitingAnswer"; topic: Topic }
  | { name: "evaluating"; topic: Topic; answer: string }
  | { name: "showingResult"; topic: Topic; answer: string; result: EvaluationResult }
  | { name: "moving"; from: number; to: number }
  | { name: "cellEffect"; cell: BoardCell; delta: number }
  | { name: "gameResult" };

export interface GameState {
  phase: Phase;
  board: BoardCell[];
  players: Player[];
  currentPlayerIndex: number;
  usedTopicIds: string[];
  bestAnswers: BestAnswer[];
  goalCount: number;
}

export type GameAction =
  | { type: "SHOW_SETUP" }
  | { type: "START_GAME"; players: PlayerConfig[]; board: BoardCell[] }
  | { type: "BEGIN_TURN"; topic: Topic }
  | { type: "SUBMIT_ANSWER"; answer: string }
  | { type: "TIME_UP" }
  | { type: "EVALUATED"; result: EvaluationResult }
  | { type: "RE_EVALUATE" }
  | { type: "PROCEED" }
  | { type: "MOVE_DONE" }
  | { type: "EFFECT_DONE" }
  | { type: "RESTART" };

export const initialState: GameState = {
  phase: { name: "title" },
  board: [],
  players: [],
  currentPlayerIndex: 0,
  usedTopicIds: [],
  bestAnswers: [],
  goalCount: 0,
};

export function currentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex];
}

function updateCurrentPlayer(state: GameState, patch: Partial<Player>): Player[] {
  return state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, ...patch } : p,
  );
}

/** 次の未ゴールプレイヤーへ手番を回す。全員ゴール済みならgameResultへ。 */
function advanceTurn(state: GameState): GameState {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (state.currentPlayerIndex + i) % n;
    if (state.players[idx].goalOrder === null) {
      return { ...state, currentPlayerIndex: idx, phase: { name: "turnStart" } };
    }
  }
  return { ...state, phase: { name: "gameResult" } };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const phase = state.phase;

  switch (action.type) {
    case "SHOW_SETUP":
      if (phase.name !== "title") return state;
      return { ...state, phase: { name: "setup" } };

    case "START_GAME": {
      if (phase.name !== "setup") return state;
      const players: Player[] = action.players.map((c, i) => ({
        id: i,
        name: c.name,
        kind: c.kind,
        personality: c.personality,
        position: 0,
        money: 0,
        goalOrder: null,
      }));
      return {
        ...initialState,
        board: action.board,
        players,
        phase: { name: "turnStart" },
      };
    }

    case "BEGIN_TURN":
      if (phase.name !== "turnStart") return state;
      return {
        ...state,
        usedTopicIds: [...state.usedTopicIds, action.topic.id],
        phase: { name: "awaitingAnswer", topic: action.topic },
      };

    case "SUBMIT_ANSWER":
      if (phase.name !== "awaitingAnswer") return state;
      return { ...state, phase: { name: "evaluating", topic: phase.topic, answer: action.answer } };

    case "TIME_UP":
      if (phase.name !== "awaitingAnswer") return state;
      return {
        ...state,
        phase: { name: "showingResult", topic: phase.topic, answer: "", result: TIME_UP_RESULT },
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
        },
      };

    case "RE_EVALUATE":
      if (phase.name !== "showingResult") return state;
      return { ...state, phase: { name: "evaluating", topic: phase.topic, answer: phase.answer } };

    case "PROCEED": {
      if (phase.name !== "showingResult") return state;
      const player = currentPlayer(state);
      const from = player.position;
      const to = moveTo(from, phase.result.score, state.board.length);
      const bestAnswers =
        phase.result.score >= BEST_ANSWER_MIN_SCORE && phase.answer !== ""
          ? [
              ...state.bestAnswers,
              {
                playerName: player.name,
                topicPrompt: phase.topic.prompt,
                answer: phase.answer,
                score: phase.result.score,
                comment: phase.result.comment,
              },
            ]
          : state.bestAnswers;
      return {
        ...state,
        players: updateCurrentPlayer(state, {
          position: to,
          money: applyMoney(player.money, answerPrize(phase.result.score)),
        }),
        bestAnswers,
        phase: { name: "moving", from, to },
      };
    }

    case "MOVE_DONE": {
      if (phase.name !== "moving") return state;
      const player = currentPlayer(state);
      if (isGoal(player.position, state.board.length)) {
        const order = state.goalCount;
        const withGoal: GameState = {
          ...state,
          goalCount: order + 1,
          players: updateCurrentPlayer(state, {
            goalOrder: order,
            money: applyMoney(player.money, goalPrize(order)),
          }),
        };
        return advanceTurn(withGoal);
      }
      const cell = state.board[player.position];
      const delta = cellEffectDelta(cell);
      if (delta !== 0) {
        return {
          ...state,
          players: updateCurrentPlayer(state, { money: applyMoney(player.money, delta) }),
          phase: { name: "cellEffect", cell, delta },
        };
      }
      return advanceTurn(state);
    }

    case "EFFECT_DONE":
      if (phase.name !== "cellEffect") return state;
      return advanceTurn(state);

    case "RESTART":
      if (phase.name !== "gameResult") return state;
      return initialState;

    default:
      return state;
  }
}
