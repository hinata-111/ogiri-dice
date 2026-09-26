import { FALLBACK_CPU_ANSWERS, FALLBACK_EVALUATION, type Evaluator } from '../../app/src/ai/evaluator';
import type { CpuPersonality, EvaluationResult } from '../../app/src/game/types';
import { callGemini } from './gemini';
import { buildCpuPrompt, buildEvaluatePrompt } from './prompts';

type Call = (key: string, prompt: string, schema: object, signal: AbortSignal) => Promise<unknown>;
export class WorkerEvaluator implements Evaluator {
  private key: string;
  private call: Call;
  private timeout: number;
  constructor(key: string, call: Call = callGemini, timeout = 10_000) {
    this.key = key; this.call = call; this.timeout = timeout;
  }
  private async attempt(prompt: string, schema: object): Promise<unknown> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.call(this.key, prompt, schema, controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, this.timeout);
        }),
      ]);
    } finally { if (timer) clearTimeout(timer); }
  }
  async evaluate(topic: string, answer: string): Promise<EvaluationResult> {
    const schema = { type: 'OBJECT', properties: { score: { type: 'INTEGER' }, comment: { type: 'STRING' } }, required: ['score', 'comment'] };
    for (let i = 0; i < 2; i++) {
      try {
        const raw = await this.attempt(buildEvaluatePrompt(topic, answer), schema) as Partial<EvaluationResult> | null;
        if (raw && Number.isInteger(raw.score) && raw.score! >= 1 && raw.score! <= 6 && typeof raw.comment === 'string') {
          return { score: raw.score!, comment: raw.comment.slice(0, 300) };
        }
      } catch { /* Bounded retry; never log secret-bearing upstream errors. */ }
    }
    return FALLBACK_EVALUATION;
  }
  async cpuAnswer(topic: string, personality: CpuPersonality): Promise<string> {
    try {
      const raw = await this.attempt(buildCpuPrompt(topic, personality), { type: 'OBJECT', properties: { answer: { type: 'STRING' } }, required: ['answer'] }) as { answer?: unknown };
      if (typeof raw?.answer === 'string' && raw.answer.trim()) return raw.answer.slice(0, 100);
    } catch { /* CPU fallback keeps the Evaluator contract. */ }
    return FALLBACK_CPU_ANSWERS[0];
  }
}
