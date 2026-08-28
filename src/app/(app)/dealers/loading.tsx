import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function DealersLoading() {
  return (
    <div>
      <Skeleton className="h-7 w-24" />
      <Skeleton className="mt-2 h-4 w-32" />
      <div className="mt-4 flex flex-wrap gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="mt-4">
        <TableSkeleton rows={8} cols={6} />
      </div>
    </div>
  );
}
