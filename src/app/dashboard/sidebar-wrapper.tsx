"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarWrapperProps {
  children: React.ReactNode;
  workspaceName?: string;
  workspaceLogoUrl?: string | null;
}

export function SidebarWrapper({ children, workspaceName, workspaceLogoUrl }: SidebarWrapperProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Auto-close on navigation (e.g. after clicking a nav link on mobile).
  // Using a `key={pathname}` would force a remount of the entire sidebar
  // tree on every navigation — too expensive. Keep the effect-based reset.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* ── Mobile top bar (hidden on lg+) ────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border z-30 flex items-center gap-3 px-4">
        <button
          onClick={() => setIsOpen((o) => !o)}
          className="p-1.5 rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          aria-label={isOpen ? "Close navigation" : "Open navigation"}
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/dashboard" className="flex items-center gap-3.5">
          {workspaceLogoUrl ? (
            <img src={workspaceLogoUrl} alt="" className="h-11 w-11 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="h-11 w-11 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-base font-bold">{(workspaceName || "N").charAt(0).toUpperCase()}</span>
            </div>
          )}
          <span className="font-semibold text-[17px] text-sidebar-foreground tracking-tight">{workspaceName || "Nami"}</span>
        </Link>
      </div>

      {/* ── Backdrop (mobile only) ─────────────────────────────────────── */}
      <div
        className={cn(
          "lg:hidden fixed inset-0 bg-black/40 z-40 transition-opacity duration-200",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-[240px] border-r border-sidebar-border bg-sidebar flex flex-col z-50",
          "transition-transform duration-200 ease-in-out",
          // Mobile: hidden by default, slide in when open
          // Desktop (lg+): always visible
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Close button — mobile only, overlaid on the logo header area */}
        <button
          onClick={() => setIsOpen(false)}
          className="lg:hidden absolute top-3.5 right-3 p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>

        {children}
      </aside>
    </>
  );
}
