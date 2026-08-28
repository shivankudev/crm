import clsx from "clsx";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={clsx("rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)]", className)}
    >
      {children}
    </div>
  );
}
