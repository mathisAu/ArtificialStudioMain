/**
 * Nieuw account aanmaken.
 *
 *   node scripts/create-user.mjs <email> <wachtwoord> [role] [full_name]
 *
 * Voorbeeld:
 *   node scripts/create-user.mjs info@artificialstudio.io Test123! admin
 *
 * Draait bewust alleen tegen een lokale Supabase (127.0.0.1). Wijs dit script
 * nooit op een productieproject.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [, , email, password, role = "developer", fullName = ""] = process.argv;

if (!email || !password) {
  throw new Error("Gebruik: node scripts/create-user.mjs <email> <wachtwoord> [role] [full_name]");
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

// De trigger app.handle_new_user() leest role/full_name uit user_metadata en
// maakt de bijbehorende rij in public.users aan.
const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName, role },
});

if (error) throw new Error(`${email}: ${error.message}`);

console.log(`Account aangemaakt: ${email} (rol: ${role}, id: ${data.user.id})`);
