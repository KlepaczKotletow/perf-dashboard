"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export function NavLink({ href, label, icon }: NavLinkProps) {
  const pathname = usePathname();

  // Exact match for /dashboard (overview), prefix match for everything else
  const isActive =
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors",
        // Keyboard focus was previously invisible here — no focus style was
        // defined at all, so tabbing through the nav gave sighted keyboard
        // users nothing to follow (WCAG 2.4.7).
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--rail)]",
        isActive
          // The rail is now the lightest surface in the shell, so the old flat
          // grey fill no longer separates from it. A soft primary tint reads as
          // selected without adding weight, and the icon inherits the colour.
          ? "bg-primary/10 text-primary font-medium"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
