import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function ReportsLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <Skeleton className="h-7 w-24" />
      <Skeleton className="mt-2 h-4 w-32" />
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <Card className="p-5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-4 h-24 w-full" />
        </Card>
        <Card className="p-5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-4 h-24 w-full" />
        </Card>
      </div>
    </div>
  );
}
