"use client";

/**
 * Aten — a GPU particle field orbiting a luminous ring.
 *
 * ~110k particles simulated entirely on the GPU with WebGL2 transform feedback
 * (core WebGL2 — no float-texture extension required, no npm dependency).
 *
 * Per frame:
 *   1. update pass   — vertex shader integrates position/velocity, rasterizer
 *                      discarded, results captured straight into the ping-pong
 *                      buffer set. Curl-ish simplex flow + orbital spring around
 *                      the ring + inverse-square pointer repulsion.
 *   2. fade pass     — multiplicative decay of the trail framebuffer, so points
 *                      leave streaks instead of dots.
 *   3. point pass    — additive blend into the same trail framebuffer.
 *   4. present pass  — trail texture + cheap bloom taps, then the Aten ring,
 *                      core darkening (this is what keeps the headline legible),
 *                      vignette and grain, composited to the screen.
 *
 * Degrades honestly: prefers-reduced-motion renders exactly one settled frame
 * and stops; no WebGL2 or a lost context unmounts the canvas and leaves the CSS
 * static field underneath visible.
 */

import { useEffect, useRef, useState } from "react";

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

// Ring radius in y-normalised units.
//
// Landscape: big enough to enclose the whole content column, so the darkened
// disc interior is what carries the text.
// Portrait: no circle can both enclose a phone-height column AND leave the
// orbiting field on screen — enclosing it would push the entire band past the
// corners. So the ring shrinks to a halo and the copy is sheltered by the
// content scrim in the present pass instead, with the rim fading out behind it.
const RING = /* glsl */ `
float ringRadius(float aspect){
  return aspect >= 1.0 ? 0.80 : clamp(aspect * 1.30, 0.42, 0.72);
}`;

/* ── 1. update pass ──────────────────────────────────────────────────────── */

const UPDATE_VS = /* glsl */ `#version 300 es
precision highp float;

in vec2 a_pos;
in vec2 a_vel;
in vec2 a_seed;   // x = life 1→0, y = per-particle random

out vec2 v_pos;
out vec2 v_vel;
out vec2 v_seed;

uniform float u_time;
uniform float u_dt;
uniform float u_aspect;
uniform vec2  u_pointer;
uniform float u_pointerForce;

${SIMPLEX}
${RING}

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main(){
  vec2  p    = a_pos;
  vec2  vel  = a_vel;
  float life = a_seed.x;
  float rnd  = a_seed.y;

  float R = ringRadius(u_aspect);

  // Organic flow: noise angle → unit direction. Two octaves, counter-drifting,
  // so the field never settles into a visible repeat. The frequencies are high
  // on purpose — coherent low-frequency noise herds the whole field into a
  // handful of fat streamers and the disc reads as smoke instead of a swarm.
  float n1  = snoise(vec3(p * 2.10, u_time * 0.07));
  float n2  = snoise(vec3(p * 4.70 + 31.4, u_time * 0.11));
  float ang = (n1 + n2 * 0.5) * 6.2831853;
  vec2  flow = vec2(cos(ang), sin(ang));

  // Orbit: tangential drive plus a stiff radial spring onto a per-particle band
  // just outside the ring. This is what turns drift into an accretion disc.
  vec2  r  = p;
  float d  = max(length(r), 1e-4);
  vec2  rn = r / d;
  vec2  tangent = vec2(-rn.y, rn.x);

  // rnd² biases the band inward, so density piles up against the rim rather
  // than spreading evenly out to the corners.
  float band      = R * (1.03 + 0.62 * rnd * rnd);
  float radialErr = band - d;

  vec2 acc = flow * 0.45
           + tangent * (1.35 * R / (0.18 + d))
           + rn * radialErr * 4.2;

  // Pointer: inverse-square shove, softened so it can't launch particles.
  vec2  pr = p - u_pointer;
  float pd = length(pr);
  acc += (pr / (pd + 1e-4)) * u_pointerForce * 0.55 / (0.05 + pd * pd * 5.0);

  vel += acc * u_dt;
  // Damping — keeps the stiff radial spring stable. Exponential in dt, not a
  // fixed per-frame factor: a flat multiply damps twice as hard on a 120Hz
  // display and the disc visibly tightens on high-refresh screens.
  vel *= exp(-u_dt * 5.1);
  p   += vel * u_dt;

  life -= u_dt * (0.055 + rnd * 0.07);

  // Respawn on death or on escape, back onto the inner edge of the band.
  if (life <= 0.0 || d > 3.2) {
    float s  = hash(vec2(rnd * 512.0, floor(u_time * 60.0) + rnd));
    float s2 = hash(vec2(s * 271.0, rnd * 97.0));
    float a  = s * 6.2831853;
    float rr = R * (1.02 + 0.6 * s2 * s2);
    p    = vec2(cos(a), sin(a)) * rr;
    vel  = vec2(-sin(a), cos(a)) * 0.30;
    life = 1.0;
    rnd  = s2;
  }

  v_pos  = p;
  v_vel  = vel;
  v_seed = vec2(life, rnd);
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
in vec2 a_pos;
in vec2 a_vel;
in vec2 a_seed;
uniform float u_aspect;
uniform float u_size;
out float v_speed;
out float v_life;
out float v_rnd;
void main(){
  gl_Position  = vec4(a_pos.x / u_aspect, a_pos.y, 0.0, 1.0);
  gl_PointSize = u_size * (0.55 + a_seed.y * 1.05);
  v_speed = length(a_vel);
  v_life  = a_seed.x;
  v_rnd   = a_seed.y;
}`;

const POINT_FS = /* glsl */ `#version 300 es
precision mediump float;
in float v_speed;
in float v_life;
in float v_rnd;
out vec4 o;
void main(){
  vec2  q = gl_PointCoord - 0.5;
  float d = length(q);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;

  // Cold indigo at rest → cyan in the stream → amber at the hot edges, which is
  // where the field brushes the ring.
  float t = clamp(v_speed * 1.45, 0.0, 1.0);
  vec3 cold = vec3(0.24, 0.30, 0.86);
  vec3 mid  = vec3(0.34, 0.83, 0.97);
  vec3 hot  = vec3(1.00, 0.76, 0.33);
  vec3 col  = mix(cold, mid, smoothstep(0.0, 0.55, t));
  col = mix(col, hot, smoothstep(0.55, 1.0, t));
  col = mix(col, vec3(1.0), pow(t, 6.0) * 0.5);

  // Fade in on spawn and out on death so respawns never pop.
  float fade = smoothstep(0.0, 0.22, v_life) * smoothstep(1.0, 0.78, v_life);
  float amp  = (0.32 + v_rnd * 0.45) * a * fade;
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

${RING}

void main(){
  vec3 c = texture(u_tex, v_uv).rgb;

  // Eight-tap ring blur, added back as cheap bloom.
  vec2 px = 3.5 / u_res;
  vec3 b = vec3(0.0);
  b += texture(u_tex, v_uv + vec2( 1.0,  0.0) * px).rgb;
  b += texture(u_tex, v_uv + vec2(-1.0,  0.0) * px).rgb;
  b += texture(u_tex, v_uv + vec2( 0.0,  1.0) * px).rgb;
  b += texture(u_tex, v_uv + vec2( 0.0, -1.0) * px).rgb;
  b += texture(u_tex, v_uv + vec2( 1.0,  1.0) * px * 2.0).rgb;
  b += texture(u_tex, v_uv + vec2(-1.0,  1.0) * px * 2.0).rgb;
  b += texture(u_tex, v_uv + vec2( 1.0, -1.0) * px * 2.0).rgb;
  b += texture(u_tex, v_uv + vec2(-1.0, -1.0) * px * 2.0).rgb;
  c += b * 0.115;

  // Screen space in the same y-normalised units the simulation uses.
  vec2  uv = (v_uv - 0.5) * 2.0;
  uv.x *= u_aspect;
  float d  = length(uv);
  float R  = ringRadius(u_aspect);

  // The Aten. A hairline rim with an angular shimmer, a soft inner halo, and a
  // faint outer echo.
  float ang     = atan(uv.y, uv.x);
  float shimmer = 0.68 + 0.32 * sin(ang * 3.0 - u_time * 0.45)
                              * sin(ang * 7.0 + u_time * 0.22);
  float breathe = 1.0 + 0.035 * sin(u_time * 0.55);
  float Rb      = R * breathe;

  float rim   = smoothstep(0.0075, 0.0, abs(d - Rb));
  float echo  = smoothstep(0.0035, 0.0, abs(d - Rb * 1.075));
  float halo  = exp(-abs(d - Rb) * 9.0);

  // Content scrim: an ellipse matching the text column, sized independently of
  // the ring. Only engaged on portrait, where the ring is a halo rather than an
  // enclosure and cannot shelter the copy by itself.
  float portrait = 1.0 - smoothstep(0.85, 1.15, u_aspect);
  vec2  se = vec2(uv.x / max(u_aspect * 0.98, 0.52), uv.y / 0.92);
  float scrim = (1.0 - smoothstep(0.55, 1.05, length(se))) * portrait;

  // Where the scrim is active the rim reads as passing *behind* the copy, which
  // is a composition; letting it cut through the text is an accident.
  vec3 gold = vec3(1.00, 0.80, 0.42);
  float behind = 1.0 - scrim * 0.92;
  c += gold * rim  * shimmer * 1.15 * behind;
  c += gold * echo * 0.22 * behind;
  c += gold * halo * 0.16 * behind;

  // Darken the disc interior. This is deliberate and load-bearing: the headline
  // sits here, so the brightest thing on screen must never drift under it.
  float core = max(smoothstep(Rb * 1.0, Rb * 0.30, d), scrim);
  c *= mix(1.0, 0.30, core);
  c += vec3(0.045, 0.050, 0.085) * core;

  // Vignette, filmic-ish rolloff, and grain to kill banding in the dark falloff.
  c *= 1.0 - 0.45 * smoothstep(0.55, 1.65, d);
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
    let raf = 0;
    let disposed = false;

    try {
      const updateProg = link(gl, UPDATE_VS, UPDATE_FS, ["v_pos", "v_vel", "v_seed"]);
      const pointProg = link(gl, POINT_VS, POINT_FS);
      const fadeProg = link(gl, QUAD_VS, FADE_FS);
      const presentProg = link(gl, QUAD_VS, PRESENT_FS);
      programs = [updateProg, pointProg, fadeProg, presentProg];

      /* seed state: a ring of particles already in orbit ------------------- */
      const pos = new Float32Array(COUNT * 2);
      const vel = new Float32Array(COUNT * 2);
      const seed = new Float32Array(COUNT * 2);
      const aspect0 = window.innerWidth / window.innerHeight;
      // Mirrors ringRadius() in GLSL — keep the two in step.
      const R0 =
        aspect0 >= 1 ? 0.8 : Math.min(0.72, Math.max(0.42, aspect0 * 1.3));
      for (let i = 0; i < COUNT; i++) {
        const a = Math.random() * Math.PI * 2;
        const rnd = Math.random();
        const r = R0 * (1.03 + 0.62 * rnd * rnd);
        pos[i * 2] = Math.cos(a) * r;
        pos[i * 2 + 1] = Math.sin(a) * r;
        vel[i * 2] = -Math.sin(a) * 0.3;
        vel[i * 2 + 1] = Math.cos(a) * 0.3;
        seed[i * 2] = Math.random(); // stagger life so respawns never sync up
        seed[i * 2 + 1] = rnd;
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
        for (const [name, buf] of [
          ["a_pos", set.pos],
          ["a_vel", set.vel],
          ["a_seed", set.seed],
        ] as const) {
          const loc = gl.getAttribLocation(prog, name);
          if (loc < 0) continue;
          gl.bindBuffer(gl.ARRAY_BUFFER, buf);
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
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

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
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
      const pointer = { x: 0, y: 0, force: 0 };
      const setPointer = (cx: number, cy: number) => {
        const aspect = window.innerWidth / window.innerHeight;
        pointer.x = (cx / window.innerWidth - 0.5) * 2 * aspect;
        pointer.y = -(cy / window.innerHeight - 0.5) * 2;
        pointer.force = 1;
      };
      const onMove = (e: PointerEvent) => setPointer(e.clientX, e.clientY);
      const onLeave = () => {
        pointer.force = 0;
      };
      if (!reduced) {
        window.addEventListener("pointermove", onMove, { passive: true });
        window.addEventListener("pointerdown", onMove, { passive: true });
        window.addEventListener("pointerleave", onLeave, { passive: true });
      }

      /* uniform locations -------------------------------------------------- */
      const uUpd = {
        time: gl.getUniformLocation(updateProg, "u_time"),
        dt: gl.getUniformLocation(updateProg, "u_dt"),
        aspect: gl.getUniformLocation(updateProg, "u_aspect"),
        pointer: gl.getUniformLocation(updateProg, "u_pointer"),
        force: gl.getUniformLocation(updateProg, "u_pointerForce"),
      };
      const uPt = {
        aspect: gl.getUniformLocation(pointProg, "u_aspect"),
        size: gl.getUniformLocation(pointProg, "u_size"),
      };
      const uFade = { decay: gl.getUniformLocation(fadeProg, "u_decay") };
      const uPres = {
        tex: gl.getUniformLocation(presentProg, "u_tex"),
        res: gl.getUniformLocation(presentProg, "u_res"),
        time: gl.getUniformLocation(presentProg, "u_time"),
        aspect: gl.getUniformLocation(presentProg, "u_aspect"),
      };

      /* frame -------------------------------------------------------------- */
      let src = 0;
      let t = 0;
      let last = performance.now();

      const step = (dt: number) => {
        const aspect = W / H;
        t += dt;

        // 1. simulate
        gl.useProgram(updateProg);
        gl.uniform1f(uUpd.time, t);
        gl.uniform1f(uUpd.dt, dt);
        gl.uniform1f(uUpd.aspect, aspect);
        gl.uniform2f(uUpd.pointer, pointer.x, pointer.y);
        gl.uniform1f(uUpd.force, pointer.force);

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

      const loop = (now: number) => {
        if (disposed) return;
        const dt = Math.min((now - last) / 1000, 1 / 20);
        last = now;
        resize();
        pointer.force *= 0.94; // pointer influence decays back to calm
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
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerdown", onMove);
        window.removeEventListener("pointerleave", onLeave);
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
