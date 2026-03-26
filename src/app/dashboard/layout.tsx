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
  SlidersHorizontal,
  Settings2,
  HelpCircle,
} from "lucide-react";
import { getUserWorkspace } from "@/lib/supabase-server";
import { FooterDropdown } from "./footer-dropdown";
import { isManagerOrAbove, isAdmin, ROLE_LABELS, UserRole } from "@/lib/roles";
import { NavLink } from "./nav-link";
import { SidebarWrapper } from "./sidebar-wrapper";

interface NavSection {
  label: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
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

  if (!workspace) {
    redirect("/");
  }

  if (!workspace.onboardingCompleted) {
    redirect("/onboarding");
  }

  const canAccessManagerFeatures = isManagerOrAbove(workspace?.role);
  const canAccessAdminFeatures = isAdmin(workspace?.role);

  const sections: NavSection[] = [
    {
      label: "Personal",
      items: [
        { href: "/dashboard", label: "Overview", icon: LayoutDashboard, requiresManager: true, requiresAdmin: false },
        { href: "/dashboard/performance", label: "Performance", icon: ClipboardCheck, requiresManager: false, requiresAdmin: false },
        { href: "/dashboard/feedback", label: "Kudos", icon: MessageSquare, requiresManager: false, requiresAdmin: false },
        { href: "/dashboard/goals", label: "Goals", icon: Flag, requiresManager: false, requiresAdmin: false },
      ],
    },
    {
      label: "People",
      items: [
        { href: "/dashboard/my-team", label: "My Team", icon: UsersRound, requiresManager: true, requiresAdmin: false },
        { href: "/dashboard/team", label: "Directory", icon: Users, requiresManager: true, requiresAdmin: false },
        { href: "/dashboard/reviews", label: "Reviews", icon: FileText, requiresManager: true, requiresAdmin: false },
      ],
    },
    {
      label: "Organization",
      items: [
        { href: "/dashboard/cycles", label: "Cycles", icon: CalendarClock, requiresManager: true, requiresAdmin: false },
        { href: "/dashboard/surveys", label: "Surveys", icon: ClipboardList, requiresManager: true, requiresAdmin: false },
        { href: "/dashboard/templates", label: "Templates", icon: ListChecks, requiresManager: true, requiresAdmin: false },
        { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, requiresManager: true, requiresAdmin: false },
      ],
    },
    {
      label: "Settings",
      items: [
        { href: "/dashboard/settings", label: "Settings", icon: Settings2, requiresManager: false, requiresAdmin: true },
        { href: "/dashboard/admin/functions", label: "Functions", icon: Briefcase, requiresManager: false, requiresAdmin: true },
        { href: "/dashboard/settings/forms", label: "Forms", icon: SlidersHorizontal, requiresManager: false, requiresAdmin: true },
        { href: "/dashboard/settings/billing", label: "Billing", icon: CreditCard, requiresManager: false, requiresAdmin: true },
      ],
    },
  ];

  // Filter items based on role
  const filteredSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.requiresAdmin && !canAccessAdminFeatures) return false;
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
      <SidebarWrapper>
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-sidebar-border">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <span className="text-primary-foreground text-xs font-bold">{(workspace?.workspaceName || "N").charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-[15px] text-sidebar-foreground tracking-tight block truncate">{workspace?.workspaceName || "Nami"}</span>
              <span className="text-[10px] text-muted-foreground/60 italic tracking-wide" style={{ fontFamily: "'Georgia', serif" }}>Powered by Nami</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {filteredSections.map((section, idx) => (
            <div key={section.label}>
              {idx > 0 && <div className="my-2 mx-2 h-px bg-sidebar-border/60" />}
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

      {/* Main content
          — desktop (lg+): offset by sidebar width
          — mobile: full width with top padding for the fixed mobile header */}
      <main className="lg:ml-[240px] min-h-screen pt-14 lg:pt-0">
        <div className="px-4 lg:px-8 py-6 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
