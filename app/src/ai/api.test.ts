import { describe, expect, it, vi } from "vitest";
import { ApiEvaluator } from "./api";
import { FALLBACK_CPU_ANSWERS, FALLBACK_EVALUATION } from "./evaluator";

const okResponse = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200 });

describe("ApiEvaluator.evaluate", () => {
  it("成功レスポンスをEvaluationResultとして返す", async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse({ score: 5, comment: "やるな" }));
    const e = new ApiEvaluator(fetchFn, 1000);
    const r = await e.evaluate("お題", "回答");
    expect(r).toEqual({ score: 5, comment: "やるな" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("1回目失敗→2回目成功ならリトライで成功", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("err", { status: 502 }))
      .mockResolvedValueOnce(okResponse({ score: 2, comment: "うーん" }));
    const e = new ApiEvaluator(fetchFn, 1000);
    const r = await e.evaluate("お題", "回答");
    expect(r.score).toBe(2);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("2回とも失敗ならフォールバック値", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("network"));
    const e = new ApiEvaluator(fetchFn, 1000);
    const r = await e.evaluate("お題", "回答");
    expect(r).toEqual(FALLBACK_EVALUATION);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("スコアが範囲外ならフォールバック値", async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse({ score: 99, comment: "x" }));
    const e = new ApiEvaluator(fetchFn, 1000);
    const r = await e.evaluate("お題", "回答");
    expect(r).toEqual(FALLBACK_EVALUATION);
  });
});

describe("ApiEvaluator.cpuAnswer", () => {
  it("成功なら回答文字列", async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse({ answer: "入場料が出世払い" }));
    const e = new ApiEvaluator(fetchFn, 1000);
    expect(await e.cpuAnswer("お題", "bold")).toBe("入場料が出世払い");
  });

  it("全失敗なら定型回答リストから返す", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("network"));
    const e = new ApiEvaluator(fetchFn, 1000);
    expect(FALLBACK_CPU_ANSWERS).toContain(await e.cpuAnswer("お題", "safe"));
  });
});
