import { FloatingNav } from "@/components/marketing/floating-nav";

// Shared marketing-site header. Now a thin wrapper over the floating, scroll-
// aware pill navbar (FloatingNav) so every public page shares identical chrome
// — logo, grouped Product/Resources menus, theme toggle, Sign in, and the
// Add-to-Slack CTA.
export function SiteHeader({ ctaPurpose = "marketing" }: { ctaPurpose?: string }) {
  return <FloatingNav ctaPurpose={ctaPurpose} />;
}
