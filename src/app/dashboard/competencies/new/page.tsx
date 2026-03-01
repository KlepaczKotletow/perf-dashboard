import { redirect } from "next/navigation";

// Inline creation is now available on the main competencies page.
export default function NewCompetencyPage() {
  redirect("/dashboard/competencies");
}
