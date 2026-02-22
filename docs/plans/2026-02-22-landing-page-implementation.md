# Landing Page UI/UX Improvement — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add four new sections (How it Works, Product Mockup, Testimonials, Pricing Teaser) to `src/app/page.tsx` with elegant scroll-triggered entry animations.

**Architecture:** Keep `page.tsx` as a Server Component; create a `ScrollReveal` Client Component that uses IntersectionObserver to trigger CSS transitions on entry. Each new section is a self-contained JSX block in `page.tsx`, wrapped in `<ScrollReveal>` for stagger. No new npm packages required.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, lucide-react, existing shadcn/ui components

---

## Task 1: Create the ScrollReveal client component

**Files:**
- Create: `src/components/landing/scroll-reveal.tsx`

**Step 1: Create the file**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface ScrollRevealProps {
  children: React.ReactNode
  delay?: number          // ms delay before transition starts
  className?: string
  scale?: boolean         // also animate scale (for the mockup)
}

export function ScrollReveal({ children, delay = 0, className, scale = false }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Respect prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.12 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const transition = visible
    ? `opacity 500ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 500ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`
    : 'none'

  const transform = visible
    ? 'translateY(0) scale(1)'
    : `translateY(16px) ${scale ? 'scale(0.97)' : 'scale(1)'}`

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        opacity: visible ? 1 : 0,
        transform,
        transition,
      }}
    >
      {children}
    </div>
  )
}
```

**Step 2: Verify the file exists and TypeScript is happy**

Run: `cd "feedback-app" && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors for this new file (or zero output if project compiles cleanly).

**Step 3: Commit**

```bash
git add src/components/landing/scroll-reveal.tsx
git commit -m "feat: add ScrollReveal client component for landing page animations"
```

---

## Task 2: Add "How it Works" section

**Files:**
- Modify: `src/app/page.tsx` — insert section after the Hero section (after line ~82, before the Feature grid section)

**Step 1: Add the import at the top of page.tsx**

After the existing imports, add:
```tsx
import { ScrollReveal } from "@/components/landing/scroll-reveal";
```

Also add `ArrowRight` to the lucide-react import:
```tsx
import { Slack, Zap, Shield, BarChart3, MessageSquare, Users, Star, ArrowRight } from "lucide-react";
```

**Step 2: Insert the "How it Works" section in the JSX**

Insert this block between the Hero `</section>` and the Feature grid `<section>`:

```tsx
{/* How it Works */}
<section className="max-w-5xl mx-auto px-6 pb-24">
  <ScrollReveal className="text-center mb-14">
    <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">How it works</p>
    <h2 className="text-3xl font-bold tracking-tight text-foreground">Up and running in minutes</h2>
    <p className="mt-3 text-muted-foreground max-w-md mx-auto text-[15px]">
      No lengthy onboarding. No training required. Just add Perf to Slack and you&apos;re set.
    </p>
  </ScrollReveal>

  <div className="relative">
    {/* Connector line — desktop only */}
    <div className="hidden lg:block absolute top-[38px] left-[calc(16.66%+24px)] right-[calc(16.66%+24px)] h-px bg-border" aria-hidden="true" />

    <ol className="grid sm:grid-cols-3 gap-8 lg:gap-12 relative">
      {[
        {
          step: "01",
          icon: Slack,
          title: "Add Perf to Slack",
          description: "Click 'Add to Slack' and authorize Perf in your workspace. Takes under 60 seconds.",
        },
        {
          step: "02",
          icon: Users,
          title: "Set up your team",
          description: "Perf syncs your Slack members automatically. Assign managers and define reporting lines.",
        },
        {
          step: "03",
          icon: BarChart3,
          title: "Launch your first cycle",
          description: "Pick a template, set a deadline, and Perf handles assignments, reminders, and collection.",
        },
      ].map((item, i) => (
        <ScrollReveal key={item.step} delay={i * 120}>
          <li className="flex flex-col items-center text-center sm:items-start sm:text-left">
            <div className="relative mb-5">
              {/* Step number — decorative background */}
              <span className="absolute -top-3 -left-3 text-[56px] font-black leading-none text-foreground/[0.04] select-none pointer-events-none">
                {item.step}
              </span>
              <div className="h-12 w-12 rounded-xl bg-primary/[0.08] border border-primary/[0.12] flex items-center justify-center relative z-10">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
            </div>
            <h3 className="font-semibold text-[15px] text-foreground">{item.title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{item.description}</p>
          </li>
        </ScrollReveal>
      ))}
    </ol>
  </div>
</section>
```

**Step 3: Start the dev server and visually verify**

Run: `npm run dev`
Open: http://localhost:3000
Check: "How it works" section appears between hero and feature grid. On scroll, the heading fades in, then each step staggers in with a 120ms delay. Connector line visible at desktop width.

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add How it Works section to landing page"
```

---

## Task 3: Add "Product Mockup" section

**Files:**
- Modify: `src/app/page.tsx` — insert section after the "How it Works" section, before the Feature grid

**Step 1: Insert the section**

Insert this block right after the "How it Works" `</section>` closing tag:

```tsx
{/* Product Mockup */}
<section className="max-w-5xl mx-auto px-6 pb-28">
  <ScrollReveal className="text-center mb-12">
    <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">The dashboard</p>
    <h2 className="text-3xl font-bold tracking-tight text-foreground">Everything in one place</h2>
    <p className="mt-3 text-muted-foreground max-w-md mx-auto text-[15px]">
      Track cycles, calibrate scores, and explore team performance — all from a clean, focused interface.
    </p>
  </ScrollReveal>

  {/* Browser frame */}
  <ScrollReveal scale className="relative">
    {/* Glow behind frame */}
    <div className="absolute inset-x-12 top-8 bottom-0 bg-primary/[0.06] blur-3xl rounded-full -z-10 pointer-events-none" />

    <div className="rounded-2xl border border-border/70 overflow-hidden shadow-xl shadow-black/[0.06] bg-card">
      {/* Browser chrome */}
      <div className="bg-muted/60 border-b border-border px-4 py-3 flex items-center gap-3">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-400/70" />
          <div className="h-3 w-3 rounded-full bg-yellow-400/70" />
          <div className="h-3 w-3 rounded-full bg-green-400/70" />
        </div>
        <div className="flex-1 bg-background/70 rounded-md px-3 py-1 text-[11px] text-muted-foreground font-mono">
          app.perf.team/dashboard/cycles
        </div>
      </div>

      {/* App shell */}
      <div className="flex h-[340px] sm:h-[400px] overflow-hidden">
        {/* Sidebar */}
        <div className="hidden sm:flex w-44 border-r border-border/60 flex-col bg-muted/20 p-3 gap-0.5 shrink-0">
          <div className="px-2 py-1.5 mb-1">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-[9px] font-bold">P</span>
              </div>
              <span className="text-xs font-semibold text-foreground">Perf</span>
            </div>
          </div>
          {[
            { label: "Overview", active: false },
            { label: "Cycles", active: true },
            { label: "My Reviews", active: false },
            { label: "Goals", active: false },
            { label: "Team", active: false },
            { label: "Analytics", active: false },
          ].map((item) => (
            <div
              key={item.label}
              className={`px-2.5 py-1.5 rounded-md text-[12px] ${
                item.active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-5 sm:p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Active cycle</p>
              <h3 className="text-sm font-semibold text-foreground mt-0.5">Q1 2025 Performance Review</h3>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">Completion</p>
              <p className="text-lg font-bold text-primary">73%</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-muted rounded-full mb-6 overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: "73%" }} />
          </div>

          {/* Competency grid */}
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-3">Avg. competency scores</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Leadership", score: 4.2, pct: 84, color: "bg-primary" },
              { label: "Execution", score: 3.8, pct: 76, color: "bg-chart-2" },
              { label: "Collaboration", score: 4.5, pct: 90, color: "bg-chart-3" },
            ].map((c) => (
              <div key={c.label} className="bg-muted/40 rounded-xl p-3">
                <p className="text-[11px] text-muted-foreground mb-1">{c.label}</p>
                <p className="text-base font-bold text-foreground">{c.score}</p>
                <div className="h-1 bg-border rounded-full mt-2 overflow-hidden">
                  <div className={`h-full rounded-full ${c.color}`} style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Review assignments */}
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2 mt-5">Recent assignments</p>
          <div className="space-y-1.5">
            {[
              { name: "Alex Johnson", status: "Submitted", dot: "bg-green-500" },
              { name: "Maria Garcia", status: "In progress", dot: "bg-yellow-500" },
              { name: "Chris Lee", status: "Pending", dot: "bg-border" },
            ].map((r) => (
              <div key={r.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                    {r.name[0]}
                  </div>
                  <span className="text-[12px] text-foreground">{r.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`h-1.5 w-1.5 rounded-full ${r.dot}`} />
                  <span className="text-[11px] text-muted-foreground">{r.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </ScrollReveal>
</section>
```

**Step 2: Visually verify**

With dev server running, scroll to the mockup section.
Check: Browser chrome frame renders, sidebar visible on sm+, competency bars show at correct widths, the section fades in with a subtle scale.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add coded product mockup section to landing page"
```

---

## Task 4: Add "Testimonials" section

**Files:**
- Modify: `src/app/page.tsx` — insert section after the Feature grid `</section>`, before the Stats strip `<section>`

**Step 1: Insert the section**

```tsx
{/* Testimonials */}
<section className="max-w-5xl mx-auto px-6 pb-24">
  <ScrollReveal className="text-center mb-12">
    <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">What teams say</p>
    <h2 className="text-3xl font-bold tracking-tight text-foreground">Teams that switched don&apos;t go back</h2>
  </ScrollReveal>

  <div className="grid sm:grid-cols-3 gap-4">
    {[
      {
        quote: "We went from 40% review completion to nearly 100% in one cycle. The Slack integration removes every excuse not to respond.",
        name: "Sarah Chen",
        role: "Engineering Manager",
        company: "Forma",
        initial: "S",
      },
      {
        quote: "Finally a tool that doesn't make HR feel like HR. Our team actually appreciates getting feedback — and giving it.",
        name: "Marcus Webb",
        role: "Head of People",
        company: "Archetype Labs",
        initial: "M",
      },
      {
        quote: "The 9-box calibration grid alone saved us hours of spreadsheet wrangling. Setup took an afternoon.",
        name: "Priya Nair",
        role: "VP of Engineering",
        company: "Meridian",
        initial: "P",
      },
    ].map((t, i) => (
      <ScrollReveal key={t.name} delay={i * 100}>
        <figure className="group flex flex-col h-full p-6 rounded-xl border border-border/60 bg-card/50 hover:bg-card hover:border-border hover:shadow-sm transition-all duration-200">
          <blockquote className="flex-1">
            <span className="block text-3xl font-serif leading-none text-primary/40 mb-3 select-none">&ldquo;</span>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{t.quote}</p>
          </blockquote>
          <figcaption className="mt-5 flex items-center gap-3 pt-4 border-t border-border/50">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
              {t.initial}
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground">{t.name}</p>
              <p className="text-[11px] text-muted-foreground">{t.role} · {t.company}</p>
            </div>
          </figcaption>
        </figure>
      </ScrollReveal>
    ))}
  </div>
</section>
```

**Step 2: Visually verify**

Scroll to the testimonials. Check: 3 cards render in a row on desktop, stagger on entry, hover state lifts the card.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add testimonials section to landing page"
```

---

## Task 5: Add "Pricing Teaser" section

**Files:**
- Modify: `src/app/page.tsx` — insert section after the Stats strip `</section>`, before the final CTA `<section>`

**Step 1: Add `Check` to the lucide-react import**

Update the lucide import line to include `Check`:
```tsx
import { Slack, Zap, Shield, BarChart3, MessageSquare, Users, Star, ArrowRight, Check } from "lucide-react";
```

**Step 2: Insert the pricing teaser section**

```tsx
{/* Pricing Teaser */}
<section className="border-t border-border/50 bg-muted/20">
  <div className="max-w-5xl mx-auto px-6 py-20">
    <ScrollReveal className="text-center mb-12">
      <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">Pricing</p>
      <h2 className="text-3xl font-bold tracking-tight text-foreground">Simple, transparent pricing</h2>
      <p className="mt-3 text-muted-foreground text-[15px]">Start free. Upgrade when your team is ready.</p>
    </ScrollReveal>

    <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
      {/* Free tier */}
      <ScrollReveal delay={0}>
        <div className="flex flex-col h-full p-6 rounded-xl border border-border/60 bg-card">
          <p className="text-sm font-semibold text-foreground mb-1">Free</p>
          <p className="text-3xl font-bold text-foreground mb-1">$0</p>
          <p className="text-[12px] text-muted-foreground mb-5">Forever, no credit card</p>
          <ul className="space-y-2.5 flex-1">
            {[
              "Up to 10 team members",
              "Slack /feedback command",
              "Basic analytics",
              "1 active review cycle",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </ScrollReveal>

      {/* Pro tier */}
      <ScrollReveal delay={100}>
        <div className="flex flex-col h-full p-6 rounded-xl border border-primary/30 bg-card shadow-sm shadow-primary/[0.06] relative">
          <div className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wider">
            Popular
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">Pro</p>
          <p className="text-3xl font-bold text-foreground mb-1">$8<span className="text-base font-normal text-muted-foreground">/user/mo</span></p>
          <p className="text-[12px] text-muted-foreground mb-5">Billed monthly or annually</p>
          <ul className="space-y-2.5 flex-1">
            {[
              "Unlimited team members",
              "360° review cycles",
              "Competency frameworks",
              "9-box calibration grid",
              "Advanced analytics",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <Link href="/pricing" className="mt-6 inline-flex items-center gap-1 text-[13px] text-primary font-medium hover:underline">
            See full pricing <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </ScrollReveal>
    </div>
  </div>
</section>
```

**Step 3: Visually verify**

Scroll to pricing teaser. Check: Free/Pro panels render side-by-side on sm+, Pro panel has a primary-tinted border, "Popular" badge in top-right, arrow link to /pricing works.

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add pricing teaser section to landing page"
```

---

## Task 6: Final check

**Step 1: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 2: Verify lint passes**

Run: `npm run lint`
Expected: No errors or warnings beyond pre-existing ones.

**Step 3: Check the full page flow**

Open http://localhost:3000. Scroll from top to bottom and verify:
- [ ] Header sticky, blur working
- [ ] Hero CTA buttons functional
- [ ] How it Works: 3 steps stagger in, connector line visible at lg
- [ ] Product Mockup: browser frame with glow, competency bars render
- [ ] Feature grid: unchanged
- [ ] Testimonials: 3 cards stagger, hover lift works
- [ ] Stats strip: unchanged
- [ ] Pricing Teaser: Free/Pro side-by-side, "See full pricing" links to /pricing
- [ ] CTA: unchanged
- [ ] Footer: unchanged

**Step 4: Test reduced-motion**

In browser DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion" → "reduce". All sections should be immediately visible with no animation.

**Step 5: Final commit if needed**

```bash
git add -A
git commit -m "feat: complete landing page UI/UX improvements with 4 new sections"
```
