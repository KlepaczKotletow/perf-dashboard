import { ListPageSkeleton } from "@/components/ui/page-skeleton";
export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto">
      <ListPageSkeleton rows={5} cols={4} />
    </div>
  );
}
