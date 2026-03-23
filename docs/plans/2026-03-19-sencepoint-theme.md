# Sence.Point Theme Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Re-theme the app (landing page + dashboard) to match the Sence.Point design system — Manrope font, purple/lavender palette, deep navy dark sections, larger border radii. No functional changes.

**Architecture:** All changes are confined to CSS variables in `globals.css`, the font import in `layout.tsx`, and hardcoded Tailwind colour classes in `page.tsx`. The shadcn/ui component system reads tokens from CSS variables, so updating the tokens propagates everywhere automatically.

**Tech Stack:** Next.js, Tailwind CSS v4, Google Fonts (Manrope), shadcn/ui

---

### Task 1: Swap font from Inter to Manrope

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: Update the font import and variable**

Replace the `Inter` import with `Manrope` and update the variable name to keep things clean. Open `src/app/layout.tsx` and make these exact changes:

```tsx
// BEFORE
import { Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
```

```tsx
// AFTER
import { Manrope } from "next/font/google";
import { Geist_Mono } from "next/font/google";

const manrope = Manrope({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
```

Also update the body className:
```tsx
// BEFORE
className={`${inter.variable} ${geistMono.variable} font-sans antialiased`}

// AFTER
className={`${manrope.variable} ${geistMono.variable} font-sans antialiased`}
```

**Step 2: Start dev server and verify font loads**

```bash
cd "/Users/filipnowakowski/Test - Slack/feedback-app" && npm run dev
```

Open the app in browser. Text should now render in Manrope (rounder, more geometric than Inter).

**Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: swap Inter for Manrope font (Sence.Point theme)"
```

---

### Task 2: Update CSS variables — light mode palette

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Replace the `:root` block**

Find the `:root { ... }` block (lines 49–84) and replace it entirely with:

```css
:root {
  --radius: 1rem;
  /* Sence.Point: lavender background, purple accent, deep navy text */
  --background: oklch(0.945 0.018 270);
  --foreground: oklch(0.09 0.055 285);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.09 0.055 285);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.09 0.055 285);
  --primary: oklch(0.60 0.22 310);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.58 0.16 265);
  --secondary-foreground: oklch(1 0 0);
  --muted: oklch(0.930 0.022 270);
  --muted-foreground: oklch(0.45 0.04 270);
  --accent: oklch(0.920 0.030 270);
  --accent-foreground: oklch(0.09 0.055 285);
  --destructive: oklch(0.545 0.235 22);
  --border: oklch(0.870 0.030 270);
  --input: oklch(0.870 0.030 270);
  --ring: oklch(0.60 0.22 310);
  --chart-1: oklch(0.60 0.22 310);
  --chart-2: oklch(0.58 0.16 265);
  --chart-3: oklch(0.70 0.15 200);
  --chart-4: oklch(0.72 0.13 150);
  --chart-5: oklch(0.65 0.18 340);
  /* Sidebar */
  --sidebar: oklch(0.970 0.012 270);
  --sidebar-foreground: oklch(0.09 0.055 285);
  --sidebar-primary: oklch(0.60 0.22 310);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.920 0.030 270);
  --sidebar-accent-foreground: oklch(0.09 0.055 285);
  --sidebar-border: oklch(0.870 0.030 270);
  --sidebar-ring: oklch(0.60 0.22 310);
}
```

**Key conversions (for reference):**
- Lavender background `#ECEEF8` ≈ `oklch(0.945 0.018 270)`
- Deep navy `#0D0425` ≈ `oklch(0.09 0.055 285)`
- Purple `#C645F9` ≈ `oklch(0.60 0.22 310)`
- Blue-purple `#5E6CE7` ≈ `oklch(0.58 0.16 265)`
- Light lavender border `#D8DCEF` ≈ `oklch(0.870 0.030 270)`
- Sidebar `#F5F5FD` ≈ `oklch(0.970 0.012 270)`

**Step 2: Verify in browser**

The landing page light sections and dashboard should now show a lavender background, purple buttons, and deep navy text.

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: update light-mode CSS variables to Sence.Point palette"
```

---

### Task 3: Update CSS variables — dark mode palette

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Replace the `.dark { ... }` block**

Find the `.dark { ... }` block (lines 86–118) and replace it entirely:

```css
.dark {
  --background: oklch(0.10 0.055 285);
  --foreground: oklch(0.93 0.012 270);
  --card: oklch(0.14 0.050 285);
  --card-foreground: oklch(0.93 0.012 270);
  --popover: oklch(0.14 0.050 285);
  --popover-foreground: oklch(0.93 0.012 270);
  --primary: oklch(0.68 0.22 310);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.65 0.16 265);
  --secondary-foreground: oklch(1 0 0);
  --muted: oklch(0.18 0.045 285);
  --muted-foreground: oklch(0.62 0.040 270);
  --accent: oklch(0.20 0.050 285);
  --accent-foreground: oklch(0.93 0.012 270);
  --destructive: oklch(0.68 0.195 22);
  --border: oklch(0.22 0.050 285);
  --input: oklch(0.18 0.045 285);
  --ring: oklch(0.68 0.22 310);
  --chart-1: oklch(0.68 0.22 310);
  --chart-2: oklch(0.65 0.16 265);
  --chart-3: oklch(0.70 0.14 200);
  --chart-4: oklch(0.72 0.13 150);
  --chart-5: oklch(0.65 0.18 340);
  --sidebar: oklch(0.10 0.055 285);
  --sidebar-foreground: oklch(0.85 0.012 270);
  --sidebar-primary: oklch(0.68 0.22 310);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.20 0.050 285);
  --sidebar-accent-foreground: oklch(0.85 0.012 270);
  --sidebar-border: oklch(0.22 0.050 285);
  --sidebar-ring: oklch(0.68 0.22 310);
}
```

**Step 2: Verify dark mode (if used)**

Toggle dark mode in browser devtools (`document.documentElement.classList.add('dark')`). Colors should shift to a purple-navy dark theme.

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: update dark-mode CSS variables to purple-navy Sence.Point palette"
```

---

### Task 4: Update hardcoded dark-bg colours in landing page

**Files:**
- Modify: `src/app/page.tsx`

The landing page has multiple hardcoded `oklch(...)` values for dark sections. These need updating to `#0D0425` navy variants to match Sence.Point.

**Step 1: Replace each hardcoded colour class**

Make these substitutions throughout `src/app/page.tsx`:

| Find | Replace |
|---|---|
| `bg-[oklch(0.11_0.014_30)]` | `bg-[#0D0425]` |
| `bg-[oklch(0.13_0.014_30)]` | `bg-[#0f0530]` |
| `bg-[oklch(0.16_0.016_30)]` | `bg-[#160838]` |
| `bg-[oklch(0.17_0.016_30)]` | `bg-[#18093c]` |
| `bg-[oklch(0.25_0.02_280)]` | `bg-[#1e1050]` |

Use find-and-replace (these are exact strings). There are roughly 8–10 occurrences total.

Also update the opacity/alpha variants that reference the same base:
- `bg-[oklch(0.11_0.014_30)]/92` → `bg-[#0D0425]/92`

**Step 2: Verify landing page dark sections**

The hero, features, testimonials, CTA, and footer dark sections should now all render in deep blue-purple navy rather than warm near-black.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: update landing page hardcoded dark bg colours to Sence.Point navy"
```

---

### Task 5: Final visual check

**Step 1: Check landing page sections**

Visit `http://localhost:3000` and verify:
- [ ] Header: deep navy background, Manrope font
- [ ] Hero: deep navy, purple CTA button
- [ ] Problem cards: lavender background, white cards, purple icons
- [ ] Slack mockup section: deep navy
- [ ] Features section: deep navy
- [ ] Pricing: lavender background, purple "Popular" badge and border
- [ ] CTA section: deep navy
- [ ] Footer: deep navy

**Step 2: Check dashboard**

Sign in and verify:
- [ ] Sidebar: light lavender/white background, purple active item
- [ ] Main content: lavender background
- [ ] Cards: white with subtle shadows
- [ ] Buttons: purple
- [ ] Text: deep navy
- [ ] Tabs, badges, inputs: purple accent

**Step 3: Commit (if any final tweaks made)**

```bash
git add -p
git commit -m "fix: visual polish for Sence.Point theme"
```
