import { describe, expect, it } from "vitest";
import { cellEffectDelta, isGoal, moveTo } from "./board";
import type { BoardCell } from "./types";

const cell = (type: BoardCell["type"], amount = 0): BoardCell => ({
  index: 1, type, amount, x: 0, y: 0,
});

describe("moveTo", () => {
  it("スコア分進む", () => expect(moveTo(3, 4, 31)).toBe(7));
  it("ゴールを超えない(最後のマスで止まる)", () => expect(moveTo(28, 6, 31)).toBe(30));
});

describe("isGoal", () => {
  it("最終マスがゴール", () => expect(isGoal(30, 31)).toBe(true));
  it("途中はゴールでない", () => expect(isGoal(29, 31)).toBe(false));
});

describe("cellEffectDelta", () => {
  it("青マスはプラス", () => expect(cellEffectDelta(cell("blue", 30000))).toBe(30000));
  it("赤マスはマイナス", () => expect(cellEffectDelta(cell("red", 20000))).toBe(-20000));
  it("通常マスはゼロ", () => expect(cellEffectDelta(cell("normal"))).toBe(0));
  it("イベントマスもゼロ(v1では効果なし)", () => expect(cellEffectDelta(cell("event"))).toBe(0));
});
