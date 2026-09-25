"use server";

import { z } from "zod";

import { requireInternal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidateShared } from "@/lib/revalidate";
import {
  checkbox,
  firstIssue,
  optionalDate,
  optionalText,
  optionalUuid,
  text,
} from "@/lib/validation";

export interface CollaborationState {
  error?: string;
  success?: string;
  id?: string;
}

/** Haalt de company_id op bij een project. Nooit uit het formulier overnemen. */
async function companyIdFor(projectId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("company_id")
    .eq("id", projectId)
    .maybeSingle();
  return data?.company_id ?? null;
}

// -----------------------------------------------------------------------------
// Projectupdates (§13)
// -----------------------------------------------------------------------------
const updateSchema = z.object({
  project_id: z.uuid("Onbekend project."),
  title: z.string().trim().min(2, "Vul een titel in."),
  body: z.string().trim().min(1, "Schrijf een bericht."),
  visible_to_client: z.boolean(),
});

export async function createProjectUpdateAction(
  _prev: CollaborationState,
  formData: FormData,
): Promise<CollaborationState> {
  const user = await requireInternal();

  const parsed = updateSchema.safeParse({
    project_id: text(formData.get("project_id")),
    title: text(formData.get("title")),
    body: text(formData.get("body")),
    visible_to_client: checkbox(formData.get("visible_to_client")),
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const companyId = await companyIdFor(parsed.data.project_id);
  if (!companyId) return { error: "Project niet gevonden." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_updates")
    .insert({ ...parsed.data, company_id: companyId, author_id: user.id });

  if (error) {
    return {
      error: "De update kon niet worden gepubliceerd. Mogelijk beheer je dit project niet.",
    };
  }

  revalidateShared(`/projecten/${parsed.data.project_id}`);
  return {
    success: parsed.data.visible_to_client
      ? "Update gepubliceerd. De klant heeft een notificatie ontvangen."
      : "Update opgeslagen. Nog niet zichtbaar voor de klant.",
  };
}

export async function deleteProjectUpdateAction(formData: FormData) {
  await requireInternal();

  const id = text(formData.get("id"));
  const projectId = text(formData.get("project_id"));
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("project_updates").delete().eq("id", id);

  revalidateShared(`/projecten/${projectId}`);
}

/** Een bestaande update alsnog vrijgeven voor de klant, of juist intrekken. */
export async function toggleUpdateVisibilityAction(updateId: string, visible: boolean) {
  await requireInternal();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_updates")
    .update({ visible_to_client: visible })
    .eq("id", updateId)
    .select("project_id")
    .maybeSingle();

  if (error || !data) return { error: "De update kon niet worden gewijzigd." };

  revalidateShared(`/projecten/${data.project_id}`);
  return { success: visible ? "Zichtbaar voor de klant." : "Niet meer zichtbaar." };
}

// -----------------------------------------------------------------------------
// Acties voor de klant (§16)
// -----------------------------------------------------------------------------
const CUSTOMER_ACTION_STATUSES = ["open", "in_progress", "done", "cancelled"] as const;

const customerActionSchema = z.object({
  project_id: z.uuid("Onbekend project."),
  title: z.string().trim().min(2, "Vul een titel in."),
  description: optionalText,
  assigned_contact_id: optionalUuid,
  due_date: optionalDate,
  status: z.enum(CUSTOMER_ACTION_STATUSES),
});

export async function createCustomerActionAction(
  _prev: CollaborationState,
  formData: FormData,
): Promise<CollaborationState> {
  const user = await requireInternal();

  const parsed = customerActionSchema.safeParse({
    project_id: text(formData.get("project_id")),
    title: text(formData.get("title")),
    description: text(formData.get("description")),
    assigned_contact_id: text(formData.get("assigned_contact_id")),
    due_date: text(formData.get("due_date")),
    status: text(formData.get("status")) || "open",
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const companyId = await companyIdFor(parsed.data.project_id);
  if (!companyId) return { error: "Project niet gevonden." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_actions")
    .insert({ ...parsed.data, company_id: companyId, created_by: user.id });

  if (error) {
    return { error: "De actie kon niet worden aangemaakt. Mogelijk beheer je dit project niet." };
  }

  revalidateShared(`/projecten/${parsed.data.project_id}`);
  return { success: "Actie bij de klant neergelegd." };
}

export async function setCustomerActionStatusAction(actionId: string, status: string) {
  await requireInternal();

  if (!(CUSTOMER_ACTION_STATUSES as readonly string[]).includes(status)) {
    return { error: "Onbekende status." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_actions")
    .update({ status })
    .eq("id", actionId)
    .select("project_id")
    .maybeSingle();

  if (error || !data) return { error: "De actie kon niet worden gewijzigd." };

  revalidateShared(`/projecten/${data.project_id}`);
  return { success: "Status bijgewerkt." };
}

export async function deleteCustomerActionAction(formData: FormData) {
  await requireInternal();

  const id = text(formData.get("id"));
  const projectId = text(formData.get("project_id"));
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("customer_actions").delete().eq("id", id);

  revalidateShared(`/projecten/${projectId}`);
}

// -----------------------------------------------------------------------------
// Interne notities (§18)
// -----------------------------------------------------------------------------
const noteSchema = z.object({
  project_id: z.uuid("Onbekend project."),
  title: z.string().trim().default(""),
  body: z.string().trim().min(1, "Schrijf eerst een notitie."),
});

export async function createNoteAction(
  _prev: CollaborationState,
  formData: FormData,
): Promise<CollaborationState> {
  const user = await requireInternal();

  const parsed = noteSchema.safeParse({
    project_id: text(formData.get("project_id")),
    title: text(formData.get("title")),
    body: text(formData.get("body")),
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const mentions = formData
    .getAll("mentions")
    .map((value) => String(value))
    .filter(Boolean);

  const supabase = await createClient();
  const { error } = await supabase
    .from("notes")
    .insert({ ...parsed.data, author_id: user.id, mentions });

  if (error) return { error: "De notitie kon niet worden opgeslagen." };

  revalidateShared(`/projecten/${parsed.data.project_id}`);
  return { success: "Notitie opgeslagen." };
}

export async function deleteNoteAction(formData: FormData) {
  await requireInternal();

  const id = text(formData.get("id"));
  const projectId = text(formData.get("project_id"));
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("notes").delete().eq("id", id);

  revalidateShared(`/projecten/${projectId}`);
}
