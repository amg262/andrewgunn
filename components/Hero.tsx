import { profile } from "@/lib/data";
import { GitHubIcon, LinkedInIcon, MailIcon, ArrowIcon } from "./Icons";

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-36 md:pb-24 md:pt-44">
        <p className="reveal font-mono text-sm text-accent">
          Hi, my name is
        </p>

        <h1 className="reveal mt-4 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl" style={{ animationDelay: "60ms" }}>
          {profile.name}
        </h1>

        <p className="reveal mt-3 text-xl font-medium text-muted sm:text-2xl md:text-3xl" style={{ animationDelay: "120ms" }}>
          {profile.role} · <span className="text-text">{profile.tagline}</span>
        </p>

        <p className="reveal mt-8 max-w-2xl text-base leading-relaxed text-muted md:text-lg" style={{ animationDelay: "180ms" }}>
          {profile.blurb}
        </p>

        <div className="reveal mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: "240ms" }}>
          <a
            href="#projects"
            className="group inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-5 py-2.5 font-mono text-sm text-accent transition-colors hover:bg-accent/20"
          >
            View work
            <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
          <a
            href={`mailto:${profile.email}`}
            className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 font-mono text-sm text-muted transition-colors hover:border-muted hover:text-text"
          >
            <MailIcon className="h-4 w-4" />
            Get in touch
          </a>
        </div>

        <div className="reveal mt-8 flex items-center gap-5" style={{ animationDelay: "300ms" }}>
          <a href={profile.socials.github} target="_blank" rel="noreferrer" aria-label="GitHub" className="text-muted transition-colors hover:text-text">
            <GitHubIcon className="h-5 w-5" />
          </a>
          <a href={profile.socials.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn" className="text-muted transition-colors hover:text-text">
            <LinkedInIcon className="h-5 w-5" />
          </a>
          <span className="font-mono text-xs text-muted">{profile.location}</span>
        </div>

        <dl className="reveal mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4" style={{ animationDelay: "360ms" }}>
          {profile.stats.map((s) => (
            <div key={s.label} className="bg-panel px-5 py-5">
              <dt className="font-mono text-2xl font-semibold text-text">{s.value}</dt>
              <dd className="mt-1 text-xs text-muted">{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
