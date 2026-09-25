/**
 * Test van het daadwerkelijk versturen uit de wachtrij (§26, §33).
 *
 *   node supabase/tests/outbox_delivery_test.mjs [basis-url]
 *
 * Zet een lokale webserver op die de rol van Slack speelt, zet die als webhook
 * in de instellingen, veroorzaakt een gebeurtenis en roept daarna het echte
 * endpoint /api/uitgaand aan. Zo wordt de hele keten getest, inclusief de
 * authenticatie op dat endpoint. Achteraf wordt alles teruggedraaid.
 *
 * Vereist: draaiende lokale Supabase, `node scripts/seed-local.mjs`, en een
 * draaiende `npm run dev` (of `npm start`).
 */

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match) env[match[1]] = match[2].trim();
}

const BASE_URL = process.argv[2] ?? env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
  throw new Error("Deze test draait alleen lokaal.");
}
if (!env.OUTBOX_SECRET) {
  throw new Error("OUTBOX_SECRET ontbreekt in .env.local.");
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let failures = 0;
const ontvangen = [];

function expect(label, condition, detail = "") {
  if (condition) console.log(`ok   · ${label}${detail ? ` (${detail})` : ""}`);
  else {
    failures += 1;
    console.error(`FOUT · ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function drainOutbox(token = env.OUTBOX_SECRET) {
  const response = await fetch(`${BASE_URL}/api/uitgaand`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

// --- Nep-Slack ---------------------------------------------------------------
const server = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    ontvangen.push(JSON.parse(body || "{}"));
    response.writeHead(200).end("ok");
  });
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const webhookUrl = `http://127.0.0.1:${server.address().port}/slack`;

// --- Voorbereiden ------------------------------------------------------------
const { data: originalSlack } = await admin
  .from("app_settings")
  .select("value")
  .eq("key", "slack")
  .single();

const { data: project } = await admin
  .from("projects")
  .select("id, company_id, slack_channel_id, slack_config")
  .limit(1)
  .single();

async function herstel() {
  await admin.from("outbound_messages").delete().eq("project_id", project.id);
  await admin.from("feedback").delete().ilike("title", "%bezorgtest%");
  // De activity log en notificaties zijn append-only en hebben geen foreign key
  // naar feedback; die ruimen we hier dus zelf op zodat de demo-data schoon blijft.
  await admin.from("activities").delete().ilike("description", "%bezorgtest%");
  await admin.from("notifications").delete().ilike("body", "%bezorgtest%");
  await admin.from("app_settings").update({ value: originalSlack.value }).eq("key", "slack");
  await admin
    .from("projects")
    .update({
      slack_channel_id: project.slack_channel_id,
      slack_config: project.slack_config,
    })
    .eq("id", project.id);
  server.close();
}

try {
  // Het endpoint hoort alleen met het juiste geheim te werken.
  const zonderGeheim = await drainOutbox("onjuist-geheim");
  expect("endpoint weigert een verkeerd geheim", zonderGeheim.status === 401, String(zonderGeheim.status));

  await admin
    .from("app_settings")
    .update({ value: { enabled: true, webhook_url: webhookUrl } })
    .eq("key", "slack");

  await admin
    .from("projects")
    .update({
      slack_channel_id: "#project-test",
      slack_config: { events: ["feedback_new"] },
    })
    .eq("id", project.id);

  // --- Gebeurtenis veroorzaken -----------------------------------------------
  const { error: feedbackError } = await admin.from("feedback").insert({
    project_id: project.id,
    company_id: project.company_id,
    title: "Bezorgtest voor de wachtrij",
    description: "Automatische test.",
    type: "bug",
  });
  if (feedbackError) throw feedbackError;

  const { count: queued } = await admin
    .from("outbound_messages")
    .select("id", { count: "exact", head: true })
    .eq("channel", "slack")
    .eq("status", "pending");

  expect("bericht staat in de wachtrij", (queued ?? 0) === 1, `${queued} bericht(en)`);

  // --- Verwerken -------------------------------------------------------------
  const eerste = await drainOutbox();

  expect("endpoint accepteert het juiste geheim", eerste.status === 200, String(eerste.status));
  expect("Slack-bericht verzonden", eerste.body.verzonden === 1, JSON.stringify(eerste.body));
  expect("webhook daadwerkelijk aangeroepen", ontvangen.length === 1, `${ontvangen.length}`);

  if (ontvangen[0]) {
    expect("kanaal meegestuurd", ontvangen[0].channel === "#project-test", ontvangen[0].channel);
    expect(
      "titel staat in het bericht",
      String(ontvangen[0].text).includes("Bezorgtest voor de wachtrij"),
      String(ontvangen[0].text).replace(/\n/g, " / "),
    );
  }

  const { data: sent } = await admin
    .from("outbound_messages")
    .select("status, sent_at")
    .eq("channel", "slack")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  expect("status staat op verzonden", sent?.status === "sent", sent?.status);
  expect("verzendmoment vastgelegd", Boolean(sent?.sent_at));

  // --- Zonder webhook wordt er overgeslagen ----------------------------------
  await admin
    .from("app_settings")
    .update({ value: { enabled: true, webhook_url: null } })
    .eq("key", "slack");

  await admin.from("feedback").insert({
    project_id: project.id,
    company_id: project.company_id,
    title: "Tweede bezorgtest",
    description: "Zonder webhook.",
    type: "bug",
  });

  const tweede = await drainOutbox();
  expect(
    "zonder webhook wordt er overgeslagen, niet eindeloos geprobeerd",
    tweede.body.overgeslagen >= 1 && tweede.body.verzonden === 0,
    JSON.stringify(tweede.body),
  );
} finally {
  await herstel();
}

console.log("");
if (failures > 0) {
  console.error(`${failures} test(s) mislukt.`);
  process.exit(1);
}
console.log("================================================");
console.log(" Bezorging vanuit de wachtrij werkt.");
console.log("================================================");
