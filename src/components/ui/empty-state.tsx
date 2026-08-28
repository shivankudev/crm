import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The one "nothing here yet" component every list/table in the app
 * should reach for — an icon, a plain-language explanation, and (when
 * there's a next step) a primary action, instead of a bare "No data."
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div className="motion-rise flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="bg-brand-50 text-brand-500 flex h-11 w-11 items-center justify-center rounded-lg">
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <p className="mt-3.5 text-sm font-medium text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p>}
      {actionLabel && (actionHref || onAction) && (
        <Button variant="primary" size="sm" href={actionHref} onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
