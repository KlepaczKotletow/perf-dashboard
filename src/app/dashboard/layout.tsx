import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  FileText,
  Users,
  MessageSquare,
  BarChart3,
  CalendarClock,
  Target,
  CreditCard,
  Briefcase,
  ClipboardCheck,
  UsersRound,
} from "lucide-react";
import { getUserWorkspace } from "@/lib/supabase-server";
import { SignOutButton } from "./signout-button";
import { isManagerOrAbove, isAdmin, ROLE_LABELS, UserRole } from "@/lib/roles";

interface NavSection {
  label: string;
  items: {
    href: string;
    label: string;
    icon: any;
    requiresManager: boolean;
    requiresAdmin: boolean;
  }[];
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = await getUserWorkspace();
  const canAccessManagerFeatures = isManagerOrAbove(workspace?.role);
  const canAccessAdminFeatures = isAdmin(workspace?.role);

  const sections: NavSection[] = [
    {
      label: "Personal",
      items: [
        { href: "/dashboard", label: "Overview", icon: LayoutDashboard, requiresManager: false, requiresAdmin: false },
        { href: "/dashboard/my-reviews", label: "My Reviews", icon: ClipboardCheck, requiresManager: false, requiresAdmin: false },
        { href: "/dashboard/feedback", label: "Feedback", icon: MessageSquare, requiresManager: false, requiresAdmin: false },
      ],
    },
    {
      label: "People",
      items: [
        { href: "/dashboard/my-team", label: "My Team", icon: UsersRound, requiresManager: true, requiresAdmin: false },
        { href: "/dashboard/team", label: "Directory", icon: Users, requiresManager: false, requiresAdmin: false },
        { href: "/dashboard/reviews", label: "Reviews", icon: FileText, requiresManager: false, requiresAdmin: false },
      ],
    },
    {
      label: "Organization",
      items: [
        { href: "/dashboard/cycles", label: "Cycles", icon: CalendarClock, requiresManager: true, requiresAdmin: false },
        { href: "/dashboard/competencies", label: "Competencies", icon: Target, requiresManager: true, requiresAdmin: false },
        { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, requiresManager: true, requiresAdmin: false },
      ],
    },
    {
      label: "Settings",
      items: [
        { href: "/dashboard/admin/job-families", label: "Job Families", icon: Briefcase, requiresManager: false, requiresAdmin: true },
        { href: "/dashboard/settings/billing", label: "Billing", icon: CreditCard, requiresManager: false, requiresAdmin: true },
      ],
    },
  ];

  // Filter items based on role
  const filteredSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.requiresAdmin) return canAccessAdminFeatures;
        if (item.requiresManager) return canAccessManagerFeatures;
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  const initials = workspace?.name
    ? workspace.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : workspace?.email?.[0]?.toUpperCase() || "?";

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-[240px] border-r border-sidebar-border bg-sidebar flex flex-col z-30">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-sidebar-border">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">P</span>
            </div>
            <span className="font-semibold text-[15px] text-sidebar-foreground tracking-tight">Perf</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {filteredSections.map((section, idx) => (
            <div key={section.label} className={idx > 0 ? "mt-5" : ""}>
              <p className="px-2 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Footer */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 px-1 mb-2.5">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-xs font-medium text-primary">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-sidebar-foreground truncate">
                {workspace?.name || workspace?.email || "User"}
              </p>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize border-sidebar-border text-sidebar-foreground/50 font-normal">
                {ROLE_LABELS[workspace?.role as UserRole] || workspace?.role || "User"}
              </Badge>
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-[240px] min-h-screen">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
