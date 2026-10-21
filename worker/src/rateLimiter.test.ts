import { describe, expect, it, vi } from "vitest";
import { RateLimiter } from "./rateLimiter";

describe("RateLimiter", () => {
  it("bindingにキーを渡し許可の結果を使う", async () => {
    const limit = vi.fn(async () => ({ success: true }));
    expect(await new RateLimiter({ limit }).allow("ai:ip1")).toBe(true);
    expect(limit).toHaveBeenCalledWith({ key: "ai:ip1" });
  });

  it("新しいインスタンスでもbindingの拒否を維持する", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    expect(await new RateLimiter({ limit }).allow("ai:ip1")).toBe(false);
    expect(await new RateLimiter({ limit }).allow("ai:ip1")).toBe(false);
    expect(limit).toHaveBeenCalledTimes(2);
  });

  it("bindingがなければローカルの許可に切り替えず失敗する", async () => {
    await expect(Promise.resolve().then(() => new RateLimiter().allow("ai:ip1"))).rejects.toThrow();
  });

  it("bindingの例外を呼び出し元へ伝える", async () => {
    const limit = vi.fn(async () => { throw new Error("unavailable"); });
    await expect(Promise.resolve().then(() => new RateLimiter({ limit }).allow("ai:ip1"))).rejects.toThrow("unavailable");
  });
});
