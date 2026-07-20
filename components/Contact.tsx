import Section from "./Section";
import { profile } from "@/lib/data";
import { GitHubIcon, LinkedInIcon, MailIcon, ArrowIcon } from "./Icons";

export default function Contact() {
  return (
    <Section id="contact" index="04" title="Get in touch">
      <div className="rounded-xl border border-border bg-panel p-8 md:p-12">
        <p className="max-w-2xl text-base leading-relaxed text-muted md:text-lg">
          {profile.intro} Whether it&apos;s enterprise .NET, applied AI, or a
          product build from zero — if it&apos;s interesting, I want to hear
          about it.
        </p>

        <a
          href={`mailto:${profile.email}`}
          className="group mt-8 inline-flex items-center gap-3 rounded-md border border-accent/40 bg-accent/10 px-6 py-3 font-mono text-sm text-accent transition-colors hover:bg-accent/20"
        >
          <MailIcon className="h-4 w-4" />
          {profile.email}
          <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>

        <div className="mt-8 flex items-center gap-5">
          <a href={profile.socials.github} target="_blank" rel="noreferrer" aria-label="GitHub" className="text-muted transition-colors hover:text-text">
            <GitHubIcon className="h-5 w-5" />
          </a>
          <a href={profile.socials.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn" className="text-muted transition-colors hover:text-text">
            <LinkedInIcon className="h-5 w-5" />
          </a>
          <a href={profile.socials.wordpress} target="_blank" rel="noreferrer" className="font-mono text-xs text-muted transition-colors hover:text-text">
            WordPress.org →
          </a>
        </div>
      </div>
    </Section>
  );
}
