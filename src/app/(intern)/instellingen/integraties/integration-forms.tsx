"use client";

import { toast } from "sonner";

import { saveIntegrationAction } from "../actions";
import { Checkbox, Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/modal";
import { useActionForm } from "@/lib/use-action-form";

/** Slack (§33). De webhook staat in app_settings en is alleen voor admins leesbaar. */
export function SlackForm({
  enabled,
  webhookUrl,
}: {
  enabled: boolean;
  webhookUrl: string | null;
}) {
  const { submit, pending, error } = useActionForm(saveIntegrationAction, (result) => {
    toast.success(result.success ?? "Opgeslagen.");
  });

  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="key" value="slack" />
      <FormError>{error}</FormError>

      <Checkbox
        name="enabled"
        defaultChecked={enabled}
        label="Slack-berichten inschakelen"
        description="Staat dit uit, dan wordt er niets in de wachtrij gezet en gaat er niets de deur uit."
      />

      <Field
        label="Incoming Webhook URL"
        htmlFor="slack_webhook"
        hint="Slack → Apps → Incoming Webhooks. Per project kies je daarna het kanaal en de gebeurtenissen."
      >
        <Input
          id="slack_webhook"
          name="webhook_url"
          type="url"
          defaultValue={webhookUrl ?? ""}
          placeholder="https://hooks.slack.com/services/..."
        />
      </Field>

      <SubmitButton pending={pending} pendingLabel="Opslaan…">
        Slack-instellingen opslaan
      </SubmitButton>
    </form>
  );
}

/** E-mail (§26). De API-sleutel van de provider staat in de omgevingsvariabelen. */
export function EmailForm({
  enabled,
  fromAddress,
  fromName,
  hasApiKey,
}: {
  enabled: boolean;
  fromAddress: string | null;
  fromName: string | null;
  hasApiKey: boolean;
}) {
  const { submit, pending, error } = useActionForm(saveIntegrationAction, (result) => {
    toast.success(result.success ?? "Opgeslagen.");
  });

  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="key" value="email" />
      <FormError>{error}</FormError>

      <Checkbox
        name="enabled"
        defaultChecked={enabled}
        label="E-mailnotificaties inschakelen"
        description="Iedere gebruiker kan daarna zelf kiezen waarover hij mail wil."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Afzendernaam" htmlFor="email_from_name">
          <Input
            id="email_from_name"
            name="from_name"
            defaultValue={fromName ?? "Artificial Studio"}
          />
        </Field>
        <Field
          label="Afzenderadres"
          htmlFor="email_from"
          hint="Moet geverifieerd zijn bij je mailprovider."
        >
          <Input
            id="email_from"
            name="from_address"
            type="email"
            defaultValue={fromAddress ?? ""}
            placeholder="projecten@artificialstudio.nl"
          />
        </Field>
      </div>

      <p
        className={`rounded-[var(--radius)] border px-3 py-2.5 text-[13px] ${
          hasApiKey
            ? "border-success/30 bg-success-soft/40 text-success"
            : "border-warning/30 bg-warning-soft/40 text-warning"
        }`}
      >
        {hasApiKey
          ? "De API-sleutel van de mailprovider is gevonden. Berichten worden daadwerkelijk verstuurd."
          : "Er is nog geen RESEND_API_KEY ingesteld. Berichten blijven in de wachtrij staan en worden overgeslagen."}
      </p>

      <SubmitButton pending={pending} pendingLabel="Opslaan…">
        E-mailinstellingen opslaan
      </SubmitButton>
    </form>
  );
}
