/**
 * Padconventie voor de private bucket `documents` (§17).
 *
 *   {company_id}/{project_id|algemeen}/{uuid}-{bestandsnaam}
 *
 * De eerste map is altijd de company_id. De storage-policy `documents_insert`
 * leest die map om te bepalen of iemand hier mag uploaden — dat moet kunnen
 * vóórdat er een rij in `public.files` bestaat.
 */

export const DOCUMENTS_BUCKET = "documents";

/** Maximale bestandsgrootte; moet gelijk zijn aan de limiet op de bucket. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Haalt tekens uit een bestandsnaam die in een storage-pad problemen geven. */
export function safeFileName(name: string): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  return normalized.slice(0, 120) || "bestand";
}

export function buildStoragePath(
  companyId: string,
  projectId: string | null,
  fileName: string,
): string {
  const folder = projectId ?? "algemeen";
  return `${companyId}/${folder}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["kB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}
