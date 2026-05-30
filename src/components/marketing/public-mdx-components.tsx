import type { MDXComponents } from "mdx/types";
import type { ComponentPropsWithoutRef } from "react";
import Link from "next/link";
import { helpMdxComponents } from "@/components/help/mdx-components";

// Reuse the in-app help-center MDX styling for public /guides pages, but rewrite
// in-app dashboard cross-links to their public equivalents so logged-out readers
// don't hit auth walls (e.g. /dashboard/help/security-privacy → /guides/security-privacy).
function rewriteHref(href: string): string {
  if (href.startsWith("/dashboard/help/")) {
    return href.replace("/dashboard/help/", "/guides/");
  }
  return href;
}

const linkClass =
  "font-medium text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary/60 transition-colors";

export const publicMdxComponents: MDXComponents = {
  ...helpMdxComponents,
  a: ({ href = "", children, ...rest }: ComponentPropsWithoutRef<"a">) => {
    const target = rewriteHref(String(href));
    if (target.startsWith("/")) {
      return (
        <Link href={target} className={linkClass} {...rest}>
          {children}
        </Link>
      );
    }
    return (
      <a href={target} className={linkClass} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  },
};
