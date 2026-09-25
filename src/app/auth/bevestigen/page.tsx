"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Tweede helft van /auth/callback, voor links waarin Supabase de sessie in het
 * `#fragment` meegeeft. Dat gebeurt bij uitnodigingen via de Admin API: de
 * server krijgt het fragment nooit te zien, de browser wel.
 *
 * De browserclient van @supabase/ssr schrijft de sessie in cookies, zodat de
 * server bij de volgende pagina gewoon een ingelogde gebruiker ziet.
 */
export default function ConfirmLinkPage() {
  // In development draait React elk effect twee keer. De eerste keer haalt de
  // tokens uit de adresbalk; een tweede ronde zou dan niets meer vinden en
  // alsnog naar de login sturen.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const hash = new URLSearchParams(window.location.hash.slice(1));
    const rawNext = new URLSearchParams(window.location.search).get("next");
    const next = rawNext?.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;

    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const type = hash.get("type");

    // Het fragment bevat een geldig token: meteen uit de adresbalk en de
    // geschiedenis halen.
    window.history.replaceState(null, "", window.location.pathname);

    if (hash.get("error") || !accessToken || !refreshToken) {
      window.location.replace("/login?fout=link-verlopen");
      return;
    }

    void createClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          window.location.replace("/login?fout=link-verlopen");
          return;
        }

        const target =
          next ?? (type === "invite" || type === "recovery" ? "/wachtwoord-resetten" : "/");
        // Een volledige navigatie, zodat de server de nieuwe sessiecookies meteen ziet.
        window.location.replace(target);
      });
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <p className="text-[13px] text-muted-foreground">Een moment, we controleren je link…</p>
    </div>
  );
}
