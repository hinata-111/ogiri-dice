import { useEffect, useRef, useState } from "react";

/** activeの間、totalMsからカウントダウンし、0でonExpireを1回呼ぶ。残りmsを返す。 */
export function useCountdown(active: boolean, totalMs: number, onExpire: () => void): number {
  const [remaining, setRemaining] = useState(totalMs);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!active) {
      setRemaining(totalMs);
      expiredRef.current = false;
      return;
    }
    setRemaining(totalMs);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const left = Math.max(0, totalMs - (Date.now() - startedAt));
      setRemaining(left);
      if (left === 0 && !expiredRef.current) {
        expiredRef.current = true;
        clearInterval(timer);
        onExpireRef.current();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [active, totalMs]);

  return remaining;
}
