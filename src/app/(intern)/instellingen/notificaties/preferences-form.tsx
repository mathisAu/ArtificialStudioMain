"use client";

import { toast } from "sonner";

import { saveEmailPreferencesAction } from "../actions";
import { Checkbox, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/modal";
import { NOTIFICATION_TYPE } from "@/lib/labels";
import type { NotificationType } from "@/lib/types";
import { useActionForm } from "@/lib/use-action-form";

/** Persoonlijke e-mailvoorkeuren (§32). */
export function PreferencesForm({
  enabled,
  mutedTypes,
}: {
  enabled: boolean;
  mutedTypes: string[];
}) {
  const { submit, pending, error } = useActionForm(saveEmailPreferencesAction, (result) => {
    toast.success(result.success ?? "Opgeslagen.");
  });

  const types = (Object.values(NOTIFICATION_TYPE) as {
    value: NotificationType;
    label: string;
    order: number;
  }[]).sort((a, b) => a.order - b.order);

  return (
    <form action={submit} className="space-y-6">
      <FormError>{error}</FormError>

      <Checkbox
        name="enabled"
        defaultChecked={enabled}
        label="Stuur mij e-mail bij notificaties"
        description="Staat dit uit, dan zie je meldingen alleen in het notificatiecentrum."
      />

      <div className="space-y-3">
        <div>
          <p className="text-[13px] font-medium text-foreground">
            Waarover wil je géén e-mail?
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Aangevinkte types blijven wel zichtbaar in het notificatiecentrum.
          </p>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {types.map((type) => (
            <Checkbox
              key={type.value}
              name="muted_types"
              value={type.value}
              defaultChecked={mutedTypes.includes(type.value)}
              label={type.label}
            />
          ))}
        </div>
      </div>

      <SubmitButton pending={pending} pendingLabel="Opslaan…">
        Voorkeuren opslaan
      </SubmitButton>
    </form>
  );
}
