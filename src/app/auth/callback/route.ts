import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Landingspunt voor alle links uit Supabase-mails: uitnodiging, activatie,
 * wachtwoord-reset en e-mailbevestiging (§3).
 *
 * Supabase levert de sessie op drie manieren af, afhankelijk van hoe de mail
 * is ontstaan:
 *   - `code` (PKCE): een wachtwoordreset die vanuit deze app is aangevraagd;
 *   - `token_hash` + `type`: bij aangepaste e-mailtemplates;
 *   - tokens in het `#fragment` (implicit flow): uitnodigingen via de Admin
 *     API. Een browser stuurt het fragment nooit naar de server, dus deze route
 *     zag daar niets en stuurde elke uitgenodigde klant terug naar de login.
 *     Die links gaan nu door naar /auth/bevestigen, waar de browser ze leest.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next");
  const next = rawNext?.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;

  if (searchParams.get("error") || searchParams.get("error_code")) {
    return NextResponse.redirect(`${origin}/login?fout=link-verlopen`);
  }

  if (!code && !tokenHash) {
    // Een redirect zonder eigen fragment neemt het fragment van de
    // oorspronkelijke URL over, dus de tokens komen mee naar de volgende pagina.
    const url = new URL("/auth/bevestigen", origin);
    if (next) url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  }

  if (!ok) {
    return NextResponse.redirect(`${origin}/login?fout=link-verlopen`);
  }

  // Een uitnodiging of herstelmail leidt altijd eerst naar het instellen van
  // een eigen wachtwoord.
  const target =
    next ?? (type === "recovery" || type === "invite" ? "/wachtwoord-resetten" : "/");

  return NextResponse.redirect(`${origin}${target}`);
}
