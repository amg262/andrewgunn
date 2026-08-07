"use client";

/**
 * Magnetic links.
 *
 * Each chip leans toward the cursor as it comes within reach, lifts out of the
 * page toward it, turns to face it, and carries a gold spotlight that tracks
 * the cursor across its own surface. The lean is a spring toward a target
 * offset rather than a direct mapping, so a fast pass leaves them swaying
 * instead of snapping. The lift and the turn are real 3D — the chips are in the
 * same perspective as the rest of the column — so a chip under the cursor is
 * measurably nearer to you than the one beside it.
 *
 * The base centre is recovered each frame by subtracting the offset currently
 * applied — cheaper and more honest than caching a measurement that the
 * parallax quietly invalidates.
 */

import { useEffect, useRef } from "react";
import { attachPointer, pointer } from "@/lib/pointer";
import { GitHubIcon, LinkedInIcon, MailIcon, ArrowIcon } from "@/components/Icons";
import { profile } from "@/lib/data";

const REACH = 105; // px at which a chip starts to notice the cursor
const PULL = 0.3; // fraction of the gap it will close at most

const links = [
  { href: profile.links.amarna, label: "Amarna", icon: ArrowIcon, external: true },
  { href: profile.links.github, label: "GitHub", icon: GitHubIcon, external: true },
  { href: profile.links.linkedin, label: "LinkedIn", icon: LinkedInIcon, external: true },
  { href: `mailto:${profile.email}`, label: "Email", icon: MailIcon, external: false },
];

export default function Links({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const host = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = host.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const detach = attachPointer();
    const chips = Array.from(root.querySelectorAll<HTMLElement>("a"));
    const offsets = chips.map(() => ({ x: 0, y: 0 }));

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      const k = 1 - Math.exp(-dt * 12);

      // Every box measured before anything is written: interleaving the two
      // makes the browser re-run layout once per chip.
      const rects = chips.map((c) => c.getBoundingClientRect());

      for (let i = 0; i < chips.length; i++) {
        const el = chips[i];
        const off = offsets[i];
        const r = rects[i];

        // Undo the offset we applied to recover where the chip actually lives.
        const cx = r.left + r.width / 2 - off.x;
        const cy = r.top + r.height / 2 - off.y;
        const dx = pointer.sx - cx;
        const dy = pointer.sy - cy;
        const dist = Math.hypot(dx, dy);
        // Gated on presence, not on `force` — force decays while the cursor
        // rests, and a chip that quietly lets go of a stationary cursor reads
        // as broken.
        const grip = Math.max(0, 1 - dist / REACH) ** 1.6 * pointer.inside;

        off.x += (dx * PULL * grip - off.x) * k;
        off.y += (dy * PULL * grip - off.y) * k;

        // Turn to face the cursor, normalised by the chip's own size so a wide
        // chip and a narrow one lean by the same amount at the same offset.
        const ry = Math.max(-1, Math.min(1, dx / (r.width * 0.7))) * 15 * grip;
        const rx = -Math.max(-1, Math.min(1, dy / (r.height * 1.3))) * 13 * grip;

        el.style.transform =
          `translate3d(${off.x.toFixed(2)}px, ${off.y.toFixed(2)}px, ${(grip * 34).toFixed(2)}px)` +
          ` rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
        el.style.setProperty("--cx", `${(pointer.sx - r.left).toFixed(1)}px`);
        el.style.setProperty("--cy", `${(pointer.sy - r.top).toFixed(1)}px`);
        el.style.setProperty("--near", grip.toFixed(3));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      for (const el of chips) {
        el.style.transform = "";
        el.style.removeProperty("--near");
      }
      detach();
    };
  }, []);

  return (
    <nav ref={host} className={className} style={style} aria-label="Elsewhere">
      {links.map(({ href, label, icon: Icon, external }) => (
        <a
          key={label}
          href={href}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
          className="chip group"
        >
          <Icon className="h-3.5 w-3.5 opacity-70 transition-opacity group-hover:opacity-100" />
          {label}
        </a>
      ))}
    </nav>
  );
}
