import Section from "./Section";
import { skills } from "@/lib/data";

export default function Skills() {
  return (
    <Section id="skills" index="03" title="Skills & Stack">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {skills.map((group) => (
          <div
            key={group.group}
            className="rounded-lg border border-border bg-panel p-5"
          >
            <h3 className="font-mono text-xs uppercase tracking-wider text-accent">
              {group.group}
            </h3>
            <ul className="mt-3 space-y-2">
              {group.items.map((item) => (
                <li key={item} className="text-sm text-muted">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
