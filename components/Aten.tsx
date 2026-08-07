"use client";

/**
 * Aten — a GPU particle field orbiting a luminous ring, and the thing on this
 * page that actually reacts to you.
 *
 * ~110k particles simulated entirely on the GPU with WebGL2 transform feedback
 * (core WebGL2 — no float-texture extension required, no npm dependency).
 *
 * The field is a volume, not a picture of one. Particles carry a real height
 * above a disc plane, that plane is tilted away from the eye, and everything is
 * projected through a perspective divide: near matter is larger, brighter and
 * warmer, the far rim is smaller and colder, and the whole disc is an ellipse
 * you are looking down onto. The camera pose lives in lib/pointer, so the text
 * column in the DOM leans on exactly the same numbers — one camera, two
 * renderers.
 *
 * Per frame:
 *   1. update pass   — vertex shader integrates position/velocity/heat in disc
 *                      space, the rasterizer is discarded and results captured
 *                      into the ping-pong buffer set. Curl-ish simplex flow, an
 *                      orbital spring around the ring, a vertical spring that
 *                      gives the disc its thickness and a standing wave that
 *                      corrugates it, plus everything the cursor does: repulsion,
 *                      vortex, wake drag, a gathering shell that lifts matter out
 *                      of the plane while held, expanding shockwaves on release,
 *                      and heat that survives the touch.
 *   2. fade pass     — multiplicative decay of the trail framebuffer, so points
 *                      leave streaks instead of dots.
 *   3. point pass    — rotate into world space, perspective divide, additive
 *                      blend into the same trail framebuffer.
 *   4. present pass  — trail texture, bloom taps, a pointer lens warp, chromatic
 *                      split and flare ghosts, then the Aten itself: every part
 *                      of it drawn by casting each pixel's ray back onto the
 *                      tilted plane, so the ring, its rays, and the coordinate
 *                      lattice are all genuinely lying in the disc rather than
 *                      painted flat over it. Then core darkening (this is what
 *                      keeps the headline legible), vignette and grain.
 *
 * Degrades honestly: prefers-reduced-motion renders exactly one settled frame
 * and stops; no WebGL2 or a lost context unmounts the canvas and leaves the CSS
 * static field underneath visible. Render scale backs off on its own if frames
 * start costing more than the budget.
 */

import { useEffect, useRef, useState } from "react";
import { attachPointer, pointer, pulses, MAX_PULSES } from "@/lib/pointer";

/* ── shared GLSL ─────────────────────────────────────────────────────────── */

// Ashima simplex noise (webgl-noise, MIT) — drives the flow field.
const SIMPLEX = /* glsl */ `
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}`;

// Ring radius in disc-plane units.
//
// Landscape: big enough that the darkened interior still carries the whole
// content column once foreshortening has flattened it — a circle that only just
// enclosed the copy face-on would cut through it the moment the disc tilts.
// Portrait: no circle can both enclose a phone-height column AND leave the
// orbiting field on screen — enclosing it would push the entire band past the
// corners. So the ring shrinks to a halo and the copy is sheltered by the
// content scrim in the present pass instead, with the rim fading out behind it.
const RING = /* glsl */ `
float ringRadius(float aspect){
  return aspect >= 1.0 ? 0.88 : clamp(aspect * 1.34, 0.46, 0.78);
}`;

// The camera. Disc space is the plane the simulation lives in; u_basis rotates
// it into world space; the divide by depth puts it on screen. Focal length is
// pinned to the eye distance, so a point at the origin lands exactly where the
// old flat design put it — the tilt changes the shape of the disc, never the
// scale of the page. Mirrors basis/project/unproject in lib/pointer.
const CAMERA = /* glsl */ `
uniform mat3  u_basis;
uniform float u_cam;

float depthScale(float wz){ return u_cam / max(u_cam - wz, 0.30); }
vec2  projectW(vec3 w){ return w.xy * depthScale(w.z); }
vec2  projectDisc(vec2 q){ return projectW(u_basis * vec3(q, 0.0)); }

// Cast a screen point back onto the disc plane. The horizon is kept off screen
// by clamping the pitch; the guard shoves a miss far enough out that everything
// keyed on radius simply reads as empty sky.
vec2 unproject(vec2 s){
  vec3 n = u_basis[2];                       // plane normal = third column
  float denom = n.z - dot(n.xy, s) / u_cam;
  if (denom < 0.06) return s * 4.0;
  float t = n.z * u_cam / denom;
  vec3 w = vec3(s * (t / u_cam), u_cam - t);
  return (transpose(u_basis) * w).xy;        // orthonormal: inverse = transpose
}`;

// Shockwaves. xy = origin in disc space, z = age in seconds (negative means the
// slot is empty), w = power. Shared verbatim between the simulation and the
// present pass so the image ripples on exactly the same wavefront that moves
// the particles — and because the origin is a point on the plane, the wave
// spreads as an ellipse across the screen, riding the disc.
const PULSES = /* glsl */ `
#define MAX_PULSES ${MAX_PULSES}
uniform vec4 u_pulses[MAX_PULSES];

// Gaussian ring profile: 1 on the wavefront, 0 either side of it.
float pulseAt(vec4 pulse, vec2 at, out vec2 dir){
  dir = vec2(0.0);
  if (pulse.z < 0.0) return 0.0;
  vec2  q  = at - pulse.xy;
  float qd = length(q);
  dir = q / max(qd, 1e-4);
  float front = pulse.z * 2.35;
  float w = exp(-pow((qd - front) * 5.5, 2.0));
  return w * exp(-pulse.z * 2.0) * pulse.w;
}`;

/* ── 1. update pass ──────────────────────────────────────────────────────── */

// Runs entirely in disc space: the plane is the world as far as the physics is
// concerned, and z is height above it. The camera never enters this shader.
const UPDATE_VS = /* glsl */ `#version 300 es
precision highp float;

in vec3 a_pos;    // xy on the disc, z above it
in vec3 a_vel;
in vec4 a_seed;   // x = life 1→0, y = random, z = heat 1→0, w = twinkle phase

out vec3 v_pos;
out vec3 v_vel;
out vec4 v_seed;

uniform float u_time;
uniform float u_dt;
uniform float u_aspect;
uniform vec2  u_pointer;      // disc space
uniform vec2  u_pointerVel;   // disc space
uniform float u_force;
uniform float u_press;

${SIMPLEX}
${RING}
${PULSES}

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main(){
  vec3  p    = a_pos;
  vec3  vel  = a_vel;
  float life = a_seed.x;
  float rnd  = a_seed.y;
  float heat = a_seed.z;

  float R = ringRadius(u_aspect);

  // Organic flow: noise angle → unit direction. Two octaves, counter-drifting,
  // so the field never settles into a visible repeat. The frequencies are high
  // on purpose — coherent low-frequency noise herds the whole field into a
  // handful of fat streamers and the disc reads as smoke instead of a swarm.
  float n1  = snoise(vec3(p.xy * 2.10, u_time * 0.07));
  float n2  = snoise(vec3(p.xy * 4.70 + 31.4, u_time * 0.11));
  float ang = (n1 + n2 * 0.5) * 6.2831853;
  vec2  flow = vec2(cos(ang), sin(ang));

  // Orbit: tangential drive plus a stiff radial spring onto a per-particle band
  // just outside the ring. This is what turns drift into an accretion disc.
  vec2  r  = p.xy;
  float d  = max(length(r), 1e-4);
  vec2  rn = r / d;
  vec2  tangent = vec2(-rn.y, rn.x);

  // rnd² biases the band inward, so density piles up against the rim rather
  // than spreading evenly out to the corners.
  float band      = R * (1.03 + 0.62 * rnd * rnd);
  float radialErr = band - d;

  vec3 acc = vec3(flow * 0.45
           + tangent * (1.35 * R / (0.18 + d))
           + rn * radialErr * 4.2, 0.0);

  /* ── the third dimension ────────────────────────────────────────────────
     A spring back onto the plane gives the disc its thickness, and the
     stiffness is per-particle: a tight inner sheet inside a loose outer haze,
     rather than one uniform slab. Noise keeps loading it, and a slow standing
     wave travelling outward warps the whole thing. This is the part that has
     to be generous — a thin disc reads as a flat ring no matter how correctly
     you project it. */
  float nz = snoise(vec3(p.xy * 2.60 + 71.0, u_time * 0.12));
  acc.z += -p.z * (5.5 + 9.0 * rnd);
  acc.z += nz * 1.35 * (0.35 + rnd);
  acc.z += sin(d * 5.2 - u_time * 0.70) * 0.55;

  /* ── the cursor ─────────────────────────────────────────────────────────
     Four separate things, because one repulsion term reads as a hole being
     dragged around and nothing else. All of it happens where your ray meets
     the plane, so the disturbance lies down in the disc with everything else. */
  vec2  pr   = p.xy - u_pointer;
  float pd   = length(pr);
  vec2  pn   = pr / (pd + 1e-4);
  float near = exp(-pd * 3.4);

  // 1. Shove. Inverse-square, softened so it can't launch anything, and only
  //    while the cursor is not being held down.
  acc.xy += pn * u_force * (1.0 - u_press) * 0.55 / (0.05 + pd * pd * 5.0);

  // 2. Vortex. The cursor drags a swirl through the disc rather than a dent.
  acc.xy += vec2(-pn.y, pn.x) * near * (1.7 * u_force + 3.4 * u_press);

  // 3. Wake. Matter is carried along with the cursor, so a fast sweep leaves a
  //    comet trail instead of a symmetrical wound.
  acc.xy += u_pointerVel * near * 2.2;

  // 4. Gather. Held down, the field falls onto a small shell around the cursor
  //    — a shell and not a point, because a point sink is one aliased pixel —
  //    and climbs out of the plane toward you while it does it.
  acc.xy += pn * u_press * (0.055 - pd) * 9.0 * smoothstep(1.7, 0.0, pd);
  acc.z  += u_press * near * 2.4;

  // Release detonates whatever was gathered. The wave throws matter outward
  // along the plane and upward off it at the same time.
  for (int i = 0; i < MAX_PULSES; i++) {
    vec2 dir;
    float w = pulseAt(u_pulses[i], p.xy, dir);
    acc.xy += dir * w * 30.0;
    acc.z  += w * 11.0;
    heat = max(heat, w * 1.4);
  }

  // Heat is the memory of contact: it decays over a couple of seconds, so you
  // paint glowing streaks into the field and they linger after you have gone.
  heat = clamp(max(heat * exp(-u_dt * 0.85), near * (u_force * 0.95 + u_press)), 0.0, 1.0);

  // Excited matter climbs out of its band, and out of the plane.
  acc.xy += rn * heat * heat * 0.85;
  acc.z  += heat * heat * 0.55;

  vel += acc * u_dt;
  // Damping — keeps the stiff springs stable. Exponential in dt, not a fixed
  // per-frame factor: a flat multiply damps twice as hard on a 120Hz display
  // and the disc visibly tightens on high-refresh screens.
  vel *= exp(-u_dt * 5.1);
  p   += vel * u_dt;

  life -= u_dt * (0.055 + rnd * 0.07);

  // Respawn on death or on escape, back onto the inner edge of the band and
  // within the thickness of the sheet.
  if (life <= 0.0 || d > 3.2 || abs(p.z) > 0.9) {
    float s  = hash(vec2(rnd * 512.0, floor(u_time * 60.0) + rnd));
    float s2 = hash(vec2(s * 271.0, rnd * 97.0));
    float a  = s * 6.2831853;
    float rr = R * (1.02 + 0.6 * s2 * s2);
    p    = vec3(cos(a) * rr, sin(a) * rr, (s2 - 0.5) * 0.30);
    vel  = vec3(-sin(a) * 0.30, cos(a) * 0.30, 0.0);
    life = 1.0;
    rnd  = s2;
    heat = 0.0;
  }

  v_pos  = p;
  v_vel  = vel;
  v_seed = vec4(life, rnd, heat, a_seed.w);
}`;

// Transform feedback needs *a* fragment shader to link, even with the
// rasterizer discarded.
const UPDATE_FS = /* glsl */ `#version 300 es
precision mediump float;
out vec4 o;
void main(){ o = vec4(0.0); }`;

/* ── 2/3. trail fade + additive points ───────────────────────────────────── */

const QUAD_VS = /* glsl */ `#version 300 es
precision highp float;
in vec2 a_quad;
out vec2 v_uv;
void main(){
  v_uv = a_quad * 0.5 + 0.5;
  gl_Position = vec4(a_quad, 0.0, 1.0);
}`;

const FADE_FS = /* glsl */ `#version 300 es
precision mediump float;
uniform float u_decay;
out vec4 o;
void main(){ o = vec4(u_decay); }`;

const POINT_VS = /* glsl */ `#version 300 es
precision highp float;
in vec3 a_pos;
in vec3 a_vel;
in vec4 a_seed;
uniform float u_aspect;
uniform float u_size;
uniform float u_time;

${CAMERA}

out float v_speed;
out float v_life;
out float v_rnd;
out float v_heat;
out float v_near;   // 0 = far side of the disc, 1 = near side
void main(){
  vec3  w  = u_basis * a_pos;
  float ds = depthScale(w.z);
  gl_Position = vec4(w.x * ds / u_aspect, w.y * ds, 0.0, 1.0);

  v_heat  = a_seed.z;
  v_speed = length(a_vel);
  v_life  = a_seed.x;
  v_rnd   = a_seed.y;
  v_near  = clamp((ds - 0.84) / 0.46, 0.0, 1.0);

  // A slow per-particle twinkle keeps the band from reading as flat noise.
  float tw = 0.88 + 0.12 * sin(u_time * 1.7 + a_seed.w * 6.2831853);
  // Perspective is exaggerated past the honest 1/z, because at this eye
  // distance the honest figure is a 20% spread and reads as noise.
  gl_PointSize = min(14.0,
    u_size * (0.55 + a_seed.y * 1.05) * tw * (1.0 + min(v_heat, 1.0) * 1.3) * pow(ds, 2.2));
}`;

const POINT_FS = /* glsl */ `#version 300 es
precision mediump float;
in float v_speed;
in float v_life;
in float v_rnd;
in float v_heat;
in float v_near;
out vec4 o;
void main(){
  vec2  q = gl_PointCoord - 0.5;
  float d = length(q);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;

  // Cold indigo at rest → cyan in the stream → amber at the hot edges, which is
  // where the field brushes the ring, and anywhere you have touched it.
  float t = clamp(v_speed * 1.45 + v_heat * 0.85, 0.0, 1.0);
  vec3 cold = vec3(0.24, 0.30, 0.86);
  vec3 mid  = vec3(0.34, 0.83, 0.97);
  vec3 hot  = vec3(1.00, 0.76, 0.33);
  vec3 col  = mix(cold, mid, smoothstep(0.0, 0.55, t));
  col = mix(col, hot, smoothstep(0.55, 1.0, t));
  col = mix(col, vec3(1.0), pow(t, 6.0) * 0.5);

  // Aerial perspective: the far half of the disc goes cold and thin, the near
  // half comes forward. Depth you can read without moving anything.
  col = mix(col * vec3(0.66, 0.76, 1.10), col, v_near);

  // Fade in on spawn and out on death so respawns never pop.
  float fade = smoothstep(0.0, 0.22, v_life) * smoothstep(1.0, 0.78, v_life);
  float amp  = (0.32 + v_rnd * 0.45) * a * fade * (1.0 + v_heat * 1.5)
             * (0.62 + v_near * 0.72);
  o = vec4(col * amp, amp);
}`;

/* ── 4. present pass ─────────────────────────────────────────────────────── */

const PRESENT_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;

uniform sampler2D u_tex;
uniform vec2  u_res;
uniform float u_time;
uniform float u_aspect;
uniform vec2  u_pointer;    // screen-sim space
uniform vec2  u_pointerD;   // where that ray lands on the disc
uniform float u_force;
uniform float u_press;
uniform float u_speed;

${RING}
${CAMERA}
${PULSES}

const float TAU = 6.2831853;

// A lens ghost: soft disc with a brighter rim, the way a real one images the
// aperture rather than the source.
float ghost(vec2 uv, vec2 at, float r){
  float x = length(uv - at) / r;
  return exp(-x * x * 1.7) * (0.55 + 0.45 * smoothstep(1.1, 0.72, x));
}

void main(){
  // Screen space in the same y-normalised units the simulation uses, plus the
  // factor that converts a delta back into texture space.
  vec2 uv = (v_uv - 0.5) * 2.0;
  uv.x *= u_aspect;
  vec2 toUv = 0.5 * vec2(1.0 / u_aspect, 1.0);

  float R = ringRadius(u_aspect);

  // Everything about the Aten is measured on the plane, not on the glass: cast
  // this pixel's ray back onto the disc and work in the coordinates the
  // simulation itself uses.
  vec2  q  = unproject(uv);
  float d  = length(q);
  float qz = (u_basis * vec3(q, 0.0)).z;   // + toward the eye: near half of the ring

  vec2  toP   = uv - u_pointer;
  float pdist = length(toP);
  vec2  pdir  = toP / max(pdist, 1e-4);
  float pdd   = length(q - u_pointerD);    // the same gap, measured on the plane

  /* ── warp ───────────────────────────────────────────────────────────────
     The cursor bends the image it passes over, and the shockwaves ripple it.
     Doing this to the composited trail rather than to the particles means it
     also drags the bloom, which is most of why it reads as a lens. The waves
     are evaluated on the plane and pushed along the screen, so the ripple runs
     out as an ellipse in perspective. */
  vec2  warp  = pdir * exp(-pdist * 4.6) * (0.30 * u_force + u_press) * 0.055;
  float shock = 0.0;
  for (int i = 0; i < MAX_PULSES; i++) {
    vec2 ignored;
    float w = pulseAt(u_pulses[i], q, ignored);
    if (w > 0.0001) {
      vec2 origin = projectDisc(u_pulses[i].xy);
      warp += normalize(uv - origin + 1e-5) * w * 0.055;
    }
    shock += w;
  }
  vec2 suv = v_uv - warp * toUv;

  /* ── trail, chromatic split, bloom ──────────────────────────────────────── */
  vec3 c = texture(u_tex, suv).rgb;

  // Aberration scales with how fast you are moving and how close you are, so a
  // still cursor is optically clean and a fast one smears colour.
  float ca  = (0.0012 + u_speed * 0.0035 + shock * 0.005) * (0.35 + exp(-pdist * 2.6));
  vec2  cad = pdir * ca * vec2(1.0 / u_aspect, 1.0);
  c.r = texture(u_tex, suv + cad).r;
  c.b = texture(u_tex, suv - cad).b;

  vec2 px = 3.5 / u_res;
  vec3 b = vec3(0.0);
  b += texture(u_tex, suv + vec2( 1.0,  0.0) * px).rgb;
  b += texture(u_tex, suv + vec2(-1.0,  0.0) * px).rgb;
  b += texture(u_tex, suv + vec2( 0.0,  1.0) * px).rgb;
  b += texture(u_tex, suv + vec2( 0.0, -1.0) * px).rgb;
  b += texture(u_tex, suv + vec2( 1.0,  1.0) * px * 2.0).rgb;
  b += texture(u_tex, suv + vec2(-1.0,  1.0) * px * 2.0).rgb;
  b += texture(u_tex, suv + vec2( 1.0, -1.0) * px * 2.0).rgb;
  b += texture(u_tex, suv + vec2(-1.0, -1.0) * px * 2.0).rgb;
  c += b * 0.115;

  /* ── the Aten ───────────────────────────────────────────────────────────── */
  float ang     = atan(q.y, q.x);
  float shimmer = 0.68 + 0.32 * sin(ang * 3.0 - u_time * 0.45)
                              * sin(ang * 7.0 + u_time * 0.22);
  float breathe = 1.0 + 0.035 * sin(u_time * 0.55) + 0.025 * u_press;
  float Rb      = R * breathe;

  // Which way the cursor is, seen from the centre of the disc. The rim runs hot
  // on the arc that faces it — the disc notices you before it reaches for you.
  float plen   = length(u_pointerD);
  vec2  pcen   = u_pointerD / max(plen, 1e-4);
  float facing = max(dot(q / max(d, 1e-4), pcen), 0.0);
  float attend = pow(facing, 3.0) * u_force;

  // Constant width on screen, not on the plane: a fixed disc-space thickness
  // would be a hairline at the near edge of the ellipse and a smear at the far
  // one. fwidth is the derivative of the unprojection, so this is exact.
  float rw   = max(fwidth(d), 1e-5);
  float rim  = smoothstep(rw * 2.4, 0.0, abs(d - Rb));
  float echo = smoothstep(rw * 1.2, 0.0, abs(d - Rb * 1.075));
  float halo = exp(-abs(d - Rb) / (0.11 + rw * 30.0));
  // The near arc of the ring is closer to the eye, so it burns hotter.
  float lean = 1.0 + qz * 0.55;

  /* ── rays ───────────────────────────────────────────────────────────────
     The Amarna disc is never carved alone. It is carved reaching: long straight
     rays that end in open hands, held out to whoever is standing in front of
     it. In the reliefs that is the pharaoh. Here it is the cursor. Step outside
     the ring and the rays on your side grow until they touch you — and because
     they are drawn on the plane, they lengthen away from you in perspective. */
  float outside = smoothstep(R * 0.45, R * 0.95, plen);
  float reach   = smoothstep(0.15, 1.0, facing) * u_force * outside;
  float phase   = (ang / TAU + 0.5) * 28.0 + u_time * 0.012;
  float spoke   = pow(max(1.0 - abs(fract(phase) - 0.5) * 2.0, 0.0), 20.0);

  float inner = Rb * 1.015;
  float tip   = mix(Rb * 1.13, max(plen, Rb * 1.2), reach * 0.95);
  float along = smoothstep(inner, inner + 0.045, d) * (1.0 - smoothstep(inner, tip, d));
  float hand  = smoothstep(0.014, 0.0, abs(d - tip)) * reach;   // the open palm
  float ray   = spoke * (along * (0.35 + reach * 1.15) + hand * 1.7);

  // Content scrim: an ellipse matching the text column, sized in screen space
  // and independent of the disc. The disc used to shelter the copy by itself,
  // but a plane that tilts cannot be trusted to keep its darkened interior
  // under the words — so the copy now carries its own shadow everywhere, and
  // leans on it hardest in portrait, where the ring is only a halo.
  float portrait = 1.0 - smoothstep(0.85, 1.15, u_aspect);
  vec2  se = vec2(uv.x / max(u_aspect * 0.98, 0.52), uv.y / 0.94);
  float scrim = (1.0 - smoothstep(0.5, 1.05, length(se))) * mix(0.62, 1.0, portrait);

  // Where the scrim is active the rim reads as passing *behind* the copy, which
  // is a composition; letting it cut through the text is an accident.
  vec3  gold   = vec3(1.00, 0.80, 0.42);
  float behind = 1.0 - scrim * 0.92;
  c += gold * rim  * shimmer * lean * (1.15 + attend * 0.85) * behind;
  c += gold * echo * 0.22 * lean * behind;
  c += gold * halo * (0.16 + attend * 0.10) * lean * behind;
  c += gold * ray  * 0.32 * behind;

  /* ── lattice ────────────────────────────────────────────────────────────
     The polar grid the whole field is actually laid out on, drawn only inside a
     small radius of the cursor. Nothing here is decoration: it is the machinery
     under the picture, and you can only ever see the piece you are pointing at.
     It is drawn on the plane, so it recedes — which is the clearest statement
     the page makes that this is a surface in space and not a wallpaper. */
  float reveal = exp(-pdd * 3.4) * clamp(0.5 * u_force + u_press, 0.0, 1.0);
  float rings  = pow(max(1.0 - abs(fract(d * 11.0 - u_time * 0.06) - 0.5) * 2.0, 0.0), 24.0);
  float radii  = pow(max(1.0 - abs(fract((ang / TAU + 0.5) * 60.0) - 0.5) * 2.0, 0.0), 24.0);
  c += vec3(0.38, 0.55, 1.00) * (rings * 0.85 + radii * 0.6) * reveal * 0.6;

  // The cursor itself carries a little of the disc's light, and each shockwave
  // front is drawn as a cold ring travelling outward.
  c += gold * exp(-pdist * 10.0) * (0.10 * u_force + 0.60 * u_press);
  c += vec3(0.55, 0.72, 1.00) * shock * 0.30;

  /* ── flare ──────────────────────────────────────────────────────────────
     Ghosts along the axis through the centre of the frame, plus an anamorphic
     streak, as if all of this were arriving through a real lens. Gated on
     presence and pressure: at rest the optics are clean. */
  float gate = u_force * (0.30 + u_press * 1.0);
  if (gate > 0.002) {
    vec3 fl = vec3(0.0);
    fl += vec3(1.00, 0.72, 0.36) * ghost(uv, u_pointer * -0.42, 0.15) * 0.15;
    fl += vec3(0.42, 0.60, 1.00) * ghost(uv, u_pointer * -0.85, 0.09) * 0.12;
    fl += vec3(1.00, 0.48, 0.34) * ghost(uv, u_pointer *  0.55, 0.06) * 0.10;
    fl += vec3(0.55, 1.00, 0.86) * ghost(uv, u_pointer *  1.28, 0.12) * 0.08;
    fl += vec3(0.42, 0.62, 1.00) * exp(-abs(toP.y) * 64.0) * exp(-abs(toP.x) * 2.4) * 0.30;
    // Never over the copy: an optical artefact is a flourish behind the words
    // and a smudge on top of them.
    c += fl * gate * behind;
  }

  // Darken the disc interior. This is deliberate and load-bearing: the headline
  // sits here, so the brightest thing on screen must never drift under it.
  float core = max(smoothstep(Rb * 1.0, Rb * 0.30, d), scrim);
  c *= mix(1.0, 0.30, core);
  c += vec3(0.045, 0.050, 0.085) * core;

  // Vignette, filmic-ish rolloff, and grain to kill banding in the dark falloff.
  c *= 1.0 - 0.45 * smoothstep(0.55, 1.65, length(uv));
  c  = c / (c + 0.72) * 1.42;
  float grain = fract(sin(dot(v_uv * u_res, vec2(12.9898, 78.233)) + u_time) * 43758.5453);
  c += (grain - 0.5) * 0.016;

  o = vec4(max(c, 0.0), 1.0);
}`;

/* ── plumbing ────────────────────────────────────────────────────────────── */

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`shader compile failed: ${log}`);
  }
  return sh;
}

function link(
  gl: WebGL2RenderingContext,
  vsSrc: string,
  fsSrc: string,
  feedback?: string[],
) {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  if (feedback) gl.transformFeedbackVaryings(prog, feedback, gl.SEPARATE_ATTRIBS);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`program link failed: ${log}`);
  }
  return prog;
}

/** Disc→world rotation, column-major for WebGL. Same matrix lib/pointer builds
 *  row-major for its own projections — one pose, two layouts. */
function packBasis(out: Float32Array, pitch: number, yaw: number) {
  const cx = Math.cos(pitch);
  const sx = Math.sin(pitch);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  out[0] = cy;
  out[1] = 0;
  out[2] = -sy;
  out[3] = -sy * sx;
  out[4] = cx;
  out[5] = -cy * sx;
  out[6] = sy * cx;
  out[7] = sx;
  out[8] = cy * cx;
  return out;
}

export default function Aten() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Unmount the canvas entirely if WebGL2 is missing or the context dies, so the
  // CSS static field behind it becomes the page rather than a black rectangle.
  const [alive, setAlive] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: false,
    });
    if (!gl) {
      setAlive(false);
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const small = Math.min(window.innerWidth, window.innerHeight) < 620;

    // Tier the work: phones get a quarter of the particles and a lower dpr cap.
    const COUNT = reduced ? 45_000 : coarse || small ? 26_000 : 110_000;
    const DPR_CAP = coarse || small ? 1.5 : 2;

    let programs: WebGLProgram[] = [];
    let buffers: WebGLBuffer[] = [];
    let vaos: WebGLVertexArrayObject[] = [];
    let detachPointer: (() => void) | null = null;
    let raf = 0;
    let disposed = false;

    try {
      const updateProg = link(gl, UPDATE_VS, UPDATE_FS, ["v_pos", "v_vel", "v_seed"]);
      const pointProg = link(gl, POINT_VS, POINT_FS);
      const fadeProg = link(gl, QUAD_VS, FADE_FS);
      const presentProg = link(gl, QUAD_VS, PRESENT_FS);
      programs = [updateProg, pointProg, fadeProg, presentProg];

      /* seed state: a ring of particles already in orbit ------------------- */
      const pos = new Float32Array(COUNT * 3);
      const vel = new Float32Array(COUNT * 3);
      const seed = new Float32Array(COUNT * 4);
      const aspect0 = window.innerWidth / window.innerHeight;
      // Mirrors ringRadius() in GLSL — keep the two in step.
      const R0 =
        aspect0 >= 1 ? 0.88 : Math.min(0.78, Math.max(0.46, aspect0 * 1.34));
      for (let i = 0; i < COUNT; i++) {
        const a = Math.random() * Math.PI * 2;
        const rnd = Math.random();
        const r = R0 * (1.03 + 0.62 * rnd * rnd);
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 1] = Math.sin(a) * r;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
        vel[i * 3] = -Math.sin(a) * 0.3;
        vel[i * 3 + 1] = Math.cos(a) * 0.3;
        vel[i * 3 + 2] = 0;
        seed[i * 4] = Math.random(); // stagger life so respawns never sync up
        seed[i * 4 + 1] = rnd;
        seed[i * 4 + 2] = 0; // heat
        seed[i * 4 + 3] = Math.random(); // twinkle phase
      }

      const mkBuf = (data: Float32Array) => {
        const b = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_COPY);
        buffers.push(b);
        return b;
      };

      // Two full sets, ping-ponged: a buffer may not be an attribute source and
      // a transform-feedback target in the same draw.
      const sets = [
        { pos: mkBuf(pos), vel: mkBuf(vel), seed: mkBuf(seed) },
        { pos: mkBuf(pos), vel: mkBuf(vel), seed: mkBuf(seed) },
      ];

      const mkVao = (prog: WebGLProgram, set: (typeof sets)[0]) => {
        const vao = gl.createVertexArray()!;
        gl.bindVertexArray(vao);
        for (const [name, buf, size] of [
          ["a_pos", set.pos, 3],
          ["a_vel", set.vel, 3],
          ["a_seed", set.seed, 4],
        ] as const) {
          const loc = gl.getAttribLocation(prog, name);
          if (loc < 0) continue;
          gl.bindBuffer(gl.ARRAY_BUFFER, buf);
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
        }
        gl.bindVertexArray(null);
        vaos.push(vao);
        return vao;
      };

      const updateVaos = [mkVao(updateProg, sets[0]), mkVao(updateProg, sets[1])];
      const pointVaos = [mkVao(pointProg, sets[0]), mkVao(pointProg, sets[1])];

      /* fullscreen quad ---------------------------------------------------- */
      const quadBuf = gl.createBuffer()!;
      buffers.push(quadBuf);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW,
      );
      const mkQuadVao = (prog: WebGLProgram) => {
        const vao = gl.createVertexArray()!;
        gl.bindVertexArray(vao);
        const loc = gl.getAttribLocation(prog, "a_quad");
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
        vaos.push(vao);
        return vao;
      };
      const fadeVao = mkQuadVao(fadeProg);
      const presentVao = mkQuadVao(presentProg);

      const tf = gl.createTransformFeedback()!;

      /* trail framebuffer -------------------------------------------------- */
      let trailTex = gl.createTexture()!;
      const fbo = gl.createFramebuffer()!;
      let W = 0;
      let H = 0;
      // Render scale, adjusted by the frame-cost governor below.
      let quality = 1;

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP) * quality;
        const w = Math.max(1, Math.round(window.innerWidth * dpr));
        const h = Math.max(1, Math.round(window.innerHeight * dpr));
        if (w === W && h === H) return;
        W = w;
        H = h;
        canvas.width = W;
        canvas.height = H;

        gl.deleteTexture(trailTex);
        trailTex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, trailTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          trailTex,
          0,
        );
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      };
      resize();

      /* pointer ------------------------------------------------------------ */
      // Shared with the DOM layer; this component only reads it.
      if (!reduced) detachPointer = attachPointer();
      const pulseData = new Float32Array(MAX_PULSES * 4);
      const packPulses = () => {
        for (let i = 0; i < MAX_PULSES; i++) {
          const p = pulses[i];
          pulseData[i * 4] = p ? p.x : 0;
          pulseData[i * 4 + 1] = p ? p.y : 0;
          pulseData[i * 4 + 2] = p ? p.age : -1; // negative = empty slot
          pulseData[i * 4 + 3] = p ? p.power : 0;
        }
      };
      packPulses();
      const basis = new Float32Array(9);

      /* uniform locations -------------------------------------------------- */
      const uUpd = {
        time: gl.getUniformLocation(updateProg, "u_time"),
        dt: gl.getUniformLocation(updateProg, "u_dt"),
        aspect: gl.getUniformLocation(updateProg, "u_aspect"),
        pointer: gl.getUniformLocation(updateProg, "u_pointer"),
        pointerVel: gl.getUniformLocation(updateProg, "u_pointerVel"),
        force: gl.getUniformLocation(updateProg, "u_force"),
        press: gl.getUniformLocation(updateProg, "u_press"),
        pulses: gl.getUniformLocation(updateProg, "u_pulses[0]"),
      };
      const uPt = {
        aspect: gl.getUniformLocation(pointProg, "u_aspect"),
        size: gl.getUniformLocation(pointProg, "u_size"),
        time: gl.getUniformLocation(pointProg, "u_time"),
        basis: gl.getUniformLocation(pointProg, "u_basis"),
        cam: gl.getUniformLocation(pointProg, "u_cam"),
      };
      const uFade = { decay: gl.getUniformLocation(fadeProg, "u_decay") };
      const uPres = {
        tex: gl.getUniformLocation(presentProg, "u_tex"),
        res: gl.getUniformLocation(presentProg, "u_res"),
        time: gl.getUniformLocation(presentProg, "u_time"),
        aspect: gl.getUniformLocation(presentProg, "u_aspect"),
        pointer: gl.getUniformLocation(presentProg, "u_pointer"),
        pointerD: gl.getUniformLocation(presentProg, "u_pointerD"),
        force: gl.getUniformLocation(presentProg, "u_force"),
        press: gl.getUniformLocation(presentProg, "u_press"),
        speed: gl.getUniformLocation(presentProg, "u_speed"),
        basis: gl.getUniformLocation(presentProg, "u_basis"),
        cam: gl.getUniformLocation(presentProg, "u_cam"),
        pulses: gl.getUniformLocation(presentProg, "u_pulses[0]"),
      };

      /* frame -------------------------------------------------------------- */
      let src = 0;
      let t = 0;
      let last = performance.now();

      const step = (dt: number) => {
        const aspect = W / H;
        t += dt;
        packPulses();
        packBasis(basis, pointer.tiltX, pointer.tiltY);

        // 1. simulate — disc space only; the camera never touches this pass.
        gl.useProgram(updateProg);
        gl.uniform1f(uUpd.time, t);
        gl.uniform1f(uUpd.dt, dt);
        gl.uniform1f(uUpd.aspect, aspect);
        gl.uniform2f(uUpd.pointer, pointer.dx, pointer.dy);
        gl.uniform2f(uUpd.pointerVel, pointer.vx, pointer.vy);
        gl.uniform1f(uUpd.force, pointer.force);
        gl.uniform1f(uUpd.press, pointer.press);
        gl.uniform4fv(uUpd.pulses, pulseData);

        gl.bindVertexArray(updateVaos[src]);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
        const dst = sets[1 - src];
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, dst.pos);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, dst.vel);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 2, dst.seed);
        gl.enable(gl.RASTERIZER_DISCARD);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, COUNT);
        gl.endTransformFeedback();
        gl.disable(gl.RASTERIZER_DISCARD);
        for (let i = 0; i < 3; i++) {
          gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, i, null);
        }
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        src = 1 - src;

        // 2/3. fade the trail buffer, then blend the points into it
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.viewport(0, 0, W, H);
        gl.enable(gl.BLEND);

        gl.useProgram(fadeProg);
        // Frame-rate independent decay, so a 120Hz display doesn't erase trails.
        gl.uniform1f(uFade.decay, Math.pow(0.9, Math.min(dt, 0.05) * 60));
        gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
        gl.bindVertexArray(fadeVao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        gl.useProgram(pointProg);
        gl.uniform1f(uPt.aspect, aspect);
        gl.uniform1f(uPt.size, Math.max(1.0, (H / 900) * 1.7));
        gl.uniform1f(uPt.time, t);
        gl.uniformMatrix3fv(uPt.basis, false, basis);
        gl.uniform1f(uPt.cam, pointer.cam);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE);
        gl.bindVertexArray(pointVaos[src]);
        gl.drawArrays(gl.POINTS, 0, COUNT);

        // 4. composite to screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, W, H);
        gl.disable(gl.BLEND);
        gl.useProgram(presentProg);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, trailTex);
        gl.uniform1i(uPres.tex, 0);
        gl.uniform2f(uPres.res, W, H);
        gl.uniform1f(uPres.time, t);
        gl.uniform1f(uPres.aspect, aspect);
        gl.uniform2f(uPres.pointer, pointer.px, pointer.py);
        gl.uniform2f(uPres.pointerD, pointer.dx, pointer.dy);
        gl.uniform1f(uPres.force, pointer.force);
        gl.uniform1f(uPres.press, pointer.press);
        gl.uniform1f(uPres.speed, pointer.speed);
        gl.uniformMatrix3fv(uPres.basis, false, basis);
        gl.uniform1f(uPres.cam, pointer.cam);
        gl.uniform4fv(uPres.pulses, pulseData);
        gl.bindVertexArray(presentVao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindVertexArray(null);
      };

      if (reduced) {
        // A genuine designed still: settle the field, then stop. No rAF at all.
        for (let i = 0; i < 90; i++) step(1 / 60);
        return () => {
          disposed = true;
        };
      }

      /* frame-cost governor -------------------------------------------------
         This shader got more expensive, and the machines it runs on did not.
         Rather than pick a resolution up front from a guess about the device,
         watch what frames actually cost and give back pixels until they fit —
         a smooth field at 85% scale beats a crisp one at 34fps. */
      let acc = 0;
      let frames = 0;
      const judge = (dt: number) => {
        acc += dt;
        if (++frames < 50) return;
        const avg = acc / frames;
        acc = 0;
        frames = 0;
        if (avg > 1 / 46 && quality > 0.68) quality = Math.max(0.68, quality - 0.12);
        else if (avg < 1 / 58 && quality < 1) quality = Math.min(1, quality + 0.08);
      };

      const loop = (now: number) => {
        if (disposed) return;
        const dt = Math.min((now - last) / 1000, 1 / 20);
        last = now;
        judge(dt);
        resize();
        step(dt);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

      // Stop burning GPU on a backgrounded tab.
      const onVisibility = () => {
        if (document.hidden) {
          cancelAnimationFrame(raf);
          raf = 0;
        } else if (!raf && !disposed) {
          last = performance.now();
          raf = requestAnimationFrame(loop);
        }
      };
      document.addEventListener("visibilitychange", onVisibility);

      const onLost = (e: Event) => {
        e.preventDefault();
        disposed = true;
        cancelAnimationFrame(raf);
        setAlive(false);
      };
      canvas.addEventListener("webglcontextlost", onLost);

      return () => {
        disposed = true;
        cancelAnimationFrame(raf);
        detachPointer?.();
        document.removeEventListener("visibilitychange", onVisibility);
        canvas.removeEventListener("webglcontextlost", onLost);
        gl.deleteTransformFeedback(tf);
        gl.deleteFramebuffer(fbo);
        gl.deleteTexture(trailTex);
        for (const v of vaos) gl.deleteVertexArray(v);
        for (const b of buffers) gl.deleteBuffer(b);
        for (const p of programs) gl.deleteProgram(p);
      };
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error(err);
      detachPointer?.();
      for (const v of vaos) gl.deleteVertexArray(v);
      for (const b of buffers) gl.deleteBuffer(b);
      for (const p of programs) gl.deleteProgram(p);
      setAlive(false);
      return;
    }
  }, []);

  if (!alive) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 h-full w-full"
    />
  );
}
