// Central content for andrewgunn.dev — edit here to update the site.

export const profile = {
  name: "Andrew Gunn",
  role: "Senior Full-Stack Engineer",
  tagline: "Full-Stack Architect · Applied AI Engineer",
  location: "Milwaukee, WI",
  email: "andrewgunn31@gmail.com",
  blurb:
    "Software engineer with 10+ years building large-scale enterprise systems in .NET, React, and cloud-native architectures. I ship production AI — ML-powered analytics, agentic workflows, and AI-driven data pipelines — and I've owned projects end to end, from SQL schema to CI/CD.",
  intro:
    "I've built e-commerce platforms grossing $1M+/year, analytics systems predicting churn across 1,250+ B2B accounts, and integration pipelines wiring together CRM, ERP, commerce, and identity. These days my focus is applied AI at the intersection of systems engineering and intelligent automation.",
  socials: {
    github: "https://github.com/amg262",
    linkedin: "https://www.linkedin.com/in/andrewmgunn",
    wordpress: "https://wordpress.org/plugins/search/andrew+gunn/",
  },
  stats: [
    { value: "10+", label: "Years full-stack" },
    { value: "188", label: "GitHub repos" },
    { value: "108K+", label: "Plugin downloads" },
    { value: "$1M+/yr", label: "Platform revenue shipped" },
  ],
};

export type Experience = {
  company: string;
  role: string;
  period: string;
  location?: string;
  summary?: string;
  points: string[];
};

export const experience: Experience[] = [
  {
    company: "OneDigital",
    role: "Senior Full-Stack Software Engineer",
    period: "Apr 2026 — Present",
    summary:
      "Primary technical owner of the corporate website and digital platforms on the Marketing Technology team at a national benefits, HR, and financial services company.",
    points: [
      "Architect, build, and maintain complex web apps end to end — .NET, C#, React (Redux/Next.js), SQL Server.",
      "Own CI/CD pipelines (GitHub Actions / Azure) for automated deployment.",
      "Drive architectural decisions — framework upgrades, system design — with IT Leadership.",
      "Bridge Marketing and IT: translate business needs into technical solutions and trade-offs.",
    ],
  },
  {
    company: "Crisis Prevention Institute",
    role: "Software Engineer II",
    period: "Nov 2024 — Apr 2026",
    location: "Milwaukee, WI",
    points: [
      "Led full-stack development of an enterprise e-commerce platform (.NET 8, ASP.NET Core, Optimizely CMS/Commerce 14+).",
      "Built \"Orderly\" from scratch — an ML analytics platform with RFM segmentation and churn prediction across 1,250+ B2B accounts.",
      "Migrated payments to PayFabric/Cybersource with multi-currency (US/CA) and fraud detection.",
      "Developed Azure Functions microservices over Service Bus for real-time data sync.",
      "Founded and led a joint Product Development & Engineering committee; contributed to Project Golden Eye (agentic AI for engineers).",
    ],
  },
  {
    company: "Ellsworth Adhesives",
    role: "System Engineer (SaaS)",
    period: "Jan 2023 — Nov 2024",
    summary:
      "Primary tech lead and developer for the marketing department at a global specialty-chemical distributor (21 countries, 20+ facilities).",
    points: [
      "Built back-end solutions in .NET, PHP, Python, and TypeScript for large-scale applications.",
      "Developed AI-powered data pipelines with .NET 8.",
      "Built BFF (Backend-for-Frontend) solutions with React, Vue.js, and Next.js.",
      "Automated data sync across ERP, CRM, PIM, and website; managed Optimizely CMS & Commerce.",
    ],
  },
  {
    company: "Independent Consultant",
    role: "Web & Software Developer",
    period: "Feb 2016 — Jan 2023",
    points: [
      "Sole developer of a medical-book e-commerce platform grossing $1M+/year.",
      "Maintained 10 WordPress.org plugins — 108,000+ lifetime downloads, 8,000 active users.",
      "Engineered high-traffic e-commerce sites; led legacy-to-modern framework transitions.",
      "WordCamp speaker and active WordPress community contributor.",
    ],
  },
  {
    company: "Orion Group",
    role: "Web Developer",
    period: "Jul 2014 — Feb 2016",
    points: [
      "Lead developer of a geographical CMS (GeoCMS) overlaying the Ice Age Trail on Google Maps with user-submitted stories and map pins.",
      "Developed custom WordPress themes and plugins.",
    ],
  },
];

export type Project = {
  name: string;
  description: string;
  tags: string[];
  link?: string;
  highlight?: string;
};

export const projects: Project[] = [
  {
    name: "AuctionNext",
    description:
      "Full microservices auction platform: Next.js + .NET 8, Duende IdentityServer, MassTransit, RabbitMQ, gRPC, SSO, Stripe, Redis, OpenTelemetry, and Grafana — running on Docker and Kubernetes.",
    tags: ["Next.js", ".NET 8", "Microservices", "gRPC", "Kubernetes"],
    link: "https://github.com/amg262/AuctionNext",
    highlight: "18★",
  },
  {
    name: "Orderly",
    description:
      "ML-powered customer analytics platform built from zero: RFM segmentation, churn-prediction models, and real-time BI dashboards across 1,250+ B2B accounts.",
    tags: ["ML", "RFM", "Churn Prediction", ".NET", "Analytics"],
    highlight: "1,250+ accounts",
  },
  {
    name: "DataBridge",
    description:
      ".NET 8 integration platform: automates data retrieval via job scheduler, performs ETL and AI analysis, and connects systems that have no direct integration path.",
    tags: [".NET 8", "ETL", "AI", "Integration"],
  },
  {
    name: "Lattice",
    description:
      "Real-time, self-hosted network monitoring dashboard with a Palantir-style dark UI — live device topology, traffic flows, bandwidth timelines, and protocol distribution.",
    tags: ["Python", "Real-time", "Monitoring", "Dashboards"],
  },
  {
    name: "Ionic OpenAI",
    description:
      "Cross-platform mobile app (Ionic + Vue.js) connecting to OpenAI's API for chat, Q&A, and AI image generation.",
    tags: ["Ionic", "Vue.js", "OpenAI", "Mobile"],
  },
  {
    name: "WordPress Plugins",
    description:
      "Portfolio of 10 plugins on WordPress.org with 108,000+ lifetime downloads, including a WooCommerce Bill of Materials plugin for parts, assemblies, and sub-assemblies.",
    tags: ["WordPress", "WooCommerce", "PHP", "OSS"],
    link: "https://wordpress.org/plugins/search/andrew+gunn/",
    highlight: "108K+ downloads",
  },
];

export const skills: { group: string; items: string[] }[] = [
  { group: "Languages", items: ["C#", "TypeScript", "JavaScript", "SQL", "Python", "PHP"] },
  { group: "Backend", items: [".NET 8/9", "ASP.NET Core", "Minimal APIs", "EF Core", "MassTransit", "xUnit"] },
  { group: "Frontend", items: ["React 18", "Next.js", "Redux", "Vue.js", "Tailwind CSS", "Node.js"] },
  { group: "Cloud & DevOps", items: ["Azure", "AWS", "Docker", "Kubernetes", "GitHub Actions"] },
  { group: "Data", items: ["SQL Server", "PostgreSQL", "MongoDB", "Redis", "RabbitMQ"] },
  { group: "AI / ML", items: ["OpenAI API", "Claude Code", "Agentic Workflows", "ML Analytics"] },
  { group: "CMS & Commerce", items: ["Optimizely CMS & Commerce 14+", "WordPress"] },
  { group: "Architecture", items: ["Microservices", "Vertical Slice", "Event-Driven", "DDD", "TDD", "BFF"] },
];

export const education = {
  school: "Waukesha County Technical College",
  program: "Web & Software Development",
  detail: "GPA 3.80 · Phi Theta Kappa · Machine Learning Lab · Dr. Richard T. Anderson Scholarship",
};
