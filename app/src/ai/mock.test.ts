import { describe, expect, it } from "vitest";
import { MockEvaluator } from "./mock";

describe("MockEvaluator", () => {
  it("1〜6のスコアとコメントを返す", async () => {
    const e = new MockEvaluator(0, () => 0.99);
    const r = await e.evaluate("お題", "回答");
    expect(r.score).toBe(6);
    expect(r.comment.length).toBeGreaterThan(0);
  });

  it("random=0でスコア1", async () => {
    const e = new MockEvaluator(0, () => 0);
    const r = await e.evaluate("お題", "回答");
    expect(r.score).toBe(1);
  });

  it("CPU回答を返す", async () => {
    const e = new MockEvaluator(0, () => 0);
    const a = await e.cpuAnswer("お題", "bold");
    expect(a.length).toBeGreaterThan(0);
  });
});
