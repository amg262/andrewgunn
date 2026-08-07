"use client";

/**
 * The line under the caption, cycling.
 *
 * Half of these sentences are about a city abandoned in 1332 BCE and half are
 * about the industry I work in, and the point of putting them in the same
 * rotation is that you cannot tell which is which without being told.
 *
 * Each swap resolves character by character out of noise. The noise is also
 * live: sweep the cursor quickly and a couple of glyphs destabilise, so the
 * text is one more surface that knows you are there.
 *
 * Server-rendered with the first line already in place, so this reads correctly
 * with JS off and never causes a layout jump on hydration.
 */

import { useEffect, useRef } from "react";
import { attachPointer, pointer } from "@/lib/pointer";

const NOISE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@*/\\<>+=-_:;·";
const HOLD = 6200; // ms a line is held before the next one resolves in
const STAGGER = 12; // ms between adjacent characters starting to settle
// Long enough that the last character of the longest line settles inside the
// window; otherwise the tail of a sentence snaps out of noise all at once.
const RESOLVE = 1150;

const noise = () => NOISE[(Math.random() * NOISE.length) | 0];

export default function Transmission({
  lines,
  className = "",
}: {
  lines: readonly string[];
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || lines.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const detach = attachPointer();
    let raf = 0;
    let index = 0;
    let swapAt = performance.now() + HOLD;
    let startedAt = -Infinity;
    let rerollAt = 0;

    const tick = (now: number) => {
      if (now >= swapAt) {
        index = (index + 1) % lines.length;
        startedAt = now;
        swapAt = now + HOLD + RESOLVE;
      }

      const target = lines[index];
      const since = now - startedAt;

      if (since < RESOLVE) {
        // Resolving: each character settles on its own clock, left to right.
        let out = "";
        for (let i = 0; i < target.length; i++) {
          const ch = target[i];
          out += ch === " " || since > i * STAGGER + 300 ? ch : noise();
        }
        el.textContent = out;
        rerollAt = now + 45;
      } else if (now >= rerollAt) {
        // Settled, but never entirely: a fast cursor shakes a glyph or two loose.
        rerollAt = now + 70;
        const shake = Math.max(0, pointer.speed - 0.3);
        if (shake > 0) {
          const chars = target.split("");
          const hits = 1 + ((Math.random() * shake * 3) | 0);
          for (let n = 0; n < hits; n++) {
            const i = (Math.random() * chars.length) | 0;
            if (chars[i] !== " ") chars[i] = noise();
          }
          el.textContent = chars.join("");
        } else if (el.textContent !== target) {
          el.textContent = target;
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      detach();
    };
  }, [lines]);

  return (
    <span ref={ref} className={className}>
      {lines[0]}
    </span>
  );
}
