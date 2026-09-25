/**
 * Storage-beveiligingstest (§36).
 *
 *   node supabase/tests/storage_test.mjs
 *
 * Draait tegen de lokale Supabase met echte gebruikerssessies, precies zoals de
 * browser dat doet. Controleert dat de policies op `storage.objects` doen wat ze
 * moeten doen: uploaden mag alleen in de eigen map, en lezen mag alleen als je
 * de bijbehorende rij in `public.files` mag zien.
 *
 * Vereist dat scripts/seed-local.mjs is gedraaid.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PASSWORD = "TestWachtwoord123";
const BUCKET = "documents";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match) env[match[1]] = match[2].trim();
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLIC_KEY =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(URL ?? "")) {
  throw new Error(`Deze test draait alleen lokaal. Gevonden: ${URL}`);
}

let failures = 0;

function ok(label, detail = "") {
  console.log(`ok   · ${label}${detail ? ` (${detail})` : ""}`);
}

function fail(label, detail = "") {
  failures += 1;
  console.error(`FOUT · ${label}${detail ? ` — ${detail}` : ""}`);
}

function expect(label, condition, detail = "") {
  if (condition) ok(label, detail);
  else fail(label, detail);
}

/** Client met een echte gebruikerssessie: dezelfde rechten als in de browser. */
async function signIn(email) {
  const client = createClient(URL, PUBLIC_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Inloggen als ${email} mislukt: ${error.message}`);
  return client;
}

const admin = createClient(URL, SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// -----------------------------------------------------------------------------
// Voorbereiding: een tweede organisatie om tegen af te zetten
// -----------------------------------------------------------------------------
const { data: companyA } = await admin
  .from("companies")
  .select("id, name")
  .eq("name", "BVS Projecten")
  .single();

const { data: existingB } = await admin
  .from("companies")
  .select("id")
  .eq("name", "Andere Klant BV")
  .maybeSingle();

const companyB =
  existingB ??
  (
    await admin
      .from("companies")
      .insert({ name: "Andere Klant BV", status: "active" })
      .select("id")
      .single()
  ).data;

const { data: project } = await admin
  .from("projects")
  .select("id")
  .eq("company_id", companyA.id)
  .limit(1)
  .single();

const content = new Blob(["Testdocument voor de storage-policytest."], {
  type: "text/plain",
});

console.log("\n— Developer (lid van het project) —");
const dev = await signIn("dev@test.local");

// 1. Uploaden in de map van de eigen klant hoort te lukken.
const goodPath = `${companyA.id}/${project.id}/${crypto.randomUUID()}-test.txt`;
const upload = await dev.storage.from(BUCKET).upload(goodPath, content);
expect("developer kan uploaden in de map van zijn klant", !upload.error, upload.error?.message);

// 2. Uploaden in de map van een andere klant hoort geweigerd te worden.
const badPath = `${companyB.id}/algemeen/${crypto.randomUUID()}-verboden.txt`;
const forbidden = await dev.storage.from(BUCKET).upload(badPath, content);
expect(
  "developer kan NIET uploaden bij een andere klant",
  Boolean(forbidden.error),
  forbidden.error ? "" : "de upload werd toegestaan",
);

// 3. Metadata vastleggen: één intern document en één vrijgegeven document.
const { data: hiddenDoc, error: hiddenDocError } = await dev
  .from("files")
  .insert({
    company_id: companyA.id,
    project_id: project.id,
    name: "Intern document.txt",
    category: "technical",
    storage_path: goodPath,
    mime_type: "text/plain",
    visible_to_client: false,
  })
  .select("id")
  .single();
expect("developer kan documentmetadata vastleggen", !hiddenDocError, hiddenDocError?.message);

const sharedPath = `${companyA.id}/${project.id}/${crypto.randomUUID()}-gedeeld.txt`;
await dev.storage.from(BUCKET).upload(sharedPath, content);
const { data: sharedDoc } = await dev
  .from("files")
  .insert({
    company_id: companyA.id,
    project_id: project.id,
    name: "Gedeeld document.txt",
    category: "manual",
    storage_path: sharedPath,
    mime_type: "text/plain",
    visible_to_client: true,
  })
  .select("id")
  .single();

console.log("\n— Klant van BVS Projecten —");
const client = await signIn("klant@test.local");

// 4. De klant ziet alleen het vrijgegeven document.
const { data: clientFiles } = await client.from("files").select("id, name");
expect(
  "klant ziet uitsluitend het vrijgegeven document",
  clientFiles?.length === 1 && clientFiles[0].id === sharedDoc.id,
  `${clientFiles?.length ?? 0} document(en): ${(clientFiles ?? []).map((f) => f.name).join(", ")}`,
);

// 5. Het interne bestand mag ook rechtstreeks uit Storage niet te halen zijn.
const blockedDownload = await client.storage.from(BUCKET).download(goodPath);
expect(
  "klant kan het interne bestand NIET downloaden",
  Boolean(blockedDownload.error),
  blockedDownload.error ? "" : "de download slaagde",
);

// 6. Het vrijgegeven bestand mag wel.
const allowedDownload = await client.storage.from(BUCKET).download(sharedPath);
expect(
  "klant kan het vrijgegeven bestand wel downloaden",
  !allowedDownload.error,
  allowedDownload.error?.message,
);

// 7. Een klant mag niet in de map van een andere organisatie uploaden.
const clientForbidden = await client.storage
  .from(BUCKET)
  .upload(`${companyB.id}/algemeen/${crypto.randomUUID()}-verboden.txt`, content);
expect(
  "klant kan NIET uploaden bij een andere organisatie",
  Boolean(clientForbidden.error),
  clientForbidden.error ? "" : "de upload werd toegestaan",
);

// 8. Een klant mag de map van de eigen organisatie niet uitlezen om te zien
//    welke bestanden er nog meer staan.
const listing = await client.storage.from(BUCKET).list(`${companyB.id}`);
expect(
  "klant kan de map van een andere organisatie niet uitlezen",
  (listing.data?.length ?? 0) === 0,
  `${listing.data?.length ?? 0} item(s)`,
);

// -----------------------------------------------------------------------------
// Opruimen
// -----------------------------------------------------------------------------
await admin.from("files").delete().in("id", [hiddenDoc.id, sharedDoc.id]);
await admin.storage.from(BUCKET).remove([goodPath, sharedPath]);
if (!existingB) await admin.from("companies").delete().eq("id", companyB.id);

console.log("");
if (failures > 0) {
  console.error(`${failures} test(s) mislukt.`);
  process.exit(1);
}
console.log("================================================");
console.log(" Alle storage-tests geslaagd.");
console.log("================================================");
