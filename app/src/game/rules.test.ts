import { describe, expect, it } from "vitest";
import { applyMoney, blueGain, CHALLENGE_UNIT, rankPlayers, redLoss } from "./rules";
import type { Player } from "./types";

const p = (id: number, money: number, arrivals = 0): Player => ({
  id, name: `P${id}`, kind: "human", position: "start", money, arrivals,
});

describe("blueGain", () => {
  it("スコア×3万", () => expect(blueGain(4)).toBe(4 * CHALLENGE_UNIT));
});

describe("redLoss", () => {
  it("未達分×3万", () => expect(redLoss(4, 1)).toBe(3 * CHALLENGE_UNIT));
  it("達成なら0", () => expect(redLoss(2, 5)).toBe(0));
});

describe("applyMoney", () => {
  it("加算", () => expect(applyMoney(10000, 30000)).toBe(40000));
  it("0未満にならない", () => expect(applyMoney(10000, -20000)).toBe(0));
});

describe("rankPlayers", () => {
  it("所持金降順・同額は到着数降順", () => {
    const ranked = rankPlayers([p(1, 100, 0), p(2, 300), p(3, 300, 2)]);
    expect(ranked.map((x) => x.id)).toEqual([3, 2, 1]);
  });
});
