import type { MDXComponents } from "mdx/types";
import { Callout } from "@/components/help/callout";
import { RoleTag } from "@/components/help/role-tag";

export const helpMdxComponents: MDXComponents = {
  // Custom components
  Callout,
  // Hide RoleTag in body since it's already shown in the page header
  RoleTag: () => null,

  // Hide h1 in MDX body - the page header already renders the title from frontmatter
  h1: () => null,
  h2: (props) => (
    <h2
      className="mt-10 mb-4 text-xl font-semibold tracking-tight text-foreground scroll-mt-20"
      {...props}
    />
  ),
  h3: (props) => (
    <h3
      className="mt-8 mb-3 text-base font-semibold text-foreground scroll-mt-20"
      {...props}
    />
  ),
  p: (props) => (
    <p className="mb-4 leading-7 text-muted-foreground" {...props} />
  ),
  ul: (props) => (
    <ul className="mb-4 ml-6 list-disc space-y-1.5 text-muted-foreground [&_ul]:mt-1.5 [&_ul]:mb-0" {...props} />
  ),
  ol: (props) => (
    <ol className="mb-4 ml-6 list-decimal space-y-1.5 text-muted-foreground [&_ol]:mt-1.5 [&_ol]:mb-0" {...props} />
  ),
  li: (props) => <li className="leading-7 pl-1" {...props} />,
  strong: (props) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  a: (props) => (
    <a
      className="font-medium text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary/60 transition-colors"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),

  // Tables - properly styled with zebra striping and better structure
  table: (props) => (
    <div className="my-6 w-full overflow-x-auto rounded-xl border border-border/60 shadow-sm">
      <table className="w-full text-sm border-collapse" {...props} />
    </div>
  ),
  thead: (props) => (
    <thead className="bg-muted/70" {...props} />
  ),
  tbody: (props) => (
    <tbody className="divide-y divide-border/50" {...props} />
  ),
  tr: (props) => (
    <tr
      className="transition-colors hover:bg-muted/30"
      {...props}
    />
  ),
  th: (props) => (
    <th
      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground/80 border-b border-border/60"
      {...props}
    />
  ),
  td: (props) => (
    <td className="px-4 py-3 text-muted-foreground align-top" {...props} />
  ),

  // Code elements
  code: (props) => {
    // Inline code (not inside a pre block)
    const isBlock = typeof props.className === "string" && props.className.includes("language-");
    if (isBlock) {
      return <code {...props} />;
    }
    return (
      <code
        className="relative rounded-md bg-muted px-[0.4rem] py-[0.2rem] font-mono text-[0.85em] text-foreground/90"
        {...props}
      />
    );
  },
  pre: (props) => (
    <pre className="my-4 overflow-x-auto rounded-xl border border-border/60 bg-muted/50 p-4 text-sm leading-relaxed" {...props} />
  ),

  // Blockquote
  blockquote: (props) => (
    <blockquote
      className="my-4 border-l-4 border-primary/30 pl-4 italic text-muted-foreground [&>p]:mb-2"
      {...props}
    />
  ),

  hr: () => <hr className="my-8 border-border/50" />,
};
