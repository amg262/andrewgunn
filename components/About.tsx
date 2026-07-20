import Section from "./Section";
import { profile } from "@/lib/data";

const focus = [
  "Enterprise CMS & Commerce — Optimizely CMS/Commerce 14+ on .NET",
  "Applied AI & ML — RFM segmentation, churn models, agentic workflows",
  "Multi-system integration — CRM, ERP, PIM, identity, payments",
  "Full-stack architecture — DB schema to CI/CD, BFF & vertical slice",
];

export default function About() {
  return (
    <Section id="about" index="00" title="About">
      <div className="grid gap-8 md:grid-cols-5">
        <div className="md:col-span-3">
          <p className="text-base leading-relaxed text-muted md:text-lg">
            {profile.intro}
          </p>
          <p className="mt-4 text-base leading-relaxed text-muted md:text-lg">
            I&apos;ve run an independent consulting practice for seven years, led
            enterprise e-commerce teams, and shipped open source with six figures
            of downloads. My edge is breadth with production depth — I can own an
            entire project, and I go deep where it counts.
          </p>
        </div>
        <div className="md:col-span-2">
          <p className="font-mono text-xs uppercase tracking-wider text-accent">
            What I focus on
          </p>
          <ul className="mt-4 space-y-3">
            {focus.map((f) => (
              <li key={f} className="flex gap-3 text-sm leading-relaxed text-muted">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent/70" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
