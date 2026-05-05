import { redirect } from "next/navigation";
import { getAllArticles } from "@/lib/help-articles";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export default function HelpPage() {
  const articles = getAllArticles();

  if (articles.length > 0) {
    redirect(`/dashboard/help/${articles[0].slug}`);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader hat="my-work" title="Help" />
      <EmptyState
        icon={HelpCircle}
        title="Help Center"
        description="No articles available yet. Need help? Reach out to our support team."
        actions={[
          { label: "Contact Support", href: "mailto:hello@namihr.com" },
          { label: "Back to Dashboard", href: "/dashboard", variant: "outline" },
        ]}
      />
    </div>
  );
}
