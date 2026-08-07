"use client";

/**
 * One pointer and one camera, shared by everything on the page.
 *
 * The GPU field, the reticle, the parallax, the light travelling across the
 * headline and the magnetic links all react to the cursor, and they all have to
 * agree about where it is. So there is exactly one set of listeners and one rAF
 * integrating one mutable state object. Consumers either read `pointer`
 * directly (the canvas, once per frame) or read the CSS custom properties this
 * writes on :root (everything in the DOM) — no React state, no re-renders.
 *
 * The disc is not flat. It lies in a plane tilted away from you, and this file
 * owns that pose: pitch, yaw and camera distance, all of them moving. The
 * canvas builds its projection matrix from them and the DOM tilts the text
 * column by the same deviation, so the copy and the simulation share one
 * camera rather than two that happen to look similar. Because the disc is a
 * plane in space, "where the cursor is" has two answers — where it is on the
 * screen, and where its ray lands on the disc — and both are kept here.
 *
 * It also lies, on purpose. Leave the cursor still for a few seconds and the
 * simulation-space position peels away from the real one and starts orbiting
 * the disc by itself: the field keeps being disturbed by something that is not
 * you. Move again and it hands control back.
 */

export type PointerState = {
  /** viewport px, lightly smoothed — what the reticle core rides */
  sx: number;
  sy: number;
  /** viewport px, heavily lagged — the trailing ring */
  lx: number;
  ly: number;
  /** screen-sim units: y-up, x scaled by aspect. Flat, un-projected. */
  px: number;
  py: number;
  /** the same pointer, where its ray lands on the tilted disc plane */
  dx: number;
  dy: number;
  /** disc-plane velocity, low-pass filtered */
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

  /* ── the camera ─────────────────────────────────────────────────────────
     Pitch and yaw of the disc plane in radians, and how far the eye is from
     it. Everything that draws in 3D reads these. */
  tiltX: number;
  tiltY: number;
  /** eye distance in sim units; smaller = more violent perspective */
  cam: number;
  /** 0..1 dolly, driven by the wheel */
  dolly: number;
};

/** Shockwaves. Fired on release; the longer the hold, the more power. `x`/`y`
 *  are disc-plane coordinates — the wave travels along the disc, not across
 *  the screen, so on screen it spreads as an ellipse. Anything in the DOM that
 *  wants to feel the same wave converts itself with toDisc() first. */
export type Pulse = { x: number; y: number; age: number; power: number };

export const PULSE_LIFE = 1.9;
export const MAX_PULSES = 3;

/** Seconds of stillness before the autonomous drift takes the field. */
const GHOST_AFTER = 4.2;

/** How far the disc lies back from face-on, before anything moves it. About
 *  32°: far enough that the ring is unmistakably an ellipse you are looking
 *  down onto, short enough that its darkened interior still carries the copy. */
export const BASE_TILT = 0.56;

/** Amplitude of a shockwave at `dist` from its origin, `age` seconds old.
 *  Mirrors pulseAt() in the shaders so the DOM ripples on exactly the same
 *  wavefront the GPU draws — keep the two in step. */
export const pulseAmp = (p: Pulse, dist: number) =>
  Math.exp(-(((dist - p.age * 2.35) * 5.5) ** 2)) * Math.exp(-p.age * 2) * p.power;

export const pointer: PointerState = {
  sx: 0,
  sy: 0,
  lx: 0,
  ly: 0,
  px: 0,
  py: 0,
  dx: 0,
  dy: 0,
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
  tiltX: BASE_TILT,
  tiltY: 0,
  cam: 3.8,
  dolly: 0.35,
};

export const pulses: Pulse[] = [];

/* ── the projection ────────────────────────────────────────────────────────
   Disc space is the plane the simulation lives in. World space is that plane
   rotated by (pitch, yaw). Screen space is world divided by depth, with the
   focal length pinned to the eye distance so a point at the origin lands
   exactly where the old flat design put it — the tilt changes the shape of
   the disc, never the scale of the page.

   These three mirror discBasis/project/unproject in components/Aten — the
   shaders need the per-pixel version, this file needs the per-frame one.
   Keep them in step. */

/** Row-major rotation of disc space into world space. Positive pitch pushes
 *  the far edge away, so we look down onto the disc. */
function basis(pitch: number, yaw: number) {
  const cx = Math.cos(pitch);
  const sx = Math.sin(pitch);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  return [
    cy, -sy * sx, sy * cx,
    0, cx, sx,
    -sy, -cy * sx, cy * cx,
  ];
}

/** disc → screen */
function project(b: number[], cam: number, x: number, y: number) {
  const wx = b[0] * x + b[1] * y;
  const wy = b[3] * x + b[4] * y;
  const wz = b[6] * x + b[7] * y;
  const s = cam / Math.max(cam - wz, 0.25);
  return [wx * s, wy * s];
}

/** screen → disc. The ray misses the plane above the horizon; the horizon is
 *  kept off screen by clamping the pitch, and the guard is for safety only. */
function unproject(b: number[], cam: number, x: number, y: number) {
  // Plane normal = third column of the basis.
  const nx = b[2];
  const ny = b[5];
  const nz = b[8];
  const denom = nz - (nx * x + ny * y) / cam;
  if (denom < 0.06) return [x * 3, y * 3];
  const t = (nz * cam) / denom;
  const wx = (x * t) / cam;
  const wy = (y * t) / cam;
  const wz = cam - t;
  // Inverse of an orthonormal basis is its transpose: read down the columns.
  return [b[0] * wx + b[3] * wy + b[6] * wz, b[1] * wx + b[4] * wy + b[7] * wz];
}

/** The pose the last frame rendered, kept so the DOM can ask where one of its
 *  own boxes is standing on the disc. Seeded at the resting pose, because
 *  under reduced motion no frame ever runs to replace it. */
let curBasis = basis(BASE_TILT, 0);

/** Screen-sim point → disc-plane point, at the current pose. */
export function toDisc(x: number, y: number) {
  return unproject(curBasis, pointer.cam, x, y);
}

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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

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

  // Device tilt, where the platform gives it away without a permission prompt.
  // On a phone the cursor is whatever you are not doing, so the handset's own
  // attitude drives the camera instead.
  let ox = 0;
  let oy = 0;
  let hasOrient = 0;

  // Wheel dollies the eye in and out. Nothing scrolls on a one-screen page, so
  // the gesture is free — and it is the one input that changes how violent the
  // perspective is rather than merely where you are in it.
  let dollyTarget = pointer.dolly;

  // While the field is unattended it detonates on its own every so often, so a
  // page nobody is touching is still visibly doing something.
  let autoPulseAt = 6;

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

  const fire = (power: number) => {
    pulses.unshift({ x: pointer.dx, y: pointer.dy, age: 0, power });
    if (pulses.length > MAX_PULSES) pulses.pop();
  };

  const onUp = () => {
    if (!down) return;
    down = false;
    // A flick gives a tap; a long hold gathers the field and then detonates it.
    fire(0.4 + pointer.press * 1.6);
  };

  const onLeave = () => {
    down = false;
    pointer.force = 0;
    pointer.hot = 0;
    pointer.inside = 0;
  };

  const onWheel = (e: WheelEvent) => {
    // Leave the wheel alone on viewports short enough that the page scrolls.
    if (window.innerHeight <= 560) return;
    const line = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    dollyTarget = clamp(dollyTarget - (e.deltaY * line) / 900, 0, 1);
  };

  const onOrient = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    hasOrient = 1;
    // Neutral posture is a handset held at about 45°, and ±22° either side of
    // that covers the whole range — further than that and you are no longer
    // looking at the screen.
    ox = clamp(e.gamma / 22, -1, 1);
    oy = clamp((e.beta - 45) / 22, -1, 1);
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("pointercancel", onLeave, { passive: true });
  window.addEventListener("blur", onLeave);
  window.addEventListener("wheel", onWheel, { passive: true });
  document.addEventListener("pointerleave", onLeave, { passive: true });
  // Not requested where it needs asking for (iOS): a permission sheet thrown at
  // someone for tapping a homepage costs more than the effect is worth.
  if (typeof DeviceOrientationEvent !== "undefined") {
    window.addEventListener("deviceorientation", onOrient, { passive: true });
  }

  // Every smoothing constant below is exponential in dt rather than a flat
  // per-frame factor, so the feel is identical on 60Hz and 120Hz displays.
  const ease = (dt: number, rate: number) => 1 - Math.exp(-dt * rate);

  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    t += dt;
    still += dt;

    const W = window.innerWidth;
    const H = window.innerHeight;
    const aspect = W / H;

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

    /* ── pose ───────────────────────────────────────────────────────────────
       Fed from last frame's pointer, so the drift swings the camera too: an
       unattended page keeps moving in three dimensions rather than settling
       into a still photograph. Heavily damped — this is a camera being leaned
       on, not a readout. */
    const lookX = clamp(pointer.px / Math.max(aspect, 0.5), -1, 1);
    const lookY = clamp(pointer.py, -1, 1);
    const tiltXWant =
      BASE_TILT +
      lookY * 0.13 +
      oy * 0.15 * hasOrient +
      Math.sin(t * 0.21) * 0.05 +
      pointer.press * 0.06;
    const tiltYWant =
      lookX * 0.17 + ox * 0.18 * hasOrient + Math.sin(t * 0.163) * 0.035;
    // Clamped well short of edge-on: past about 40° the horizon crosses the
    // viewport and the plane folds through itself.
    pointer.tiltX += (clamp(tiltXWant, 0.26, 0.82) - pointer.tiltX) * ease(dt, 2.4);
    pointer.tiltY += (clamp(tiltYWant, -0.34, 0.34) - pointer.tiltY) * ease(dt, 2.1);

    pointer.dolly += (dollyTarget - pointer.dolly) * ease(dt, 4.5);
    pointer.cam = 4.7 - pointer.dolly * 2.4;

    const b = (curBasis = basis(pointer.tiltX, pointer.tiltY));
    const cam = pointer.cam;

    /* ── where you are, in both spaces ─────────────────────────────────────
       The real cursor is a screen position; the drift is a disc-space orbit
       through the particle band. Each is converted into the other space and
       the two are blended by `ghost`, so nothing ever has to guess which of
       them is currently in charge. */
    const realX = (rx / W - 0.5) * 2 * aspect;
    const realY = -(ry / H - 0.5) * 2;
    const [realDX, realDY] = unproject(b, cam, realX, realY);

    const ga = t * 0.13;
    const gr = 0.78 + 0.3 * Math.sin(t * 0.077);
    const ghostDX = Math.cos(ga) * gr * 1.15;
    const ghostDY = Math.sin(ga * 1.31) * gr * 1.1;
    const [ghostX, ghostY] = project(b, cam, ghostDX, ghostDY);

    const g = pointer.ghost;
    const tx = realX + (ghostX - realX) * g;
    const ty = realY + (ghostY - realY) * g;
    const tdx = realDX + (ghostDX - realDX) * g;
    const tdy = realDY + (ghostDY - realDY) * g;

    // The drift is a presence in its own right, so the field answers it — but
    // gently. At full strength an orbit this slow ploughs the particle band
    // empty in a few seconds; the disc should look stirred, not swept.
    pointer.force = Math.max(pointer.force, g * 0.3);

    const k = ease(dt, g > 0.5 ? 6 : 22);
    pointer.px += (tx - pointer.px) * k;
    pointer.py += (ty - pointer.py) * k;

    const ndx = pointer.dx + (tdx - pointer.dx) * k;
    const ndy = pointer.dy + (tdy - pointer.dy) * k;
    const kv = ease(dt, 10);
    pointer.vx += ((ndx - pointer.dx) / Math.max(dt, 1e-4) - pointer.vx) * kv;
    pointer.vy += ((ndy - pointer.dy) / Math.max(dt, 1e-4) - pointer.vy) * kv;
    pointer.dx = ndx;
    pointer.dy = ndy;
    pointer.speed = Math.min(1, Math.hypot(pointer.vx, pointer.vy) / 3);

    // Unattended, the thing stirring the disc occasionally lets go of it.
    if (g > 0.55 && t > autoPulseAt) {
      autoPulseAt = t + 5.5 + Math.random() * 4;
      fire(0.5 + Math.random() * 0.4);
    }

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
    s.setProperty("--nx", ((pointer.sx / W - 0.5) * 2).toFixed(3));
    s.setProperty("--ny", ((pointer.sy / H - 0.5) * 2).toFixed(3));
    s.setProperty("--pforce", pointer.force.toFixed(3));
    s.setProperty("--ppress", pointer.press.toFixed(3));
    s.setProperty("--pmove", pointer.moving.toFixed(3));
    s.setProperty("--pghost", pointer.ghost.toFixed(3));
    s.setProperty("--pspeed", pointer.speed.toFixed(3));
    s.setProperty("--phot", String(pointer.hot));
    s.setProperty("--pin", String(pointer.inside));
    // Deviation from the resting pose, not the pose itself: the text column
    // leans with the disc, it does not lie down with it.
    s.setProperty("--dtx", (pointer.tiltX - BASE_TILT).toFixed(4));
    s.setProperty("--dty", pointer.tiltY.toFixed(4));
    s.setProperty("--persp", `${(1480 - pointer.dolly * 780).toFixed(0)}px`);

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
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("deviceorientation", onOrient);
    document.removeEventListener("pointerleave", onLeave);
  };
}
