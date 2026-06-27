"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type TocItem = { id: string; label: string };

// Sticky scroll-spy table of contents for long-form pages (legal, security,
// guides). Highlights the section currently in view via IntersectionObserver.
export function SectionToc({
  items,
  title = "On this page",
  className,
}: {
  items: TocItem[];
  title?: string;
  className?: string;
}) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive((entry.target as HTMLElement).id);
        }
      },
      { rootMargin: "-16% 0px -72% 0px", threshold: 0 },
    );
    const els = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label={title} className={cn("text-sm", className)}>
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-0.5 border-l border-border">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className={cn(
                "-ml-px block border-l-2 py-1 pl-3 leading-snug transition-colors",
                active === it.id
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Thin top-of-page reading-progress bar for long articles.
export function ReadingProgress({ className }: { className?: string }) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setPct(max > 0 ? Math.min(100, (doc.scrollTop / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={cn("fixed inset-x-0 top-0 z-[60] h-0.5 bg-transparent", className)} aria-hidden>
      <div className="h-full bg-primary transition-[width] duration-150 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}
