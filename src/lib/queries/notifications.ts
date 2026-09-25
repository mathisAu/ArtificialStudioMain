import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Tabel per onderwerp waar een notificatie naar kan verwijzen. */
const ENTITY_TABLES: Record<string, string> = {
  feedback: "feedback",
  question: "customer_questions",
  customer_action: "customer_actions",
  project_update: "project_updates",
  invoice: "invoices",
  task: "tasks",
};

interface LinkedNotification {
  id: string;
  entity_type?: string | null;
  entity_id?: string | null;
}

/**
 * Verwijdert notificaties die naar een item wijzen dat er niet meer is.
 *
 * Migratie 20260912000001 ruimt ze op zodra het item verwijderd wordt. Deze
 * controle vangt wat daarvóór al weg was, en een database waarop die migratie
 * nog niet draait — zodat niemand meer op een link naar een 404 klikt.
 *
 * "Niet meer zichtbaar voor deze gebruiker" telt ook als weg: de link zou dan
 * evengoed een 404 opleveren. Kan een tabel niet gelezen worden, dan blijft
 * alles staan; bij twijfel wordt er niets weggegooid.
 */
export async function pruneStaleNotifications<T extends LinkedNotification>(
  supabase: SupabaseClient,
  userId: string,
  rows: T[],
): Promise<T[]> {
  const idsByType = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.entity_type || !row.entity_id || !ENTITY_TABLES[row.entity_type]) continue;
    const ids = idsByType.get(row.entity_type) ?? new Set<string>();
    ids.add(row.entity_id);
    idsByType.set(row.entity_type, ids);
  }

  if (idsByType.size === 0) return rows;

  const missing = new Set<string>();

  await Promise.all(
    [...idsByType].map(async ([type, ids]) => {
      const { data, error } = await supabase
        .from(ENTITY_TABLES[type])
        .select("id")
        .in("id", [...ids]);

      if (error) return;

      const found = new Set((data ?? []).map((row: { id: string }) => row.id));
      for (const id of ids) {
        if (!found.has(id)) missing.add(`${type}:${id}`);
      }
    }),
  );

  if (missing.size === 0) return rows;

  const staleIds = new Set(
    rows
      .filter((row) => missing.has(`${row.entity_type}:${row.entity_id}`))
      .map((row) => row.id),
  );

  await supabase
    .from("notifications")
    .delete()
    .in("id", [...staleIds])
    .eq("user_id", userId);

  return rows.filter((row) => !staleIds.has(row.id));
}
