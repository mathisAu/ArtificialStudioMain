import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Voortgangsbalkje voor een enkel item, zoals de route die feedback aflegt
 * in het klantportaal (§26):
 *
 *   Nieuw → In behandeling → Ingepland → Opgelost
 *
 * `current` mag ook een status zijn die niet in de reeks voorkomt (bijvoorbeeld
 * "Afgewezen"); dan wordt er niets gemarkeerd en toont de badge de werkelijke
 * status.
 */
export function StatusSteps({
  steps,
  current,
  className,
}: {
  steps: { value: string; label: string }[];
  current: string;
  className?: string;
}) {
  const activeIndex = steps.findIndex((step) => step.value === current);

  return (
    <ol className={cn("flex flex-wrap items-start", className)}>
      {steps.map((step, index) => {
        const done = activeIndex > index;
        const active = activeIndex === index;

        return (
          <li key={step.value} className="flex min-w-0 flex-1 items-start">
            <div className="flex min-w-0 flex-col items-center gap-1.5 px-1">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                  done && "border-success bg-success text-white",
                  active && "border-accent bg-accent-soft text-accent",
                  !done && !active && "border-border bg-surface text-subtle-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "max-w-[8rem] text-center text-[11px] leading-tight",
                  active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>

            {index < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "mt-3 h-px min-w-4 flex-1",
                  done ? "bg-success" : "bg-border",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
