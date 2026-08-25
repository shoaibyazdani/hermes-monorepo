"use client";

import { useEffect, useState } from "react";

interface TypewriterState {
  shown: string;
}

export function useTypewriter(text: string, speed = 30): TypewriterState {
  const [shown, setShown] = useState("");

  useEffect(() => {
    setShown("");
    let i = 0;
    const tick = () => {
      if (i <= text.length) {
        setShown(text.slice(0, i));
        i++;
        setTimeout(tick, speed);
      }
    };
    tick();
  }, [text, speed]);

  return { shown };
}
