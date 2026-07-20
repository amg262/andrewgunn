import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { profile } from "@/lib/data";

const url = "https://andrewgunn.dev";
const description = profile.blurb;

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: `${profile.name} — ${profile.role}`,
  description,
  keywords: [
    "Andrew Gunn",
    "Full-Stack Engineer",
    ".NET",
    "C#",
    "React",
    "Next.js",
    "Applied AI",
    "Optimizely",
    "Azure",
  ],
  authors: [{ name: profile.name, url }],
  alternates: { canonical: url },
  openGraph: {
    type: "website",
    url,
    title: `${profile.name} — ${profile.role}`,
    description,
    siteName: profile.name,
  },
  twitter: {
    card: "summary_large_image",
    title: `${profile.name} — ${profile.role}`,
    description,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    jobTitle: profile.role,
    email: `mailto:${profile.email}`,
    url,
    address: { "@type": "PostalAddress", addressLocality: profile.location },
    sameAs: [profile.socials.github, profile.socials.linkedin],
  };

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
