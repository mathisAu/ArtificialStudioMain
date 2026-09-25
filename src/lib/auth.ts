import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { isInternalRole } from "./labels";
import { createClient } from "./supabase/server";
import type { UserRole } from "./types";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl: string | null;
  /** Alleen gevuld voor de rol `client`: de eigen organisatie. */
  companyId: string | null;
  companyName: string | null;
}

/**
 * De ingelogde gebruiker inclusief rol en organisatie.
 *
 * `getClaims()` verifieert het JWT; daarna halen we het profiel op via een
 * gewone query, zodat een gedeactiveerd account of een gewijzigde rol direct
 * effect heeft. `cache()` zorgt dat dit één keer per request gebeurt.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  // getClaims() verifieert het JWT lokaal (asymmetric signing keys), zonder
  // netwerkaanroep naar Auth — veel sneller dan getUser() bij elke request.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) return null;
  const userId = claims.sub;

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, full_name, role, avatar_url, is_active")
    .eq("id", userId)
    .maybeSingle();

  // Geen profiel of gedeactiveerd account: behandelen als niet ingelogd.
  if (!profile || !profile.is_active) return null;

  let companyId: string | null = null;
  let companyName: string | null = null;

  if (profile.role === "client") {
    const { data: link } = await supabase
      .from("customer_users")
      .select("company_id, company:companies(id, name)")
      .eq("user_id", userId)
      .maybeSingle();

    companyId = link?.company_id ?? null;
    const company = link?.company as { name?: string } | { name?: string }[] | null;
    companyName = Array.isArray(company)
      ? (company[0]?.name ?? null)
      : (company?.name ?? null);
  }

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role as UserRole,
    avatarUrl: profile.avatar_url,
    companyId,
    companyName,
  };
});

/** Landingsroute per rol (§3). */
export function homePathForRole(role: UserRole): string {
  return isInternalRole(role) ? "/dashboard" : "/portaal";
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Interne omgeving: admin, projectmanager, developer of freelancer. */
export async function requireInternal(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isInternalRole(user.role)) redirect("/portaal");
  return user;
}

/** Beheerhandelingen: klanten, projecten, facturen (§2). */
export async function requireManager(): Promise<SessionUser> {
  const user = await requireInternal();
  if (user.role !== "admin" && user.role !== "projectmanager") {
    redirect("/dashboard");
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireInternal();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}

/** Klantportaal: uitsluitend de rol client, met een gekoppelde organisatie. */
export async function requireClient(): Promise<SessionUser & { companyId: string }> {
  const user = await requireUser();
  if (user.role !== "client") redirect("/dashboard");
  if (!user.companyId) {
    redirect("/login?fout=geen-organisatie");
  }
  return user as SessionUser & { companyId: string };
}

export function isManager(role: UserRole): boolean {
  return role === "admin" || role === "projectmanager";
}
