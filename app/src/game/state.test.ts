import { describe, expect, it } from "vitest";
import { gameReducer, initialState, currentPlayer } from "./state";
import type { GameState } from "./state";
import { TIME_UP_RESULT } from "./rules";
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
