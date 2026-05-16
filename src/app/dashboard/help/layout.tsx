import { getArticlesGroupedByCategory } from "@/lib/help-articles";
import { HelpSidebar } from "@/components/help/help-sidebar";

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  const grouped = getArticlesGroupedByCategory();

  return (
    <div className="max-w-6xl mx-auto flex min-h-[calc(100vh-8rem)] rounded-lg border border-border/60 overflow-hidden">
      <HelpSidebar grouped={grouped} />
      <main className="flex-1 overflow-y-auto min-w-0">
        <div className="px-6 py-8 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
