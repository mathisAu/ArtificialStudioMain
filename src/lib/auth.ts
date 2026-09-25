import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
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
 * Het gebruikers-id uit het JWT, zonder profielquery. Daardoor kan een layout
 * andere queries alvast starten terwijl het profiel nog wordt opgehaald.
 *
 * `getClaims()` verifieert het JWT lokaal (asymmetric signing keys), zonder
 * netwerkaanroep naar Auth — veel sneller dan getUser() bij elke request.
 */
export const getAuthUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
});

/**
 * De ingelogde gebruiker inclusief rol en organisatie.
 *
 * `getClaims()` verifieert het JWT; daarna halen we het profiel op via een
 * gewone query, zodat een gedeactiveerd account of een gewijzigde rol direct
 * effect heeft. `cache()` zorgt dat dit één keer per request gebeurt.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const userId = await getAuthUserId();
  if (!userId) return null;

  const supabase = await createClient();

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

/** Cookie waarmee een beheerder het portaal van één klant als voorbeeld bekijkt. */
export const PORTAL_PREVIEW_COOKIE = "portal_preview";

export type PortalUser = SessionUser & {
  companyId: string;
  /** Waar als een beheerder het portaal van deze klant bekijkt. */
  preview?: boolean;
};

const previewCompany = cache(async (id: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  return data;
});

/**
 * Klantportaal: de rol client, met een gekoppelde organisatie.
 *
 * Admins en projectmanagers komen er alleen in als ze bewust een voorbeeld van
 * één klant hebben geopend. De portaalpagina's filteren op `companyId`, dus zij
 * zien precies wat die klant ziet. Alle andere rollen gaan terug naar het dashboard.
 */
export async function requireClient(): Promise<PortalUser> {
  const user = await requireUser();

  if (isManager(user.role)) {
    const id = (await cookies()).get(PORTAL_PREVIEW_COOKIE)?.value;
    const company = id ? await previewCompany(id) : null;
    if (!company) redirect("/klantportaal");
    return { ...user, companyId: company.id, companyName: company.name, preview: true };
  }

  if (user.role !== "client") redirect("/dashboard");
  if (!user.companyId) {
    redirect("/login?fout=geen-organisatie");
  }
  return user as PortalUser;
}

export function isManager(role: UserRole): boolean {
  return role === "admin" || role === "projectmanager";
}
