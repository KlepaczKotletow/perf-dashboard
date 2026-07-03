import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams?: Record<string, string>;
}

export function Pagination({ page, pageSize, total, basePath, searchParams = {} }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  function buildHref(targetPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(targetPage));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-xs text-muted-foreground">
        {total} result{total !== 1 ? "s" : ""} · Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Button variant="outline" size="sm" className="h-8" asChild>
            <Link href={buildHref(page - 1)}>
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-8" disabled>
            <ChevronLeft className="h-3.5 w-3.5 mr-1" />
            Previous
          </Button>
        )}
        {page < totalPages ? (
          <Button variant="outline" size="sm" className="h-8" asChild>
            <Link href={buildHref(page + 1)}>
              Next
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-8" disabled>
            Next
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
