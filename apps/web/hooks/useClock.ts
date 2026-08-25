"use client";

import { useEffect, useState } from "react";

interface ClockState {
  utc: string;
  pkt: string;
}

function fmtUTC(d: Date): string {
  return d.toUTCString().split(" ")[4] + " UTC";
}

function fmtPKT(d: Date): string {
  // PKT = UTC+5
  const pktMs = d.getTime() + 5 * 60 * 60 * 1000;
  const pkt = new Date(pktMs);
  return (
    pkt.toLocaleTimeString("en-US", { hour12: false }) + " PKT"
  );
}

export function useClock(): ClockState {
  const [clock, setClock] = useState<ClockState>(() => ({
    utc: fmtUTC(new Date()),
    pkt: fmtPKT(new Date()),
  }));

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock({ utc: fmtUTC(now), pkt: fmtPKT(now) });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return clock;
}
