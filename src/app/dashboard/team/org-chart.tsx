"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

interface OrgUser {
  id: string;
  slack_name: string | null;
  avatar_url?: string | null;
  job_title: string | null;
  department: string | null;
  manager_id: string | null;
}

interface OrgNode extends OrgUser {
  children: OrgNode[];
}

// ---------------------------------------------------------------------------
//  Tree builder (reused from original — includes cycle detection)
// ---------------------------------------------------------------------------

function buildTree(users: OrgUser[]): OrgNode[] {
  const map = new Map<string, OrgNode>();
  users.forEach((u) => map.set(u.id, { ...u, children: [] }));

  function wouldCycle(nodeId: string, managerId: string): boolean {
    let current: string | null = managerId;
    const visited = new Set<string>();
    while (current) {
      if (current === nodeId) return true;
      if (visited.has(current)) return true;
      visited.add(current);
      current = map.get(current)?.manager_id ?? null;
    }
    return false;
  }

  const roots: OrgNode[] = [];
  map.forEach((node) => {
    if (
      node.manager_id &&
      map.has(node.manager_id) &&
      !wouldCycle(node.id, node.manager_id)
    ) {
      map.get(node.manager_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort children alphabetically
  function sortChildren(node: OrgNode) {
    node.children.sort((a, b) =>
      (a.slack_name || "").localeCompare(b.slack_name || ""),
    );
    node.children.forEach(sortChildren);
  }
  roots.sort((a, b) => (a.slack_name || "").localeCompare(b.slack_name || ""));
  roots.forEach(sortChildren);

  return roots;
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ---------------------------------------------------------------------------
//  Node card component
// ---------------------------------------------------------------------------

function NodeCard({ node }: { node: OrgNode }) {
  return (
    <Link
      href={`/dashboard/team/${node.id}`}
      className="flex flex-col items-center gap-1.5 group w-[120px] shrink-0"
    >
      <Avatar className="h-12 w-12 ring-2 ring-background shadow-md group-hover:shadow-lg group-hover:ring-primary/20 transition-all">
        {node.avatar_url && (
          <AvatarImage src={node.avatar_url} alt={node.slack_name || ""} />
        )}
        <AvatarFallback className="text-sm bg-primary/[0.08] text-primary font-semibold">
          {getInitials(node.slack_name)}
        </AvatarFallback>
      </Avatar>
      <div className="text-center min-w-0 w-full">
        <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors leading-tight">
          {node.slack_name || "Unknown"}
        </p>
        <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
          {node.job_title || "—"}
        </p>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
//  Tree node with connectors (recursive)
// ---------------------------------------------------------------------------

const AUTO_COLLAPSE_DEPTH = 3;

function TreeNode({ node, depth = 0 }: { node: OrgNode; depth?: number }) {
  const hasChildren = node.children.length > 0;
  const [expanded, setExpanded] = useState(depth < AUTO_COLLAPSE_DEPTH);

  return (
    <div className="flex flex-col items-center">
      {/* The card itself */}
      <div className="relative flex flex-col items-center">
        <NodeCard node={node} />

        {/* Expand/collapse toggle */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.preventDefault();
              setExpanded((prev) => !prev);
            }}
            className="mt-1 flex items-center justify-center h-5 w-5 rounded-full border border-border bg-card shadow-sm hover:bg-muted transition-colors z-10"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <span className="text-[9px] font-medium text-muted-foreground leading-none">
                {node.children.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="flex flex-col items-center">
          {/* Vertical line from toggle down to the horizontal rail */}
          <div className="w-px h-5 bg-border/60" />

          {node.children.length === 1 ? (
            /* Single child — just a vertical line, no horizontal rail */
            <TreeNode
              node={node.children[0]}
              depth={depth + 1}
            />
          ) : (
            /* Multiple children — horizontal rail + vertical drops */
            <div className="relative flex items-start">
              {/* Horizontal rail: spans from first child center to last child center */}
              <div
                className="absolute top-0 h-px bg-border/60"
                style={{
                  left: "calc(60px)",
                  right: "calc(60px)",
                }}
              />

              <div className="flex gap-2">
                {node.children.map((child) => (
                  <div
                    key={child.id}
                    className="flex flex-col items-center"
                  >
                    {/* Vertical drop from horizontal rail to child */}
                    <div className="w-px h-5 bg-border/60" />
                    <TreeNode node={child} depth={depth + 1} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Root export
// ---------------------------------------------------------------------------

interface OrgChartProps {
  users: OrgUser[];
}

export function OrgChart({ users }: OrgChartProps) {
  const roots = buildTree(users);

  if (roots.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-sm">No org structure to display.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-8">
      <div className="inline-flex flex-col items-center min-w-full px-8 pt-4">
        {roots.length === 1 ? (
          <TreeNode node={roots[0]} />
        ) : (
          /* Multiple roots — render side by side with shared horizontal rail */
          <div className="relative flex items-start">
            <div
              className="absolute top-[34px] h-px bg-border/60"
              style={{
                left: "calc(60px)",
                right: "calc(60px)",
              }}
            />
            <div className="flex gap-6">
              {roots.map((root) => (
                <TreeNode key={root.id} node={root} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
