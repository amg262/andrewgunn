import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { profile } from "@/lib/data";

const url = "https://andrewgunn.dev";
const title = `${profile.name} — ${profile.role}`;

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title,
  description: profile.bio,
  keywords: [
    "Andrew Gunn",
    "Amarna",
    "Amarna LLC",
    "Full-Stack Engineer",
    "Applied AI",
    ".NET",
    "C#",
    "React",
    "Next.js",
    "Azure",
  ],
  authors: [{ name: profile.name, url }],
  creator: profile.name,
  alternates: { canonical: url },
  openGraph: {
    type: "website",
    url,
    title,
    description: profile.bio,
    siteName: profile.name,
  },
  twitter: { card: "summary_large_image", title, description: profile.bio },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#05050a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    jobTitle: profile.role,
    description: profile.bio,
    email: `mailto:${profile.email}`,
    url,
    address: { "@type": "PostalAddress", addressLocality: profile.location },
    worksFor: {
      "@type": "Organization",
      name: "Amarna LLC",
      url: profile.links.amarna,
    },
    founder: { "@type": "Organization", name: "Amarna LLC" },
    sameAs: [profile.links.github, profile.links.linkedin, profile.links.amarna],
  };

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
