import Aten from "@/components/Aten";
import Headline from "@/components/Headline";
import Links from "@/components/Links";
import Reticle from "@/components/Reticle";
import Stats from "@/components/Stats";
import Transmission from "@/components/Transmission";
import { profile, motif } from "@/lib/data";

// Every line stands at its own distance from the eye. The column is one rigid
// plate in a real perspective — it leans with the disc behind it, on the same
// camera — and --depth is how far out of that plate each line is pushed, so the
// name is the plane closest to you and the footnote is the furthest back.
const layer = (depth: number, delay: number) =>
  ({ "--depth": depth, animationDelay: `${delay}ms` }) as React.CSSProperties;

export default function Home() {
  return (
    <main className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 py-10">
      {/* Painted before any JS runs — the page still reads as designed with the
          canvas absent (no WebGL2, lost context, or JS off). */}
      <div className="static-field" aria-hidden />

      <Aten />
      <Reticle />

      <div className="stage relative z-10 w-full max-w-2xl">
        <div className="entrance">
          <div className="deck flex flex-col items-center text-center">
            <p
              className="rise par flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[0.68rem] uppercase tracking-[0.22em] text-muted"
              style={layer(0.3, 0)}
            >
              <span className="text-gold">{profile.founder}</span>
              <span aria-hidden className="text-border">
                /
              </span>
              <span>{profile.location}</span>
            </p>

            <Headline
              text={profile.name}
              className="rise par mt-5 text-[clamp(2.5rem,10vw,4.9rem)] font-semibold leading-[0.95] tracking-[-0.045em]"
              style={layer(1.5, 80)}
            />

            <p
              className="rise par mt-4 font-mono text-[0.8rem] tracking-[0.05em] text-text/85 sm:text-sm"
              style={layer(1, 160)}
            >
              {profile.role}
            </p>

            <p
              className="rise par selectable mt-7 max-w-[44ch] text-[0.95rem] leading-relaxed text-muted sm:text-base"
              style={layer(0.7, 240)}
            >
              {profile.bio}
            </p>

            <Links
              className="rise par mt-9 flex flex-wrap items-center justify-center gap-2.5"
              style={layer(0.5, 320)}
            />

            <Stats
              className="rise par mt-9 grid w-full max-w-lg grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4"
              style={layer(0.35, 400)}
            />

            {/* Kept inside the darkened disc rather than pinned to the viewport
                floor — at the bottom of the screen it sat on the brightest part
                of the field and became unreadable. */}
            <div
              className="rise par mt-10 flex flex-col items-center gap-1.5"
              style={layer(0.2, 480)}
            >
              <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[0.58rem] uppercase tracking-[0.26em] text-muted/55">
                <span>{motif.caption}</span>
                <span aria-hidden className="hide-reduced text-border">
                  ·
                </span>
                <span className="hide-reduced text-muted/35">{motif.hint}</span>
              </p>
              <Transmission
                lines={motif.transmissions}
                className="transmission font-mono text-[0.58rem] tracking-[0.14em] text-muted/40"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
