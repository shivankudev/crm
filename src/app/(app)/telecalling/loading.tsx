import { Skeleton, StatCardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function TelecallingLoading() {
  return (
    <div>
      <Skeleton className="h-6 w-28" />
      <Skeleton className="mt-2 h-3 w-48" />
      <div className="mt-5 flex flex-wrap divide-x divide-slate-200 rounded-lg border border-slate-200 bg-white px-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <StatCardSkeleton key={i} size="sm" />
        ))}
      </div>
      <Card className="mt-5 p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-5 w-56" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-3/4" />
        <div className="mt-5 flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </Card>
    </div>
  );
}
