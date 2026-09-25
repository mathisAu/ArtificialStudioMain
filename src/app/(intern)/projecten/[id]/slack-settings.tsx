"use client";

import { Hash } from "lucide-react";
import { toast } from "sonner";

import { saveProjectSlackAction } from "../../instellingen/actions";
import { Checkbox, Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/modal";
import { NOTIFICATION_TYPE, SLACK_EVENT_TYPES } from "@/lib/labels";
import { useActionForm } from "@/lib/use-action-form";

/**
 * Slack-instellingen per project (§33).
 *
 * De webhook zelf staat centraal bij Instellingen → Integraties en is alleen
 * voor admins zichtbaar. Hier kies je het kanaal en welke gebeurtenissen
 * doorgestuurd worden.
 */
export function SlackSettings({
  projectId,
  channelId,
  events,
  slackEnabled,
  disabled,
}: {
  projectId: string;
  channelId: string | null;
  events: string[];
  slackEnabled: boolean;
  disabled: boolean;
}) {
  const { submit, pending, error } = useActionForm(saveProjectSlackAction, (result) => {
    toast.success(result.success ?? "Opgeslagen.");
  });

  return (
    <form action={submit} className="space-y-5">
      <input type="hidden" name="project_id" value={projectId} />

      <FormError>{error}</FormError>

      {!slackEnabled ? (
        <p className="rounded-[var(--radius)] border border-border bg-surface-muted/50 px-3.5 py-2.5 text-[13px] text-muted-foreground">
          Slack staat voor de hele omgeving uit. Je kunt hier alvast instellen wat
          er doorgestuurd moet worden; het gaat pas lopen zodra een admin Slack
          aanzet bij Instellingen.
        </p>
      ) : null}

      <Field
        label="Slack-kanaal"
        htmlFor="slack_channel"
        hint="Bijvoorbeeld #project-bvs. Leeg laten schakelt Slack uit voor dit project."
      >
        <div className="relative">
          <Hash
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground"
            aria-hidden
          />
          <Input
            id="slack_channel"
            name="slack_channel_id"
            defaultValue={channelId ?? ""}
            placeholder="project-bvs"
            disabled={disabled}
            className="pl-8"
          />
        </div>
      </Field>

      <div className="space-y-3">
        <div>
          <p className="text-[13px] font-medium text-foreground">
            Wat sturen we door?
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Per gebeurtenis gaat er één bericht naar het kanaal, niet één per teamlid.
          </p>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {SLACK_EVENT_TYPES.map((type) => (
            <Checkbox
              key={type}
              name="events"
              value={type}
              defaultChecked={events.includes(type)}
              disabled={disabled}
              label={NOTIFICATION_TYPE[type].label}
            />
          ))}
        </div>
      </div>

      {!disabled ? (
        <SubmitButton size="sm" pending={pending} pendingLabel="Opslaan…">
          Slack-instellingen opslaan
        </SubmitButton>
      ) : null}
    </form>
  );
}
