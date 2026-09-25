/**
 * Wachtwoord en/of rol zetten voor een bestaand account.
 *
 *   node scripts/set-user-role.mjs <email> <role> [wachtwoord]
 *
 * Voorbeeld:
 *   node scripts/set-user-role.mjs info@artificialstudio.io admin Test123!
 *
 * Draait bewust alleen tegen een lokale Supabase (127.0.0.1). Wijs dit script
 * nooit op een productieproject.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [, , email, role, password] = process.argv;

if (!email || !role) {
  throw new Error("Gebruik: node scripts/set-user-role.mjs <email> <role> [wachtwoord]");
}

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

const { data: found, error: findError } = await admin
  .from("users")
  .select("id")
  .ilike("email", email)
  .maybeSingle();

if (findError) throw new Error(findError.message);
if (!found) throw new Error(`Geen gebruiker gevonden met e-mail ${email}.`);

const { error: authError } = await admin.auth.admin.updateUserById(found.id, {
  ...(password ? { password } : {}),
  user_metadata: { role },
});
if (authError) throw new Error(authError.message);

const { error: roleError } = await admin
  .from("users")
  .update({ role })
  .eq("id", found.id);
if (roleError) throw new Error(roleError.message);

console.log(`${email} is nu rol '${role}'${password ? " met nieuw wachtwoord" : ""}.`);
