"use client";

import { useEffect, useState } from "react";
import { Paperclip, X, Check, Users2, User, AlertTriangle, MessageSquare, Sparkles, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { WA_TRIGGER_OUTCOME, WA_TRIGGER_CADENCE_STEP } from "@/lib/whatsapp-constants";

type Target = { id: string; name: string };
type TemplateData = {
  triggerType: string;
  triggerKey: string;
  text: string | null;
  enabled: boolean;
  mediaFileName: string | null;
};

const ALL = "__all__";

/**
 * Same accents the calling screen paints its outcome buttons with, so an
 * admin editing "Wrong Number" here sees the colour they'll see on the
 * button that fires it. Neutral fallback keeps a Settings-added custom
 * outcome rendering sensibly.
 */
const OUTCOME_ACCENTS: Record<string, { dot: string; tint: string }> = {
  "Connected - Interested": { dot: "bg-chip-pos", tint: "bg-chip-pos/10 text-chip-pos" },
  "Connected - Not Interested": { dot: "bg-amber-500", tint: "bg-amber-50 text-amber-800" },
  "Not Reachable": { dot: "bg-slate-400", tint: "bg-slate-100 text-slate-600" },
  "Wrong Number": { dot: "bg-chip-neg", tint: "bg-chip-neg/10 text-chip-neg" },
  "Call Back Later": { dot: "bg-brand-500", tint: "bg-brand-50 text-brand-700" },
};
const NEUTRAL_ACCENT = { dot: "bg-slate-300", tint: "bg-slate-100 text-slate-600" };

function findTemplate(templates: TemplateData[], triggerType: string, triggerKey: string) {
  return templates.find((t) => t.triggerType === triggerType && t.triggerKey === triggerKey) ?? null;
}

/** A row counts as set up only if it would actually send something. */
function isConfigured(t: TemplateData | null) {
  return Boolean(t && t.enabled && (t.text || t.mediaFileName));
}

/** Section heading with a coverage count, so gaps are visible at a glance. */
function SectionHeader({
  title,
  blurb,
  configured,
  total,
}: {
  title: string;
  blurb: string;
  configured: number | null;
  total: number;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{title}</p>
        {configured !== null && total > 0 && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              configured === 0 ? "bg-slate-100 text-slate-500" : "bg-chip-pos/10 text-chip-pos"
            }`}
          >
            {configured} of {total} set up
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500">{blurb}</p>
    </div>
  );
}

/**
 * Admin-side editor for the automated WhatsApp messages.
 *
 * Templates are set centrally rather than by each telecaller: the business
 * decides what goes out under its name, and a telecaller only links their
 * own device. "All telecallers" writes the same template to every active
 * telecaller at once, which is the normal case — per-person overrides exist
 * for the exception, not the rule.
 */
export function WhatsAppTemplatesAdmin({
  targets,
  resultNames,
  sequenceNumbers,
}: {
  targets: Target[];
  resultNames: string[];
  sequenceNumbers: number[];
}) {
  const [scope, setScope] = useState<string>(ALL);
  const [loaded, setLoaded] = useState<TemplateData[]>([]);
  /**
   * Which scope `loaded` actually belongs to.
   *
   * The rows seed their fields from props on mount only, so they must not be
   * mounted until the data for the CURRENT scope has arrived. Without this
   * gate the rows mounted immediately on a scope change — while the fetch
   * was still in flight — read an empty list, and never re-seeded when the
   * response landed. The admin saw blank boxes for a telecaller who
   * actually had messages configured, and could overwrite them without ever
   * seeing them. It also stops one person's messages flashing up while the
   * next person's request is still running.
   */
  const [loadedFor, setLoadedFor] = useState<string>(ALL);

  // A specific person shows their current messages. "All telecallers" has no
  // single answer to show — different people may hold different text — so it
  // starts empty, and whatever is saved becomes the new value for everyone.
  useEffect(() => {
    if (scope === ALL) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoaded([]);
      setLoadedFor(ALL);
      return;
    }

    let cancelled = false;
    fetch(`/api/v1/settings/whatsapp-templates?userId=${encodeURIComponent(scope)}`)
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => {
        if (cancelled) return; // a newer scope was picked while this was in flight
        setLoaded(d.templates ?? []);
        setLoadedFor(scope);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const ready = loadedFor === scope;

  const find = (t: string, k: string) => findTemplate(loaded, t, k);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-medium text-slate-900">Who should these apply to?</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <button
            onClick={() => setScope(ALL)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              scope === ALL
                ? "border-brand-500 bg-brand-600 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <Users2 size={14} />
            All telecallers
            <span
              className={`rounded-full px-1.5 text-xs ${scope === ALL ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}
            >
              {targets.length}
            </span>
          </button>
          {targets.map((t) => (
            <button
              key={t.id}
              onClick={() => setScope(t.id)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                scope === t.id
                  ? "border-brand-500 bg-brand-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <User size={14} />
              {t.name}
            </button>
          ))}
        </div>
        <p
          className={`flex items-start gap-2 px-4 py-2.5 text-xs ${
            scope === ALL ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-500"
          }`}
        >
          {scope === ALL ? (
            <>
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>
                Saving overwrites that message for <strong>every</strong> active telecaller, replacing anything
                they had for it.
              </span>
            </>
          ) : (
            <>
              <User size={13} className="mt-0.5 shrink-0" />
              <span>Showing this telecaller&apos;s own messages. Saving changes only them.</span>
            </>
          )}
        </p>
      </Card>

      {targets.length === 0 && (
        <Card className="p-4 text-sm text-slate-500">
          No active telecallers yet — add one under Users &amp; Permissions first.
        </Card>
      )}

      <div>
        <SectionHeader
          title="Call outcome messages"
          blurb="Sent to the lead the moment a telecaller logs this outcome."
          configured={ready ? resultNames.filter((n) => isConfigured(find(WA_TRIGGER_OUTCOME, n))).length : null}
          total={resultNames.length}
        />
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {!ready && <p className="p-4 text-sm text-slate-400">Loading…</p>}
          {ready &&
            resultNames.map((name) => (
              <TemplateRow
                key={`${scope}-${name}`}
                label={name}
                accent={OUTCOME_ACCENTS[name] ?? NEUTRAL_ACCENT}
                triggerType={WA_TRIGGER_OUTCOME}
                triggerKey={name}
                template={find(WA_TRIGGER_OUTCOME, name)}
                scope={scope}
                disabled={targets.length === 0}
              />
            ))}
        </Card>
      </div>

      <div>
        <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          Cadence step messages
        </p>
        <p className="mb-3 text-xs text-slate-500">
          The welcome message goes out as soon as a lead is added. The rest are sent when a call advances a lead
          onto that follow-up step. Bulk CSV imports do not send the welcome message.
        </p>
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {!ready && <p className="p-4 text-sm text-slate-400">Loading…</p>}
          {ready &&
            sequenceNumbers.map((n) => (
              <TemplateRow
                key={`${scope}-c${n}`}
                label={n === 1 ? "Welcome message" : `Follow-up #${n}`}
                sublabel={n === 1 ? "sent as soon as a lead is added" : undefined}
                accent={n === 1 ? { dot: "bg-brand-500", tint: "bg-brand-50 text-brand-700" } : NEUTRAL_ACCENT}
                icon={n === 1 ? Sparkles : MessageSquare}
                triggerType={WA_TRIGGER_CADENCE_STEP}
                triggerKey={String(n)}
                template={find(WA_TRIGGER_CADENCE_STEP, String(n))}
                scope={scope}
                disabled={targets.length === 0}
              />
            ))}
          {ready && sequenceNumbers.length === 0 && (
            <p className="p-4 text-sm text-slate-400">No follow-up cadence steps configured yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function TemplateRow({
  label,
  sublabel,
  accent,
  icon: Icon,
  triggerType,
  triggerKey,
  template,
  scope,
  disabled,
}: {
  label: string;
  sublabel?: string;
  accent: { dot: string; tint: string };
  icon?: LucideIcon;
  triggerType: string;
  triggerKey: string;
  template: TemplateData | null;
  scope: string;
  disabled: boolean;
}) {
  const toast = useToast();
  const [text, setText] = useState(template?.text ?? "");
  const [enabled, setEnabled] = useState(template?.enabled ?? true);
  const [file, setFile] = useState<File | null>(null);
  const [removeMedia, setRemoveMedia] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const currentMediaName = removeMedia ? null : (file?.name ?? template?.mediaFileName ?? null);
  // Reflects what's typed right now, not just what was saved — so the status
  // pill stops saying "Not set" the moment an admin starts writing.
  const willSend = Boolean(enabled && (text.trim() || currentMediaName));

  async function save() {
    setSaving(true);
    const form = new FormData();
    form.set("triggerType", triggerType);
    form.set("triggerKey", triggerKey);
    form.set("text", text);
    form.set("enabled", String(enabled));
    if (removeMedia) form.set("removeMedia", "true");
    if (file) form.set("file", file);
    if (scope === ALL) form.set("applyToAll", "true");
    else form.set("targetUserId", scope);

    const res = await fetch("/api/v1/settings/whatsapp-templates", { method: "PUT", body: form });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error ?? "Failed to save the message");
      return;
    }
    setFile(null);
    setRemoveMedia(false);
    setDirty(false);
    const n = data.appliedTo ?? 1;
    toast.success(`${label} saved for ${n} telecaller${n === 1 ? "" : "s"}.`);
  }

  return (
    <div className={`p-4 transition-colors ${dirty ? "bg-brand-50/40" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${accent.dot}`} aria-hidden />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
              {Icon && <Icon size={13} className="shrink-0 text-slate-400" />}
              {label}
            </p>
            {sublabel && <p className="text-xs text-slate-400">{sublabel}</p>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              willSend ? accent.tint : "bg-slate-100 text-slate-400"
            }`}
          >
            {willSend ? "Will send" : "Not set"}
          </span>
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
            On
          </label>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        placeholder="Message text (optional if a file is attached)"
        rows={2}
        disabled={disabled}
        className="focus:border-brand-400 focus:ring-brand-100 mt-2.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 disabled:bg-slate-50"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="hover:border-brand-300 hover:bg-brand-50/30 flex cursor-pointer items-center gap-1.5 rounded border border-dashed border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition">
          <Paperclip size={13} />
          {currentMediaName ? "Replace file" : "Attach image/video/document"}
          <input
            type="file"
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setRemoveMedia(false);
              setDirty(true);
            }}
          />
        </label>

        {currentMediaName && (
          <span className="flex min-w-0 items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
            <span className="truncate">{currentMediaName}</span>
            <button
              onClick={() => {
                setFile(null);
                setRemoveMedia(true);
                setDirty(true);
              }}
              className="hover:text-chip-neg shrink-0 text-slate-400"
              title="Remove attachment"
            >
              <X size={12} />
            </button>
          </span>
        )}

        <Button size="sm" icon={Check} onClick={save} disabled={saving || !dirty || disabled} className="ml-auto">
          {saving ? "Saving…" : dirty ? "Save" : "Saved"}
        </Button>
      </div>
    </div>
  );
}
