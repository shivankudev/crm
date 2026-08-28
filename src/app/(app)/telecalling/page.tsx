import { requireUser } from "@/lib/auth/current-user";
import { getTelecallerDailyStats, getTelecallingQueueForUser } from "@/services/telecalling.service";
import { listResultOptions } from "@/repositories/lookup.repository";
import { TelecallingWorkspace } from "@/app/(app)/telecalling/telecalling-workspace";

export default async function TelecallingPage() {
  const user = await requireUser();
  const [{ items, counts }, results, stats] = await Promise.all([
    getTelecallingQueueForUser(user),
    listResultOptions(),
    getTelecallerDailyStats(user),
  ]);

  return (
    <TelecallingWorkspace
      initialItems={items}
      counts={counts}
      results={results.map((r) => ({ id: r.id, name: r.name }))}
      initialStats={stats}
    />
  );
}
