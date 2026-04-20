import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  MessageSquare,
  BarChart3,
  CalendarClock,
  CreditCard,
  Briefcase,
  ClipboardCheck,
  ClipboardList,
  UsersRound,
  ListChecks,
  Flag,
  ScrollText,
  SlidersHorizontal,
  Settings2,
  HelpCircle,
} from "lucide-react";
import { getUserWorkspace } from "@/lib/supabase-server";
import { FooterDropdown } from "./footer-dropdown";
import { isManagerOrAbove, isAdmin, isHROrAbove, ROLE_LABELS, UserRole } from "@/lib/roles";
import { NavLink } from "./nav-link";
import { SidebarWrapper } from "./sidebar-wrapper";
import { RoleWatcher } from "./role-watcher";
import { WidgetErrorBoundary } from "@/components/widget-error-boundary";

interface NavSection {
  label: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    requiresManager: boolean;
    requiresHR: boolean;
    requiresAdmin: boolean;
  }[];
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = await getUserWorkspace();

  if (!workspace) {
    redirect("/");
  }

  if (!workspace.onboardingCompleted) {
    redirect("/onboarding");
  }

  const canAccessManagerFeatures = isManagerOrAbove(workspace?.role) || workspace?.hasDirectReports;
  const canAccessAdminFeatures = isAdmin(workspace?.role);
  const canAccessHRFeatures = isHROrAbove(workspace?.role);

  const sections: NavSection[] = [
    // ── MY WORK: personal-scope items, always visible ──
    {
      label: "My Work",
      items: [
        { href: "/dashboard", label: "Home", icon: LayoutDashboard, requiresManager: false, requiresHR: false, requiresAdmin: false },
        { href: "/dashboard/performance", label: "My Performance", icon: ClipboardCheck, requiresManager: false, requiresHR: false, requiresAdmin: false },
        { href: "/dashboard/goals", label: "My Goals", icon: Flag, requiresManager: false, requiresHR: false, requiresAdmin: false },
        { href: "/dashboard/feedback", label: "My Kudos", icon: MessageSquare, requiresManager: false, requiresHR: false, requiresAdmin: false },
      ],
    },
    // ── MY TEAM: manager-scope items, visible when hasDirectReports ──
    {
      label: "My Team",
      items: [
        { href: "/dashboard/my-team", label: "Team Overview", icon: UsersRound, requiresManager: true, requiresHR: false, requiresAdmin: false },
        { href: "/dashboard/reviews", label: "Team Reviews", icon: FileText, requiresManager: true, requiresHR: false, requiresAdmin: false },
        // Team Goals tab on /dashboard/goals only renders for users with direct
        // reports — keep this link in lockstep so role-only managers (admins
        // with no reports) don't land on a tab that silently falls back to "Me".
        ...(canAccessManagerFeatures && workspace?.hasDirectReports
          ? [{ href: "/dashboard/goals?tab=team", label: "Team Goals", icon: Flag, requiresManager: true, requiresHR: false, requiresAdmin: false }]
          : []),
      ],
    },
    // ── MANAGE: HR/Admin org-wide tools ──
    {
      label: "Manage",
      items: [
        { href: "/dashboard/cycles", label: "Cycles", icon: CalendarClock, requiresManager: false, requiresHR: true, requiresAdmin: false },
        { href: "/dashboard/team", label: "Directory", icon: Users, requiresManager: false, requiresHR: true, requiresAdmin: false },
        { href: "/dashboard/surveys", label: "Surveys", icon: ClipboardList, requiresManager: false, requiresHR: true, requiresAdmin: false },
        { href: "/dashboard/templates", label: "Templates", icon: ListChecks, requiresManager: false, requiresHR: true, requiresAdmin: false },
        { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, requiresManager: false, requiresHR: true, requiresAdmin: false },
        { href: "/dashboard/admin/functions", label: "Functions", icon: Briefcase, requiresManager: false, requiresHR: true, requiresAdmin: false },
        { href: "/dashboard/settings", label: "Settings", icon: Settings2, requiresManager: false, requiresHR: true, requiresAdmin: false },
        { href: "/dashboard/settings/billing", label: "Billing", icon: CreditCard, requiresManager: false, requiresHR: false, requiresAdmin: true },
        { href: "/dashboard/admin/audit", label: "Audit log", icon: ScrollText, requiresManager: false, requiresHR: true, requiresAdmin: false },
      ],
    },
  ];

  // Filter items based on role
  const filteredSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.requiresAdmin && !canAccessAdminFeatures) return false;
        if (item.requiresHR && !canAccessHRFeatures) return false;
        if (item.requiresManager && !canAccessManagerFeatures) return false;
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  const initials = workspace?.name
    ? workspace.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : workspace?.email?.[0]?.toUpperCase() || "?";

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar — wrapped in SidebarWrapper for mobile drawer behaviour */}
      <SidebarWrapper workspaceName={workspace?.workspaceName} workspaceLogoUrl={workspace?.logoUrl}>
        {/* Logo */}
        <div className="h-[64px] flex items-center px-4 border-b border-sidebar-border">
          <Link href="/dashboard" className="flex items-center gap-3.5 min-w-0">
            {workspace?.logoUrl ? (
              <img src={workspace.logoUrl} alt="" className="h-11 w-11 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="h-11 w-11 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground text-base font-bold">{(workspace?.workspaceName || "N").charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div className="min-w-0">
              <span className="font-semibold text-[17px] text-sidebar-foreground tracking-tight block truncate leading-none">{workspace?.workspaceName || "Nami"}</span>
              <span className="text-[10px] text-muted-foreground/50 italic leading-none mt-1 block" style={{ fontFamily: "'Georgia', serif" }}>Powered by Nami</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {filteredSections.map((section, idx) => (
            <div key={section.label || `section-${idx}`}>
              {idx > 0 && <div className="my-2 mx-2 h-px bg-sidebar-border/60" />}
              {section.label && filteredSections.length > 1 && (
                <p className="text-[10px] font-medium text-sidebar-foreground/40 uppercase tracking-wider px-3 pt-2 pb-1">{section.label}</p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={<item.icon className="h-4 w-4 shrink-0" />}
                  />
                ))}
              </div>
            </div>
          ))}

          <div className="my-2 mx-2 h-px bg-sidebar-border/60" />
          <div className="space-y-0.5">
            <NavLink
              href="/dashboard/help"
              label="Help"
              icon={<HelpCircle className="h-4 w-4 shrink-0" />}
            />
          </div>
        </nav>

        {/* User Footer */}
        <div className="border-t border-sidebar-border p-3">
          <FooterDropdown
            initials={initials}
            name={workspace?.name || workspace?.email || "User"}
            roleLabel={ROLE_LABELS[workspace?.role as UserRole] || workspace?.role || "User"}
            isAdmin={canAccessAdminFeatures}
          />
        </div>
      </SidebarWrapper>

      {/* Realtime watcher — refreshes layout when user's role changes */}
      <RoleWatcher appUserId={workspace.appUserId} />

      {/* Main content
          — desktop (lg+): offset by sidebar width
          — mobile: full width with top padding for the fixed mobile header */}
      <main className="lg:ml-[240px] min-h-screen pt-14 lg:pt-0">
        <div className="px-4 lg:px-8 py-6 lg:py-8">
          <WidgetErrorBoundary label="page">{children}</WidgetErrorBoundary>
        </div>
      </main>
    </div>
  );
}
