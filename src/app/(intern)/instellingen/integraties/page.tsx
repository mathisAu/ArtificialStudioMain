import { Receipt } from "lucide-react";
import type { Metadata } from "next";

import { EmailForm, SlackForm } from "./integration-forms";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Integraties" };

interface SlackValue {
  enabled?: boolean;
  webhook_url?: string | null;
}

interface EmailValue {
  enabled?: boolean;
  from_address?: string | null;
  from_name?: string | null;
}

/** Integratie-instellingen (§26, §27, §33). Alleen voor admins. */
export default async function IntegrationsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: settings }, { data: queue }] = await Promise.all([
    supabase.from("app_settings").select("key, value"),
    supabase
      .from("outbound_messages")
      .select("id, channel, status, target, subject, last_error, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const slack = (settings?.find((s) => s.key === "slack")?.value ?? {}) as SlackValue;
  const email = (settings?.find((s) => s.key === "email")?.value ?? {}) as EmailValue;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Slack"
            description="Stuur gebeurtenissen door naar een Slack-kanaal."
            action={
              <Badge tone={slack.enabled ? "success" : "neutral"}>
                {slack.enabled ? "Aan" : "Uit"}
              </Badge>
            }
          />
          <CardBody>
            <SlackForm
              enabled={slack.enabled ?? false}
              webhookUrl={slack.webhook_url ?? null}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="E-mail"
            description="Notificaties ook per e-mail versturen."
            action={
              <Badge tone={email.enabled ? "success" : "neutral"}>
                {email.enabled ? "Aan" : "Uit"}
              </Badge>
            }
          />
          <CardBody>
            <EmailForm
              enabled={email.enabled ?? false}
              fromAddress={email.from_address ?? null}
              fromName={email.from_name ?? null}
              hasApiKey={Boolean(process.env.RESEND_API_KEY)}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Boekhouding"
          description="Facturen exporteren voor je boekhoudpakket (§27)."
        />
        <CardBody className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            Elke factuur heeft een veld <span className="font-medium">Externe factuur-ID</span>,
            zodat je de koppeling met je boekhouding kunt vastleggen. Zolang er geen
            directe API-koppeling is, exporteer je alle facturen als CSV — dat bestand
            kun je in vrijwel elk boekhoudpakket importeren.
          </p>
          <a href="/api/facturen/export" className={buttonClass("secondary", "sm")}>
            <Receipt className="h-3.5 w-3.5" />
            Facturen exporteren (CSV)
          </a>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Wachtrij"
          description="De laatste tien uitgaande berichten. Wordt geleegd door /api/uitgaand."
        />
        {(queue ?? []).length === 0 ? (
          <CardBody>
            <p className="text-[13px] text-muted-foreground">
              Er staat niets in de wachtrij. Dat klopt zolang beide integraties uit staan.
            </p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-border">
            {(queue ?? []).map((message) => (
              <li key={message.id} className="flex items-center gap-3 px-5 py-3">
                <Badge tone={message.channel === "slack" ? "accent" : "info"}>
                  {message.channel === "slack" ? "Slack" : "E-mail"}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">{message.subject ?? "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {message.target} · {formatDateTime(message.created_at)}
                  </p>
                  {message.last_error ? (
                    <p className="truncate text-xs text-danger">{message.last_error}</p>
                  ) : null}
                </div>
                <Badge
                  tone={
                    message.status === "sent"
                      ? "success"
                      : message.status === "failed"
                        ? "danger"
                        : message.status === "skipped"
                          ? "neutral"
                          : "warning"
                  }
                >
                  {
                    {
                      pending: "In wachtrij",
                      sent: "Verzonden",
                      failed: "Mislukt",
                      skipped: "Overgeslagen",
                    }[message.status as "pending" | "sent" | "failed" | "skipped"]
                  }
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
