# andrewgunn.dev

One screen. Andrew Gunn — founder of [Amarna LLC](https://www.amarna.dev) — sitting in
the dark eye of the **Aten**: a luminous ring with ~110k light particles orbiting it in a
GPU-simulated flow field, and every surface on the page reacting to the cursor.

The disc is a real plane in space, tilted away from you and drawn through a perspective
divide — and the text column stands in the same space, on the same camera, leaning as it
leans. There is one pose for the whole page; the canvas and the DOM are two renderers of
it.

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

Everything below happens where your ray meets the disc, not where the cursor is on the
glass. The two are different points once the plane is tilted, and the simulation only
cares about the first one.

| Gesture | Reaction |
| --- | --- |
| Move | Shove, vortex and wake drag through the particle band; the camera leans, and the whole text column leans with it; the rim runs hot on the arc facing you; a lens warp, chromatic split and flare ghosts follow the cursor; the letters of the name rise toward you, turn to face you, warm up, and have their fill chiselled away underneath the cursor |
| Move fast | Aberration widens, and a glyph or two in the cycling line destabilises |
| Step outside the ring | The Aten's rays grow along your bearing until they reach you, each ending in a bright terminal hand — drawn on the plane, so they lengthen away from you in perspective |
| Hold | The field falls onto a shell around the cursor and climbs out of the disc toward you; the polar coordinate lattice underneath the picture is revealed within a small radius, receding as it goes |
| Release | A shockwave: an expanding gaussian front that moves the particles, ripples the composited image, and lifts the letters of the name, all on the same wavefront. It travels across the disc, so on screen it spreads as an ellipse. Longer hold, bigger detonation |
| Scroll | Dollies the eye between 4.7 and 2.3 disc units. Nothing on a one-screen page needs the wheel, so it changes how violent the perspective is instead |
| Tilt the handset | Where the platform reports orientation without a permission prompt, the device's own attitude drives the camera — a phone has no cursor to drive it with |
| Nothing, for four seconds | The pointer the shaders see peels away from the real one and starts orbiting the disc by itself, detonating every few seconds. Move to take the field back |

Anything the cursor touches keeps a decaying **heat** value for a couple of seconds, so
streaks stay lit after you have gone.

## Structure

```
app/
  page.tsx        the single screen — server-rendered
  layout.tsx      metadata + Person/Organization JSON-LD
  globals.css     tokens, the CSS static field, the 3D stage, the name, chips, the reticle
  icon.svg        the ring, as a favicon
components/
  Aten.tsx        the WebGL2 particle field
  Headline.tsx    the name: per-letter, cursor-lit fill over a chiselled-out copy
  Links.tsx       magnetic chips
  Stats.tsx       the four figures: resolve out of digit noise, then go magnetic
  Reticle.tsx     the cursor, replaced by an instrument
  Transmission.tsx  the cycling line that resolves out of noise
  Icons.tsx       inline SVG
lib/
  data.ts         all copy
  pointer.ts      one pointer state and one camera, shared by the canvas and the DOM
```

Editing copy means editing `lib/data.ts` and nothing else.

## lib/pointer.ts

There is exactly one set of pointer listeners and one rAF integrating one mutable state
object. The canvas reads it directly once per frame; everything in the DOM reads the CSS
custom properties it writes on `:root` (`--px`, `--nx`, `--pforce`, `--ppress`, `--pin`,
…), so the parallax, the reticle and the chip glows cost zero React re-renders.

It also owns the camera — pitch, yaw and eye distance — and therefore owns the two
coordinate spaces the page works in:

- **screen-sim** (`px`, `py`): y-up, x scaled by aspect, flat. What the compositing pass
  and the DOM measure in.
- **disc** (`dx`, `dy`): where that ray lands on the tilted plane. What the simulation
  runs in, where shockwaves originate, and what the reticle reads out.

`toDisc()` converts between them for anything in the DOM that needs to know where it is
standing on the disc — which is how the letters of the name ride the same shockwave the
GPU is drawing rather than an approximation of it.

Three distinctions in there are load-bearing:

- **`force` decays while the cursor rests; `inside` does not.** The field should forget a
  stationary cursor — otherwise it sits there punching a permanent hole. The reticle drawn
  in place of the system cursor obviously must not vanish, and neither should a chip that
  you are hovering.
- **The simulation-space position is allowed to lie.** After four seconds of stillness it
  blends off the real cursor and onto a slow orbit *through the disc*, at reduced strength
  so the drift stirs the band instead of ploughing it empty. The blend happens in both
  spaces at once, so nothing downstream has to ask which one is in charge.
- **The DOM gets the deviation from the resting pose, not the pose.** `--dtx`/`--dty` are
  how far the camera has leaned away from where it sits at rest. The disc lies back 32°;
  the paragraph under it obviously cannot. Multiply the deviation, never the pose.

## How Aten.tsx works

Four passes per frame, all in raw WebGL2:

1. **update** — a vertex shader integrates position/velocity/heat for every particle and
   writes results straight back out via **transform feedback** into a ping-ponged buffer
   set. Transform feedback is core WebGL2, so this needs no extension probe and no float
   -texture fallback path. Runs entirely in disc space — the camera never enters this
   pass. Forces are a two-octave simplex flow field, a tangential orbital drive, a stiff
   radial spring onto a per-particle band just outside the ring, a softer vertical spring
   that gives the sheet its thickness plus a standing wave that warps it, and then
   everything the cursor is doing: shove, vortex, wake drag, the gathering shell while
   held, and up to three live shockwaves.
2. **fade** — multiplicative decay of the trail framebuffer, so points leave streaks.
   The decay is `pow(0.9, dt * 60)` rather than a flat factor, or trails vanish on a
   120Hz display.
3. **points** — rotate into world space, perspective divide, additive blend into that
   same framebuffer. Near matter is larger, brighter and warmer; the far half of the disc
   goes cold and thin.
4. **present** — a pointer lens warp, chromatic split and flare ghosts, the trail texture
   plus eight bloom taps, then the Aten: every part of it drawn by casting the pixel's ray
   back onto the tilted plane, so the ring, its rays and the lattice are genuinely lying
   in the disc rather than painted flat over it. Then the core darkening, vignette and
   grain, composited to screen.

Velocity damping is likewise `exp(-dt * k)`, not a per-frame multiply, for the same
refresh-rate reason.

Frame cost is watched rather than guessed at: a governor averages 50 frames and gives
back render scale (down to 0.68) when they run long, restoring it when they do not. A
smooth field at 85% scale beats a crisp one at 34fps.

### Things that will bite you if you change them

- **`ringRadius()` is duplicated in GLSL and JS** (`R0`, used to seed the initial ring).
  Change one, change the other.
- **So is the projection.** `basis`/`project`/`unproject` exist in `lib/pointer.ts` and
  again as `discBasis`/`projectDisc`/`unproject` in the GLSL `CAMERA` chunk. The shader
  needs a per-pixel version and the pointer needs a per-frame one; there is no way to
  share the code, only the definition. Focal length is pinned to the eye distance, so a
  point at the origin lands exactly where the old flat design put it — the tilt changes
  the shape of the disc, never the scale of the page.
- **The pitch clamp keeps the horizon off screen.** Past about 47° the plane's vanishing
  line crosses the viewport and the disc folds through itself. `unproject` guards the
  miss, but the guard is a safety net, not a design.
- **The disc has to be thick.** A thin sheet reads as a flat ring no matter how correctly
  you project it. The vertical spring is deliberately soft and per-particle — a tight
  inner sheet inside a loose outer haze — and that, plus the standing wave warping it, is
  most of what makes the tilt legible as a tilt.
- **The rim's width is set with `fwidth`, not a constant.** A fixed disc-space thickness
  is a hairline at the near edge of the ellipse and a smear at the far one.
- **The core darkening is load-bearing, not decoration.** The headline sits inside the
  disc, so the interior is dimmed to 30% to guarantee contrast against a field that is
  different every frame. Removing it makes the text fail on some frames and pass on
  others, which is the worst kind of contrast bug.
- **The content scrim is now always on, not just in portrait.** A plane that tilts cannot
  be trusted to keep its darkened interior under the words, so the copy carries its own
  shadow at every aspect ratio and leans on it hardest in portrait, where no circle can
  both enclose a phone-height column and leave the orbiting band on screen. The rim, the
  rays and the flare are all faded *behind* that scrim — a rim cutting through body text
  reads as a bug, a rim passing behind it reads as a composition.
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
- **The name is split into letter boxes, and that changes nothing about the light.** Both
  the warm gradient and the chisel mask are positioned at an absolute point, so the union
  of the per-letter masks is identical to the single-word mask it replaced. `white-space:
  pre` on the word is not cosmetic — without it the browser will happily break a line
  between two letters.
- **CSS grouping properties flatten `preserve-3d`.** `opacity < 1` and `filter != none`
  both do it, which is why the intro animation lives on its own wrapper element and the
  pointer-driven pose lives on another.

### Degradation

| Condition | Result |
| --- | --- |
| No JS / pre-hydration | Full copy server-rendered, figures at their settled values; `.static-field` paints the disc in CSS, as an ellipse at the same angle the canvas draws it |
| No WebGL2 | Canvas unmounts, CSS static field becomes the page |
| Context lost | Same — no black rectangle |
| `prefers-reduced-motion` | 90 frames stepped once to settle the field, then **no rAF at all**. No pointer listeners are installed, so the name renders plain white, the stage is flat and perspective-free, the reticle and the interaction hint are gone, the figures render settled and the cycling line holds on its first sentence |
| Slow GPU | Render scale backs off to as low as 0.68 and climbs back when frames get cheap again |
| Backgrounded tab | rAF cancelled on `visibilitychange` |
| Phone / coarse pointer | 26k particles instead of 110k, DPR capped at 1.5; no reticle (the system cursor is never hidden), no magnetic links or figures — touch drag and tap still drive the field, and device orientation drives the camera where it is available without a permission prompt |

Verified in Chromium at 1440×900 and 390×844, plus reduced-motion, WebGL2 disabled and
JS disabled: no console errors, no horizontal overflow, no lost context, and the name
measured at full `--text` brightness everywhere outside the cursor's pool.

## Where else this runs

The field, the camera and the reticle have been ported into the two Amarna repos.
They are **copies, not a shared package** — each one is adapted to a page whose
shape is different — so anything changed here has to be carried across by hand.
Three things are duplicated in all three repos and will drift silently if only
one of them is edited:

- **`pulseAmp()` in `lib/pointer.ts` and `pulseAt()` in the shaders.** The DOM and
  the GPU have to agree about where a shockwave's front is, or letters ripple on a
  wave nothing is drawing.
- **`basis` / `project` / `unproject` in `lib/pointer.ts` and their GLSL twins.**
  Per-frame and per-pixel versions of the same projection. If they disagree, the
  cursor stops landing where the field thinks it landed.
- **`ringRadius()` in the shaders and the CSS static field's radii.** The fallback
  ring has to sit where the real one sits, or the page visibly jumps when WebGL2
  is unavailable.

| Repo | What it took, and what it left behind |
|---|---|
| [`amarnaorg/amarna`](https://github.com/amarnaorg/amarna) | All of it, hero-scoped. `lib/pointer.ts` gains a registerable *stage* so the cursor is normalised against the disc's box rather than the viewport, and loses the wheel dolly — that page scrolls. The headline splits into words as well as letters so a sentence can wrap. The magnetism became a wrapper that drives the design system's Button rather than owning its own chips. Everything parks on an `IntersectionObserver`; the reticle is bound to the hero, because five screens of prose is not a place to take somebody's cursor away. |
| [`amarnaorg/amarna-video`](https://github.com/amarnaorg/amarna-video) | The field, the camera and the reticle only, behind the empty stage — and it is **disposed of the moment a show compiles**: canvas, GL objects, listeners, rAF and every custom property. The premise rows and style cards get the light but none of the lean or lift; a control that steps aside as you reach for it is a bug with a nice explanation. |

Nothing came back the other way. This page is the one that gets to be all field
and no product, which is the point of it.

## Deploy

Push to `main` — Vercel builds and deploys. No env vars.
