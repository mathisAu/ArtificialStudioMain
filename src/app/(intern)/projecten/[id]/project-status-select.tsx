"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { moveProjectAction } from "../actions";
import { Select } from "@/components/ui/field";
import { PROJECT_STATUS, options } from "@/lib/labels";
import type { ProjectStatus } from "@/lib/types";

/** Statuswissel vanaf de projectdetailpagina, met dezelfde logging als het bord. */
export function ProjectStatusSelect({
  projectId,
  status,
  disabled,
}: {
  projectId: string;
  status: ProjectStatus;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<ProjectStatus>(status);
  const [isPending, startTransition] = useTransition();

  async function onChange(next: ProjectStatus) {
    const previous = value;
    setValue(next);

    const result = await moveProjectAction(projectId, next);
    if (result?.error) {
      setValue(previous);
      toast.error(result.error);
      return;
    }

    toast.success(`Status gewijzigd naar "${PROJECT_STATUS[next].label}".`);
    startTransition(() => router.refresh());
  }

  return (
    <Select
      aria-label="Projectstatus"
      value={value}
      disabled={disabled || isPending}
      onChange={(event) => onChange(event.target.value as ProjectStatus)}
      className="w-auto min-w-[180px]"
    >
      {options(PROJECT_STATUS).map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
