"use client";

import { useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { KanbanColumn } from "@/components/pipeline/kanban-column";
import { KanbanCard, type KanbanLead } from "@/components/pipeline/kanban-card";

type Option = { id: string; name: string };
type BoardLead = KanbanLead & { updatedAt: string };
type Column = {
  status: { id: string; name: string; isTerminal: boolean };
  total: number;
  leads: BoardLead[];
};

export function KanbanBoard({
  initialColumns,
  lostReasons,
  canChangeStatus,
}: {
  initialColumns: Column[];
  lostReasons: Option[];
  canChangeStatus: boolean;
}) {
  const [columns, setColumns] = useState(initialColumns);
  const [activeLead, setActiveLead] = useState<BoardLead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingLostDrop, setPendingLostDrop] = useState<{ lead: BoardLead; fromStatusId: string; toStatusId: string } | null>(
    null
  );
  const [lostReasonId, setLostReasonId] = useState("");
  const [submittingLostReason, setSubmittingLostReason] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function findLead(leadId: string) {
    for (const col of columns) {
      const lead = col.leads.find((l) => l.id === leadId);
      if (lead) return { lead, columnStatusId: col.status.id };
    }
    return null;
  }

  function moveLeadLocally(lead: BoardLead, fromStatusId: string, toStatusId: string) {
    setColumns((cols) =>
      cols.map((col) => {
        if (col.status.id === fromStatusId) {
          return { ...col, leads: col.leads.filter((l) => l.id !== lead.id), total: col.total - 1 };
        }
        if (col.status.id === toStatusId) {
          return { ...col, leads: [lead, ...col.leads], total: col.total + 1 };
        }
        return col;
      })
    );
  }

  async function commitStatusChange(leadId: string, statusId: string, lostReasonIdArg?: string) {
    const res = await fetch(`/api/v1/leads/${leadId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusId, lostReasonId: lostReasonIdArg }),
    });
    return res;
  }

  function handleDragStart(event: DragStartEvent) {
    const found = findLead(String(event.active.id));
    setActiveLead(found?.lead ?? null);
    setError(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveLead(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = String(active.id);
    const toStatusId = String(over.id);
    const found = findLead(leadId);
    if (!found || found.columnStatusId === toStatusId) return;

    const fromStatusId = found.columnStatusId;
    const targetColumn = columns.find((c) => c.status.id === toStatusId);

    if (targetColumn?.status.name === "LOST") {
      // Needs a lost reason before we commit — hold off moving the card.
      setPendingLostDrop({ lead: found.lead, fromStatusId, toStatusId });
      return;
    }

    moveLeadLocally(found.lead, fromStatusId, toStatusId);
    const res = await commitStatusChange(leadId, toStatusId);
    if (!res.ok) {
      const data = await res.json();
      moveLeadLocally(found.lead, toStatusId, fromStatusId); // revert
      setError(data.error ?? "Failed to update status");
    }
  }

  async function confirmLostDrop() {
    if (!pendingLostDrop || !lostReasonId) return;
    setSubmittingLostReason(true);
    const { lead, fromStatusId, toStatusId } = pendingLostDrop;
    const res = await commitStatusChange(lead.id, toStatusId, lostReasonId);
    setSubmittingLostReason(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to update status");
      setPendingLostDrop(null);
      setLostReasonId("");
      return;
    }
    moveLeadLocally(lead, fromStatusId, toStatusId);
    setPendingLostDrop(null);
    setLostReasonId("");
  }

  return (
    <div>
      {error && (
        <div className="mb-3 flex items-center justify-between rounded border border-chip-neg/25 bg-chip-neg/5 px-3.5 py-2.5 text-sm text-chip-neg">
          {error}
          <button onClick={() => setError(null)} className="text-xs font-medium hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Explicit id: dnd-kit otherwise assigns aria-describedby from an
          internal auto-increment counter that can drift between the SSR
          pass and the client hydration pass, tripping a hydration mismatch. */}
      <DndContext id="pipeline-board" sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map((col) => (
            <KanbanColumn
              key={col.status.id}
              statusId={col.status.id}
              statusName={col.status.name}
              leads={col.leads}
              total={col.total}
              canDrop={canChangeStatus}
            />
          ))}
        </div>
        <DragOverlay>{activeLead ? <KanbanCard lead={activeLead} disabled /> : null}</DragOverlay>
      </DndContext>

      {pendingLostDrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Why was this lead lost?</h3>
            <p className="mt-1 text-sm text-slate-500">A reason is required before {pendingLostDrop.lead.name} moves to Lost.</p>
            <select
              value={lostReasonId}
              onChange={(e) => setLostReasonId(e.target.value)}
              className="focus:border-brand-400 focus:ring-brand-100 mt-4 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2"
            >
              <option value="">Select a lost reason…</option>
              {lostReasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setPendingLostDrop(null);
                  setLostReasonId("");
                }}
                className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmLostDrop}
                disabled={!lostReasonId || submittingLostReason}
                className="rounded bg-chip-neg px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
              >
                {submittingLostReason ? "Saving…" : "Mark lost"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
