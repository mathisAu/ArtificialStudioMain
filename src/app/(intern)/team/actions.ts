"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin, requireManager } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { firstIssue, text } from "@/lib/validation";

export interface TeamState {
  error?: string;
  success?: string;
}

const INTERNAL_ROLES = ["admin", "projectmanager", "developer", "freelancer"] as const;

const inviteSchema = z.object({
  email: z.email("Vul een geldig e-mailadres in."),
  full_name: z.string().trim().min(2, "Vul een naam in."),
  role: z.enum(INTERNAL_ROLES),
});

/**
 * Teamlid uitnodigen (§3).
 *
 * Supabase stuurt een uitnodigingsmail; via /auth/callback komt de ontvanger
 * op het scherm om zelf een wachtwoord te kiezen. De rol geven we mee als
 * metadata, waarna de trigger `on_auth_user_created` het profiel aanmaakt.
 */
export async function inviteTeamMemberAction(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  await requireAdmin();

  const parsed = inviteSchema.safeParse({
    email: text(formData.get("email")).trim(),
    full_name: text(formData.get("full_name")),
    role: text(formData.get("role")) || "developer",
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .ilike("email", parsed.data.email)
    .maybeSingle();

  if (existing) {
    return { error: "Er bestaat al een account met dit e-mailadres." };
  }

  const admin = createAdminClient();
  const siteUrl = await getSiteUrl();

  const { error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/wachtwoord-resetten`,
    data: {
      full_name: parsed.data.full_name,
      role: parsed.data.role,
    },
  });

  if (error) {
    return {
      error:
        error.message.includes("rate")
          ? "Er zijn te veel uitnodigingen kort na elkaar verstuurd. Probeer het over een paar minuten opnieuw."
          : `De uitnodiging kon niet worden verstuurd: ${error.message}`,
    };
  }

  revalidatePath("/team");
  return { success: `Uitnodiging verstuurd naar ${parsed.data.email}.` };
}

/**
 * Klant uitnodigen voor het portaal (§3).
 *
 * De organisatie komt uit het contactpersoon-record; daarmee is meteen bepaald
 * welke gegevens dit account mag zien.
 */
export async function inviteClientAction(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  await requireManager();

  const contactId = text(formData.get("contact_id"));
  const companyId = text(formData.get("company_id"));
  if (!contactId || !companyId) return { error: "Onbekende contactpersoon." };

  const supabase = await createClient();

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, full_name, email, company_id")
    .eq("id", contactId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!contact) return { error: "Contactpersoon niet gevonden." };
  if (!contact.email) {
    return { error: "Deze contactpersoon heeft nog geen e-mailadres." };
  }

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .ilike("email", contact.email)
    .maybeSingle();

  if (existing) {
    return { error: "Er bestaat al een account met dit e-mailadres." };
  }

  const admin = createAdminClient();
  const siteUrl = await getSiteUrl();

  const { error } = await admin.auth.admin.inviteUserByEmail(contact.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/wachtwoord-resetten`,
    data: {
      full_name: contact.full_name,
      role: "client",
      company_id: contact.company_id,
      contact_id: contact.id,
    },
  });

  if (error) {
    return { error: `De uitnodiging kon niet worden verstuurd: ${error.message}` };
  }

  revalidatePath(`/klanten/${companyId}`);
  return { success: `Uitnodiging verstuurd naar ${contact.email}.` };
}

/** Rol wijzigen. De databasetrigger staat dit alleen toe voor admins. */
export async function setUserRoleAction(userId: string, role: string) {
  const admin = await requireAdmin();

  if (!(INTERNAL_ROLES as readonly string[]).includes(role)) {
    return { error: "Onbekende rol." };
  }

  // Voorkom dat de laatste admin zichzelf degradeert en niemand meer bij de
  // instellingen kan.
  if (userId === admin.id && role !== "admin") {
    return { error: "Je kunt je eigen adminrol niet afnemen." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("users").update({ role }).eq("id", userId);

  if (error) return { error: "De rol kon niet worden gewijzigd." };

  revalidatePath("/team");
  return { success: "Rol bijgewerkt." };
}

/** Account activeren of deactiveren. Een gedeactiveerd account kan niet inloggen. */
export async function setUserActiveAction(userId: string, isActive: boolean) {
  const admin = await requireAdmin();

  if (userId === admin.id && !isActive) {
    return { error: "Je kunt je eigen account niet deactiveren." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ is_active: isActive })
    .eq("id", userId);

  if (error) return { error: "Het account kon niet worden bijgewerkt." };

  revalidatePath("/team");
  return {
    success: isActive ? "Account geactiveerd." : "Account gedeactiveerd.",
  };
}
