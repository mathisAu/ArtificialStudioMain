"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Select } from "@/components/ui/field";
import type { Tone } from "@/lib/labels";
import { useSyncedState } from "@/lib/use-action-form";
import { cn } from "@/lib/utils";

interface LabelDef {
  label: string;
  tone: Tone;
  order: number;
}

/**
 * Statusveld dat direct opslaat, met optimistische weergave en terugdraaien bij
 * een fout. Gebruikt voor feedback, vragen en klantacties.
 */
export function InlineStatusSelect<T extends string>({
  id,
  value,
  map,
  action,
  disabled = false,
  ariaLabel = "Status",
  className,
}: {
  id: string;
  value: T;
  map: Record<T, LabelDef>;
  action: (id: string, status: string) => Promise<{ error?: string; success?: string }>;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  // Volgt automatisch de waarde die de server teruggeeft.
  const [current, setCurrent] = useSyncedState<T>(value);
  const [isPending, startTransition] = useTransition();

  const entries = (Object.entries(map) as [T, LabelDef][]).sort(
    (a, b) => a[1].order - b[1].order,
  );

  async function onChange(next: T) {
    const previous = current;
    setCurrent(next);

    const result = await action(id, next);
    if (result?.error) {
      setCurrent(previous);
      toast.error(result.error);
      return;
    }

    toast.success(`Status gewijzigd naar "${map[next].label}".`);
    startTransition(() => router.refresh());
  }

  return (
    <Select
      aria-label={ariaLabel}
      value={current}
      disabled={disabled || isPending}
      onChange={(event) => onChange(event.target.value as T)}
      className={cn("w-auto min-w-[170px]", className)}
    >
      {entries.map(([key, def]) => (
        <option key={key} value={key}>
          {def.label}
        </option>
      ))}
    </Select>
  );
}
