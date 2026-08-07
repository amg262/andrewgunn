# andrewgunn.dev

One screen. Andrew Gunn — founder of [Amarna LLC](https://www.amarna.dev) — sitting in
the dark eye of the **Aten**: a luminous ring with ~110k light particles orbiting it in a
GPU-simulated flow field, and every surface on the page reacting to the cursor.

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · deployed on Vercel.
No animation library, no WebGL wrapper — **zero dependencies beyond the framework**.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

## Why a ring

Amarna — *Akhet-Aten* — was a capital raised out of empty desert in about four years to
serve a single new god, the Aten: the sun disc, the light itself. It was abandoned within
a generation and its king was chiselled out of the record. The ring is the disc. The
field orbiting it is the work. The rays reach for whoever stands in front of the disc,
which in the reliefs is the pharaoh and here is your cursor.

That is the whole concept, and it is why the site is one screen rather than eight
sections.

## What the cursor does

| Gesture | Reaction |
| --- | --- |
| Move | Shove, vortex and wake drag through the particle band; the rim runs hot on the arc facing you; a lens warp and chromatic split follow the cursor; the letters of the name warm up and their fill is chiselled away underneath it |
| Move fast | Aberration widens, and a glyph or two in the cycling line destabilises |
| Step outside the ring | The Aten's rays grow along your bearing until they reach you, each ending in a bright terminal hand |
| Hold | The field falls onto a shell around the cursor; the polar coordinate lattice underneath the picture is revealed within a small radius |
| Release | A shockwave: an expanding gaussian front that moves the particles *and* ripples the composited image on the same wavefront. Longer hold, bigger detonation |
| Nothing, for four seconds | The pointer the shaders see peels away from the real one and starts orbiting by itself. Move to take the field back |

Anything the cursor touches keeps a decaying **heat** value for a couple of seconds, so
streaks stay lit after you have gone.

## Structure

```
app/
  page.tsx        the single screen — server-rendered
  layout.tsx      metadata + Person/Organization JSON-LD
  globals.css     tokens, the CSS static field, the name, chips, the reticle
  icon.svg        the ring, as a favicon
components/
  Aten.tsx        the WebGL2 particle field
  Headline.tsx    the name: cursor-lit fill over a chiselled-out copy
  Links.tsx       magnetic chips
  Reticle.tsx     the cursor, replaced by an instrument
  Transmission.tsx  the cycling line that resolves out of noise
  Icons.tsx       inline SVG
lib/
  data.ts         all copy
  pointer.ts      one pointer state, shared by the canvas and the DOM
```

Editing copy means editing `lib/data.ts` and nothing else.

## lib/pointer.ts

There is exactly one set of pointer listeners and one rAF integrating one mutable state
object. The canvas reads it directly once per frame; everything in the DOM reads the CSS
custom properties it writes on `:root` (`--px`, `--nx`, `--pforce`, `--ppress`, `--pin`,
…), so the parallax, the reticle and the chip glows cost zero React re-renders.

Two distinctions in there are load-bearing:

- **`force` decays while the cursor rests; `inside` does not.** The field should forget a
  stationary cursor — otherwise it sits there punching a permanent hole. The reticle drawn
  in place of the system cursor obviously must not vanish, and neither should a chip that
  you are hovering.
- **The simulation-space position is allowed to lie.** After four seconds of stillness it
  blends off the real cursor and onto a slow orbit, at reduced strength so the drift stirs
  the band instead of ploughing it empty.

## How Aten.tsx works

Four passes per frame, all in raw WebGL2:

1. **update** — a vertex shader integrates position/velocity/heat for every particle and
   writes results straight back out via **transform feedback** into a ping-ponged buffer
   set. Transform feedback is core WebGL2, so this needs no extension probe and no float
   -texture fallback path. Forces are a two-octave simplex flow field, a tangential
   orbital drive, a stiff radial spring onto a per-particle band just outside the ring,
   and then everything the cursor is doing: shove, vortex, wake drag, the gathering shell
   while held, and up to three live shockwaves.
2. **fade** — multiplicative decay of the trail framebuffer, so points leave streaks.
   The decay is `pow(0.9, dt * 60)` rather than a flat factor, or trails vanish on a
   120Hz display.
3. **points** — additive blend into that same framebuffer.
4. **present** — a pointer lens warp and chromatic split, the trail texture plus eight
   bloom taps, then the ring and its reaching rays, the cursor-local lattice, the core
   darkening, vignette and grain, composited to screen.

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
- **The shockwave profile is shared verbatim** between the update pass and the present
  pass (`pulseAt`), so the image ripples on exactly the wavefront that is moving the
  particles. Edit it in one place.
- **`text-shadow` cannot live on the lit copy of the name.** With
  `background-clip: text`, the background is painted *beneath* the text-shadow, so a
  legibility shadow on the same element knocks about a third off the brightness of every
  letter. That is what `.hl-shade` exists for.
- **The press force pulls onto a shell, not a point.** A point sink collapses the field
  into one aliased pixel.

### Degradation

| Condition | Result |
| --- | --- |
| No JS / pre-hydration | Full copy server-rendered; `.static-field` paints the ring in CSS |
| No WebGL2 | Canvas unmounts, CSS static field becomes the page |
| Context lost | Same — no black rectangle |
| `prefers-reduced-motion` | 90 frames stepped once to settle the field, then **no rAF at all**. No pointer listeners are installed, so the name renders plain white, the parallax is flat, the reticle and the interaction hint are gone and the cycling line holds on its first sentence |
| Backgrounded tab | rAF cancelled on `visibilitychange` |
| Phone / coarse pointer | 26k particles instead of 110k, DPR capped at 1.5; no reticle (the system cursor is never hidden), no magnetic links — touch drag and tap still drive the field |

Verified in Chromium at 1440×900 and 390×844, plus reduced-motion: no console errors,
no horizontal overflow, no lost context, and the name measured at full `--text`
brightness everywhere outside the cursor's pool.

## Deploy

Push to `main` — Vercel builds and deploys. No env vars.
