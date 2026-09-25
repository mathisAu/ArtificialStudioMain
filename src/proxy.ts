import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Proxy (in Next.js 15 en eerder: middleware).
 *
 * Twee taken:
 *   1. De Supabase-sessie verversen, zodat Server Components altijd een geldig
 *      token zien.
 *   2. Een optimistische toegangscheck: niet-ingelogde bezoekers gaan naar
 *      /login. De échte autorisatie gebeurt in de pagina's (requireInternal /
 *      requireClient) en in de database (RLS). Proxy is nadrukkelijk geen
 *      beveiligingslaag.
 */

const PUBLIC_PATHS = [
  "/login",
  "/wachtwoord-vergeten",
  "/wachtwoord-resetten",
  "/account-activeren",
  "/auth/callback",
  "/auth/bevestigen",
  "/auth/uitloggen",
  // Wordt door een scheduler aangeroepen en heeft een eigen geheim.
  "/api/uitgaand",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabasePublicKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Deze aanroep ververst het access token wanneer dat nodig is. Niet
  // weghalen: zonder deze regel verloopt de sessie stilletjes. getClaims()
  // verifieert lokaal (asymmetric signing keys) i.p.v. een netwerkaanroep
  // per request, wat veel sneller is dan getUser().
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") {
      url.searchParams.set("verder", `${pathname}${search}`);
    }
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    const verder = request.nextUrl.searchParams.get("verder");
    // "/" bepaalt op basis van de rol naar welke omgeving deze gebruiker gaat.
    url.pathname = verder?.startsWith("/") ? verder : "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Alles behalve statische bestanden en afbeeldingen.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
