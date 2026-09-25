import { createBrowserClient } from "@supabase/ssr";

import { supabasePublicKey, supabaseUrl } from "./env";

/** Supabase-client voor Client Components (realtime, uploads, live filters). */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabasePublicKey());
}
