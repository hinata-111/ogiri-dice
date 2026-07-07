import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCountdown } from "./useCountdown";

describe("useCountdown", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("残り時間が減っていく", () => {
    const { result } = renderHook(() => useCountdown(true, 10000, () => {}));
    expect(result.current).toBe(10000);
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current).toBeLessThanOrEqual(7000);
  });

  it("時間切れでonExpireが1回だけ呼ばれる", () => {
    const onExpire = vi.fn();
    renderHook(() => useCountdown(true, 1000, onExpire));
    act(() => vi.advanceTimersByTime(2000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("activeがfalseなら動かない", () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useCountdown(false, 1000, onExpire));
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current).toBe(1000);
    expect(onExpire).not.toHaveBeenCalled();
  });
});
