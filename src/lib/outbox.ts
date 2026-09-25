import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Verwerken van de wachtrij met uitgaande berichten (§26, §33).
 *
 * De wachtrij wordt gevuld door de databasetrigger `fan_out_notification`.
 * Hier gaan de berichten daadwerkelijk de deur uit. Beide kanalen zijn inert
 * zolang ze niet zijn ingesteld: zonder Slack-webhook of zonder API-sleutel
 * voor e-mail wordt een bericht op `skipped` gezet in plaats van eindeloos
 * opnieuw geprobeerd.
 */

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 25;

export interface OutboxResult {
  verwerkt: number;
  verzonden: number;
  overgeslagen: number;
  mislukt: number;
}

interface OutboundMessage {
  id: string;
  channel: "email" | "slack" | "whatsapp";
  target: string;
  subject: string | null;
  body: string;
  payload: Record<string, unknown>;
  attempts: number;
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
}

/** Slack Incoming Webhook. Verwacht een URL uit app_settings. */
async function sendSlack(
  message: OutboundMessage,
  webhookUrl: string,
): Promise<void> {
  const link = String(message.payload.link ?? "");
  const text = link && siteUrl() ? `${message.body}\n${siteUrl()}${link}` : message.body;

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel: message.target, text }),
  });

  if (!response.ok) {
    throw new Error(`Slack gaf ${response.status}: ${await response.text()}`);
  }
}

/** WhatsApp via Chatlevel (https://docs.chatlevel.io). */
async function sendWhatsapp(
  message: OutboundMessage,
  deviceId: string,
): Promise<void> {
  const apiKey = process.env.CHATLEVEL_API_KEY;
  if (!apiKey) throw new Error("CHATLEVEL_API_KEY ontbreekt");

  const link = String(message.payload.link ?? "");
  const url = link && siteUrl() ? `${siteUrl()}${link}` : null;
  // Chatlevel verwacht alleen cijfers (8-15), zonder + of andere opmaak.
  const toNumber = message.target.replace(/\D/g, "");

  const response = await fetch(
    `https://api.chatlevel.io/v1/devices/${deviceId}/messages/text`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        toNumber,
        message: [message.body, url ? `\nBekijken: ${url}` : ""]
          .filter(Boolean)
          .join("\n"),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Chatlevel gaf ${response.status}: ${await response.text()}`);
  }
}

/**
 * E-mail via Resend. Een andere provider aansluiten betekent alleen deze
 * functie vervangen; de rest van de keten blijft gelijk.
 */
async function sendEmail(
  message: OutboundMessage,
  from: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY ontbreekt");

  const link = String(message.payload.link ?? "");
  const url = link && siteUrl() ? `${siteUrl()}${link}` : null;
  const name = String(message.payload.name ?? "");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.target],
      subject: message.subject ?? "Bericht uit het projectportaal",
      text: [
        name ? `Hallo ${name.split(" ")[0]},` : "Hallo,",
        "",
        message.body,
        url ? `\nBekijken: ${url}` : "",
        "",
        "— Artificial Studio",
      ]
        .filter(Boolean)
        .join("\n"),
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend gaf ${response.status}: ${await response.text()}`);
  }
}

/**
 * Verwerkt één batch. Gebruikt de secret key: dit draait zonder gebruiker,
 * dus RLS is hier niet van toepassing.
 */
export async function processOutbox(): Promise<OutboxResult> {
  const admin = createAdminClient();
  const result: OutboxResult = { verwerkt: 0, verzonden: 0, overgeslagen: 0, mislukt: 0 };

  const [{ data: slackSetting }, { data: emailSetting }, { data: whatsappSetting }] =
    await Promise.all([
      admin.from("app_settings").select("value").eq("key", "slack").maybeSingle(),
      admin.from("app_settings").select("value").eq("key", "email").maybeSingle(),
      admin.from("app_settings").select("value").eq("key", "whatsapp").maybeSingle(),
    ]);

  const slackWebhook = (slackSetting?.value as { webhook_url?: string } | null)
    ?.webhook_url;
  const emailCfg = emailSetting?.value as
    | { from_address?: string; from_name?: string }
    | null;
  const emailFrom = emailCfg?.from_address
    ? `${emailCfg.from_name ?? "Artificial Studio"} <${emailCfg.from_address}>`
    : null;
  const whatsappDeviceId = (whatsappSetting?.value as { device_id?: string } | null)
    ?.device_id;

  const { data: messages } = await admin
    .from("outbound_messages")
    .select("id, channel, target, subject, body, payload, attempts")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("created_at")
    .limit(BATCH_SIZE);

  for (const message of (messages ?? []) as OutboundMessage[]) {
    result.verwerkt += 1;

    // Kanaal niet ingesteld: één keer overslaan in plaats van blijven proberen.
    const misconfigured =
      (message.channel === "slack" && !slackWebhook) ||
      (message.channel === "email" && (!emailFrom || !process.env.RESEND_API_KEY)) ||
      (message.channel === "whatsapp" &&
        (!whatsappDeviceId || !process.env.CHATLEVEL_API_KEY));

    if (misconfigured) {
      await admin
        .from("outbound_messages")
        .update({
          status: "skipped",
          last_error:
            message.channel === "slack"
              ? "Geen Slack-webhook ingesteld."
              : message.channel === "whatsapp"
                ? "WhatsApp (Chatlevel) is niet volledig ingesteld."
                : "E-mailverzending is niet volledig ingesteld.",
        })
        .eq("id", message.id);
      result.overgeslagen += 1;
      continue;
    }

    try {
      if (message.channel === "slack") {
        await sendSlack(message, slackWebhook as string);
      } else if (message.channel === "whatsapp") {
        await sendWhatsapp(message, whatsappDeviceId as string);
      } else {
        await sendEmail(message, emailFrom as string);
      }

      await admin
        .from("outbound_messages")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts: message.attempts + 1,
        })
        .eq("id", message.id);
      result.verzonden += 1;
    } catch (error) {
      const attempts = message.attempts + 1;
      const failed = attempts >= MAX_ATTEMPTS;

      await admin
        .from("outbound_messages")
        .update({
          status: failed ? "failed" : "pending",
          attempts,
          last_error: error instanceof Error ? error.message : String(error),
          // Oplopend uitstel: 5, 25, 125 minuten.
          scheduled_for: failed
            ? undefined
            : new Date(Date.now() + 5 ** attempts * 60_000).toISOString(),
        })
        .eq("id", message.id);

      result.mislukt += 1;
    }
  }

  return result;
}
