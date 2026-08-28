"use client";

import { useState } from "react";
import { Paperclip, X, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { WhatsAppWidget } from "@/components/whatsapp/whatsapp-widget";
import { WA_TRIGGER_OUTCOME, WA_TRIGGER_CADENCE_STEP } from "@/lib/whatsapp-constants";

type TemplateData = {
  triggerType: string;
  triggerKey: string;
  text: string | null;
  enabled: boolean;
  mediaFileName: string | null;
};

function findTemplate(templates: TemplateData[], triggerType: string, triggerKey: string) {
  return templates.find((t) => t.triggerType === triggerType && t.triggerKey === triggerKey) ?? null;
}

export function WhatsAppSettings({
  resultNames,
  sequenceNumbers,
  initialTemplates,
}: {
  resultNames: string[];
  sequenceNumbers: number[];
  initialTemplates: TemplateData[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);

  function onSaved(updated: TemplateData) {
    setTemplates((prev) => {
      const rest = prev.filter((t) => !(t.triggerType === updated.triggerType && t.triggerKey === updated.triggerKey));
      return [...rest, updated];
    });
  }

  return (
    <div className="space-y-6">
      <WhatsAppWidget />

      <div>
        <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          Call outcome messages
        </p>
        <p className="mb-3 text-xs text-slate-500">Sent instantly to the lead when you log this outcome.</p>
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {resultNames.map((name) => (
            <TemplateRow
              key={name}
              label={name}
              triggerType={WA_TRIGGER_OUTCOME}
              triggerKey={name}
              template={findTemplate(templates, WA_TRIGGER_OUTCOME, name)}
              onSaved={onSaved}
            />
          ))}
        </Card>
      </div>

      <div>
        <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          Cadence step messages
        </p>
        <p className="mb-3 text-xs text-slate-500">
          The welcome message goes out as soon as a lead is added. The rest are sent when your call advances a
          lead onto that follow-up step — fixed for every lead, same as the cadence itself. Bulk CSV imports do
          not send the welcome message.
        </p>
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {sequenceNumbers.map((n) => (
            <TemplateRow
              key={n}
              // Step 1 is special: it fires the moment a lead is created,
              // before anyone has called them — a welcome touch, not a
              // follow-up. Naming it "Follow-up #1" made people expect it
              // after a call.
              label={n === 1 ? "Welcome message (on new lead)" : `Follow-up #${n}`}
              triggerType={WA_TRIGGER_CADENCE_STEP}
              triggerKey={String(n)}
              template={findTemplate(templates, WA_TRIGGER_CADENCE_STEP, String(n))}
              onSaved={onSaved}
            />
          ))}
          {sequenceNumbers.length === 0 && (
            <p className="p-4 text-sm text-slate-400">No follow-up cadence steps configured yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function TemplateRow({
  label,
  triggerType,
  triggerKey,
  template,
  onSaved,
}: {
  label: string;
  triggerType: string;
  triggerKey: string;
  template: TemplateData | null;
  onSaved: (t: TemplateData) => void;
}) {
  const toast = useToast();
  const [text, setText] = useState(template?.text ?? "");
  const [enabled, setEnabled] = useState(template?.enabled ?? true);
  const [file, setFile] = useState<File | null>(null);
  const [removeMedia, setRemoveMedia] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const currentMediaName = removeMedia ? null : (file?.name ?? template?.mediaFileName ?? null);

  async function save() {
    setSaving(true);
    const form = new FormData();
    form.set("triggerType", triggerType);
    form.set("triggerKey", triggerKey);
    form.set("text", text);
    form.set("enabled", String(enabled));
    if (removeMedia) form.set("removeMedia", "true");
    if (file) form.set("file", file);

    const res = await fetch("/api/v1/whatsapp/templates", { method: "PUT", body: form });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error ?? "Failed to save the template");
      return;
    }
    setFile(null);
    setRemoveMedia(false);
    setDirty(false);
    onSaved({
      triggerType,
      triggerKey,
      text: data.template.text,
      enabled: data.template.enabled,
      mediaFileName: data.template.mediaFileName,
    });
    toast.success(`${label} message saved.`);
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setDirty(true);
            }}
            className="accent-brand-600"
          />
          Enabled
        </label>
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        placeholder="Message text (optional if a file is attached)"
        rows={2}
        className="focus:border-brand-400 focus:ring-brand-100 mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2"
      />

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="hover:border-brand-300 hover:bg-brand-50/30 flex cursor-pointer items-center gap-1.5 rounded border border-dashed border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition">
          <Paperclip size={13} />
          {currentMediaName ? "Replace file" : "Attach image/video/document"}
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setRemoveMedia(false);
              setDirty(true);
            }}
          />
        </label>

        {currentMediaName && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            {currentMediaName}
            <button
              onClick={() => {
                setFile(null);
                setRemoveMedia(true);
                setDirty(true);
              }}
              className="text-slate-400 hover:text-chip-neg"
              title="Remove attachment"
            >
              <X size={12} />
            </button>
          </span>
        )}

        <Button size="sm" icon={Check} onClick={save} disabled={saving || !dirty} className="ml-auto">
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
