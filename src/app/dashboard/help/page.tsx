import { redirect } from "next/navigation";
import { getAllArticles } from "@/lib/help-articles";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpCircle } from "lucide-react";

export default function HelpPage() {
  const articles = getAllArticles();

  if (articles.length > 0) {
    redirect(`/dashboard/help/${articles[0].slug}`);
  }

  return (
    <div className="py-8">
      <EmptyState
        icon={HelpCircle}
        title="Help Center"
        description="No articles available yet. Need help? Reach out to our support team."
        actions={[
          { label: "Contact Support", href: "mailto:support@namihr.com" },
          { label: "Back to Dashboard", href: "/dashboard", variant: "outline" },
        ]}
      />
    </div>
  );
}
