import { describe, expect, it } from "vitest";
import { currentPlayer, gameReducer, initialState } from "./state";
import type { GameState } from "./state";
import {
  ARRIVAL_PRIZE, CHALLENGE_UNIT, INITIAL_MONEY, MAX_ROUNDS, TIME_UP_RESULT, WIN_MONEY,
} from "./rules";
import type { MapNode, PlayerConfig, Topic } from "./types";

// テスト用ミニマップ: start - n1(blue) - n2(red) - dest(theater) 、n1から枝 n1 - side(行き止まり)
const n = (
  id: string, neighbors: string[],
  kind: MapNode["kind"] = "stop", cell: MapNode["cell"] = "normal",
): MapNode => ({ id, name: id, kind, cell, x: 0, y: 0, neighbors });

const nodes: MapNode[] = [
  n("start", ["n1"], "station"),
  n("n1", ["start", "n2", "side"], "stop", "blue"),
  n("n2", ["n1", "dest"], "stop", "red"),
  n("dest", ["n2"], "theater"),
  n("side", ["n1"], "stop"),
];

const configs: PlayerConfig[] = [
  { name: "太郎", kind: "human" },
  { name: "ロボ", kind: "cpu", personality: "bold" },
];
const topic: Topic = { id: "t1", category: "c", prompt: "お題", difficulty: "Easy" };

function started(): GameState {
  let s = gameReducer(initialState, { type: "SHOW_SETUP" });
  s = gameReducer(s, {
    type: "START_GAME", players: configs, nodes, startId: "start", destinationId: "dest",
  });
  return s;
}

function toMoving(s: GameState, score: number): GameState {
  s = gameReducer(s, { type: "BEGIN_TURN", topic });
  s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "回答" });
  s = gameReducer(s, { type: "EVALUATED", result: { score, comment: "c" } });
  return gameReducer(s, { type: "PROCEED" });
}

describe("セットアップv2", () => {
  it("初期所持金10万・位置start・目的地dest", () => {
    const s = started();
    expect(s.phase.name).toBe("turnStart");
    expect(s.players[0]).toMatchObject({ position: "start", money: INITIAL_MONEY, arrivals: 0 });
    expect(s.destinationId).toBe("dest");
    expect(s.round).toBe(1);
  });
});

describe("メイン回答→移動", () => {
  it("PROCEEDで所持金変化なし・moving開始(remaining=score)", () => {
    const s = toMoving(started(), 3);
    expect(s.phase).toMatchObject({ name: "moving", remaining: 3, cameFrom: null });
    expect(currentPlayer(s).money).toBe(INITIAL_MONEY);
  });

  it("TIME_UPで時間切れ結果", () => {
    let s = gameReducer(started(), { type: "BEGIN_TURN", topic });
    s = gameReducer(s, { type: "TIME_UP" });
    expect(s.phase).toMatchObject({ name: "showingResult", result: TIME_UP_RESULT });
  });

  it("STEP_TOで1歩進み残数減・cameFrom更新", () => {
    let s = toMoving(started(), 2);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    expect(currentPlayer(s).position).toBe("n1");
    expect(s.phase).toMatchObject({ name: "moving", remaining: 1, cameFrom: "start" });
  });

  it("不正な移動先(隣接していない)は無視", () => {
    const s = toMoving(started(), 2);
    expect(gameReducer(s, { type: "STEP_TO", nodeId: "dest" })).toBe(s);
  });

  it("来た道への移動は無視(行き止まり以外)", () => {
    let s = toMoving(started(), 3);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    expect(gameReducer(s, { type: "STEP_TO", nodeId: "start" })).toBe(s);
  });

  it("行き止まりでは戻れる", () => {
    let s = toMoving(started(), 3);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    s = gameReducer(s, { type: "STEP_TO", nodeId: "side" }); // 行き止まり、残1
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" }); // 戻る、残0 → n1はblue
    expect(s.phase).toMatchObject({ name: "challengeIntro", cellKind: "blue" });
  });
});

describe("停止マス処理", () => {
  it("青マス停止でchallengeIntro(blue)", () => {
    let s = toMoving(started(), 1);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    expect(s.phase).toMatchObject({ name: "challengeIntro", cellKind: "blue" });
  });

  it("通常マス停止で次の手番へ", () => {
    let s = toMoving(started(), 3);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    s = gameReducer(s, { type: "STEP_TO", nodeId: "side" });
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" }); // blue... 使わない
    // 別ケース: score1でsideに止まる
    let s2 = toMoving(started(), 2);
    s2 = gameReducer(s2, { type: "STEP_TO", nodeId: "n1" });
    s2 = gameReducer(s2, { type: "STEP_TO", nodeId: "side" }); // 残0、side=normal
    expect(s2.phase.name).toBe("turnStart");
    expect(s2.currentPlayerIndex).toBe(1);
  });
});

describe("チャレンジ", () => {
  function toBlueChallenge(): GameState {
    let s = toMoving(started(), 1);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" }); // blue停止
    s = gameReducer(s, { type: "BEGIN_CHALLENGE", topic });
    s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "ボケ" });
    return s;
  }

  it("青: EVALUATEDでmoneyDelta=score×3万、PROCEEDで加算+次手番", () => {
    let s = toBlueChallenge();
    s = gameReducer(s, { type: "EVALUATED", result: { score: 4, comment: "c" } });
    expect(s.phase).toMatchObject({ name: "showingResult", moneyDelta: 4 * CHALLENGE_UNIT });
    s = gameReducer(s, { type: "PROCEED" });
    expect(s.players[0].money).toBe(INITIAL_MONEY + 4 * CHALLENGE_UNIT);
    expect(s.phase.name).toBe("turnStart");
    expect(s.currentPlayerIndex).toBe(1);
  });

  it("赤: 目標未達で(T−score)×3万減", () => {
    let s = toMoving(started(), 2);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n2" }); // red停止
    expect(s.phase).toMatchObject({ name: "challengeIntro", cellKind: "red" });
    s = gameReducer(s, { type: "BEGIN_CHALLENGE", topic, target: 4 });
    s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "ボケ" });
    s = gameReducer(s, { type: "EVALUATED", result: { score: 2, comment: "c" } });
    expect(s.phase).toMatchObject({ name: "showingResult", moneyDelta: -2 * CHALLENGE_UNIT });
    s = gameReducer(s, { type: "PROCEED" });
    expect(s.players[0].money).toBe(INITIAL_MONEY - 2 * CHALLENGE_UNIT);
  });

  it("赤: 目標達成なら増減なし", () => {
    let s = toMoving(started(), 2);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n2" });
    s = gameReducer(s, { type: "BEGIN_CHALLENGE", topic, target: 2 });
    s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "ボケ" });
    s = gameReducer(s, { type: "EVALUATED", result: { score: 5, comment: "c" } });
    expect(s.phase).toMatchObject({ name: "showingResult", moneyDelta: 0 });
  });
});

describe("到着と目的地", () => {
  it("目的地に踏み込んだ瞬間に到着(残歩数切捨て)+30万+arrival演出", () => {
    let s = toMoving(started(), 6);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n2" });
    s = gameReducer(s, { type: "STEP_TO", nodeId: "dest" }); // 残3あるが到着
    expect(s.phase).toMatchObject({ name: "arrival", nodeId: "dest" });
    expect(s.players[0].money).toBe(INITIAL_MONEY + ARRIVAL_PRIZE);
    expect(s.players[0].arrivals).toBe(1);
  });

  it("ARRIVAL_DONEで次目的地設定+次手番", () => {
    let s = toMoving(started(), 3);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n2" });
    s = gameReducer(s, { type: "STEP_TO", nodeId: "dest" });
    s = gameReducer(s, { type: "ARRIVAL_DONE", nextDestinationId: "start" });
    expect(s.destinationId).toBe("start");
    expect(s.phase.name).toBe("turnStart");
    expect(s.currentPlayerIndex).toBe(1);
  });
});

describe("勝敗", () => {
  it("ターン終了時に100万以上で即gameResult+winnerId", () => {
    let s = started();
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, money: WIN_MONEY - CHALLENGE_UNIT } : p)) };
    // 青チャレンジで4×3万獲得 → 100万超え
    s = toMoving(s, 1);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    s = gameReducer(s, { type: "BEGIN_CHALLENGE", topic });
    s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "ボケ" });
    s = gameReducer(s, { type: "EVALUATED", result: { score: 4, comment: "c" } });
    s = gameReducer(s, { type: "PROCEED" });
    expect(s.phase.name).toBe("gameResult");
    expect(s.winnerId).toBe(0);
  });

  it("MAX_ROUNDS周終了でgameResult(winnerIdはnull=金額判定)", () => {
    let s = started();
    s = { ...s, round: MAX_ROUNDS, currentPlayerIndex: 1 }; // 最終周の最終手番
    s = toMoving(s, 2);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    s = gameReducer(s, { type: "STEP_TO", nodeId: "side" }); // normal停止→ターン終了
    expect(s.phase.name).toBe("gameResult");
    expect(s.winnerId).toBeNull();
  });

  it("RESTARTでtitleへ", () => {
    let s = started();
    s = { ...s, phase: { name: "gameResult" } };
    s = gameReducer(s, { type: "RESTART" });
    expect(s.phase.name).toBe("title");
  });
});
