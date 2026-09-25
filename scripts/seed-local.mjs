/**
 * Demo-data voor een lokale ontwikkelomgeving.
 *
 *   node scripts/seed-local.mjs
 *
 * Maakt vier testaccounts, één klant en één project met taken aan, zodat je de
 * applicatie kunt doorlopen zonder alles met de hand in te voeren.
 *
 * Draait bewust alleen tegen een lokale Supabase (127.0.0.1). Wijs dit script
 * nooit op een productieproject.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PASSWORD = "TestWachtwoord123";

function loadEnv(path = ".env.local") {
  const env = {};
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) env[match[1]] = match[2].trim();
    }
  } catch {
    throw new Error("Kon .env.local niet lezen. Kopieer eerst .env.local.example.");
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const secret = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secret) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SECRET_KEY zijn vereist.");
}

if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
  throw new Error(
    `Dit script draait alleen tegen een lokale Supabase. Gevonden: ${url}`,
  );
}

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createUser(email, meta) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: meta,
  });
  if (error) throw new Error(`${email}: ${error.message}`);
  console.log(`  account   ${email}`);
  return data.user.id;
}

console.log("Testaccounts aanmaken…");

const adminId = await createUser("admin@test.local", {
  full_name: "Berend Verstegen",
  role: "admin",
});
const pmId = await createUser("pm@test.local", {
  full_name: "Sanne de Vries",
  role: "projectmanager",
});
const devId = await createUser("dev@test.local", {
  full_name: "Tim Jansen",
  role: "developer",
});

console.log("Klant aanmaken…");

const { data: company, error: companyError } = await admin
  .from("companies")
  .insert({
    name: "BVS Projecten",
    email: "info@bvsprojecten.nl",
    phone: "010 - 123 45 67",
    website: "https://bvsprojecten.nl",
    city: "Rotterdam",
    status: "active",
    account_manager_id: pmId,
  })
  .select("id")
  .single();
if (companyError) throw companyError;

const { data: contact, error: contactError } = await admin
  .from("contacts")
  .insert({
    company_id: company.id,
    first_name: "Peter",
    last_name: "Bakker",
    email: "peter@bvsprojecten.nl",
    phone: "06 - 12 34 56 78",
    job_title: "Directeur",
    is_primary: true,
  })
  .select("id")
  .single();
if (contactError) throw contactError;

await createUser("klant@test.local", {
  full_name: "Peter Bakker",
  role: "client",
  company_id: company.id,
  contact_id: contact.id,
});

console.log("Project met taken aanmaken…");

const { data: project, error: projectError } = await admin
  .from("projects")
  .insert({
    company_id: company.id,
    name: "Klantportaal ontwikkeling",
    description:
      "Bouw van een beveiligd klantportaal met projectstatus, feedback en documenten.",
    goal: "Klanten kunnen zelfstandig de status van hun project volgen.",
    scope: "Portaal, koppeling met het interne systeem, documentbeheer.",
    next_step: "API-koppeling testen",
    project_type: "automation",
    status: "in_development",
    priority: "high",
    project_manager_id: pmId,
    start_date: "2026-07-01",
    deadline: "2026-09-04",
    created_by: adminId,
  })
  .select("id")
  .single();
if (projectError) throw projectError;

const { error: memberError } = await admin.from("project_members").upsert(
  [
    { project_id: project.id, user_id: devId },
    { project_id: project.id, user_id: adminId },
  ],
  { onConflict: "project_id,user_id", ignoreDuplicates: true },
);

// Let op: PostgREST eist dat elk object in een bulk-insert exact dezelfde
// sleutels heeft. Daarom staan hier overal alle velden, ook als ze null zijn.
const task = (fields) => ({
  project_id: project.id,
  title: "",
  description: null,
  status: "todo",
  priority: "normal",
  assignee_id: null,
  due_date: null,
  visible_to_client: false,
  ...fields,
});

const { error: taskError } = await admin.from("tasks").insert([
  task({
    title: "Databaseschema opzetten",
    status: "done",
    priority: "high",
    assignee_id: devId,
    due_date: "2026-07-10",
  }),
  task({
    title: "Authenticatie en rollen inrichten",
    status: "done",
    priority: "high",
    assignee_id: devId,
    due_date: "2026-07-20",
  }),
  task({
    title: "API-koppeling testen",
    description: "Testen van de automatische orderverwerking.",
    status: "in_progress",
    priority: "urgent",
    assignee_id: adminId,
    due_date: "2026-08-28",
    visible_to_client: true,
  }),
  task({
    title: "Klantportaal afronden",
    status: "todo",
    priority: "normal",
    assignee_id: adminId,
    due_date: "2026-09-01",
  }),
  task({
    title: "Wacht op API-gegevens van klant",
    status: "blocked",
    priority: "high",
    due_date: "2026-08-20",
  }),
]);
if (taskError) throw taskError;

const { error: updateError } = await admin.from("project_updates").insert({
  project_id: project.id,
  company_id: company.id,
  title: "API-koppeling afgerond",
  body:
    "De eerste API-koppeling is succesvol gerealiseerd. We starten nu met het testen van de automatische orderverwerking.",
  author_id: pmId,
  visible_to_client: true,
});

const { error: noteError } = await admin.from("notes").insert({
  project_id: project.id,
  title: "Interne notitie",
  body: "Deze notitie mag de klant nooit kunnen zien.",
  author_id: adminId,
});

const { error: actionError } = await admin.from("customer_actions").insert({
  project_id: project.id,
  company_id: company.id,
  title: "API-gegevens aanleveren",
  description: "Graag de API-sleutel en endpoint van het orderpakket aanleveren.",
  assigned_contact_id: contact.id,
  due_date: "2026-08-28",
  created_by: pmId,
});

console.log("Feedback en vragen aanmaken…");

const feedbackRow = (fields) => ({
  project_id: project.id,
  company_id: company.id,
  title: "",
  description: "",
  type: "general",
  priority: "normal",
  status: "new",
  ...fields,
});

const { data: feedbackItems, error: feedbackError } = await admin
  .from("feedback")
  .insert([
    feedbackRow({
      title: "Knop op de bevestigingspagina werkt niet",
      description:
        "Na het versturen van het formulier blijft de knop 'Bevestigen' grijs. In Chrome en Edge, op desktop.",
      type: "bug",
      priority: "urgent",
    }),
    feedbackRow({
      title: "Graag ons logo groter in de header",
      description: "Het logo valt nu weg tegen de achtergrond.",
      type: "change",
      priority: "normal",
      status: "in_progress",
    }),
    feedbackRow({
      title: "Kunnen we ook een exportknop krijgen?",
      description: "Een export naar Excel van de orderlijst zou ons veel tijd schelen.",
      type: "feature_request",
      priority: "low",
      status: "planned",
    }),
  ])
  .select("id");
if (feedbackError) throw feedbackError;

const { error: questionError } = await admin.from("customer_questions").insert([
  {
    project_id: project.id,
    company_id: company.id,
    subject: "Wanneer staat de testomgeving klaar?",
    body: "We willen graag intern alvast plannen wanneer we kunnen testen.",
    status: "new",
  },
  {
    project_id: project.id,
    company_id: company.id,
    subject: "Hebben jullie nog gegevens van ons nodig?",
    body: "Zo ja, dan zetten wij dat deze week klaar.",
    status: "answered",
  },
]);
if (questionError) throw questionError;

// Een reactie in de conversatie bij het eerste feedbackpunt.
const { error: commentError } = await admin.from("comments").insert([
  {
    entity_type: "feedback",
    entity_id: feedbackItems[0].id,
    project_id: project.id,
    company_id: company.id,
    author_id: pmId,
    body: "Dank voor de melding. We kunnen het reproduceren en pakken het deze sprint op.",
    is_internal: false,
  },
  {
    entity_type: "feedback",
    entity_id: feedbackItems[0].id,
    project_id: project.id,
    company_id: company.id,
    author_id: devId,
    body: "Oorzaak gevonden: de validatie blokkeert bij een leeg optioneel veld.",
    is_internal: true,
  },
]);
if (commentError) throw commentError;

console.log("Facturen aanmaken…");

const invoice = (fields) => ({
  company_id: company.id,
  project_id: project.id,
  description: null,
  invoice_date: "2026-07-01",
  due_date: "2026-07-31",
  amount_excl_vat: 0,
  vat_amount: 0,
  status: "open",
  external_payment_url: null,
  created_by: adminId,
  ...fields,
});

const { error: invoiceError } = await admin.from("invoices").insert([
  invoice({
    description: "Klantportaal — sprint 1 en 2",
    invoice_date: "2026-07-05",
    due_date: "2026-08-04",
    amount_excl_vat: 4500,
    vat_amount: 945,
    status: "paid",
  }),
  invoice({
    description: "Klantportaal — sprint 3",
    invoice_date: "2026-07-28",
    due_date: "2026-08-11",
    amount_excl_vat: 3200,
    vat_amount: 672,
    status: "open",
    external_payment_url: "https://voorbeeld.betaallink.nl/factuur",
  }),
  invoice({
    description: "Meerwerk: extra rapportagescherm",
    invoice_date: "2026-08-18",
    due_date: "2026-09-17",
    amount_excl_vat: 850,
    vat_amount: 178.5,
    status: "draft",
  }),
]);
if (invoiceError) throw invoiceError;

for (const [label, error] of [
  ["teamleden", memberError],
  ["projectupdate", updateError],
  ["notitie", noteError],
  ["klantactie", actionError],
]) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

console.log("\nKlaar. Inloggen kan met wachtwoord " + PASSWORD + ":");
console.log("  admin@test.local   admin");
console.log("  pm@test.local      projectmanager");
console.log("  dev@test.local     developer");
console.log("  klant@test.local   klant (BVS Projecten)");
