# Landing Page UI/UX Improvement — Design Doc

**Date:** 2026-02-22
**Status:** Approved

## Goal

Add four new content sections to the landing page to improve depth, trust, and conversion — while preserving the existing hero, features grid, stats strip, CTA, and footer.

## Page Structure (after changes)

```
Header
Hero
→ How it Works       [NEW]
→ Product Mockup     [NEW]
Features grid
→ Testimonials       [NEW]
Stats strip
→ Pricing Teaser     [NEW]
CTA
Footer
```

## Design Principles

- **Aesthetic**: Refined editorial — Geist Sans, indigo accent, warm neutral background
- **Typography scale**: 4 levels — display, section heading, card title, body. No orphan sizes.
- **Spacing**: Section padding `py-24`, inner content `max-w-5xl mx-auto px-6` (consistent with existing)
- **Color**: Use existing CSS variables (`--primary`, `--muted`, `--border`, etc.) — no new colors introduced
- **Accessibility**: WCAG AA contrast on all text; semantic HTML (`<section>`, `<h2>`, `<ol>`, etc.)

## Animation Spec

- **Trigger**: IntersectionObserver — fire once when element enters viewport (threshold: 0.15)
- **Effect**: `opacity: 0 → 1` + `translateY(16px) → translateY(0)`
- **Easing**: `cubic-bezier(0.16, 1, 0.3, 1)` (snappy ease-out)
- **Duration**: 500ms
- **Stagger**: Grid children delayed 100ms apart (0ms, 100ms, 200ms, ...)
- **Hover on cards**: border color lift + `box-shadow` subtle grow, 200ms ease-out
- No parallax, no looping animations, no reduced-motion violations (respect `prefers-reduced-motion`)

## Section Specs

### How it Works
- 3 steps in a horizontal row (mobile: vertical stack)
- Each step: large decorative step number (very low contrast, background role), icon, bold title, one-line description
- Hairline connector/arrow between steps (hidden on mobile)
- Scroll entry: stagger left-to-right (0ms, 120ms, 240ms)

### Product Mockup
- Browser chrome wrapper (simplified: gray bar with 3 colored dots + URL bar)
- Coded dashboard inside: review cycle progress bar, 3-column competency score grid with colored bars, small sidebar nav items
- Radial glow behind the frame (primary color, very low opacity)
- Full section width up to `max-w-4xl`, centered
- Scroll entry: single fade-in + scale from 0.97 → 1

### Testimonials
- 3 cards in a responsive grid (1 col mobile, 3 col desktop)
- Each card: large opening quote mark in primary color, quote text, avatar initial circle + name + role/company
- Faint border, hover: border brightens + shadow lifts
- Scroll entry: stagger (0ms, 100ms, 200ms)

### Pricing Teaser
- 2 panels: Free (muted background) and Pro (card with subtle primary border highlight)
- Each: tier name, price/label, 3–4 bullet points, action link
- "View full pricing →" link on Pro panel
- Not a full pricing page — teaser only, drives to `/pricing`
- Scroll entry: two panels fade in with 100ms stagger

## Implementation Notes

- All new sections are self-contained JSX blocks within `src/app/page.tsx`
- Animation uses a small inline `useEffect` + `IntersectionObserver` hook, or a shared `useScrollReveal` utility in `src/hooks/use-scroll-reveal.ts`
- Coded mockup uses only Tailwind classes — no external image assets
- Testimonials use placeholder quotes (realistic, not obviously fake)
