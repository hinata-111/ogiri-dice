import { describe, it, expect, vi } from 'vitest';
import { WorkerEvaluator } from './workerEvaluator';

describe('Worker evaluator', () => {
  it('validates structured Gemini scores and does not expose credentials', async () => {
    const call = vi.fn(async () => ({ score: 6, comment: 'いいね' }));
    const e = new WorkerEvaluator('key', call);
    expect(await e.evaluate('題', '答')).toEqual({ score: 6, comment: 'いいね' });
    expect(call.mock.calls).toHaveLength(1);
  });
  it('retries invalid or failed results once before fallback', async () => {
    const call = vi.fn(async () => ({ score: 99, comment: 'invalid' }));
    const result = await new WorkerEvaluator('key', call).evaluate('題', '答');
    expect(result).toMatchObject({ score: 3, fallback: true });
    expect(call).toHaveBeenCalledTimes(2);
  });
  it('bounds a hung request and cancels it before retry', async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const call = vi.fn((_key, _prompt, _schema, signal: AbortSignal) => {
      signals.push(signal); return new Promise(() => {});
    });
    const pending = new WorkerEvaluator('key', call, 100).evaluate('題', '答');
    await vi.advanceTimersByTimeAsync(200);
    expect(await pending).toMatchObject({ fallback: true });
    expect(signals.every(s => s.aborted)).toBe(true);
    vi.useRealTimers();
  });
});
