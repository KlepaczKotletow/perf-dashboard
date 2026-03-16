"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";

interface OrgUser {
  id: string;
  slack_name: string | null;
  job_title: string | null;
  department: string | null;
  manager_id: string | null;
  avatar_url?: string | null;
}

interface OrgNode extends OrgUser {
  children: OrgNode[];
}

function buildTree(users: OrgUser[]): OrgNode[] {
  const map = new Map<string, OrgNode>();
  users.forEach((u) => map.set(u.id, { ...u, children: [] }));

  const roots: OrgNode[] = [];
  map.forEach((node) => {
    if (node.manager_id && map.has(node.manager_id)) {
      map.get(node.manager_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function OrgNodeItem({ node, depth = 0 }: { node: OrgNode; depth?: number }) {
  return (
    <div className={depth > 0 ? "ml-8 border-l border-border/60 pl-4" : ""}>
      <div className="py-1.5">
        <Link
          href={`/dashboard/team/${node.id}`}
          className="inline-flex items-center gap-3 px-3 py-2 rounded-xl border border-border/60 bg-card hover:border-border hover:shadow-sm transition-all group"
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs bg-primary/[0.08] text-primary font-medium">
              {getInitials(node.slack_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
              {node.slack_name || "Unknown"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {node.job_title || node.department || "—"}
            </p>
          </div>
          {node.children.length > 0 && (
            <span className="ml-2 text-[10px] text-muted-foreground/60 shrink-0">
              {node.children.length} direct
            </span>
          )}
        </Link>
      </div>
      {node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <OrgNodeItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

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
    <div className="space-y-1">
      {roots.map((root) => (
        <OrgNodeItem key={root.id} node={root} />
      ))}
    </div>
  );
}
