"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Paperclip,
  X,
  Check,
  MapPin,
  ChevronUp,
  ChevronDown,
  MessageSquare,
  Film,
  FileText,
  AlertTriangle,
  Eye,
  EyeOff,
  Clock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type Media = { id: string; fileName: string; mimeType: string };
type QuickAction = {
  id: string;
  label: string;
  text: string | null;
  enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  media: Media[];
};

const inputClass =
  "focus:border-brand-400 focus:ring-brand-100 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2";

/** Mirrors the API's own limits so a doomed upload never leaves the browser. */
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 10;

/** Matches SEND_GAP_MS in whatsapp-quick-action.service.ts. */
const SEND_GAP_MS = 700;

/**
 * Admin editor for the one-press send buttons that appear on the
 * telecalling screen. Add or remove buttons freely — the calling screen
 * renders whatever is enabled here, so the count is whatever the business
 * needs rather than a fixed number.
 */
export function QuickActionsEditor({ initialActions }: { initialActions: QuickAction[] }) {
  const router = useRouter();
  const toast = useToast();
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/settings/quick-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't add that button");
        return;
      }
      setNewLabel("");
      router.refresh();
    } catch {
      toast.error("Couldn't reach the server — check your connection.");
    } finally {
      setCreating(false);
    }
  }

  const live = initialActions.filter((a) => a.enabled && hasContent(a)).length;

  return (
    <div className="space-y-4">
      {initialActions.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span className="font-medium text-slate-700">
            {initialActions.length} {initialActions.length === 1 ? "button" : "buttons"}
          </span>
          <span aria-hidden>·</span>
          <span className="bg-chip-pos/10 text-chip-pos inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium">
            <Eye size={11} /> {live} on the calling screen
          </span>
          {initialActions.length - live > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
              <EyeOff size={11} /> {initialActions.length - live} hidden
            </span>
          )}
        </div>
      )}

      {initialActions.length === 0 && (
        <Card className="p-4 text-sm text-slate-500">
          No buttons yet. Add one below — it appears on every telecaller&apos;s calling screen as soon as you
          give it a message, a file or a location.
        </Card>
      )}

      {initialActions.map((a, i) => (
        <ActionCard
          key={a.id}
          action={a}
          position={i}
          total={initialActions.length}
        />
      ))}

      <form onSubmit={create} className="flex items-center gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="New button label — e.g. Send brochure"
          className={inputClass}
        />
        <Button type="submit" variant="primary" icon={Plus} disabled={creating || !newLabel.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}

/** A button with none of the three is one the caller can't actually press. */
function hasContent(a: { text: string | null; latitude: number | null; media: unknown[] }) {
  return Boolean(a.text) || a.media.length > 0 || a.latitude !== null;
}

function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

/**
 * Pulls coordinates out of whatever an admin pastes — a Google Maps link
 * off their phone, or a bare "lat, lng". Nobody has the showroom's decimal
 * coordinates to hand, but everybody can share its map pin.
 */
function parseCoordinates(raw: string): { lat: number; lng: number } | null {
  const s = raw.trim();
  const inRange = (lat: number, lng: number) =>
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;

  const bare = s.match(/^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (bare) return inRange(Number(bare[1]), Number(bare[2]));

  // A place link carries the exact pin as !3d<lat>!4d<lng>. Prefer it over
  // the @lat,lng earlier in the URL, which is only where the map is centred
  // and can sit a street away from the pin itself.
  const pin = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pin) return inRange(Number(pin[1]), Number(pin[2]));

  const centre = s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (centre) return inRange(Number(centre[1]), Number(centre[2]));

  const query = s.match(/[?&](?:q|query|ll|destination)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/i);
  if (query) return inRange(Number(query[1]), Number(query[2]));

  return null;
}

function ActionCard({
  action,
  position,
  total,
}: {
  action: QuickAction;
  position: number;
  total: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [label, setLabel] = useState(action.label);
  const [text, setText] = useState(action.text ?? "");
  const [enabled, setEnabled] = useState(action.enabled);
  const [lat, setLat] = useState(action.latitude?.toString() ?? "");
  const [lng, setLng] = useState(action.longitude?.toString() ?? "");
  const [locName, setLocName] = useState(action.locationName ?? "");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);

  const mark = () => setDirty(true);

  /** Fills the lat/lng fields from a pasted link, or flags that it couldn't. */
  function applyPin(raw: string) {
    const parsed = parseCoordinates(raw);
    if (!parsed) {
      setPinError(true);
      return;
    }
    setLat(String(parsed.lat));
    setLng(String(parsed.lng));
    setPin("");
    setPinError(false);
    mark();
    toast.success("Coordinates picked up from that link.");
  }

  // What this button would send if pressed right now — from the live inputs,
  // not the saved row, so the preview tracks what's being typed.
  const pieces: { icon: typeof MessageSquare; label: string }[] = [];
  if (text.trim()) pieces.push({ icon: MessageSquare, label: "Message" });
  for (const m of action.media) {
    pieces.push({ icon: isImage(m.mimeType) ? Paperclip : m.mimeType.startsWith("video/") ? Film : FileText, label: m.fileName });
  }
  if (lat.trim() && lng.trim()) pieces.push({ icon: MapPin, label: locName.trim() || "Location pin" });

  const empty = pieces.length === 0;
  const seconds = Math.max(1, Math.round((pieces.length * SEND_GAP_MS) / 1000));

  async function request(url: string, init: RequestInit, fallback: string) {
    setBusy(true);
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? fallback);
        return null;
      }
      return data as Record<string, unknown>;
    } catch {
      toast.error("Couldn't reach the server — check your connection.");
      return null;
    } finally {
      // Always cleared: a network throw used to leave the card disabled
      // until a full page reload.
      setBusy(false);
    }
  }

  async function save() {
    const ok = await request(
      `/api/v1/settings/quick-actions/${action.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, text, enabled, latitude: lat, longitude: lng, locationName: locName }),
      },
      "Couldn't save that"
    );
    if (!ok) return;
    setDirty(false);
    toast.success(`"${label}" saved.`);
    router.refresh();
  }

  async function upload(files: FileList) {
    const chosen = Array.from(files);
    if (chosen.length > MAX_FILES_PER_UPLOAD) {
      toast.error(`Add at most ${MAX_FILES_PER_UPLOAD} files at a time.`);
      return;
    }
    // Checked here as well as on the server so a 40MB video doesn't upload
    // in full over the office line only to be rejected on arrival.
    const tooBig = chosen.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      toast.error(`"${tooBig.name}" is over the 15MB limit.`);
      return;
    }

    const form = new FormData();
    for (const f of chosen) form.append("files", f);
    const ok = await request(`/api/v1/settings/quick-actions/${action.id}`, { method: "PUT", body: form }, "Upload failed");
    if (!ok) return;
    toast.success(`${chosen.length} ${chosen.length === 1 ? "file" : "files"} attached.`);
    router.refresh();
  }

  async function moveMedia(mediaId: string, direction: "up" | "down") {
    const ok = await request(
      `/api/v1/settings/quick-actions/media/${mediaId}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ direction }) },
      "Couldn't reorder that"
    );
    if (ok) router.refresh();
  }

  async function removeMedia(id: string) {
    const ok = await request(
      `/api/v1/settings/quick-actions/media/${id}`,
      { method: "DELETE" },
      "Couldn't remove that attachment"
    );
    if (ok) router.refresh();
  }

  async function moveSelf(direction: "up" | "down") {
    const ok = await request(
      "/api/v1/settings/quick-actions",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: action.id, direction }),
      },
      "Couldn't reorder that"
    );
    if (ok) router.refresh();
  }

  async function remove() {
    const ok = await request(
      `/api/v1/settings/quick-actions/${action.id}`,
      { method: "DELETE" },
      "Couldn't delete that button"
    );
    if (!ok) return;
    toast.success(`"${action.label}" deleted.`);
    router.refresh();
  }

  const showing = enabled && !empty;

  return (
    <Card className={dirty ? "border-brand-200 bg-brand-50/30 p-4" : "p-4"}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Order on the calling screen — the row the caller reads left to right. */}
        <div className="flex shrink-0 flex-col">
          <button
            onClick={() => moveSelf("up")}
            disabled={busy || position === 0}
            aria-label="Move button earlier"
            className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={() => moveSelf("down")}
            disabled={busy || position === total - 1}
            aria-label="Move button later"
            className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <ChevronDown size={14} />
          </button>
        </div>

        <input
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            mark();
          }}
          aria-label="Button label"
          // Takes the rest of the first line on a phone so the status pill and
          // the Show/Delete controls wrap beneath it — sharing one row shrank
          // the label to about eight characters at 375px.
          className={`${inputClass} min-w-0 flex-1 basis-[calc(100%-3rem)] font-medium sm:max-w-[16rem] sm:basis-auto`}
        />

        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            showing ? "bg-chip-pos/10 text-chip-pos" : "bg-slate-100 text-slate-500"
          }`}
        >
          {showing ? <Eye size={11} /> : <EyeOff size={11} />}
          {showing ? "On the calling screen" : "Hidden"}
        </span>

        <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              mark();
            }}
            className="accent-brand-600"
          />
          Show
        </label>

        <button
          onClick={() => setConfirmingDelete(true)}
          disabled={busy}
          className="hover:text-chip-neg ml-auto shrink-0 text-xs font-medium text-slate-400"
        >
          <Trash2 size={13} className="inline" /> Delete
        </button>
      </div>

      {confirmingDelete && (
        <div className="border-chip-neg/25 bg-chip-neg/5 mt-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
          <AlertTriangle size={14} className="text-chip-neg shrink-0" />
          <p className="text-chip-neg min-w-0 flex-1 text-xs">
            Delete <strong>{action.label}</strong>
            {action.media.length > 0 && ` and its ${action.media.length} attachment${action.media.length === 1 ? "" : "s"}`}
            ? This can&apos;t be undone.
          </p>
          <button
            onClick={() => setConfirmingDelete(false)}
            className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white"
          >
            Cancel
          </button>
          <button
            onClick={remove}
            disabled={busy}
            className="bg-chip-neg rounded px-2.5 py-1 text-xs font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      )}

      {empty ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle size={13} className="mt-px shrink-0" />
          <span>
            Nothing to send yet. This button stays off the calling screen until you add a message, a file or a
            location.
          </span>
        </p>
      ) : (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
          <p className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            One press sends, in order
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium tracking-normal text-slate-500 normal-case">
              <Clock size={10} /> about {seconds}s
            </span>
          </p>
          <ol className="flex flex-wrap items-center gap-1.5">
            {pieces.map((p, i) => (
              <li
                key={i}
                className="flex max-w-[13rem] items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-600"
              >
                <span className="text-[10px] font-semibold text-slate-400">{i + 1}</span>
                <p.icon size={11} className="shrink-0 text-slate-400" />
                <span className="truncate">{p.label}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          mark();
        }}
        rows={2}
        placeholder="Message text sent with this button (optional)"
        className={`${inputClass} mt-3 bg-white`}
      />

      <div className="mt-3">
        <p className="mb-1.5 text-xs font-medium text-slate-500">
          Attachments ({action.media.length}) — sent in this order after the message
        </p>
        <div className="flex flex-wrap items-start gap-2">
          {action.media.map((m, i) => (
            <div
              key={m.id}
              className="group relative w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white"
            >
              <div className="flex h-16 items-center justify-center bg-slate-50">
                {isImage(m.mimeType) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/v1/settings/quick-actions/media/${m.id}`}
                    alt={m.fileName}
                    className="h-full w-full object-cover"
                  />
                ) : m.mimeType.startsWith("video/") ? (
                  <Film size={20} className="text-slate-400" />
                ) : (
                  <FileText size={20} className="text-slate-400" />
                )}
              </div>
              <p className="truncate px-1 py-1 text-[10px] text-slate-500" title={m.fileName}>
                {m.fileName}
              </p>

              <span className="absolute top-1 left-1 rounded bg-slate-900/70 px-1 text-[10px] font-semibold text-white">
                {i + 1}
              </span>
              <button
                onClick={() => removeMedia(m.id)}
                disabled={busy}
                aria-label={`Remove ${m.fileName}`}
                className="hover:bg-chip-neg absolute top-1 right-1 rounded bg-slate-900/70 p-0.5 text-white transition disabled:opacity-50"
              >
                <X size={10} />
              </button>

              {/* Order is send order, so it has to be changeable without
                  deleting and re-uploading the whole set. */}
              <div className="absolute right-1 bottom-6 flex gap-0.5">
                <button
                  onClick={() => moveMedia(m.id, "up")}
                  disabled={busy || i === 0}
                  aria-label={`Move ${m.fileName} earlier`}
                  className="rounded bg-slate-900/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-0"
                >
                  <ChevronUp size={10} />
                </button>
                <button
                  onClick={() => moveMedia(m.id, "down")}
                  disabled={busy || i === action.media.length - 1}
                  aria-label={`Move ${m.fileName} later`}
                  className="rounded bg-slate-900/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-0"
                >
                  <ChevronDown size={10} />
                </button>
              </div>
            </div>
          ))}

          <label className="hover:border-brand-300 hover:bg-brand-50/30 flex h-[5.9rem] w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-xs font-medium text-slate-600 transition">
            <Paperclip size={14} />
            Add files
            <input
              type="file"
              multiple
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                if (e.target.files?.length) upload(e.target.files);
                e.target.value = ""; // so re-picking the same file fires again
              }}
            />
          </label>
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-slate-500">
          <MapPin size={11} /> Location pin (optional) — sent last
        </p>
        <input
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setPinError(false);
          }}
          // Parsed on paste and on blur rather than on every keystroke: a
          // half-typed maps URL momentarily contains the map-centre "@lat,lng"
          // and would be grabbed before the more accurate pin further along
          // the URL had been typed at all.
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (parseCoordinates(pasted)) {
              e.preventDefault();
              applyPin(pasted);
            }
          }}
          onBlur={() => pin.trim() && applyPin(pin)}
          placeholder="Paste a Google Maps link or “28.6139, 77.2090” to fill these in"
          aria-label="Paste a Google Maps link"
          className={`${inputClass} bg-white`}
        />
        {pinError && (
          <p className="mt-1 text-xs text-amber-700">
            No coordinates in that. A short goo.gl link has to be opened first — copy the full URL from the
            address bar, or type the numbers below.
          </p>
        )}
        <div className="mt-2" />
        {/* Stacks on phones — three columns squeezed "Place name" to a few
            characters at 375px. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            value={lat}
            onChange={(e) => {
              setLat(e.target.value);
              mark();
            }}
            placeholder="Latitude"
            aria-label="Latitude"
            className={`${inputClass} bg-white`}
          />
          <input
            value={lng}
            onChange={(e) => {
              setLng(e.target.value);
              mark();
            }}
            placeholder="Longitude"
            aria-label="Longitude"
            className={`${inputClass} bg-white`}
          />
          <input
            value={locName}
            onChange={(e) => {
              setLocName(e.target.value);
              mark();
            }}
            placeholder="Place name"
            aria-label="Place name"
            className={`${inputClass} bg-white`}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        {dirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
        <Button
          size="sm"
          variant={dirty ? "primary" : "secondary"}
          icon={Check}
          onClick={save}
          disabled={busy || !dirty}
        >
          {busy ? "Saving…" : dirty ? "Save" : "Saved"}
        </Button>
      </div>
    </Card>
  );
}
