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
  "font-medium text-primary underline decoration-primary/30 underline-offset-[3px] transition-colors hover:decoration-primary/70";

// Reading styles for the public /guides article body — Manrope, matching the
// landing page's type and the brand's indigo accent (no serif, no amber).
export const publicMdxComponents: MDXComponents = {
  Callout,
  RoleTag: () => null,
  h1: () => null,
  h2: ({ children }: ComponentPropsWithoutRef<"h2">) => {
    const id = slugify(textOf(children));
    return (
      <h2
        id={id}
        className="mt-12 mb-4 border-t border-border/60 pt-9 text-2xl font-bold tracking-tight text-foreground scroll-mt-28"
      >
        {children}
      </h2>
    );
  },
  h3: ({ children }: ComponentPropsWithoutRef<"h3">) => {
    const id = slugify(textOf(children));
    return (
      <h3 className="mt-8 mb-3 text-lg font-bold tracking-tight text-foreground scroll-mt-28" id={id}>
        {children}
      </h3>
    );
  },
  p: (props) => (
    <p className="mb-5 text-[1.0625rem] leading-[1.75] text-muted-foreground" {...props} />
  ),
  ul: (props) => (
    <ul
      className="mb-6 ml-1 space-y-2.5 text-[1.0625rem] leading-[1.7] text-muted-foreground [&>li]:relative [&>li]:pl-6 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[0.62em] [&>li]:before:h-1.5 [&>li]:before:w-1.5 [&>li]:before:-translate-y-1/2 [&>li]:before:rounded-full [&>li]:before:bg-primary/60"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="mb-6 ml-5 list-decimal space-y-2.5 text-[1.0625rem] leading-[1.7] text-muted-foreground marker:font-semibold marker:text-primary/70"
      {...props}
    />
  ),
  li: (props) => <li className="pl-1" {...props} />,
  strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="my-7 border-l-2 border-primary/50 pl-5 text-lg italic leading-relaxed text-foreground/75 [&>p]:mb-0"
      {...props}
    />
  ),
  hr: () => <hr className="my-10 border-border/60" />,
  code: (props) => (
    <code
      className="rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
      {...props}
    />
  ),
  pre: (props) => (
    <pre
      className="my-6 overflow-x-auto rounded-xl bg-[#1a1a2e] p-4 text-sm text-[#e9e9f2] [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-[#e9e9f2]"
      {...props}
    />
  ),
  table: (props) => (
    <div className="my-7 overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props) => (
    <th
      className="border-b border-border/60 bg-muted/40 px-4 py-2.5 text-left font-semibold text-foreground"
      {...props}
    />
  ),
  td: (props) => (
    <td className="border-b border-border/40 px-4 py-2.5 align-top text-muted-foreground" {...props} />
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
