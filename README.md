# andrewgunn.dev

One screen. A brief bio for Andrew Gunn — founder of [Amarna LLC](https://www.amarna.dev) —
sitting in the dark eye of the **Aten**: a luminous ring with ~110k light particles
orbiting it in a GPU-simulated flow field.

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · deployed on Vercel.
No animation library, no WebGL wrapper — **zero dependencies beyond the framework**.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

## Why a ring

Amarna — *Akhet-Aten* — was the capital Akhenaten raised from empty desert to worship
the Aten, the sun disc: the light itself. The ring is the Aten. The field orbiting it is
the work. That is the whole concept, and it is why the site is one screen rather than
eight sections.

## Structure

```
app/
  page.tsx        the single screen — server-rendered, no client JS in the content
  layout.tsx      metadata + Person/Organization JSON-LD
  globals.css     tokens, the CSS static field, chip + reveal styles
  icon.svg        the ring, as a favicon
components/
  Aten.tsx        the WebGL2 particle field (the only client component)
  Icons.tsx       inline SVG
lib/data.ts       all copy
```

Editing copy means editing `lib/data.ts` and nothing else.

## How Aten.tsx works

Four passes per frame, all in raw WebGL2:

1. **update** — a vertex shader integrates position/velocity for every particle and
   writes results straight back out via **transform feedback** into a ping-ponged buffer
   set. Transform feedback is core WebGL2, so this needs no extension probe and no float
   -texture fallback path. Forces are a two-octave simplex flow field, a tangential
   orbital drive, a stiff radial spring onto a per-particle band just outside the ring,
   and an inverse-square shove away from the pointer.
2. **fade** — multiplicative decay of the trail framebuffer, so points leave streaks.
   The decay is `pow(0.9, dt * 60)` rather than a flat factor, or trails vanish on a
   120Hz display.
3. **points** — additive blend into that same framebuffer.
4. **present** — trail texture plus eight bloom taps, then the ring, the core darkening,
   vignette and grain, composited to screen.

Velocity damping is likewise `exp(-dt * k)`, not a per-frame multiply, for the same
refresh-rate reason.

### Things that will bite you if you change them

- **`ringRadius()` is duplicated in GLSL and JS** (`R0`, used to seed the initial ring).
  Change one, change the other.
- **The core darkening is load-bearing, not decoration.** The headline sits inside the
  disc, so the interior is dimmed to 30% to guarantee contrast against a field that is
  different every frame. Removing it makes the text fail on some frames and pass on
  others, which is the worst kind of contrast bug.
- **Portrait uses a scrim, not the ring.** No circle can both enclose a phone-height
  content column and leave the orbiting band on screen. So on portrait the ring shrinks
  to a halo, an ellipse-shaped scrim shelters the copy, and the rim is faded *behind*
  that scrim — a rim cutting through body text reads as a bug, a rim passing behind it
  reads as a composition.
- **Flow-field noise frequencies are high on purpose.** Coherent low-frequency noise
  herds the whole field into a handful of fat streamers and the disc reads as smoke
  instead of a swarm.

### Degradation

| Condition | Result |
| --- | --- |
| No JS / pre-hydration | Full copy server-rendered; `.static-field` paints the ring in CSS |
| No WebGL2 | Canvas unmounts, CSS static field becomes the page |
| Context lost | Same — no black rectangle |
| `prefers-reduced-motion` | 90 frames stepped once to settle the field, then **no rAF at all**; the interaction hint hides itself |
| Backgrounded tab | rAF cancelled on `visibilitychange` |
| Phone / coarse pointer | 26k particles instead of 110k, DPR capped at 1.5 |

Verified in Chromium at 1440×900 and 390×844, plus reduced-motion: no console errors,
no horizontal overflow, no lost context.

## Deploy

Push to `main` — Vercel builds and deploys. No env vars.
