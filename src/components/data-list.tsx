"use client";

// Shared primitives for the dashboard's dense list views.
//
// The Directory (src/app/dashboard/team/team-list.tsx) is the reference
// layout — these are lifted verbatim from it so Team Overview and Team
// Reviews render with the same rhythm, type scale and colour treatment
// instead of each page inventing its own table.
//
// Deliberately NOT a generic <DataTable>: every page needs its own
// responsive column grid, and hiding that behind a config object made the
// breakpoints impossible to read. Pages own their grid; everything that
// governs how a row *looks* lives here.

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export type SortDir = "asc" | "desc";

// ── Shell classes ────────────────────────────────────────────────────────────

/** Sortable column header. */
export const COL_HEADER =
  "flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold cursor-pointer hover:text-foreground transition-colors select-none";
/** Column header for columns that cannot be sorted. */
export const COL_HEADER_STATIC =
  "flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold select-none";
/** Header row wrapper. Pair with ROW_SHELL so columns line up. */
export const HEAD_SHELL = "flex items-center gap-4 px-3 py-2 border-b border-border/60";
/** Body row wrapper. */
export const ROW_SHELL =
  "flex items-center gap-4 px-3 py-2.5 border-b border-border/30 transition-all hover:bg-muted/30";
/** Section label above a table ("PENDING TEAM REVIEWS · 2"). */
export const SECTION_LABEL =
  "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider";

// ── Helpers ──────────────────────────────────────────────────────────────────

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function formatTenure(startDate: string | null | undefined): string {
  if (!startDate) return "—";
  const diffDays = Math.floor((Date.now() - new Date(startDate).getTime()) / 86_400_000);
  if (diffDays < 0) return "Not started";
  if (diffDays < 30) return `${diffDays}d`;
  const months = Math.floor(diffDays / 30.44);
  if (months < 12) return `${months}mo`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}y ${rem}mo` : `${years}y`;
}

export function formatShortDate(date: string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Sort affordance ──────────────────────────────────────────────────────────

export function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

// ── Cells ────────────────────────────────────────────────────────────────────

export function PersonAvatar({
  name,
  avatarUrl,
  href,
  className = "h-9 w-9",
}: {
  name: string | null | undefined;
  avatarUrl?: string | null;
  href?: string;
  className?: string;
}) {
  const avatar = (
    <Avatar className={className}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name || ""} />}
      <AvatarFallback className="text-xs bg-primary/[0.08] text-primary font-medium">
        {initialsOf(name)}
      </AvatarFallback>
    </Avatar>
  );
  return href ? (
    <Link href={href} className="shrink-0">
      {avatar}
    </Link>
  ) : (
    <span className="shrink-0">{avatar}</span>
  );
}

/** Name on the primary line, muted detail beneath, optional inline badges. */
export function NameCell({
  name,
  subtitle,
  href,
  badges,
}: {
  name: string | null | undefined;
  subtitle?: ReactNode;
  href?: string;
  badges?: ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {name || "Unknown"}
        </p>
        {badges}
      </div>
      {subtitle !== undefined && (
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      )}
    </>
  );
  return href ? (
    <Link href={href} className="min-w-0 group">
      {body}
    </Link>
  ) : (
    <div className="min-w-0">{body}</div>
  );
}

/**
 * Two-line cell: a value with a smaller qualifier beneath it. The Directory
 * uses this for Department + competency bracket and Start date + tenure.
 */
export function StackedCell({
  primary,
  secondary,
  secondaryTone = "text-primary/50",
  title,
  className = "",
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  secondaryTone?: string;
  title?: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-xs text-muted-foreground truncate">{primary}</p>
      {secondary !== undefined && secondary !== null && (
        <p className={`text-[10px] truncate ${secondaryTone}`} title={title}>
          {secondary}
        </p>
      )}
    </div>
  );
}

/** Em dash placeholder, so "no value" never reads as a broken cell. */
export function Blank({ label }: { label?: string }) {
  return (
    <span className="text-xs text-muted-foreground/40">{label ?? "—"}</span>
  );
}

// ── Badges ───────────────────────────────────────────────────────────────────

const BADGE_BASE = "text-[9px] px-1.5 py-0 font-medium shrink-0";

export function HeadBadge() {
  return (
    <Badge
      variant="outline"
      className={`${BADGE_BASE} text-violet-600 border-violet-200 bg-violet-50 dark:text-violet-400 dark:border-violet-400/20 dark:bg-violet-400/10`}
    >
      Head
    </Badge>
  );
}

const STATUS_TONE: Record<string, string> = {
  onboarding:
    "text-sky-600 border-sky-200 bg-sky-50 dark:text-sky-400 dark:border-sky-400/20 dark:bg-sky-400/10",
  inactive:
    "text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-400/20 dark:bg-amber-400/10",
  deactivated:
    "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-400/20 dark:bg-red-400/10",
};
const STATUS_LABEL: Record<string, string> = {
  onboarding: "Onboarding",
  inactive: "Inactive",
  deactivated: "Deactivated",
};

export function EmployeeStatusBadge({ status }: { status?: string | null }) {
  if (!status || status === "active") return null;
  return (
    <Badge variant="outline" className={`${BADGE_BASE} ${STATUS_TONE[status] ?? STATUS_TONE.inactive}`}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

/**
 * Marks a person the Nami bot cannot reach. Assignments can be created for
 * them, but no DM is ever sent and they cannot sign in to submit — so a
 * review against them will sit pending forever. Surfacing it inline is the
 * difference between "nobody has responded yet" and "nobody ever can".
 */
export function NoSlackBadge() {
  return (
    <Badge
      variant="outline"
      className={`${BADGE_BASE} text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-400/20 dark:bg-amber-400/10`}
      title="No Slack account linked — Nami cannot DM this person and they cannot sign in to submit a review."
    >
      No Slack
    </Badge>
  );
}

// ── Filter dropdown ──────────────────────────────────────────────────────────

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export function FilterDropdown({
  label,
  options,
  selected,
  defaultSelected,
  onToggle,
}: {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: Set<string>;
  /** When omitted, "no selection" is treated as the neutral state. */
  defaultSelected?: Set<string>;
  onToggle: (value: string) => void;
}) {
  const isActive = defaultSelected ? !setsEqual(selected, defaultSelected) : selected.size > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-9 text-xs gap-1.5 ${isActive ? "border-primary/50 bg-primary/[0.04]" : ""}`}
        >
          {label}
          {isActive && (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {selected.size}
            </span>
          )}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            checked={selected.has(o.value)}
            onCheckedChange={() => onToggle(o.value)}
            onSelect={(e) => e.preventDefault()}
            className="text-xs"
          >
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card py-16 text-center">
      <div className="mx-auto h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground max-w-xs mx-auto">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ── Inline notice banner ─────────────────────────────────────────────────────

/** The Directory's amber "N people have no competency bracket" strip. */
export function NoticeBanner({
  icon: Icon,
  children,
  action,
  tone = "amber",
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: ReactNode;
  action?: ReactNode;
  tone?: "amber" | "sky";
}) {
  const tones = {
    amber:
      "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:border-amber-400/20 dark:text-amber-400",
    sky: "border-sky-200 bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:border-sky-400/20 dark:text-sky-400",
  };
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border text-sm ${tones[tone]}`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <span>{children}</span>
      </div>
      {action}
    </div>
  );
}
