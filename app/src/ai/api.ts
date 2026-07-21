import type { CpuPersonality, EvaluationResult } from "../game/types";
import { FALLBACK_CPU_ANSWERS, FALLBACK_EVALUATION, type Evaluator } from "./evaluator";

const API_BASE: string = import.meta.env.VITE_API_BASE ?? "";
const ATTEMPTS = 2; // 初回 + リトライ1回

/** Cloudflare Worker(Geminiプロキシ)経由の本番評価器。タイムアウト・失敗時は1回リトライし、
 * それでも失敗ならフォールバック値を返す。 */
export class ApiEvaluator implements Evaluator {
  private fetchFn: typeof fetch;
  private timeoutMs: number;

  constructor(
    fetchFn: typeof fetch = (...args) => fetch(...args),
    timeoutMs: number = 10_000,
  ) {
    this.fetchFn = fetchFn;
    this.timeoutMs = timeoutMs;
  }

  private async post(path: string, body: object): Promise<unknown | null> {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      try {
        const res = await this.fetchFn(`${API_BASE}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!res.ok) continue;
        return await res.json();
      } catch {
        // タイムアウト・ネットワークエラー → リトライへ
      }
    }
    return null;
  }

  async evaluate(topicPrompt: string, answer: string): Promise<EvaluationResult> {
    const data = (await this.post("/api/evaluate", {
      topic: topicPrompt,
      answer,
    })) as { score?: unknown; comment?: unknown } | null;
    if (
      data &&
      typeof data.score === "number" &&
      data.score >= 1 && data.score <= 6 &&
      typeof data.comment === "string"
    ) {
      return { score: data.score, comment: data.comment };
    }
    return FALLBACK_EVALUATION;
  }

  async cpuAnswer(topicPrompt: string, personality: CpuPersonality): Promise<string> {
    const data = (await this.post("/api/cpu-answer", {
      topic: topicPrompt,
      personality,
    })) as { answer?: unknown } | null;
    if (data && typeof data.answer === "string" && data.answer.length > 0) {
      return data.answer;
    }
    return FALLBACK_CPU_ANSWERS[Math.floor(Math.random() * FALLBACK_CPU_ANSWERS.length)];
  }
}
