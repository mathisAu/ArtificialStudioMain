import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabasePublicKey, supabaseUrl } from "./env";

/**
 * Supabase-client voor Server Components, Server Actions en Route Handlers.
 * Draait met de sessie van de ingelogde gebruiker, dus alle RLS-policies zijn
 * van kracht. In Next.js 16 is `cookies()` asynchroon.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabasePublicKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components mogen geen cookies zetten. Dat is hier geen
          // probleem: proxy.ts ververst de sessie bij elke request.
        }
      },
    },
  });
}
