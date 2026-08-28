"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, CheckCheck, Clock3, XCircle, Image as ImageIcon, FileText, Video, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";

type MessageLog = {
  id: string;
  triggerType: string;
  triggerKey: string;
  phone: string;
  messageType: string;
  status: string;
  error: string | null;
  createdAt: string;
  lead: { id: string; name: string; leadCode: string } | null;
};

/**
 * Per-status presentation. SENT deliberately reads "Sent" rather than
 * "Delivered": OpenWA's send response is not a delivery confirmation —
 * DELIVERED/READ only arrive later as WhatsApp acks — so calling a SENT
 * message delivered would be telling the telecaller something we don't
 * actually know.
 */
const STATUS_META: Record<string, { label: string; icon: typeof Check; className: string }> = {
  SENT: { label: "Sent", icon: Check, className: "text-slate-400" },
  DELIVERED: { label: "Delivered", icon: CheckCheck, className: "text-slate-500" },
  READ: { label: "Read", icon: CheckCheck, className: "text-chip-pos" },
  QUEUED: { label: "Queued", icon: Clock3, className: "text-slate-400" },
  FAILED: { label: "Failed", icon: XCircle, className: "text-chip-neg" },
  SKIPPED_NOT_CONNECTED: { label: "Not sent", icon: AlertTriangle, className: "text-chip-neg" },
};

const TYPE_ICONS: Record<string, typeof MessageSquare> = {
  text: MessageSquare,
  image: ImageIcon,
  video: Video,
  document: FileText,
};

export function WhatsAppDeliveryPanel() {
  const [messages, setMessages] = useState<MessageLog[] | null>(null);
  const [summary, setSummary] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/v1/whatsapp/messages")
      .then((r) => (r.ok ? r.json() : { messages: [], summary: {} }))
      .then((data) => {
        setMessages(data.messages ?? []);
        setSummary(data.summary ?? {});
      })
      .catch(() => setMessages([]));
  }, []);

  if (messages === null) {
    return (
      <Card className="mt-3 p-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-3 w-full" />
        <Skeleton className="mt-2 h-3 w-2/3" />
      </Card>
    );
  }

  if (messages.length === 0) return null; // nothing sent yet — no empty shell on the dashboard

  const problems = (summary.FAILED ?? 0) + (summary.SKIPPED_NOT_CONNECTED ?? 0);
  const delivered = (summary.DELIVERED ?? 0) + (summary.READ ?? 0);

  return (
    <Card className="mt-3 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-medium text-slate-900">WhatsApp messages</p>
        <p className="tnum text-xs text-slate-500">
          Last 24h · <span className="text-chip-pos">{delivered} delivered</span>
          {(summary.SENT ?? 0) > 0 && <> · {summary.SENT} sent</>}
          {problems > 0 && <> · <span className="font-semibold text-chip-neg">{problems} not delivered</span></>}
        </p>
      </div>

      {problems > 0 && (
        <div className="flex items-start gap-2 border-b border-chip-neg/20 bg-chip-neg/5 px-4 py-2.5 text-xs text-chip-neg">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            {problems} message{problems === 1 ? "" : "s"} didn&apos;t reach the lead. Check your WhatsApp connection
            above, then re-send from the lead if needed.
          </span>
        </div>
      )}

      <ul className="divide-y divide-slate-50">
        {messages.map((m) => {
          const meta = STATUS_META[m.status] ?? STATUS_META.SENT;
          const StatusIcon = meta.icon;
          const TypeIcon = TYPE_ICONS[m.messageType] ?? MessageSquare;
          return (
            <li key={m.id} className="flex items-center gap-3 px-4 py-2 text-xs">
              <TypeIcon size={13} className="shrink-0 text-slate-300" />
              <span className="min-w-0 flex-1 truncate text-slate-700">
                {m.lead ? (
                  <Link href={`/leads/${m.lead.id}`} className="hover:text-brand-600 font-medium">
                    {m.lead.name}
                  </Link>
                ) : (
                  <span className="font-medium">{m.phone}</span>
                )}
                <span className="ml-1.5 text-slate-400">
                  {m.triggerType === "CADENCE_STEP" ? `follow-up #${m.triggerKey}` : m.triggerKey}
                </span>
              </span>
              <span className="shrink-0 text-slate-300">{formatDate(m.createdAt)}</span>
              <span className={`flex shrink-0 items-center gap-1 font-medium ${meta.className}`} title={m.error ?? undefined}>
                <StatusIcon size={13} />
                {meta.label}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
