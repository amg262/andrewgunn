# andrewgunn.dev

Personal site for Andrew Gunn — Senior Full-Stack Engineer.

Built with **Next.js 15** (App Router), **React 19**, **TypeScript**, and **Tailwind CSS v4**. Minimal dark, dev-focused theme. Deployed on **Vercel**.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

## Editing content

All site content lives in one file: [`lib/data.ts`](lib/data.ts). Update the
`profile`, `experience`, `projects`, `skills`, and `education` exports there — no
component changes needed.

## Structure

```
app/
  layout.tsx     # metadata, fonts, JSON-LD
  page.tsx       # section composition
  globals.css    # theme tokens + Tailwind
  icon.svg       # favicon
components/       # Nav, Hero, About, Experience, Projects, Skills, Contact, Footer
lib/data.ts       # single source of content
```

## Deploy

Push to `main` — Vercel builds and deploys automatically. No env vars required.
