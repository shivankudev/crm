"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import clsx from "clsx";

type ToastKind = "success" | "error" | "warning" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

const ICONS: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES: Record<ToastKind, string> = {
  success: "border-chip-pos/25 bg-white text-slate-800 [&_svg]:text-chip-pos",
  error: "border-chip-neg/25 bg-white text-slate-800 [&_svg]:text-chip-neg",
  warning: "border-brand-400/40 bg-white text-slate-800 [&_svg]:text-brand-600",
  info: "border-slate-200 bg-white text-slate-800 [&_svg]:text-slate-400",
};

type ToastFn = (message: string) => void;
const ToastContext = createContext<{
  success: ToastFn;
  error: ToastFn;
  warning: ToastFn;
  info: ToastFn;
} | null>(null);

/**
 * Lightweight toast system — no extra dependency, just a context + portal.
 * Mounted once in AppShell; call `useToast().success("Saved")` etc. from
 * anywhere in the app. Auto-dismisses after 4s, dismissable early by hand.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  // The portal target (document.body) only exists client-side — rendering
  // it on the very first client pass (before this mount flag flips) would
  // still diverge from the server's HTML, so defer it exactly one tick.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, kind, message }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (m: string) => push("success", m),
      error: (m: string) => push("error", m),
      warning: (m: string) => push("warning", m),
      info: (m: string) => push("info", m),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:right-4 sm:left-auto sm:items-end">
            {toasts.map((t) => {
              const Icon = ICONS[t.kind];
              return (
                <div
                  key={t.id}
                  className={clsx(
                    "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm shadow-lg",
                    STYLES[t.kind]
                  )}
                >
                  <Icon size={16} className="mt-0.5 shrink-0" />
                  <p className="flex-1">{t.message}</p>
                  <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-50 hover:opacity-100">
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
