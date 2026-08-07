"use client";

/**
 * The name, and what the cursor does to it.
 *
 * Two stacked copies of the same string. The solid one carries a warm gradient
 * positioned at the cursor, so the light travelling across the letters is the
 * light of the disc behind them. Under the cursor its fill is masked away and
 * the second copy — hollow, cut in gold outline — shows through, so wherever
 * you point, the name stops being carved and starts being *un*carved.
 *
 * Which is the whole Amarna joke: Akhenaten built a city to the disc and then
 * had his name chiselled out of every list that mattered. Hold your cursor over
 * this one long enough and you are doing the chiselling.
 *
 * The cut is positioned in element-local pixels, so this measures itself each
 * frame rather than trusting a cached box — the column drifts with parallax and
 * a mask that lags the letters by ten pixels looks like a bug, not an effect.
 */

import { useEffect, useRef } from "react";
import { attachPointer, pointer } from "@/lib/pointer";

export default function Headline({
  text,
  className = "",
  style,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const detach = attachPointer();
    let raf = 0;
    const tick = () => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--hx", `${(pointer.sx - r.left).toFixed(1)}px`);
      el.style.setProperty("--hy", `${(pointer.sy - r.top).toFixed(1)}px`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      detach();
    };
  }, []);

  return (
    <h1 ref={ref} className={`headline ${className}`} style={style}>
      {/* The legibility shadow lives on its own layer underneath. On the lit
          copy it would paint *over* the clipped gradient — background-clip:text
          puts the background beneath the text-shadow, not above it — and knock
          about a third off the brightness of the name. */}
      <span className="hl-shade" aria-hidden="true">
        {text}
      </span>
      <span className="hl-fill">{text}</span>
      <span className="hl-cut" aria-hidden="true">
        {text}
      </span>
    </h1>
  );
}
