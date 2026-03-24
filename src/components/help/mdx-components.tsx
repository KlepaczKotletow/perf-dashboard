import type { MDXComponents } from "mdx/types";
import { Callout } from "@/components/help/callout";
import { RoleTag } from "@/components/help/role-tag";

export const helpMdxComponents: MDXComponents = {
  // Custom components
  Callout,
  RoleTag,

  // HTML element overrides
  h1: (props) => (
    <h1
      className="mt-8 mb-4 text-3xl font-bold tracking-tight text-foreground"
      {...props}
    />
  ),
  h2: (props) => (
    <h2
      className="mt-8 mb-3 text-2xl font-semibold tracking-tight text-foreground border-b pb-2"
      {...props}
    />
  ),
  h3: (props) => (
    <h3
      className="mt-6 mb-2 text-lg font-semibold text-foreground"
      {...props}
    />
  ),
  p: (props) => (
    <p className="mb-4 leading-7 text-muted-foreground" {...props} />
  ),
  ul: (props) => (
    <ul className="mb-4 ml-6 list-disc space-y-1 text-muted-foreground" {...props} />
  ),
  ol: (props) => (
    <ol className="mb-4 ml-6 list-decimal space-y-1 text-muted-foreground" {...props} />
  ),
  li: (props) => <li className="leading-7" {...props} />,
  strong: (props) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  a: (props) => (
    <a
      className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  table: (props) => (
    <div className="mb-4 overflow-x-auto rounded-lg border">
      <table className="w-full text-sm" {...props} />
    </div>
  ),
  th: (props) => (
    <th
      className="border-b bg-muted/50 px-4 py-2 text-left font-medium text-foreground"
      {...props}
    />
  ),
  td: (props) => (
    <td className="border-b px-4 py-2 text-muted-foreground" {...props} />
  ),
  hr: () => <hr className="my-6 border-border" />,
};
