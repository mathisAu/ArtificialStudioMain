import { Check } from "lucide-react";

import type { ProjectPhase, ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Visuele projecttijdlijn (§10, §24).
 *
 * Zijn er projectfases vastgelegd (via een template), dan volgen we die.
 * Anders vallen we terug op de vaste hoofdroute:
 *   Intake → Ontwikkeling → Testfase → Feedback → Oplevering
 */

const FALLBACK_STAGES: { label: string; statuses: ProjectStatus[] }[] = [
  { label: "Intake", statuses: ["intake", "planning"] },
  { label: "Ontwikkeling", statuses: ["in_development"] },
  { label: "Testfase", statuses: ["internal_test", "client_test"] },
  { label: "Feedback", statuses: ["waiting_client", "revisions"] },
  { label: "Oplevering", statuses: ["ready_for_delivery", "completed"] },
];

type StepState = "done" | "active" | "pending";

interface Step {
  label: string;
  state: StepState;
}

function stepsFromStatus(status: ProjectStatus): Step[] {
  if (status === "on_hold") {
    return FALLBACK_STAGES.map((stage) => ({ label: stage.label, state: "pending" }));
  }

  const activeIndex = FALLBACK_STAGES.findIndex((stage) =>
    stage.statuses.includes(status),
  );

  return FALLBACK_STAGES.map((stage, index) => ({
    label: stage.label,
    state:
      status === "completed"
        ? "done"
        : index < activeIndex
          ? "done"
          : index === activeIndex
            ? "active"
            : "pending",
  }));
}

export function ProjectTimeline({
  status,
  phases = [],
}: {
  status: ProjectStatus;
  phases?: ProjectPhase[];
}) {
  const steps: Step[] =
    phases.length > 0
      ? [...phases]
          .sort((a, b) => a.position - b.position)
          .map((phase) => ({
            label: phase.name,
            state:
              phase.state === "done" ? "done" : phase.state === "active" ? "active" : "pending",
          }))
      : stepsFromStatus(status);

  return (
    <ol className="flex flex-wrap items-start gap-y-4">
      {steps.map((step, index) => (
        <li key={`${step.label}-${index}`} className="flex min-w-0 flex-1 items-start">
          <div className="flex min-w-0 flex-col items-center gap-1.5 px-1">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                step.state === "done" && "border-success bg-success text-white",
                step.state === "active" && "border-accent bg-accent-soft text-accent",
                step.state === "pending" &&
                  "border-border bg-surface text-subtle-foreground",
              )}
            >
              {step.state === "done" ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span
              className={cn(
                "max-w-[9rem] text-center text-[11px] leading-tight",
                step.state === "active"
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
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
                step.state === "done" ? "bg-success" : "bg-border",
              )}
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
