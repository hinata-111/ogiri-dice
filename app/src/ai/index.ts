import type { Evaluator } from "./evaluator";
import { MockEvaluator } from "./mock";

// Task 13でApiEvaluatorに切り替える。それまでは常にモック。
export function createEvaluator(): Evaluator {
  return new MockEvaluator();
}
