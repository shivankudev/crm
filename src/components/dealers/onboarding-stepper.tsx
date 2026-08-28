import { DEALER_ONBOARDING_SEQUENCE } from "@/lib/dealers/constants";

export function OnboardingStepper({ currentStatusName }: { currentStatusName: string }) {
  const currentIndex = DEALER_ONBOARDING_SEQUENCE.indexOf(currentStatusName);

  return (
    <ol className="flex items-center gap-1">
      {DEALER_ONBOARDING_SEQUENCE.map((step, i) => {
        const done = currentIndex >= 0 && i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={step} className="flex items-center gap-1" title={step.replaceAll("_", " ")}>
            <span
              className={`h-2 w-2 rounded-full ${
                active ? "bg-brand-600" : done ? "bg-brand-300" : "bg-slate-200"
              }`}
            />
            {i < DEALER_ONBOARDING_SEQUENCE.length - 1 && (
              <span className={`h-px w-3 ${done ? "bg-brand-300" : "bg-slate-200"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
