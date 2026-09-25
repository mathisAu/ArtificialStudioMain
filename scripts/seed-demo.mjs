/**
 * Demodata voor de Board-, Kalender-, Goedkeuringen- en Rapporten-pagina's.
 *
 *   node scripts/seed-demo.mjs --ja            demodata toevoegen
 *   node scripts/seed-demo.mjs --verwijder --ja   demodata weer verwijderen
 *
 * Werkt ook tegen een echt (cloud) Supabase-project, daarom vraagt het script
 * expliciet om `--ja`. Het maakt bewust GEEN accounts aan: teamleden zijn de
 * bestaande interne gebruikers uit je database, dus er komt nooit een
 * bekend wachtwoord in je project terecht.
 *
 * Alles wat dit script toevoegt hangt aan drie klanten waarvan de notitie met
 * "Demodata" begint. Zo weet `--verwijder` precies wat weg mag. De templates
 * blijven bij verwijderen staan: die zijn ook los van de demo bruikbaar.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const MARKER = "Demodata";
const args = new Set(process.argv.slice(2));
const remove = args.has("--verwijder");

function loadEnv(path = ".env.local") {
  const env = {};
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) env[match[1]] = match[2].trim();
    }
  } catch {
    throw new Error("Kon .env.local niet lezen.");
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const secret = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) throw new Error("NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SECRET_KEY zijn vereist.");

const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(url);
if (!isLocal && !args.has("--ja")) {
  console.error(
    `Dit schrijft naar een echt project:\n  ${url}\nVoeg --ja toe om door te gaan.`,
  );
  process.exit(1);
}

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function must(label, { data, error }) {
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

const day = (offset) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

console.log(`Doel: ${url}`);

// -----------------------------------------------------------------------------
// Verwijderen
// -----------------------------------------------------------------------------
if (remove) {
  const companies = must(
    "klanten zoeken",
    await admin.from("companies").select("id, name").like("notes", `${MARKER}%`),
  );
  if (companies.length === 0) {
    console.log("Geen demodata gevonden. Er is niets verwijderd.");
    process.exit(0);
  }
  const ids = companies.map((c) => c.id);

  // projects.company_id staat op `restrict`: eerst de projecten, dan de klanten.
  must("projecten verwijderen", await admin.from("projects").delete().in("company_id", ids));
  must("klanten verwijderen", await admin.from("companies").delete().in("id", ids));

  console.log(`Verwijderd: ${companies.map((c) => c.name).join(", ")} met alle projecten en taken.`);
  process.exit(0);
}

// -----------------------------------------------------------------------------
// Toevoegen
// -----------------------------------------------------------------------------
const existing = must(
  "controle bestaande demodata",
  await admin.from("companies").select("id").like("notes", `${MARKER}%`).limit(1),
);
if (existing.length > 0) {
  console.error("Demodata staat er al. Verwijder die eerst met: node scripts/seed-demo.mjs --verwijder --ja");
  process.exit(1);
}

const staff = must(
  "teamleden ophalen",
  await admin
    .from("users")
    .select("id, full_name, role")
    .eq("is_active", true)
    .neq("role", "client")
    .order("created_at"),
);
if (staff.length === 0) throw new Error("Geen actieve interne gebruikers gevonden. Maak eerst een admin aan.");

const pm = staff.find((u) => u.role === "admin" || u.role === "projectmanager") ?? staff[0];
const person = (i) => staff[i % staff.length];
console.log(`Teamleden: ${staff.map((u) => u.full_name).join(", ")}`);

// --- Templates ---------------------------------------------------------------
console.log("Templates controleren…");

const TEMPLATES = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Software / Automatiseringsproject",
    description: "Standaardfases voor een software- of automatiseringstraject, van intake tot afronding.",
    project_type: "automation",
    phases: ["Intake", "Benodigdheden verzamelen", "Technische scope", "Ontwikkeling", "Interne test", "Klanttest", "Feedback verwerken", "Laatste controle", "Oplevering", "Documentatie", "Afronding"],
    tasks: ["Intakegesprek inplannen", "Doelstelling en scope vastleggen", "Benodigde toegangen opvragen", "Technisch ontwerp opstellen", "Ontwikkeling uitvoeren", "Interne test uitvoeren", "Testomgeving klaarzetten voor klant", "Feedback van klant verwerken", "Laatste controle uitvoeren", "Opleveren en overdragen", "Documentatie opleveren"],
  },
  {
    id: "22222222-2222-4222-8222-222222222201",
    name: "Orderverwerking",
    description: "Automatische verwerking van binnenkomende transportopdrachten.",
    project_type: "automation",
    phases: ["Bronnen koppelen", "Herkenning live", "Opdrachten in het systeem"],
    tasks: ["Leest orders uit e-mails, PDF's en klantportalen", "Herkent automatisch ordergegevens", "Vermindert handmatige invoer", "Verwerkt opdrachten direct binnen het systeem"],
  },
  {
    id: "22222222-2222-4222-8222-222222222202",
    name: "Planning",
    description: "Een centrale omgeving voor ritplanning, chauffeurs en voertuigen.",
    project_type: "app",
    phases: ["Ritplanning", "Capaciteit", "Boordcomputer"],
    tasks: ["Inplannen van ritten en transportopdrachten", "Inzicht in beschikbare capaciteit", "Planning per chauffeur en voertuig", "Koppelingen met boordcomputersystemen"],
  },
  {
    id: "22222222-2222-4222-8222-222222222203",
    name: "Facturatie & Financieel",
    description: "Automatische verwerking van transportfacturen.",
    project_type: "integration",
    phases: ["Conceptfactuur", "Goedkeuring", "Boekhoudkoppeling"],
    tasks: ["Conceptfacturen automatisch genereren", "Controle- en goedkeuringsworkflow", "Koppelingen met boekhoudsoftware", "Minder handmatige administratie"],
  },
  {
    id: "22222222-2222-4222-8222-222222222204",
    name: "Winst- & Tarief Analyse",
    description: "Realtime inzicht in de prestaties van jouw transportbedrijf.",
    project_type: "consultancy",
    phases: ["Klantwinst", "Tarieven", "Stuurinformatie"],
    tasks: ["Inzicht in winst per klant", "Analyse van tarieven en marges", "Overzicht van omzet en kosten", "Ondersteuning van commerciële beslissingen"],
  },
];

const haveTemplates = new Set(
  must(
    "templates ophalen",
    await admin.from("project_templates").select("id").in("id", TEMPLATES.map((t) => t.id)),
  ).map((t) => t.id),
);

for (const t of TEMPLATES.filter((t) => !haveTemplates.has(t.id))) {
  must(
    `template ${t.name}`,
    await admin
      .from("project_templates")
      .insert({ id: t.id, name: t.name, description: t.description, project_type: t.project_type }),
  );
  const items = [
    ...t.phases.map((title, i) => ({ kind: "phase", title, position: i + 1, offset_days: i * 7, priority: "normal" })),
    ...t.tasks.map((title, i) => ({ kind: "task", title, position: i + 1, offset_days: (i + 1) * 5, priority: i === 0 ? "high" : "normal" })),
  ].map((item) => ({ ...item, template_id: t.id }));
  must(`template-items ${t.name}`, await admin.from("project_template_items").insert(items));
  console.log(`  template  ${t.name}`);
}

// --- Klanten en contactpersonen ---------------------------------------------
console.log("Klanten aanmaken…");

const note = `${MARKER} — verwijderen met: node scripts/seed-demo.mjs --verwijder --ja`;
const companies = must(
  "klanten",
  await admin
    .from("companies")
    .insert([
      { name: "Van Dijk Transport", email: "info@vandijk-transport.example", phone: "010 - 123 45 67", website: "https://vandijk-transport.example", city: "Rotterdam", status: "active", account_manager_id: pm.id, notes: note },
      { name: "Bakker Logistics", email: "info@bakker-logistics.example", phone: "030 - 234 56 78", website: "https://bakker-logistics.example", city: "Utrecht", status: "active", account_manager_id: pm.id, notes: note },
      { name: "Nova Distributie", email: "info@nova-distributie.example", phone: "040 - 345 67 89", website: "https://nova-distributie.example", city: "Eindhoven", status: "active", account_manager_id: pm.id, notes: note },
    ])
    .select("id, name"),
);
const company = Object.fromEntries(companies.map((c) => [c.name, c.id]));

const contacts = must(
  "contactpersonen",
  await admin
    .from("contacts")
    .insert([
      { company_id: company["Van Dijk Transport"], first_name: "Peter", last_name: "van Dijk", email: "peter@vandijk-transport.example", job_title: "Directeur", is_primary: true },
      { company_id: company["Van Dijk Transport"], first_name: "Sanne", last_name: "Mulder", email: "sanne@vandijk-transport.example", job_title: "Planner", is_primary: false },
      { company_id: company["Bakker Logistics"], first_name: "Lotte", last_name: "Bakker", email: "lotte@bakker-logistics.example", job_title: "Operationeel manager", is_primary: true },
      { company_id: company["Nova Distributie"], first_name: "Ruben", last_name: "de Haan", email: "ruben@nova-distributie.example", job_title: "Financieel directeur", is_primary: true },
    ])
    .select("id, first_name, company_id"),
);
const contactOf = (companyName) => contacts.find((c) => c.company_id === company[companyName])?.id ?? null;

// --- Projecten ---------------------------------------------------------------
console.log("Projecten aanmaken…");

const PROJECTS = [
  { key: "order", company: "Van Dijk Transport", name: "Orderverwerking automatiseren", type: "automation", status: "in_development", priority: "high", start: -40, deadline: 21, phase: 1, next: "Herkenning live zetten in de testomgeving", goal: "Binnenkomende transportopdrachten automatisch verwerken.", scope: "E-mail, PDF en klantportalen koppelen en herkennen." },
  { key: "planning", company: "Van Dijk Transport", name: "Ritplanning dashboard", type: "app", status: "planning", priority: "normal", start: -10, deadline: 60, phase: 0, next: "Ontwerp van de planning afronden", goal: "Eén plek voor ritten, chauffeurs en voertuigen.", scope: "Planbord, capaciteit en koppeling met boordcomputers." },
  { key: "factuur", company: "Bakker Logistics", name: "Facturatie koppeling boekhouding", type: "integration", status: "internal_test", priority: "high", start: -55, deadline: 7, phase: 2, next: "Testfacturen laten goedkeuren", goal: "Facturen automatisch klaarzetten in het boekhoudpakket.", scope: "Conceptfacturen, goedkeuringsflow en boekhoudkoppeling." },
  { key: "portaal", company: "Bakker Logistics", name: "Klantportaal Bakker Logistics", type: "website", status: "waiting_client", priority: "normal", start: -30, deadline: -3, phase: 3, next: "Wachten op logo en huisstijl", goal: "Klanten volgen hun zendingen zelf.", scope: "Inloggen, zendingoverzicht en documenten." },
  { key: "analyse", company: "Nova Distributie", name: "Winst- en tarief analyse", type: "consultancy", status: "intake", priority: "low", start: -3, deadline: 90, phase: 0, next: "Intakegesprek plannen", goal: "Realtime inzicht in winst per klant.", scope: "Analyse van tarieven, marges en omzet." },
  { key: "website", company: "Nova Distributie", name: "Website vernieuwing", type: "website", status: "completed", priority: "normal", start: -100, deadline: -20, phase: 5, next: null, goal: "Een snelle, moderne website.", scope: "Ontwerp, bouw en oplevering." },
];

const projects = must(
  "projecten",
  await admin
    .from("projects")
    .insert(
      PROJECTS.map((p) => ({
        company_id: company[p.company],
        name: p.name,
        description: p.goal,
        goal: p.goal,
        scope: p.scope,
        next_step: p.next,
        project_type: p.type,
        status: p.status,
        priority: p.priority,
        project_manager_id: pm.id,
        start_date: day(p.start),
        deadline: day(p.deadline),
        created_by: pm.id,
      })),
    )
    .select("id, name"),
);
const projectId = Object.fromEntries(PROJECTS.map((p, i) => [p.key, projects[i].id]));

must(
  "teamleden koppelen",
  await admin.from("project_members").upsert(
    projects.flatMap((p) => staff.map((u) => ({ project_id: p.id, user_id: u.id }))),
    { onConflict: "project_id,user_id", ignoreDuplicates: true },
  ),
);

const PHASES = ["Intake", "Ontwikkeling", "Interne test", "Klanttest", "Oplevering"];
must(
  "fases",
  await admin.from("project_phases").insert(
    PROJECTS.flatMap((p) =>
      PHASES.map((name, i) => ({
        project_id: projectId[p.key],
        name,
        position: i + 1,
        state: i < p.phase ? "done" : i === p.phase ? "active" : "pending",
      })),
    ),
  ),
);

// --- Taken en subtaken -------------------------------------------------------
console.log("Taken en subtaken aanmaken…");

// [project, titel, status, prioriteit, deadline (dagen vanaf vandaag), zichtbaar voor klant]
const TASKS = [
  ["order", "Leest orders uit e-mails, PDF's en klantportalen", "in_progress", "high", 4, true],
  ["order", "Herkent automatisch ordergegevens", "todo", "high", 9, false],
  ["order", "Vermindert handmatige invoer", "todo", "normal", 14, false],
  ["order", "Verwerkt opdrachten direct binnen het systeem", "review", "normal", 2, false],
  ["order", "Koppeling met transportplanning testen", "blocked", "urgent", -2, false],
  ["order", "Intake en scope vastleggen", "done", "normal", -30, true],
  ["planning", "Ritplanning ontwerp uitwerken", "in_progress", "normal", 6, false],
  ["planning", "Inzicht in beschikbare capaciteit", "todo", "normal", 20, false],
  ["planning", "Planning per chauffeur en voertuig", "todo", "low", 30, false],
  ["planning", "Koppelingen met boordcomputersystemen onderzoeken", "todo", "normal", 12, false],
  ["factuur", "Conceptfacturen automatisch genereren", "review", "high", 1, false],
  ["factuur", "Controle- en goedkeuringsworkflow", "in_progress", "high", 0, true],
  ["factuur", "Koppelingen met boekhoudsoftware", "in_progress", "urgent", 3, false],
  ["factuur", "Testfacturen controleren", "todo", "normal", 5, true],
  ["factuur", "API-sleutels boekhouding aanvragen", "done", "normal", -12, false],
  ["portaal", "Inlogpagina klantportaal", "done", "normal", -14, true],
  ["portaal", "Overzicht zendingen tonen", "review", "normal", -1, false],
  ["portaal", "Documenten uploaden voor klant", "in_progress", "normal", 2, true],
  ["portaal", "Wacht op logo en huisstijl van klant", "blocked", "high", -5, false],
  ["analyse", "Intakegesprek inplannen", "in_progress", "high", 1, true],
  ["analyse", "Inzicht in winst per klant", "todo", "normal", 25, false],
  ["analyse", "Analyse van tarieven en marges", "todo", "normal", 35, false],
  ["website", "Website opleveren", "done", "high", -22, true],
  ["website", "Documentatie opleveren", "done", "normal", -21, false],
];

const tasks = must(
  "taken",
  await admin
    .from("tasks")
    .insert(
      TASKS.map(([key, title, status, priority, due, visible], i) => ({
        project_id: projectId[key],
        title,
        description: null,
        status,
        priority,
        assignee_id: person(i).id,
        start_date: null,
        due_date: day(due),
        position: (i + 1) * 1000,
        visible_to_client: visible,
        completed_at: status === "done" ? new Date().toISOString() : null,
        created_by: pm.id,
      })),
    )
    .select("id, title"),
);
const taskId = Object.fromEntries(tasks.map((t) => [t.title, t.id]));

const SUBTASKS = {
  "Leest orders uit e-mails, PDF's en klantportalen": [["Mailbox koppelen", true], ["PDF-herkenning testen", false], ["Klantportaal koppelen", false]],
  "Conceptfacturen automatisch genereren": [["Sjabloon opstellen", true], ["Btw-regels controleren", false]],
  "Controle- en goedkeuringsworkflow": [["Rollen vastleggen", false], ["Goedkeuringsstap bouwen", false], ["Meldingen instellen", false]],
  "Ritplanning ontwerp uitwerken": [["Schetsen maken", true], ["Ontwerp bespreken", false]],
  "Documenten uploaden voor klant": [["Uploadscherm bouwen", true], ["Bestandstypen beperken", false]],
};
must(
  "subtaken",
  await admin.from("subtasks").insert(
    Object.entries(SUBTASKS).flatMap(([title, steps]) =>
      steps.map(([stepTitle, done], i) => ({
        task_id: taskId[title],
        title: stepTitle,
        is_done: done,
        position: i + 1,
      })),
    ),
  ),
);

// --- Goedkeuringen en updates ------------------------------------------------
console.log("Goedkeuringen en updates aanmaken…");

const projectCompany = Object.fromEntries(PROJECTS.map((p) => [p.key, p.company]));
// [project, titel, toelichting, status, deadline]
const APPROVALS = [
  ["order", "Voorbeeldorders aanleveren", "Graag tien recente orders als voorbeeld voor de herkenning.", "open", 5],
  ["order", "Ontwerp goedkeuren", "Het scherm waarop opdrachten binnenkomen.", "open", 2],
  ["planning", "Planning bevestigen", "Bevestig de fases en de opleverdatum.", "open", 10],
  ["factuur", "Testfacturen goedkeuren", "Controleer de vijf conceptfacturen in de testomgeving.", "open", 4],
  ["factuur", "API-toegang boekhouding aanleveren", "Sleutel en administratienummer.", "done", -10],
  ["portaal", "Logo en huisstijl aanleveren", "Zonder huisstijl kunnen we het portaal niet afmaken.", "open", -4],
  ["portaal", "Oplevering accorderen", "Akkoord op de afgesproken scope.", "in_progress", 7],
  ["website", "Oplevering website accorderen", "Definitief akkoord op de opgeleverde website.", "done", -22],
];
must(
  "goedkeuringen",
  await admin.from("customer_actions").insert(
    APPROVALS.map(([key, title, description, status, due]) => ({
      project_id: projectId[key],
      company_id: company[projectCompany[key]],
      title,
      description,
      assigned_contact_id: contactOf(projectCompany[key]),
      due_date: day(due),
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
      created_by: pm.id,
    })),
  ),
);

const UPDATES = [
  ["order", "Orderherkenning draait in de testomgeving", "De eerste orders uit e-mail worden nu automatisch herkend. Volgende stap: PDF's en het klantportaal."],
  ["factuur", "Boekhoudkoppeling in interne test", "De conceptfacturen komen goed door. We laten ze nu door jullie controleren."],
  ["portaal", "We wachten op jullie huisstijl", "Zodra we logo en kleuren hebben, ronden we het portaal af."],
  ["website", "De website is opgeleverd", "Bedankt voor de fijne samenwerking. De documentatie staat klaar."],
];
must(
  "updates",
  await admin.from("project_updates").insert(
    UPDATES.map(([key, title, body]) => ({
      project_id: projectId[key],
      company_id: company[projectCompany[key]],
      title,
      body,
      author_id: pm.id,
      visible_to_client: true,
    })),
  ),
);

console.log(`
Klaar. Toegevoegd:
  ${companies.length} klanten, ${contacts.length} contactpersonen, ${projects.length} projecten
  ${tasks.length} taken, ${Object.values(SUBTASKS).flat().length} subtaken
  ${APPROVALS.length} goedkeuringen, ${UPDATES.length} projectupdates

Opruimen kan met: node scripts/seed-demo.mjs --verwijder --ja
`);
