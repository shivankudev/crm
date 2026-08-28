"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";

export function TelecallerStatusesEditor({
  allStatusNames,
  allowedStatusNames,
}: {
  allStatusNames: string[];
  allowedStatusNames: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(new Set(allowedStatusNames));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    await fetch("/api/v1/settings/telecaller-statuses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusNames: [...selected] }),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <Card className="p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {allStatusNames.map((name) => (
          <label key={name} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selected.has(name)}
              onChange={() => toggle(name)}
              className="accent-brand-600"
            />
            <span className="font-mono text-xs">{name}</span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-chip-pos">
            <Check size={14} />
            Saved
          </span>
        )}
      </div>
    </Card>
  );
}
