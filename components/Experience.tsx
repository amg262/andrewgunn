import Section from "./Section";
import { experience, education } from "@/lib/data";

export default function Experience() {
  return (
    <Section id="experience" index="01" title="Experience">
      <ol className="relative border-l border-border pl-6 md:pl-8">
        {experience.map((job) => (
          <li key={job.company + job.period} className="relative pb-12 last:pb-0">
            <span className="absolute -left-[6.5px] top-1.5 h-3 w-3 rounded-full border-2 border-accent bg-bg" />
            <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between">
              <h3 className="text-lg font-semibold text-text">
                {job.role}{" "}
                <span className="text-accent">· {job.company}</span>
              </h3>
              <span className="font-mono text-xs text-muted">{job.period}</span>
            </div>
            {job.location && (
              <p className="mt-0.5 font-mono text-xs text-muted">{job.location}</p>
            )}
            {job.summary && (
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">{job.summary}</p>
            )}
            <ul className="mt-3 space-y-2">
              {job.points.map((p, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent/70" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <div className="mt-4 rounded-lg border border-border bg-panel px-5 py-5">
        <p className="font-mono text-xs uppercase tracking-wider text-accent">Education</p>
        <h3 className="mt-2 text-base font-semibold text-text">
          {education.school} <span className="text-muted">— {education.program}</span>
        </h3>
        <p className="mt-1 text-sm text-muted">{education.detail}</p>
      </div>
    </Section>
  );
}
