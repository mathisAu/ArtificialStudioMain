import "server-only";

import { createClient } from "@supabase/supabase-js";

import { supabaseSecretKey, supabaseUrl } from "./env";

/**
 * Client met de secret key. Deze omzeilt RLS volledig en is uitsluitend bedoeld
 * voor beheeracties die de Auth Admin API vereisen: gebruikers uitnodigen,
 * klanten uitnodigen, accounts deactiveren (§3).
 *
 * Roep dit nooit aan zonder eerst zelf te controleren of de ingelogde gebruiker
 * de handeling mag uitvoeren — de database doet dat hier namelijk niet meer.
 */
export function createAdminClient() {
  return createClient(supabaseUrl(), supabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
