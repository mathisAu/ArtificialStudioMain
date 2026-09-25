import { z } from "zod";

/**
 * Gedeelde bouwstenen voor formuliervalidatie.
 * Lege formuliervelden komen binnen als "" en horen in de database als NULL.
 */

export const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable();

export const optionalEmail = optionalText.refine(
  (value) => value === null || z.email().safeParse(value).success,
  { message: "Vul een geldig e-mailadres in." },
);

export const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Vul een geldige datum in.",
  });

export const optionalUuid = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .refine((value) => value === null || z.uuid().safeParse(value).success, {
    message: "Ongeldige selectie.",
  });

/** Eerste leesbare foutmelding uit een mislukte parse. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Controleer de ingevulde gegevens.";
}

export function checkbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

export function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/**
 * Bedragen komen binnen als "1.234,56", "1234,56", "1234.56" of "1234".
 *
 * Alle punten weghalen gaat mis: het invoerveld vult de btw automatisch aan met
 * `toFixed(2)`, dus "315.00" zou dan 31.500 worden. Daarom bepaalt het laatste
 * scheidingsteken de decimalen en is alles daarvoor duizendtalscheiding. Een
 * enkel scheidingsteken met precies drie cijfers erachter ("1.000") is niet te
 * onderscheiden van drie decimalen en telt daarom als duizendtal.
 */
export function parseAmount(value: string): number {
  // Alles wat geen cijfer of scheidingsteken is (euroteken, spaties, NBSP) weg.
  const compact = value.replace(/[^0-9.,]/g, "");
  if (compact === "") return 0;

  const separatorAt = Math.max(compact.lastIndexOf(","), compact.lastIndexOf("."));
  const digitsOnly = compact.replace(/[.,]/g, "");

  if (separatorAt === -1) return Number(digitsOnly);

  const decimals = compact.slice(separatorAt + 1);
  const singleSeparator = compact.replace(/[^.,]/g, "").length === 1;

  // "1.000" / "1,000": duizendtal. Ook lege of niet-numerieke staart valt hierop terug.
  if (!/^\d+$/.test(decimals) || (decimals.length === 3 && singleSeparator)) {
    return Number(digitsOnly);
  }

  const whole = compact.slice(0, separatorAt).replace(/[.,]/g, "") || "0";
  return Number(`${whole}.${decimals}`);
}
