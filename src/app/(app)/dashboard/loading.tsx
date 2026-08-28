import { Skeleton, StatCardSkeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div>
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-2 h-4 w-32" />

      <Skeleton className="mt-5 h-5 w-28" />
      <div className="mt-2 flex flex-wrap divide-x divide-slate-200 rounded-lg border border-slate-200 bg-white px-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      <Skeleton className="mt-6 h-5 w-24" />
      <div className="mt-2 flex flex-wrap divide-x divide-slate-200 rounded-lg border border-slate-200 bg-white px-1">
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    </div>
  );
}
