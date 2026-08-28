import { requireUser } from "@/lib/auth/current-user";
import { listOverdueForUser } from "@/services/followup.service";
import { listResultOptions } from "@/repositories/lookup.repository";
import { FollowUpList } from "@/components/followups/followup-list";

export default async function OverdueFollowUpsPage() {
  const user = await requireUser();
  const [{ followUps, total }, results] = await Promise.all([
    listOverdueForUser(user, { page: 1, pageSize: 50 }),
    listResultOptions(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Overdue Follow-ups</h1>
      <p className="mt-1 text-sm text-slate-500">
        {total} overdue
        {total > 0 && " — carried over from earlier days. Call these first."}
      </p>

      <div className="mt-6">
        <FollowUpList
          items={followUps.map((f) => ({
            id: f.id,
            type: f.type,
            sequenceNumber: f.sequenceNumber,
            scheduledDate: f.scheduledDate.toISOString(),
            scheduledTime: f.scheduledTime,
            status: f.status,
            notes: f.notes,
            assignedUser: f.assignedUser,
            lead: f.lead,
            dealer: f.dealer,
          }))}
          results={results.map((r) => ({ id: r.id, name: r.name }))}
          emptyMessage="No overdue follow-ups. Nice work."
        />
      </div>
    </div>
  );
}
