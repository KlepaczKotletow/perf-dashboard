"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  Menu,
  BookOpen,
  Rocket,
  RefreshCw,
  ClipboardCheck,
  Target,
  Users,
  BarChart3,
  Settings,
  MessageSquare,
  Award,
  Scale,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import type { HelpArticle } from "@/lib/help-articles";

const categoryIcons: Record<string, React.ElementType> = {
  "Getting Started": Rocket,
  Cycles: RefreshCw,
  Reviews: ClipboardCheck,
  Goals: Target,
  "Team Management": Users,
  Surveys: MessageSquare,
  Competencies: Award,
  Calibration: Scale,
  Analytics: BarChart3,
  "Admin & Billing": Settings,
  Troubleshooting: HelpCircle,
};

interface HelpSidebarProps {
  grouped: { category: string; articles: HelpArticle[] }[];
}

function SidebarContent({
  grouped,
  search,
  setSearch,
  pathname,
  onNavigate,
}: {
  grouped: HelpSidebarProps["grouped"];
  search: string;
  setSearch: (v: string) => void;
  pathname: string;
  onNavigate?: () => void;
}) {
  const query = search.toLowerCase();

  const filtered = grouped
    .map((group) => ({
      ...group,
      articles: group.articles.filter(
        (a) =>
          a.title.toLowerCase().includes(query) ||
          a.description.toLowerCase().includes(query)
      ),
    }))
    .filter((g) => g.articles.length > 0);

  const totalArticles = grouped.reduce(
    (sum, g) => sum + g.articles.length,
    0
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4.5 w-4.5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Help Center</h2>
          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground/60">
            {totalArticles} articles
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Search articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-8 py-2 text-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-ring/50 transition-shadow"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <span className="text-xs">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {filtered.map((group) => {
          const CategoryIcon = categoryIcons[group.category] || BookOpen;

          return (
            <div key={group.category} className="mb-1">
              {/* Category header */}
              <div className="flex items-center gap-2 px-2 py-2 mt-2 first:mt-0">
                <CategoryIcon className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-foreground/50">
                  {group.category}
                </h3>
                <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/40">
                  {group.articles.length}
                </span>
              </div>

              {/* Article links */}
              <div className="space-y-0.5">
                {group.articles.map((article) => {
                  const href = `/dashboard/help/${article.slug}`;
                  const isActive = pathname === href;

                  return (
                    <Link
                      key={article.slug}
                      href={href}
                      onClick={onNavigate}
                      className={cn(
                        "group flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-all",
                        isActive
                          ? "bg-primary/8 text-primary font-medium shadow-sm shadow-primary/5"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <span className="truncate flex-1">{article.title}</span>
                      {isActive && (
                        <ChevronRight className="h-3 w-3 text-primary/50 shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-sm text-muted-foreground/60">
              No articles found
            </p>
            <button
              onClick={() => setSearch("")}
              className="mt-1 text-xs text-primary hover:underline"
            >
              Clear search
            </button>
          </div>
        )}
      </nav>
    </div>
  );
}

export function HelpSidebar({ grouped }: HelpSidebarProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Mobile trigger */}
      <div className="lg:hidden fixed top-[57px] left-0 right-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur-sm px-4 py-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Menu className="h-4 w-4" />
              Articles
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Help Articles</SheetTitle>
            <SidebarContent
              grouped={grouped}
              search={search}
              setSearch={setSearch}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-[272px] shrink-0 border-r border-border/60 bg-muted/20 overflow-y-auto">
        <SidebarContent
          grouped={grouped}
          search={search}
          setSearch={setSearch}
          pathname={pathname}
        />
      </aside>
    </>
  );
}
