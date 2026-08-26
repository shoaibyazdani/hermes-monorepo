"use client";

import { useEffect, useState } from "react";

/**
 * Live UTC clock as "HH:MM:SS".
 *
 * Starts at a fixed placeholder so server and client render identical markup,
 * then swaps to the real time after mount. Consumers should still pass
 * `suppressHydrationWarning` on the element in case the tick lands between
 * hydration and the first effect.
 */
export function useUtcClock(): string {
  const [time, setTime] = useState("--:--:--");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(
        [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]
          .map((n) => String(n).padStart(2, "0"))
          .join(":"),
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}
