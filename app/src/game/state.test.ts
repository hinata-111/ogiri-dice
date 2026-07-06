import { describe, expect, it } from "vitest";
import { gameReducer, initialState, currentPlayer } from "./state";
import type { GameState } from "./state";
import { TIME_UP_RESULT, GOAL_PRIZES, PRIZE_PER_SCORE } from "./rules";
import type { BoardCell, PlayerConfig, Topic } from "./types";

const board: BoardCell[] = Array.from({ length: 31 }, (_, i) => ({
  index: i,
  type: i === 2 ? "blue" : i === 4 ? "red" : "normal",
  amount: i === 2 ? 30000 : i === 4 ? 20000 : 0,
  x: 0, y: 0,
}));

const configs: PlayerConfig[] = [
  { name: "太郎", kind: "human" },
  { name: "ロボ", kind: "cpu", personality: "bold" },
];

const topic: Topic = { id: "t1", category: "c", prompt: "こんな劇場は嫌だ", difficulty: "Easy" };

function started(): GameState {
  let s = gameReducer(initialState, { type: "SHOW_SETUP" });
  s = gameReducer(s, { type: "START_GAME", players: configs, board });
  return s;
}

describe("セットアップ", () => {
  it("title→setup→turnStart と遷移しプレイヤーが初期化される", () => {
    const s = started();
    expect(s.phase.name).toBe("turnStart");
    expect(s.players).toHaveLength(2);
    expect(s.players[0]).toMatchObject({ name: "太郎", position: 0, money: 0, goalOrder: null });
    expect(currentPlayer(s).name).toBe("太郎");
  });
});

describe("出題〜採点", () => {
  it("BEGIN_TURNでawaitingAnswerになりお題が使用済みになる", () => {
    const s = gameReducer(started(), { type: "BEGIN_TURN", topic });
    expect(s.phase).toMatchObject({ name: "awaitingAnswer", topic });
    expect(s.usedTopicIds).toContain("t1");
  });

  it("SUBMIT_ANSWERでevaluatingへ", () => {
    let s = gameReducer(started(), { type: "BEGIN_TURN", topic });
    s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "客席が全部トイレ" });
    expect(s.phase).toMatchObject({ name: "evaluating", answer: "客席が全部トイレ" });
  });

  it("TIME_UPで時間切れ結果のshowingResultへ", () => {
    let s = gameReducer(started(), { type: "BEGIN_TURN", topic });
    s = gameReducer(s, { type: "TIME_UP" });
    expect(s.phase).toMatchObject({ name: "showingResult", answer: "", result: TIME_UP_RESULT });
  });

  it("EVALUATEDでshowingResultへ(この時点で所持金は変わらない)", () => {
    let s = gameReducer(started(), { type: "BEGIN_TURN", topic });
    s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "a" });
    s = gameReducer(s, { type: "EVALUATED", result: { score: 5, comment: "やるな" } });
    expect(s.phase).toMatchObject({ name: "showingResult", result: { score: 5 } });
    expect(currentPlayer(s).money).toBe(0);
  });

  it("RE_EVALUATEで同じ回答のままevaluatingへ戻る", () => {
    let s = gameReducer(started(), { type: "BEGIN_TURN", topic });
    s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "a" });
    s = gameReducer(s, { type: "EVALUATED", result: { score: 3, comment: "…", fallback: true } });
    s = gameReducer(s, { type: "RE_EVALUATE" });
    expect(s.phase).toMatchObject({ name: "evaluating", answer: "a" });
  });

  it("不正な遷移のアクションは無視される", () => {
    const s = started();
    expect(gameReducer(s, { type: "SUBMIT_ANSWER", answer: "x" })).toBe(s);
  });
});

function toShowingResult(score: number): GameState {
  let s = gameReducer(started(), { type: "BEGIN_TURN", topic });
  s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "回答" });
  s = gameReducer(s, { type: "EVALUATED", result: { score, comment: "コメント" } });
  return s;
}

describe("移動とマス効果", () => {
  it("PROCEEDで賞金加算+位置更新+movingへ", () => {
    const s = gameReducer(toShowingResult(4), { type: "PROCEED" });
    expect(s.phase).toMatchObject({ name: "moving", from: 0, to: 4 });
    expect(s.players[0].position).toBe(4);
    expect(s.players[0].money).toBe(4 * PRIZE_PER_SCORE);
  });

  it("スコア5以上はベスト回答に記録される", () => {
    const s = gameReducer(toShowingResult(5), { type: "PROCEED" });
    expect(s.bestAnswers).toHaveLength(1);
    expect(s.bestAnswers[0]).toMatchObject({ playerName: "太郎", score: 5 });
  });

  it("スコア4以下は記録されない", () => {
    const s = gameReducer(toShowingResult(4), { type: "PROCEED" });
    expect(s.bestAnswers).toHaveLength(0);
  });

  it("青マス到着でcellEffect(+3万)", () => {
    let s = gameReducer(toShowingResult(2), { type: "PROCEED" }); // index2=blue
    const moneyBefore = s.players[0].money;
    s = gameReducer(s, { type: "MOVE_DONE" });
    expect(s.phase).toMatchObject({ name: "cellEffect", delta: 30000 });
    expect(s.players[0].money).toBe(moneyBefore + 30000);
  });

  it("赤マス到着でcellEffect(-2万)", () => {
    let s = gameReducer(toShowingResult(4), { type: "PROCEED" }); // index4=red
    const moneyBefore = s.players[0].money;
    s = gameReducer(s, { type: "MOVE_DONE" });
    expect(s.phase).toMatchObject({ name: "cellEffect", delta: -20000 });
    expect(s.players[0].money).toBe(moneyBefore - 20000);
  });

  it("通常マスなら即次の手番(turnStart)へ", () => {
    let s = gameReducer(toShowingResult(3), { type: "PROCEED" }); // index3=normal
    s = gameReducer(s, { type: "MOVE_DONE" });
    expect(s.phase.name).toBe("turnStart");
    expect(s.currentPlayerIndex).toBe(1);
  });

  it("EFFECT_DONEで次の手番へ", () => {
    let s = gameReducer(toShowingResult(2), { type: "PROCEED" });
    s = gameReducer(s, { type: "MOVE_DONE" });
    s = gameReducer(s, { type: "EFFECT_DONE" });
    expect(s.phase.name).toBe("turnStart");
    expect(s.currentPlayerIndex).toBe(1);
  });
});

describe("ゴールと勝敗", () => {
  function goalPlayer(s: GameState): GameState {
    // 現在手番のプレイヤーを位置29に置き、スコア6でゴールさせる
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === s.currentPlayerIndex ? { ...p, position: 29 } : p,
      ),
    };
    s = gameReducer(s, { type: "BEGIN_TURN", topic });
    s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "ゴール回答" });
    s = gameReducer(s, { type: "EVALUATED", result: { score: 6, comment: "神" } });
    s = gameReducer(s, { type: "PROCEED" });
    return gameReducer(s, { type: "MOVE_DONE" });
  }

  it("ゴールで1着賞金が加算されgoalOrderが付く", () => {
    const s = goalPlayer(started());
    expect(s.players[0].goalOrder).toBe(0);
    expect(s.players[0].money).toBe(6 * PRIZE_PER_SCORE + GOAL_PRIZES[0]);
    expect(s.phase.name).toBe("turnStart");
    expect(s.currentPlayerIndex).toBe(1);
  });

  it("ゴール済みプレイヤーは手番スキップされる", () => {
    let s = goalPlayer(started()); // P0ゴール、手番P1
    // P1が通常マスに止まって手番が一周 → 再びP1(P0スキップ)
    s = gameReducer(s, { type: "BEGIN_TURN", topic });
    s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "a" });
    s = gameReducer(s, { type: "EVALUATED", result: { score: 3, comment: "c" } });
    s = gameReducer(s, { type: "PROCEED" });
    s = gameReducer(s, { type: "MOVE_DONE" });
    expect(s.currentPlayerIndex).toBe(1);
    expect(s.phase.name).toBe("turnStart");
  });

  it("全員ゴールでgameResultへ、RESTARTでtitleへ", () => {
    let s = goalPlayer(started()); // P0ゴール
    s = goalPlayer(s); // P1ゴール
    expect(s.phase.name).toBe("gameResult");
    expect(s.players[1].goalOrder).toBe(1);
    s = gameReducer(s, { type: "RESTART" });
    expect(s.phase.name).toBe("title");
  });
});
