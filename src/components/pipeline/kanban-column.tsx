"use client";

import { useDroppable } from "@dnd-kit/core";
import clsx from "clsx";
import { KanbanCard, type KanbanLead } from "@/components/pipeline/kanban-card";

export function KanbanColumn({
  statusId,
  statusName,
  leads,
  total,
  canDrop,
}: {
  statusId: string;
  statusName: string;
  leads: KanbanLead[];
  total: number;
  canDrop: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: statusId, disabled: !canDrop });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "flex w-72 shrink-0 flex-col rounded-lg border bg-slate-50/60 transition duration-150",
        isOver
          ? "border-brand-300 bg-brand-50/50 ring-2 ring-brand-200/60"
          : "border-slate-200/80"
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-200/70 px-3.5 py-2.5">
        <p className="text-sm font-medium text-slate-800">{statusName.replaceAll("_", " ")}</p>
        <span className="tnum rounded-full bg-white px-1.5 py-0.5 text-xs font-medium text-slate-500 shadow-[0_1px_1px_rgba(15,23,42,0.05)]">
          {total}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: "calc(100vh - 260px)" }}>
        {leads.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-slate-400">No leads here</p>
        ) : (
          <>
            {leads.map((lead, i) => (
              <div
                key={lead.id}
                className="motion-stagger"
                style={{ "--i": Math.min(i, 6) } as React.CSSProperties}
              >
                <KanbanCard lead={lead} disabled={!canDrop} />
              </div>
            ))}
            {total > leads.length && (
              <p className="tnum px-1 py-1 text-center text-xs text-slate-400">+{total - leads.length} more</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
