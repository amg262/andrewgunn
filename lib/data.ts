// Single source of content for andrewgunn.dev — a one-screen site.
// The page is one viewport: this copy plus the Aten field behind it.

export const profile = {
  name: "Andrew Gunn",
  role: "Full-Stack Architect · Applied AI Engineer",
  founder: "Founder, Amarna LLC",
  location: "Milwaukee, WI",
  email: "andrewgunn31@gmail.com",

  // Keep this to a few sentences. There is no second screen to spill into.
  bio: "Ten years building large-scale systems in .NET, React, and cloud-native architecture — and shipping production AI: ML analytics, agentic workflows, AI-driven data pipelines. I founded Amarna, an engineering studio building AI-native software.",

  links: {
    amarna: "https://www.amarna.dev",
    github: "https://github.com/amg262",
    linkedin: "https://www.linkedin.com/in/andrewmgunn",
  },

  stats: [
    { value: "10+", label: "Years full-stack" },
    { value: "$1M+", label: "Revenue shipped" },
    { value: "108K+", label: "Plugin downloads" },
    { value: "1,250+", label: "Accounts scored" },
  ],
} as const;

// Why the page looks like this. Amarna — Akhet-Aten — was the capital Akhenaten
// raised from empty desert to worship the Aten, the sun disc: the light itself.
// The ring is the Aten. The field orbiting it is the work.
export const motif = {
  caption: "Akhet-Aten · the horizon of the disc",
  hint: "Move to disturb the field",
} as const;
