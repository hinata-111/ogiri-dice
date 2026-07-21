import { ApiEvaluator } from "./api";
import type { Evaluator } from "./evaluator";
import { MockEvaluator } from "./mock";

/** VITE_USE_MOCK=1 ならモック評価器、それ以外は Worker 経由の本番評価器 */
export function createEvaluator(): Evaluator {
  if (import.meta.env.VITE_USE_MOCK === "1") return new MockEvaluator();
  return new ApiEvaluator();
}
