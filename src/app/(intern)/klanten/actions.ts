"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  checkbox,
  firstIssue,
  optionalEmail,
  optionalText,
  optionalUuid,
  text,
} from "@/lib/validation";

export interface ActionState {
  error?: string;
  success?: string;
  /** Id van het zojuist aangemaakte record, zodat de UI kan doorschakelen. */
  id?: string;
}

const companySchema = z.object({
  name: z.string().trim().min(2, "Vul een bedrijfsnaam in."),
  email: optionalEmail,
  phone: optionalText,
  website: optionalText,
  address_line: optionalText,
  postal_code: optionalText,
  city: optionalText,
  vat_number: optionalText,
  status: z.enum(["prospect", "active", "on_hold", "inactive"]),
  account_manager_id: optionalUuid,
  notes: optionalText,
});

function readCompany(formData: FormData) {
  return companySchema.safeParse({
    name: text(formData.get("name")),
    email: text(formData.get("email")),
    phone: text(formData.get("phone")),
    website: text(formData.get("website")),
    address_line: text(formData.get("address_line")),
    postal_code: text(formData.get("postal_code")),
    city: text(formData.get("city")),
    vat_number: text(formData.get("vat_number")),
    status: text(formData.get("status")) || "active",
    account_manager_id: text(formData.get("account_manager_id")),
    notes: text(formData.get("notes")),
  });
}

export async function createCompanyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireManager();
  const parsed = readCompany(formData);

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .insert({ ...parsed.data, created_by: user.id })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "Er bestaat al een klant met deze bedrijfsnaam." };
    }
    return { error: "De klant kon niet worden opgeslagen. Probeer het opnieuw." };
  }

  revalidatePath("/klanten");
  return { success: "Klant aangemaakt.", id: data.id };
}

export async function updateCompanyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireManager();

  const id = text(formData.get("id"));
  if (!id) return { error: "Onbekende klant." };

  const parsed = readCompany(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("companies").update(parsed.data).eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Er bestaat al een klant met deze bedrijfsnaam." };
    }
    return { error: "De wijzigingen konden niet worden opgeslagen." };
  }

  revalidatePath("/klanten");
  revalidatePath(`/klanten/${id}`);
  return { success: "Wijzigingen opgeslagen.", id };
}

// -----------------------------------------------------------------------------
// Contactpersonen (§6)
// -----------------------------------------------------------------------------
const contactSchema = z.object({
  company_id: z.uuid("Onbekende klant."),
  first_name: z.string().trim().min(1, "Vul een voornaam in."),
  last_name: z.string().trim().min(1, "Vul een achternaam in."),
  email: optionalEmail,
  phone: optionalText,
  job_title: optionalText,
  is_primary: z.boolean(),
});

export async function createContactAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireManager();

  const parsed = contactSchema.safeParse({
    company_id: text(formData.get("company_id")),
    first_name: text(formData.get("first_name")),
    last_name: text(formData.get("last_name")),
    email: text(formData.get("email")),
    phone: text(formData.get("phone")),
    job_title: text(formData.get("job_title")),
    is_primary: checkbox(formData.get("is_primary")),
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();

  // Er kan per organisatie maar één hoofdcontactpersoon zijn (unieke index).
  if (parsed.data.is_primary) {
    await supabase
      .from("contacts")
      .update({ is_primary: false })
      .eq("company_id", parsed.data.company_id)
      .eq("is_primary", true);
  }

  const { error } = await supabase
    .from("contacts")
    .insert({ ...parsed.data, created_by: user.id });

  if (error) return { error: "De contactpersoon kon niet worden opgeslagen." };

  // Ook het overzicht: daar staat per klant de hoofdcontactpersoon.
  revalidatePath("/klanten");
  revalidatePath(`/klanten/${parsed.data.company_id}`);
  return { success: "Contactpersoon toegevoegd." };
}

export async function deleteContactAction(formData: FormData) {
  await requireManager();

  const id = text(formData.get("id"));
  const companyId = text(formData.get("company_id"));
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("contacts").delete().eq("id", id);

  revalidatePath("/klanten");
  revalidatePath(`/klanten/${companyId}`);
}
