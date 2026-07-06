import type { CpuPersonality, EvaluationResult } from "../game/types";

export interface Evaluator {
  evaluate(topicPrompt: string, answer: string): Promise<EvaluationResult>;
  cpuAnswer(topicPrompt: string, personality: CpuPersonality): Promise<string>;
}

export const FALLBACK_EVALUATION: EvaluationResult = {
  score: 3,
  comment: "電波の関係で審査員が聞き取れなかったらしい…",
  fallback: true,
};

export const FALLBACK_CPU_ANSWERS = [
  "考えすぎて頭が真っ白になりました",
  "ノーコメントでお願いします",
  "それは来世でお答えします",
];
