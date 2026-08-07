import Aten from "@/components/Aten";
import { GitHubIcon, LinkedInIcon, MailIcon, ArrowIcon } from "@/components/Icons";
import { profile, motif } from "@/lib/data";

const links = [
  { href: profile.links.amarna, label: "Amarna", icon: ArrowIcon, external: true },
  { href: profile.links.github, label: "GitHub", icon: GitHubIcon, external: true },
  { href: profile.links.linkedin, label: "LinkedIn", icon: LinkedInIcon, external: true },
  { href: `mailto:${profile.email}`, label: "Email", icon: MailIcon, external: false },
];

export default function Home() {
  return (
    <main className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 py-10">
      {/* Painted before any JS runs — the page still reads as designed with the
          canvas absent (no WebGL2, lost context, or JS off). */}
      <div className="static-field" aria-hidden />

      <Aten />

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center">
        <p className="rise flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[0.68rem] uppercase tracking-[0.22em] text-muted">
          <span className="text-gold">{profile.founder}</span>
          <span aria-hidden className="text-border">/</span>
          <span>{profile.location}</span>
        </p>

        <h1
          className="rise mt-5 text-[clamp(2.5rem,10vw,4.9rem)] font-semibold leading-[0.95] tracking-[-0.045em] text-glow"
          style={{ animationDelay: "80ms" }}
        >
          {profile.name}
        </h1>

        <p
          className="rise mt-4 font-mono text-[0.8rem] tracking-[0.05em] text-text/85 sm:text-sm"
          style={{ animationDelay: "160ms" }}
        >
          {profile.role}
        </p>

        <p
          className="rise mt-7 max-w-[46ch] text-[0.95rem] leading-relaxed text-muted sm:text-base"
          style={{ animationDelay: "240ms" }}
        >
          {profile.bio}
        </p>

        <nav
          className="rise mt-9 flex flex-wrap items-center justify-center gap-2.5"
          style={{ animationDelay: "320ms" }}
          aria-label="Elsewhere"
        >
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

        <dl
          className="rise mt-9 grid w-full max-w-lg grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4"
          style={{ animationDelay: "400ms" }}
        >
          {profile.stats.map((s) => (
            <div key={s.label}>
              <dt className="font-mono text-base font-medium tracking-tight text-text sm:text-lg">
                {s.value}
              </dt>
              <dd className="mt-0.5 text-[0.6rem] uppercase leading-tight tracking-[0.1em] text-muted">
                {s.label}
              </dd>
            </div>
          ))}
        </dl>

        {/* Kept inside the darkened disc rather than pinned to the viewport
            floor — at the bottom of the screen it sat on the brightest part of
            the field and became unreadable. */}
        <p
          className="rise mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[0.58rem] uppercase tracking-[0.26em] text-muted/55"
          style={{ animationDelay: "480ms" }}
        >
          <span>{motif.caption}</span>
          <span aria-hidden className="hide-reduced text-border">
            ·
          </span>
          <span className="hide-reduced text-muted/35">{motif.hint}</span>
        </p>
      </div>
    </main>
  );
}
