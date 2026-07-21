/** 固定ウィンドウのシンプルなIP毎レート制限(Workerインスタンス内メモリ) */
export class RateLimiter {
  private limit: number;
  private windowMs: number;
  private windows = new Map<string, { start: number; count: number }>();

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  allow(key: string, now: number = Date.now()): boolean {
    const w = this.windows.get(key);
    if (!w || now - w.start >= this.windowMs) {
      this.windows.set(key, { start: now, count: 1 });
      return true;
    }
    if (w.count >= this.limit) return false;
    w.count += 1;
    return true;
  }
}
