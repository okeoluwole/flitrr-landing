# FLITRR Landing Page

Next.js 14 landing page for FLITRR — an AI-powered programme management platform for Nigerian SME real estate developers.

## Quick start

```bash
cd flitrr-landing
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Stack

- Next.js 14 (App Router)
- JavaScript (no TypeScript)
- CSS Modules (no external UI libraries)
- Google Fonts: Playfair Display + Plus Jakarta Sans

## Structure

```
app/
  layout.js        — root layout, font setup, metadata
  page.js          — all seven sections as React components
  page.module.css  — scoped styles
  globals.css      — design tokens, resets, shared utilities
```

## Sections

1. Navigation — sticky, responsive with hamburger
2. Hero — headline, subheadline, CTAs
3. Problem — three-card grid
4. Solution — two feature blocks
5. Credibility — founder bio + stats card
6. Pilot Signup — email form with client-side validation
7. Footer — dark, with contact links
