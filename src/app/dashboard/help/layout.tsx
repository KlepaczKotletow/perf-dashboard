import { getArticlesGroupedByCategory } from "@/lib/help-articles";
import { HelpSidebar } from "@/components/help/help-sidebar";

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  const grouped = getArticlesGroupedByCategory();

  return (
    <div className="-mx-4 lg:-mx-8 -my-6 lg:-my-8 flex min-h-screen">
      <HelpSidebar grouped={grouped} />
      <main className="flex-1 overflow-y-auto min-w-0">
        <div className="px-6 py-8 lg:px-12 lg:py-10 pt-16 lg:pt-10">
          {children}
        </div>
      </main>
    </div>
  );
}
