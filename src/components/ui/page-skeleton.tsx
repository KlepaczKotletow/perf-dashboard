import { Skeleton } from "@/components/ui/skeleton";

/** Generic row skeleton — avatar + two lines of text */
function RowSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-3 px-4 border-b border-border/40 last:border-0">
      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className={`h-3.5 ${wide ? "w-48" : "w-32"}`} />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

/** Table row skeleton */
function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  const widths = ["w-40", "w-20", "w-16", "w-28", "w-16"];
  return (
    <div className={`grid items-center px-6 py-4 border-b border-border/40 last:border-0`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className={`h-3.5 ${widths[i] ?? "w-20"}`} />
      ))}
    </div>
  );
}

/** Page header skeleton */
function HeaderSkeleton({ hasButton = true }: { hasButton?: boolean }) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      {hasButton && <Skeleton className="h-9 w-28 rounded-lg" />}
    </div>
  );
}

/** Card with a few lines */
function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2.5">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3.5 ${i === 0 ? "w-1/2" : i === lines - 1 ? "w-1/4" : "w-3/4"}`} />
      ))}
    </div>
  );
}

/** List page skeleton — header + table card */
export function ListPageSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div>
      <HeaderSkeleton />
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <TableRowSkeleton key={i} cols={cols} />
        ))}
      </div>
    </div>
  );
}

/** Detail page skeleton — header + two cards */
export function DetailPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full ml-2" />
      </div>
      {/* Stats card */}
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <div className="flex gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-7 w-10" />
              <Skeleton className="h-3.5 w-20" />
            </div>
          ))}
        </div>
      </div>
      {/* Participants card */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40">
          <Skeleton className="h-5 w-32" />
        </div>
        {[1, 2, 3].map((i) => (
          <RowSkeleton key={i} wide />
        ))}
      </div>
    </div>
  );
}

/** My Reviews page skeleton — sections */
export function MyReviewsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-56" />
      </div>
      {["My Performance", "Reviews to Give"].map((section) => (
        <div key={section} className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-32" />
          </div>
          <CardSkeleton lines={3} />
        </div>
      ))}
    </div>
  );
}

/** Review form skeleton */
export function ReviewFormSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-full" />
          <div className="flex gap-2 pt-1">
            {[1, 2, 3, 4, 5].map((j) => (
              <Skeleton key={j} className="h-9 w-9 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
