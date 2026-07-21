import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rateLimiter";

describe("RateLimiter", () => {
  it("上限までは許可、超えたら拒否", () => {
    const rl = new RateLimiter(3, 60000);
    expect(rl.allow("ip1", 0)).toBe(true);
    expect(rl.allow("ip1", 1)).toBe(true);
    expect(rl.allow("ip1", 2)).toBe(true);
    expect(rl.allow("ip1", 3)).toBe(false);
  });

  it("ウィンドウが過ぎたら再び許可", () => {
    const rl = new RateLimiter(1, 60000);
    expect(rl.allow("ip1", 0)).toBe(true);
    expect(rl.allow("ip1", 1000)).toBe(false);
    expect(rl.allow("ip1", 61000)).toBe(true);
  });

  it("キーごとに独立", () => {
    const rl = new RateLimiter(1, 60000);
    expect(rl.allow("ip1", 0)).toBe(true);
    expect(rl.allow("ip2", 0)).toBe(true);
  });
});
