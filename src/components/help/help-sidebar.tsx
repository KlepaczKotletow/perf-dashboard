"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import type { HelpArticle } from "@/lib/help-articles";

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

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-8 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        {filtered.map((group) => (
          <div key={group.category}>
            <h3 className="px-2 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.category}
            </h3>
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
                      "block rounded-md px-2 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    {article.title}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="px-2 text-sm text-muted-foreground">
            No articles found.
          </p>
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
      <div className="lg:hidden fixed top-[57px] left-0 right-0 z-30 border-b bg-background px-4 py-2">
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
      <aside className="hidden lg:block w-64 shrink-0 border-r bg-background overflow-y-auto">
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
