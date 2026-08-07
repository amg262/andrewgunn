// Single source of content for andrewgunn.dev — a one-screen site.
// The page is one viewport: this copy plus the Aten field behind it.

export const profile = {
  name: "Andrew Gunn",
  role: "Full-Stack Architect · Applied AI Engineer",
  founder: "Founder, Amarna LLC",
  location: "Milwaukee, WI",
  email: "andrewgunn31@gmail.com",

  // Two sentences. The credentials, then the part that should sit uneasily.
  bio: "Ten years of large-scale .NET and cloud architecture, now spent building things that decide on their own. Amarna puts agentic systems into production — scoring, routing, acting, with nobody in the loop.",

  links: {
    amarna: "https://www.amarna.dev",
    github: "https://github.com/amg262",
    linkedin: "https://www.linkedin.com/in/andrewmgunn",
  },

  // `to` is the number the odometer counts up to on load; prefix/suffix wrap it.
  // Split rather than stored as a string so the count-up lands on exactly the
  // figure that server-renders — the no-JS page and the settled page agree.
  stats: [
    { to: 10, suffix: "+", label: "Years full-stack" },
    { to: 1, prefix: "$", suffix: "M+", label: "Revenue shipped" },
    { to: 150, suffix: "K+", label: "Plugin downloads" },
    { to: 1250, suffix: "+", label: "Accounts scored" },
  ],
} as const;

export type Stat = (typeof profile.stats)[number];

/** The settled label for a stat — also the string rendered on the server. */
export const statText = (s: Stat, value: number = s.to) =>
  `${"prefix" in s ? s.prefix : ""}${Math.round(value).toLocaleString("en-US")}${
    "suffix" in s ? s.suffix : ""
  }`;

// Why the page looks like this. Amarna — Akhet-Aten — was a capital raised out
// of empty desert in about four years to serve a single new god, the Aten: the
// sun disc, the light itself. It was abandoned within a generation and its
// king was chiselled out of the record. The ring is the disc. The field
// orbiting it is the work. The rays reach for whoever is standing in front of
// it, which in the reliefs is the pharaoh and here is you.
export const motif = {
  caption: "Akhet-Aten · the horizon of the disc",
  hint: "Move · hold · release · scroll",

  // Cycled one at a time under the caption. Half of these are about 1346 BCE
  // and half are about now; the point is that you cannot tell which is which.
  transmissions: [
    "A capital raised from empty desert in four years.",
    "One god. One disc. Every older name struck from the stone.",
    "Abandoned in a generation. Chiselled out of the king lists.",
    "The models are already deciding. The loop is already closed.",
    "Nobody agreed to this. It shipped anyway.",
    "Build fast, worship the new light, audit the cost never.",
    "The disc does not ask. It reaches.",
  ],
} as const;
