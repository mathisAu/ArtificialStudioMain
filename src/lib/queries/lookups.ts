import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CompanySummary, UserSummary } from "@/lib/types";

export interface ProjectOption {
  id: string;
  name: string;
  company_id: string;
  companyName: string | null;
}

/** Projecten waar de ingelogde gebruiker bij mag; gebruikt in keuzelijsten. */
export async function getProjectOptions(): Promise<ProjectOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, name, company_id, company:companies(name)")
    .eq("is_archived", false)
    .order("name");

  return (data ?? []).map((row) => {
    const company = Array.isArray(row.company) ? row.company[0] : row.company;
    return {
      id: row.id,
      name: row.name,
      company_id: row.company_id,
      companyName: (company as { name?: string } | null)?.name ?? null,
    };
  });
}

export async function getCompanyOptions(): Promise<CompanySummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("id, name, status")
    .order("name");
  return (data ?? []) as CompanySummary[];
}

/** Alle actieve interne medewerkers, voor toewijzingen en filters. */
export async function getInternalUsers(): Promise<UserSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("id, full_name, email, avatar_url, role")
    .eq("is_active", true)
    .neq("role", "client")
    .order("full_name");
  return (data ?? []) as UserSummary[];
}

/** Contactpersonen van één organisatie, voor het toewijzen van klantacties. */
export async function getContactOptions(companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, full_name, email")
    .eq("company_id", companyId)
    .order("is_primary", { ascending: false })
    .order("full_name");
  return data ?? [];
}
