import { buildNodeMap, moveOptions } from "./graph.js";
import {
  applyMoney, ARRIVAL_PRIZE, BEST_ANSWER_MIN_SCORE, blueGain, INITIAL_MONEY,
  MAX_ROUNDS, redLoss, TIME_UP_RESULT, WIN_MONEY,
} from "./rules.js";




























































export const initialState            = {
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

export function currentPlayer(state           )         {
  return state.players[state.currentPlayerIndex];
}

function updateCurrentPlayer(state           , patch                 )           {
  return state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, ...patch } : p,
  );
}

function findNode(state           , id        )          {
  const node = state.nodes.find((n) => n.id === id);
  if (!node) throw new Error(`unknown node: ${id}`);
  return node;
}

/** ターン終了処理: 勝利判定→周回判定→次手番 */
function endTurn(state           )            {
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
    phase: { name: "turnStart" },
  };
}

/** 記録対象ならベスト回答に追加 */
function recordBest(
  state           , topic       , answer        , result                  ,
)               {
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

export function gameReducer(state           , action            )            {
  const phase = state.phase;

  switch (action.type) {
    case "SHOW_SETUP":
      if (phase.name !== "title") return state;
      return { ...state, phase: { name: "setup" } };

    case "START_GAME": {
      if (phase.name !== "setup") return state;
      buildNodeMap(action.nodes); // 整合性検証(不正ならthrow)
      const players           = action.players.map((c, i) => ({
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
        phase: { name: "turnStart" },
      };
    }

    case "BEGIN_TURN":
      if (phase.name !== "turnStart") return state;
      return {
        ...state,
        usedTopicIds: [...state.usedTopicIds, action.topic.id],
        phase: { name: "awaitingAnswer", topic: action.topic, context: { kind: "main" } },
      };

    case "BEGIN_CHALLENGE": {
      if (phase.name !== "challengeIntro") return state;
      const context                =
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
      const withMoney            = {
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

      const moved            = {
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
function challengeDelta(context               , score        )         {
  if (context.kind === "blue") return blueGain(score);
  if (context.kind === "red") return 0 - redLoss(context.target, score); // 0-x で -0 を回避
  return 0;
}
