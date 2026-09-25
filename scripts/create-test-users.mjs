/**
 * Test-accounts aanmaken voor elke rol (admin, projectmanager, developer,
 * freelancer, client), allemaal met wachtwoord Test123!.
 *
 *   node scripts/create-test-users.mjs
 *
 * Voor de client-rol is een company_id verplicht (zie app.handle_new_user),
 * dus dit script maakt eerst een testklant aan als die nog niet bestaat.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PASSWORD = "Test123!";

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

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createUser(email, role, fullName) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });
  if (error) throw new Error(`${email}: ${error.message}`);
  console.log(`  ${role.padEnd(15)} ${email}`);
  return data.user.id;
}

async function createUserForCompany(email, role, fullName, companyId) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, role, company_id: companyId },
  });
  if (error) throw new Error(`${email}: ${error.message}`);
  console.log(`  ${role.padEnd(15)} ${email}`);
  return data.user.id;
}

console.log("Testklant klaarzetten…");

let { data: company, error: companyError } = await admin
  .from("companies")
  .select("id")
  .eq("name", "Testklant BV")
  .maybeSingle();
if (companyError) throw new Error(companyError.message);

if (!company) {
  const { data: created, error: createError } = await admin
    .from("companies")
    .insert({ name: "Testklant BV" })
    .select("id")
    .single();
  if (createError) throw new Error(createError.message);
  company = created;
}

console.log("Testaccounts aanmaken…");

await createUser("admin-test@artificialstudio.io", "admin", "Test Admin");
await createUser("pm-test@artificialstudio.io", "projectmanager", "Test Projectmanager");
await createUser("dev-test@artificialstudio.io", "developer", "Test Developer");
await createUser("freelancer-test@artificialstudio.io", "freelancer", "Test Freelancer");
await createUserForCompany("client-test@artificialstudio.io", "client", "Test Klant", company.id);

console.log(`\nAlle accounts hebben wachtwoord: ${PASSWORD}`);
