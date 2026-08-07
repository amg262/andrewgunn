"use client";

/**
 * The cursor, replaced by an instrument.
 *
 * A gold core ring with a gapped crosshair rides the lightly-smoothed pointer;
 * a dashed indigo ring lags well behind it and contracts while you hold. A
 * monospace readout trails the core with your position in the same coordinate
 * space the simulation uses — the page is telling you, quietly, that it is
 * taking measurements.
 *
 * Everything except the readout text is driven by CSS custom properties written
 * by lib/pointer, so this component renders once and never again. Fine pointers
 * only: on touch there is nothing to replace, and under reduced motion a cursor
 * that lags on a spring is exactly the thing being opted out of.
 */

import { useEffect, useRef, useState } from "react";
import { attachPointer, pointer } from "@/lib/pointer";

const READOUT_MS = 90; // slow enough that the digits are readable, not a blur

const axis = (v: number) => (v < 0 ? "−" : "+") + Math.abs(v).toFixed(3);

export default function Reticle() {
  const [on, setOn] = useState(false);
  const readout = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    setOn(true);
    const detach = attachPointer();
    const root = document.documentElement;

    let raf = 0;
    let acc = READOUT_MS;
    let last = performance.now();
    const tick = (now: number) => {
      // Hide the native cursor only once there is a reticle standing where it
      // was. Swapping earlier leaves anyone who hasn't moved the mouse yet with
      // no cursor at all.
      if (pointer.inside) root.classList.add("reticle-on");

      acc += now - last;
      last = now;
      if (acc >= READOUT_MS) {
        acc = 0;
        const el = readout.current;
        if (el) {
          el.textContent = `${axis(pointer.px)} ${axis(pointer.py)}${
            pointer.ghost > 0.5 ? " ·unattended" : ""
          }`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      root.classList.remove("reticle-on");
      detach();
    };
  }, []);

  if (!on) return null;

  return (
    <>
      <span className="cur cur-lag" aria-hidden="true" />
      <span className="cur cur-core" aria-hidden="true" />
      <span className="cur cur-read" aria-hidden="true" ref={readout} />
    </>
  );
}
