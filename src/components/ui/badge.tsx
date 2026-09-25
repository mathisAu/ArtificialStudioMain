import type { ReactNode } from "react";

import type { Tone } from "@/lib/labels";
import { cn } from "@/lib/utils";

const TONES: Record<Tone, string> = {
  neutral: "bg-neutral-soft text-muted-foreground",
  accent: "bg-accent-soft text-accent",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot = false,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {dot ? (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      ) : null}
      {children}
    </span>
  );
}

/** Badge op basis van een labelmap uit lib/labels.ts. */
export function StatusBadge<T extends string>({
  map,
  value,
  variant = "label",
  className,
}: {
  map: Record<T, { label: string; tone: Tone; clientLabel?: string }>;
  value: T | null | undefined;
  /** In het klantportaal tonen we waar mogelijk een vriendelijker label (§24). */
  variant?: "label" | "clientLabel";
  className?: string;
}) {
  if (!value || !map[value]) return <span className="text-subtle-foreground">—</span>;
  const def = map[value];
  const text = variant === "clientLabel" ? (def.clientLabel ?? def.label) : def.label;
  return (
    <Badge tone={def.tone} className={className} dot>
      {text}
    </Badge>
  );
}
