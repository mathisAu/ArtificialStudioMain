import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Het bureau en zijn klanten zitten in Nederland, terwijl de server op UTC
 * draait. Zonder expliciete tijdzone toont de server 07:49 waar de browser
 * 09:52 laat zien, en verschuift een datum rond middernacht een dag.
 */
export const TIME_ZONE = "Europe/Amsterdam";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const DATE_SHORT_FMT = new Intl.DateTimeFormat("nl-NL", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
});

const DATETIME_FMT = new Intl.DateTimeFormat("nl-NL", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

/** en-CA levert precies jjjj-mm-dd, het formaat van een `date`-kolom. */
const ISO_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const CURRENCY_FMT = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return DATE_FMT.format(new Date(value));
}

export function formatDateShort(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return DATE_SHORT_FMT.format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return DATETIME_FMT.format(new Date(value));
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return CURRENCY_FMT.format(value);
}

/** "3 dagen geleden", "over 2 weken" — relatief t.o.v. nu. */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat("nl-NL", { numeric: "auto" });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["week", 1000 * 60 * 60 * 24 * 7],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
  ];

  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return "zojuist";
}

/**
 * Aantal hele dagen tot een deadline. Negatief = over deadline.
 *
 * Beide kanten worden eerst naar een kalenderdag in Nederland teruggebracht, zo
 * telt de server dezelfde dagen als de browser.
 */
export function daysUntil(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const target = toDateInput(value);
  if (!target) return null;
  const diff = Date.parse(`${target}T00:00:00Z`) - Date.parse(`${todayIso()}T00:00:00Z`);
  return Math.round(diff / 86_400_000);
}

export function isOverdue(value: string | Date | null | undefined): boolean {
  const days = daysUntil(value);
  return days !== null && days < 0;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Datum in jjjj-mm-dd, het formaat dat Postgres `date`-kolommen verwachten. */
export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  // Een `date`-kolom komt al in dit formaat binnen; die niet door een tijdzone
  // halen, anders schuift hij een dag op.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : ISO_DATE_FMT.format(date);
}

export function todayIso(): string {
  return toDateInput(new Date());
}

/** Datum over N dagen, in yyyy-mm-dd. */
export function inDaysIso(days: number): string {
  return toDateInput(new Date(Date.now() + days * 86_400_000));
}

/**
 * Tijdstip van N dagen geleden, als ISO-string voor databasefilters.
 *
 * Staat bewust in een helper: binnen een component zou een directe aanroep van
 * `Date.now()` als onzuiver worden aangemerkt. In een Server Component is de
 * waarde correct — die rendert één keer per request — maar de bedoeling is zo
 * ook duidelijker.
 */
export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}
