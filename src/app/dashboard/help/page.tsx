import { redirect } from "next/navigation";
import { getAllArticles } from "@/lib/help-articles";

export default function HelpPage() {
  const articles = getAllArticles();

  if (articles.length > 0) {
    redirect(`/dashboard/help/${articles[0].slug}`);
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h1 className="text-2xl font-semibold text-foreground mb-2">
        Help Center
      </h1>
      <p className="text-muted-foreground">
        No articles available yet. Check back soon!
      </p>
    </div>
  );
}
