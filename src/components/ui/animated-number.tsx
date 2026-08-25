"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/utils";

// Counts from whatever it last showed up to the new value, instead of
// snapping straight there. Mounts at 0 on purpose — the rise on first paint
// is what makes a dashboard's headline figures feel alive rather than
// printed — and re-fires the same way on every later change (switching the
// month selector re-renders this with a new `value`), so a number visibly
// moves instead of just being replaced.
//
// Always renders as BRL, the same as every other figure in the app —
// deliberately not a `format` prop: this is a Client Component threaded
// straight into Server Component pages (StatCard, BalanceHero), and a
// function prop crossing that boundary is exactly what React's "Functions
// cannot be passed directly to Client Components" error is about.
export function AnimatedNumber({
  value,
  duration = 700,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const currentRef = useRef(0);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const from = currentRef.current;
    const delta = value - from;

    if (prefersReduced || Math.abs(delta) < 0.005) {
      currentRef.current = value;
      setDisplay(value);
      return;
    }

    let raf = 0;
    const start = performance.now();

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      // Cubic ease-out: fast start, settles rather than stopping abruptly.
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + delta * eased;
      currentRef.current = next;
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className={className}>{formatCurrency(display)}</span>;
}
