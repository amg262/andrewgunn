"use client";

/**
 * The name, and what the cursor does to it.
 *
 * Two stacked copies of the same string, split into letters. The solid one
 * carries a warm gradient positioned at the cursor, so the light travelling
 * across the letters is the light of the disc behind them. Under the cursor its
 * fill is masked away and the second copy — hollow, cut in gold outline — shows
 * through, so wherever you point, the name stops being carved and starts being
 * *un*carved.
 *
 * Which is the whole Amarna joke: Akhenaten built a city to the disc and then
 * had his name chiselled out of every list that mattered. Hold your cursor over
 * this one long enough and you are doing the chiselling.
 *
 * The letters are separate blocks in the same 3D space as the rest of the
 * column, so they can move independently: they rise toward the cursor and turn
 * to face it, they breathe on their own when nobody is there, and a shockwave
 * fired into the field runs through them on the same wavefront the GPU is
 * drawing — the name is part of the simulation, not a caption over it.
 *
 * The light and the cut are positioned in element-local pixels, so this
 * measures itself each frame rather than trusting a cached box — the column
 * drifts with parallax and a mask that lags the letters by ten pixels looks
 * like a bug, not an effect. Per-letter offsets inside that box are static, so
 * they are measured once and only on resize.
 */

import { useEffect, useRef } from "react";
import { attachPointer, pointer, pulses, pulseAmp, toDisc } from "@/lib/pointer";

/** px of cursor distance over which a letter stops noticing. */
const REACH = 130;

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
    const letters = Array.from(el.querySelectorAll<HTMLElement>(".ltr"));

    // Where each letter sits inside the heading. Transforms do not move a box
    // in layout, so these hold until the heading itself reflows — measured
    // here rather than read per frame, which would interleave layout reads
    // with the style writes below and stall on every letter.
    let lx: number[] = [];
    let ly: number[] = [];
    let ox: number[] = [];
    let oy: number[] = [];
    const measure = () => {
      lx = letters.map((l) => l.offsetLeft);
      ly = letters.map((l) => l.offsetTop);
      ox = letters.map((l, i) => lx[i] + l.offsetWidth / 2);
      oy = letters.map((l, i) => ly[i] + l.offsetHeight / 2);
    };
    measure();
    // A late-arriving webfont reflows every letter; re-measure when it lands.
    document.fonts?.ready.then(measure).catch(() => {});
    window.addEventListener("resize", measure);

    let raf = 0;
    const tick = (now: number) => {
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const aspect = vw / vh;
      const t = now / 1000;

      for (let i = 0; i < letters.length; i++) {
        const l = letters[i];
        // The light and the cut are absolute points shared by every letter, so
        // splitting the word changes nothing about how they look.
        l.style.setProperty("--hx", `${(pointer.sx - r.left - lx[i]).toFixed(1)}px`);
        l.style.setProperty("--hy", `${(pointer.sy - r.top - ly[i]).toFixed(1)}px`);

        const cx = r.left + ox[i];
        const cy = r.top + oy[i];
        const dx = pointer.sx - cx;
        const dy = pointer.sy - cy;
        const prox =
          Math.max(0, 1 - Math.hypot(dx, dy) / REACH) ** 1.7 * pointer.inside;

        // The same wavefront the shader is drawing, sampled where this letter
        // is standing — which means asking where on the disc this letter is,
        // since that is the surface the wave is travelling across.
        let wave = 0;
        if (pulses.length) {
          const [qx, qy] = toDisc(
            (cx / vw - 0.5) * 2 * aspect,
            -((cy / vh - 0.5) * 2),
          );
          for (const p of pulses) {
            wave += pulseAmp(p, Math.hypot(qx - p.x, qy - p.y));
          }
        }

        // Unattended, the letters still breathe — offset per letter so the name
        // ripples rather than bobbing as one slab.
        const idle = Math.sin(t * 1.15 + i * 0.55) * 1.8;
        // The wave is capped: a long hold builds enough power to throw a letter
        // out of the frame, and the gesture should punch the name, not lose it.
        const lift = prox * 30 * (0.45 + pointer.force * 0.55) + Math.min(wave, 1.2) * 32;
        const lit = Math.min(1, prox + wave * 1.2);

        l.style.transform =
          `translate3d(0,${(idle - lift * 0.18).toFixed(2)}px,${lift.toFixed(2)}px)` +
          ` rotateX(${(-dy * 0.06 * prox).toFixed(2)}deg)` +
          ` rotateY(${(dx * 0.06 * prox).toFixed(2)}deg)`;
        l.style.setProperty("--lit", lit.toFixed(3));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      for (const l of letters) {
        l.style.transform = "";
        l.style.removeProperty("--lit");
      }
      detach();
    };
  }, []);

  return (
    <h1 ref={ref} className={`headline ${className}`} style={style}>
      {/* The name, once, for anything reading rather than looking. */}
      <span className="sr-only">{text}</span>
      <span className="hl-word" aria-hidden="true">
        {Array.from(text).map((ch, i) =>
          ch === " " ? (
            <span key={i} className="ltr ltr-gap">
              {" "}
            </span>
          ) : (
            <span key={i} className="ltr">
              {/* The legibility shadow lives on its own layer underneath. On the
                  lit copy it would paint *over* the clipped gradient —
                  background-clip:text puts the background beneath the
                  text-shadow, not above it — and knock about a third off the
                  brightness of the name. */}
              <span className="hl-shade">{ch}</span>
              <span className="hl-fill">{ch}</span>
              <span className="hl-cut">{ch}</span>
            </span>
          ),
        )}
      </span>
    </h1>
  );
}
