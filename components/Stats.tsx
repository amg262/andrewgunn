"use client";

/**
 * The four figures, and how they arrive.
 *
 * Each one resolves out of digit noise on load, staggered left to right — the
 * same gesture the transmission line under the disc makes, because these are
 * readings off the same instrument. Only the digits scramble: the currency
 * marks, the K and the plus signs are the frame the number is being read
 * against, and swapping those looks like a rendering fault rather than an
 * effect. Nothing changes length while it settles, so the row never reflows.
 *
 * After that they behave like everything else on the page: each cell lifts and
 * turns toward the cursor in the column's own perspective, and the rule under
 * it lights as you approach.
 *
 * Server-rendered at the settled value, so with JS off the figures are simply
 * correct.
 */

import { useEffect, useRef } from "react";
import { attachPointer, pointer } from "@/lib/pointer";
import { profile, statText } from "@/lib/data";

const START = 340; // ms before the first figure begins to settle
const STAGGER = 130; // ms between adjacent figures
const CHAR = 55; // ms between adjacent digits within a figure
const HOLD = 620; // ms of noise before the first digit lands
const ROLL = 55; // ms between re-rolls, so the noise is readable as digits
const REACH = 120; // px at which a cell starts to notice the cursor

const digit = () => String((Math.random() * 10) | 0);

export default function Stats({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const host = useRef<HTMLDListElement>(null);

  useEffect(() => {
    const root = host.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cells = Array.from(root.querySelectorAll<HTMLElement>("[data-cell]"));
    const figures = cells.map((c) => c.querySelector<HTMLElement>("[data-figure]")!);
    const targets = profile.stats.map((s) => statText(s));

    const fine = window.matchMedia("(pointer: fine)").matches;
    const detach = fine ? attachPointer() : null;

    const t0 = performance.now();
    let rollAt = 0;
    let settling = true;
    let raf = 0;

    const tick = (now: number) => {
      if (settling && now >= rollAt) {
        rollAt = now + ROLL;
        settling = false;
        for (let i = 0; i < figures.length; i++) {
          const since = now - t0 - START - i * STAGGER;
          const target = targets[i];
          let out = "";
          for (let j = 0; j < target.length; j++) {
            const ch = target[j];
            const landed = since > HOLD + j * CHAR;
            if (!landed) settling = true;
            out += landed || ch < "0" || ch > "9" ? ch : digit();
          }
          if (figures[i].textContent !== out) figures[i].textContent = out;
        }
      }

      if (fine) {
        // Every box measured before anything is written: interleaving the two
        // makes the browser re-run layout once per cell.
        const rects = cells.map((c) => c.getBoundingClientRect());
        for (let i = 0; i < cells.length; i++) {
          const el = cells[i];
          const r = rects[i];
          const dx = pointer.sx - (r.left + r.width / 2);
          const dy = pointer.sy - (r.top + r.height / 2);
          const grip =
            Math.max(0, 1 - Math.hypot(dx, dy) / REACH) ** 1.7 * pointer.inside;
          el.style.transform =
            `translate3d(0,0,${(grip * 26).toFixed(2)}px)` +
            ` rotateX(${(-Math.max(-1, Math.min(1, dy / 44)) * 11 * grip).toFixed(2)}deg)` +
            ` rotateY(${(Math.max(-1, Math.min(1, dx / 60)) * 13 * grip).toFixed(2)}deg)`;
          el.style.setProperty("--near", grip.toFixed(3));
        }
      } else if (!settling) {
        return; // nothing left to drive
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      for (let i = 0; i < figures.length; i++) {
        figures[i].textContent = targets[i];
        cells[i].style.transform = "";
        cells[i].style.removeProperty("--near");
      }
      detach?.();
    };
  }, []);

  return (
    <dl ref={host} className={className} style={style}>
      {profile.stats.map((s) => (
        <div key={s.label} data-cell className="stat">
          <dt
            data-figure
            className="font-mono text-base font-medium tracking-tight text-text tabular-nums sm:text-lg"
          >
            {statText(s)}
          </dt>
          <dd className="mt-0.5 text-[0.6rem] uppercase leading-tight tracking-[0.1em] text-muted">
            {s.label}
          </dd>
        </div>
      ))}
    </dl>
  );
}
