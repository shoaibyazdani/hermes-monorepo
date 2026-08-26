"use client";

import { useEffect, useState } from "react";

interface TypewriterProps {
  text: string;
  speed?: number; // ms per char
  className?: string;
}

/**
 * Typewriter helper — reveals text character by character.
 */
export function Typewriter({ text, speed = 30, className }: TypewriterProps) {
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

  return (
    <span className={className}>
      {shown}
      <span aria-hidden className="animate-blink-cursor">▋</span>
    </span>
  );
}
