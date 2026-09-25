/**
 * Themavoorkeur (licht, donker of "volg mijn systeem").
 *
 * De keuze staat in een cookie zodat de server hem al kent bij het renderen.
 * Daardoor staat het juiste thema meteen in de HTML en zie je geen flits van
 * het verkeerde thema bij het laden van de pagina.
 */

export const THEME_COOKIE = "thema";

export type Theme = "licht" | "donker" | "systeem";

export function isTheme(value: string | undefined): value is Theme {
  return value === "licht" || value === "donker" || value === "systeem";
}

/**
 * Vertaalt de voorkeur naar de waarde van het `data-theme`-attribuut.
 * Bij "systeem" komt er geen attribuut, zodat `prefers-color-scheme` het
 * overneemt.
 */
export function themeAttribute(theme: Theme | undefined): "light" | "dark" | undefined {
  if (theme === "licht") return "light";
  if (theme === "donker") return "dark";
  return undefined;
}
