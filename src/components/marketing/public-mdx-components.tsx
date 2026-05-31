import type { MDXComponents } from "mdx/types";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import { Callout } from "@/components/help/callout";

// Turn a heading's text into a stable anchor id, shared with the table of
// contents on the guide page so "On this page" links line up exactly.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) {
    // @ts-expect-error – MDX child element
    return textOf(node.props?.children);
  }
  return "";
}

function rewriteHref(href: string): string {
  return href.startsWith("/dashboard/help/")
    ? href.replace("/dashboard/help/", "/guides/")
    : href;
}

const linkClass =
  "font-medium text-primary underline decoration-[oklch(0.75_0.16_85)]/50 underline-offset-[3px] decoration-2 transition-colors hover:decoration-[oklch(0.75_0.16_85)]";

// Editorial reading styles for the public /guides article body — distinct from
// the in-app help styling. Serif section heads with hairline breaks, a
// comfortable measure, amber markers.
export const publicMdxComponents: MDXComponents = {
  Callout,
  RoleTag: () => null,
  h1: () => null,
  h2: ({ children }: ComponentPropsWithoutRef<"h2">) => {
    const id = slugify(textOf(children));
    return (
      <h2
        id={id}
        className="font-display text-[1.6rem] sm:text-[1.8rem] font-semibold tracking-[-0.01em] text-foreground mt-14 mb-4 pt-10 border-t border-foreground/10 scroll-mt-28"
      >
        {children}
      </h2>
    );
  },
  h3: ({ children }: ComponentPropsWithoutRef<"h3">) => {
    const id = slugify(textOf(children));
    return (
      <h3
        id={id}
        className="font-display text-xl font-semibold text-foreground mt-9 mb-3 scroll-mt-28"
      >
        {children}
      </h3>
    );
  },
  p: (props) => (
    <p className="text-[1.0625rem] leading-[1.75] text-foreground/80 mb-5" {...props} />
  ),
  ul: (props) => (
    <ul
      className="mb-6 ml-1 space-y-2.5 text-[1.0625rem] leading-[1.7] text-foreground/80 [&>li]:relative [&>li]:pl-6 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[0.62em] [&>li]:before:h-1.5 [&>li]:before:w-1.5 [&>li]:before:-translate-y-1/2 [&>li]:before:rounded-full [&>li]:before:bg-[oklch(0.75_0.16_85)]"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="mb-6 ml-5 list-decimal space-y-2.5 text-[1.0625rem] leading-[1.7] text-foreground/80 marker:font-display marker:font-semibold marker:text-primary/70"
      {...props}
    />
  ),
  li: (props) => <li className="pl-1" {...props} />,
  strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="my-7 border-l-2 border-[oklch(0.75_0.16_85)] pl-5 font-display text-xl italic leading-relaxed text-foreground/75 [&>p]:mb-0"
      {...props}
    />
  ),
  hr: () => <hr className="my-10 border-foreground/10" />,
  code: (props) => (
    <code
      className="rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
      {...props}
    />
  ),
  pre: (props) => (
    <pre
      className="my-6 overflow-x-auto rounded-xl bg-[oklch(0.175_0.035_264)] p-4 text-sm text-[#e9e5da] [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-[#e9e5da]"
      {...props}
    />
  ),
  table: (props) => (
    <div className="my-7 overflow-x-auto rounded-xl border border-foreground/10">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props) => (
    <th
      className="border-b border-foreground/10 bg-foreground/[0.03] px-4 py-2.5 text-left font-semibold text-foreground"
      {...props}
    />
  ),
  td: (props) => (
    <td className="border-b border-foreground/[0.06] px-4 py-2.5 text-foreground/80 align-top" {...props} />
  ),
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
