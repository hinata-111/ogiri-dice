import { describe, expect, it } from "vitest";
import { answerPrize, applyMoney, goalPrize, rankPlayers } from "./rules";
import type { Player } from "./types";

const p = (id: number, money: number): Player => ({
  id, name: `P${id}`, kind: "human", position: 0, money, goalOrder: null,
});

describe("answerPrize", () => {
  it("スコア×2万円", () => expect(answerPrize(4)).toBe(80000));
});

describe("goalPrize", () => {
  it("1着30万", () => expect(goalPrize(0)).toBe(300000));
  it("4着5万", () => expect(goalPrize(3)).toBe(50000));
  it("5着以降も5万", () => expect(goalPrize(4)).toBe(50000));
});

describe("applyMoney", () => {
  it("加算", () => expect(applyMoney(10000, 30000)).toBe(40000));
  it("0未満にならない", () => expect(applyMoney(10000, -20000)).toBe(0));
});

describe("rankPlayers", () => {
  it("所持金降順", () => {
    const ranked = rankPlayers([p(1, 100), p(2, 300), p(3, 200)]);
    expect(ranked.map((x) => x.id)).toEqual([2, 3, 1]);
  });
  it("元配列を破壊しない", () => {
    const arr = [p(1, 100), p(2, 300)];
    rankPlayers(arr);
    expect(arr[0].id).toBe(1);
  });
});
