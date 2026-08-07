"use client";

/**
 * One pointer, shared by everything on the page.
 *
 * The GPU field, the reticle, the parallax, the light travelling across the
 * headline and the magnetic links all react to the cursor, and they all have to
 * agree about where it is. So there is exactly one set of listeners and one rAF
 * integrating one mutable state object. Consumers either read `pointer`
 * directly (the canvas, once per frame) or read the CSS custom properties this
 * writes on :root (everything in the DOM) — no React state, no re-renders.
 *
 * It also lies, on purpose. Leave the cursor still for a few seconds and the
 * simulation-space position peels away from the real one and starts orbiting by
 * itself: the field keeps being disturbed by something that is not you. Move
 * again and it hands control back.
 */

export type PointerState = {
  /** viewport px, lightly smoothed — what the reticle core rides */
  sx: number;
  sy: number;
  /** viewport px, heavily lagged — the trailing ring */
  lx: number;
  ly: number;
  /** simulation units: y-up, x scaled by aspect. What the shaders consume. */
  px: number;
  py: number;
  /** simulation-unit velocity, low-pass filtered */
  vx: number;
  vy: number;
  /** 0..1 normalised speed */
  speed: number;
  /** 0..1 presence. Decays while the cursor sits still — a resting cursor
   *  should stop punching a hole in the field. */
  force: number;
  /** 0..1 smoothed press */
  press: number;
  /** 0..1 how far the autonomous drift has taken over from the real cursor */
  ghost: number;
  /** 0..1 recency of movement */
  moving: number;
  /** over an interactive element */
  hot: number;
  /** the pointer is in the window. Distinct from `force`, which decays while
   *  the cursor rests — the field should forget a still cursor, the reticle
   *  drawn in its place must not. */
  inside: number;
  coarse: boolean;
};

/** Shockwaves. Fired on release; the longer the hold, the more power. */
export type Pulse = { x: number; y: number; age: number; power: number };

export const PULSE_LIFE = 1.9;
export const MAX_PULSES = 3;

/** Seconds of stillness before the autonomous drift takes the field. */
const GHOST_AFTER = 4.2;

export const pointer: PointerState = {
  sx: 0,
  sy: 0,
  lx: 0,
  ly: 0,
  px: 0,
  py: 0,
  vx: 0,
  vy: 0,
  speed: 0,
  force: 0,
  press: 0,
  ghost: 0,
  moving: 0,
  hot: 0,
  inside: 0,
  coarse: false,
};

export const pulses: Pulse[] = [];

let refs = 0;
let stop: (() => void) | null = null;

/**
 * Reference-counted. Every consumer attaches; the listeners and the rAF exist
 * only while at least one is mounted.
 */
export function attachPointer(): () => void {
  if (typeof window === "undefined") return () => {};
  refs += 1;
  if (refs === 1) stop = start();
  return () => {
    refs -= 1;
    if (refs === 0 && stop) {
      stop();
      stop = null;
    }
  };
}

function start(): () => void {
  const root = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  pointer.coarse = window.matchMedia("(pointer: coarse)").matches;

  // Nothing moves under reduced motion, so nothing needs integrating. Leave the
  // state at its neutral centre and let every consumer render its still frame.
  if (reduced) return () => {};

  let rx = window.innerWidth / 2;
  let ry = window.innerHeight / 2;
  pointer.sx = pointer.lx = rx;
  pointer.sy = pointer.ly = ry;

  let seen = false;
  let down = false;
  let still = 99;
  let t = 0;
  let last = performance.now();
  let raf = 0;

  const onMove = (e: PointerEvent) => {
    rx = e.clientX;
    ry = e.clientY;
    if (!seen) {
      seen = true;
      pointer.sx = pointer.lx = rx;
      pointer.sy = pointer.ly = ry;
    }
    still = 0;
    pointer.force = 1;
    pointer.inside = 1;
    const el = e.target as Element | null;
    pointer.hot = el?.closest?.("a, button, [data-hot]") ? 1 : 0;
  };

  const onDown = (e: PointerEvent) => {
    onMove(e);
    down = true;
  };

  const onUp = () => {
    if (!down) return;
    down = false;
    // A flick gives a tap; a long hold gathers the field and then detonates it.
    pulses.unshift({
      x: pointer.px,
      y: pointer.py,
      age: 0,
      power: 0.4 + pointer.press * 1.6,
    });
    if (pulses.length > MAX_PULSES) pulses.pop();
  };

  const onLeave = () => {
    down = false;
    pointer.force = 0;
    pointer.hot = 0;
    pointer.inside = 0;
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("pointercancel", onLeave, { passive: true });
  window.addEventListener("blur", onLeave);
  document.addEventListener("pointerleave", onLeave, { passive: true });

  // Every smoothing constant below is exponential in dt rather than a flat
  // per-frame factor, so the feel is identical on 60Hz and 120Hz displays.
  const ease = (dt: number, rate: number) => 1 - Math.exp(-dt * rate);

  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    t += dt;
    still += dt;

    const aspect = window.innerWidth / window.innerHeight;

    pointer.force *= Math.exp(-dt * (down ? 0.15 : 1.2));
    pointer.press += ((down ? 1 : 0) - pointer.press) * ease(dt, down ? 6 : 11);
    pointer.moving += ((still < 0.1 ? 1 : 0) - pointer.moving) * ease(dt, 7);

    // Hand-over to the drift is slow; the hand-back is immediate. `still` starts
    // high, so on a page nobody has touched yet the field is already being
    // stirred by something — and the first thing your cursor does is take it
    // back off whatever that is.
    const wantGhost = !down && still > GHOST_AFTER ? 1 : 0;
    pointer.ghost += (wantGhost - pointer.ghost) * ease(dt, wantGhost ? 0.42 : 4.5);

    pointer.sx += (rx - pointer.sx) * ease(dt, 26);
    pointer.sy += (ry - pointer.sy) * ease(dt, 26);
    pointer.lx += (rx - pointer.lx) * ease(dt, 7);
    pointer.ly += (ry - pointer.ly) * ease(dt, 7);

    // Simulation-space target: the real cursor, blended toward a slow orbit
    // through the particle band as the drift takes over.
    const realX = (rx / window.innerWidth - 0.5) * 2 * aspect;
    const realY = -(ry / window.innerHeight - 0.5) * 2;
    const ga = t * 0.13;
    const gr = 0.68 + 0.26 * Math.sin(t * 0.077);
    const tx = realX + (Math.cos(ga) * gr * 1.15 - realX) * pointer.ghost;
    const ty = realY + (Math.sin(ga * 1.31) * gr * 0.9 - realY) * pointer.ghost;

    // The drift is a presence in its own right, so the field answers it — but
    // gently. At full strength an orbit this slow ploughs the particle band
    // empty in a few seconds; the disc should look stirred, not swept.
    pointer.force = Math.max(pointer.force, pointer.ghost * 0.3);

    const k = ease(dt, pointer.ghost > 0.5 ? 6 : 22);
    const nx = pointer.px + (tx - pointer.px) * k;
    const ny = pointer.py + (ty - pointer.py) * k;
    const kv = ease(dt, 10);
    pointer.vx += ((nx - pointer.px) / Math.max(dt, 1e-4) - pointer.vx) * kv;
    pointer.vy += ((ny - pointer.py) / Math.max(dt, 1e-4) - pointer.vy) * kv;
    pointer.px = nx;
    pointer.py = ny;
    pointer.speed = Math.min(1, Math.hypot(pointer.vx, pointer.vy) / 3);

    for (let i = pulses.length - 1; i >= 0; i--) {
      pulses[i].age += dt;
      if (pulses[i].age > PULSE_LIFE) pulses.splice(i, 1);
    }

    // The DOM half of the reaction. Written as custom properties so the styling
    // stays in CSS and no component re-renders at 60fps.
    const s = root.style;
    s.setProperty("--px", `${pointer.sx.toFixed(1)}px`);
    s.setProperty("--py", `${pointer.sy.toFixed(1)}px`);
    s.setProperty("--lx", `${pointer.lx.toFixed(1)}px`);
    s.setProperty("--ly", `${pointer.ly.toFixed(1)}px`);
    s.setProperty("--nx", ((pointer.sx / window.innerWidth - 0.5) * 2).toFixed(3));
    s.setProperty("--ny", ((pointer.sy / window.innerHeight - 0.5) * 2).toFixed(3));
    s.setProperty("--pforce", pointer.force.toFixed(3));
    s.setProperty("--ppress", pointer.press.toFixed(3));
    s.setProperty("--pmove", pointer.moving.toFixed(3));
    s.setProperty("--pghost", pointer.ghost.toFixed(3));
    s.setProperty("--phot", String(pointer.hot));
    s.setProperty("--pin", String(pointer.inside));

    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onLeave);
    window.removeEventListener("blur", onLeave);
    document.removeEventListener("pointerleave", onLeave);
  };
}
