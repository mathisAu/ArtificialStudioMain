import "server-only";

import { cookies } from "next/headers";

import { THEME_COOKIE, isTheme, type Theme } from "./theme";

/**
 * Leest de themavoorkeur uit de cookie.
 *
 * Apart van `lib/theme.ts` omdat dat bestand ook door client components wordt
 * geïmporteerd; `next/headers` mag daar niet in voorkomen.
 */
export async function readTheme(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : "systeem";
}
