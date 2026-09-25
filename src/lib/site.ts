import "server-only";

import { headers } from "next/headers";

/**
 * Absolute basis-URL van de applicatie. Nodig voor de redirect-links in
 * uitnodigings- en wachtwoordmails. Zet NEXT_PUBLIC_SITE_URL in productie;
 * lokaal wordt de host uit de request gebruikt.
 */
export async function getSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol =
    headerList.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");

  return `${protocol}://${host ?? "localhost:3000"}`;
}
