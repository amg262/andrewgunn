import Section from "./Section";
import { projects } from "@/lib/data";
import { ArrowIcon, GitHubIcon } from "./Icons";

export default function Projects() {
  return (
    <Section id="projects" index="02" title="Projects">
      <div className="grid gap-4 sm:grid-cols-2">
        {projects.map((p) => {
          const isLink = Boolean(p.link);
          const Wrapper = isLink ? "a" : "div";
          return (
            <Wrapper
              key={p.name}
              {...(isLink
                ? { href: p.link, target: "_blank", rel: "noreferrer" }
                : {})}
              className={`group flex flex-col rounded-lg border border-border bg-panel p-5 transition-colors ${
                isLink ? "hover:border-accent/40" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-text">{p.name}</h3>
                <div className="flex items-center gap-2">
                  {p.highlight && (
                    <span className="whitespace-nowrap font-mono text-xs text-accent">
                      {p.highlight}
                    </span>
                  )}
                  {isLink && (
                    <ArrowIcon className="h-4 w-4 text-muted transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent" />
                  )}
                </div>
              </div>

              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">
                {p.description}
              </p>

              <ul className="mt-4 flex flex-wrap gap-2">
                {p.tags.map((t) => (
                  <li
                    key={t}
                    className="rounded border border-border px-2 py-0.5 font-mono text-[11px] text-muted"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </Wrapper>
          );
        })}
      </div>

      <a
        href="https://github.com/amg262"
        target="_blank"
        rel="noreferrer"
        className="mt-6 inline-flex items-center gap-2 font-mono text-sm text-muted transition-colors hover:text-text"
      >
        <GitHubIcon className="h-4 w-4" />
        See all 188 repos on GitHub
        <ArrowIcon className="h-3.5 w-3.5" />
      </a>
    </Section>
  );
}
