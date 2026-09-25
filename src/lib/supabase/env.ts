/**
 * Supabase gebruikt sinds 2025 nieuwe sleutelnamen (publishable/secret) naast de
 * oude (anon/service_role). Beide worden hier ondersteund, zodat het niet
 * uitmaakt welke variant er in het Supabase-dashboard staat.
 */

export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ontbreekt. Kopieer .env.local.example naar .env.local en vul de waarden in.",
    );
  }
  return url;
}

export function supabasePublicKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (of NEXT_PUBLIC_SUPABASE_ANON_KEY) ontbreekt.",
    );
  }
  return key;
}

/** Alleen op de server te gebruiken. Deze sleutel omzeilt RLS volledig. */
export function supabaseSecretKey(): string {
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SECRET_KEY (of SUPABASE_SERVICE_ROLE_KEY) ontbreekt. Deze is nodig om gebruikers en klanten uit te nodigen.",
    );
  }
  return key;
}
