"use client";

import { useDraggable } from "@dnd-kit/core";
import Link from "next/link";
import clsx from "clsx";
import { TemperatureBadge } from "@/components/leads/temperature-badge";
import { Avatar } from "@/components/ui/avatar";

export type KanbanLead = {
  id: string;
  leadCode: string;
  name: string;
  phone: string;
  temperature: string;
  priority: string;
  interestedProduct: string | null;
  assignedUser: { id: string; name: string } | null;
};

export function KanbanCard({
  lead,
  disabled,
  overlay,
}: {
  lead: KanbanLead;
  disabled: boolean;
  /** The floating copy dnd-kit renders under the pointer while dragging. */
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    disabled,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={clsx(
        "rounded-lg border border-slate-200/80 bg-white p-3 text-sm shadow-[0_1px_2px_rgba(10,11,16,0.04)] transition duration-150",
        !disabled &&
          "cursor-grab hover:-translate-y-px hover:border-slate-300 hover:shadow-[0_4px_10px_rgba(10,11,16,0.06)] active:cursor-grabbing",
        isDragging && !overlay && "opacity-40",
        overlay && "rotate-2 scale-[1.03] cursor-grabbing border-brand-300 shadow-[0_16px_32px_-8px_rgba(10,11,16,0.22)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/leads/${lead.id}`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="hover:text-brand-600 font-medium text-slate-900"
        >
          {lead.name}
        </Link>
        <TemperatureBadge temperature={lead.temperature} />
      </div>
      <p className="tnum mt-0.5 text-xs text-slate-400">{lead.leadCode}</p>
      {lead.interestedProduct && <p className="mt-1.5 truncate text-xs text-slate-600">{lead.interestedProduct}</p>}
      <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
        <span className="text-xs text-slate-400">{lead.assignedUser?.name ?? "Unassigned"}</span>
        {lead.assignedUser && <Avatar name={lead.assignedUser.name} size="xs" />}
      </div>
    </div>
  );
}
