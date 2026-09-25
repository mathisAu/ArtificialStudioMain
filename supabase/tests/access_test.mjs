/**
 * Toegangstest op de nieuwe endpoints en instellingen van fase 4.
 *
 *   node supabase/tests/access_test.mjs [basis-url]
 *
 * Logt in als developer en als klant met een echte sessie, en controleert dat
 * zij niet bij financiële gegevens of admin-instellingen komen. Doet dit via
 * dezelfde HTTP-laag als de browser, niet via de database.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match) env[match[1]] = match[2].trim();
}

const BASE_URL = process.argv[2] ?? env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const PASSWORD = "TestWachtwoord123";
const PUBLIC_KEY =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
  throw new Error("Deze test draait alleen lokaal.");
}

let failures = 0;

function expect(label, condition, detail = "") {
  if (condition) console.log(`ok   · ${label}${detail ? ` (${detail})` : ""}`);
  else {
    failures += 1;
    console.error(`FOUT · ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Log in via Supabase en bouw de cookies die de app verwacht. */
async function sessionCookie(email) {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, PUBLIC_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Inloggen als ${email} mislukt: ${error.message}`);

  // @supabase/ssr slaat de sessie op als base64-cookie, eventueel in stukken.
  const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).port === "54321"
    ? "127"
    : new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const name = `sb-${ref}-auth-token`;
  const value = "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64");

  const chunks = [];
  const size = 3180;
  if (value.length <= size) {
    chunks.push(`${name}=${value}`);
  } else {
    for (let i = 0; i * size < value.length; i += 1) {
      chunks.push(`${name}.${i}=${value.slice(i * size, (i + 1) * size)}`);
    }
  }
  return chunks.join("; ");
}

async function get(path, cookie) {
  return fetch(`${BASE_URL}${path}`, {
    headers: { cookie },
    redirect: "manual",
  });
}

// -----------------------------------------------------------------------------
const developer = await sessionCookie("dev@test.local");
const klant = await sessionCookie("klant@test.local");
const admin = await sessionCookie("admin@test.local");

// Controle dat de sessie überhaupt werkt.
const devDashboard = await get("/dashboard", developer);
expect("developer kan het dashboard openen", devDashboard.status === 200, String(devDashboard.status));

// Financiële export: alleen admin en projectmanager (§2).
const devExport = await get("/api/facturen/export", developer);
expect(
  "developer wordt geweigerd bij de factuurexport",
  devExport.status !== 200,
  `status ${devExport.status}`,
);

const adminExport = await get("/api/facturen/export", admin);
expect("admin mag de factuurexport ophalen", adminExport.status === 200, String(adminExport.status));

// Integratie-instellingen bevatten geheimen: alleen admin.
const devIntegraties = await get("/instellingen/integraties", developer);
expect(
  "developer wordt geweigerd bij Integraties",
  devIntegraties.status !== 200,
  `status ${devIntegraties.status}`,
);

// De klant hoort helemaal niet in de interne omgeving te komen.
for (const path of ["/facturen", "/instellingen/integraties", "/api/facturen/export"]) {
  const response = await get(path, klant);
  expect(`klant wordt geweigerd bij ${path}`, response.status !== 200, `status ${response.status}`);
}

// Het wachtrij-endpoint mag niet zonder geheim werken, ook niet met een sessie.
const zonderGeheim = await fetch(`${BASE_URL}/api/uitgaand`, {
  method: "POST",
  headers: { cookie: admin },
});
expect(
  "wachtrij-endpoint weigert een ingelogde admin zonder geheim",
  zonderGeheim.status === 401,
  String(zonderGeheim.status),
);

console.log("");
if (failures > 0) {
  console.error(`${failures} test(s) mislukt.`);
  process.exit(1);
}
console.log("================================================");
console.log(" Alle toegangstests geslaagd.");
console.log("================================================");
