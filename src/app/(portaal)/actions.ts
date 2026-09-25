"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { firstIssue, optionalUuid, text } from "@/lib/validation";

export interface PortalState {
  error?: string;
  success?: string;
  id?: string;
}

const FEEDBACK_TYPES = ["change", "bug", "feature_request", "general", "other"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

/**
 * Controleert dat het gekozen project bij de eigen organisatie hoort.
 *
 * De RLS-policy weigert dit ook, maar dan met een generieke databasefout. Door
 * het hier af te vangen krijgt de klant een begrijpelijke melding.
 */
async function assertOwnProject(projectId: string, companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("company_id", companyId)
    .maybeSingle();
  return Boolean(data);
}

// -----------------------------------------------------------------------------
// Feedback indienen (§26)
// -----------------------------------------------------------------------------
const feedbackSchema = z.object({
  project_id: z.uuid("Kies een project."),
  title: z.string().trim().min(2, "Vul een onderwerp in."),
  description: z.string().trim().min(1, "Beschrijf kort waar het om gaat."),
  type: z.enum(FEEDBACK_TYPES),
  priority: z.enum(PRIORITIES),
});

export async function submitFeedbackAction(
  _prev: PortalState,
  formData: FormData,
): Promise<PortalState> {
  const user = await requireClient();

  const parsed = feedbackSchema.safeParse({
    project_id: text(formData.get("project_id")),
    title: text(formData.get("title")),
    description: text(formData.get("description")),
    type: text(formData.get("type")) || "general",
    priority: text(formData.get("priority")) || "normal",
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  if (!(await assertOwnProject(parsed.data.project_id, user.companyId))) {
    return { error: "Dit project hoort niet bij uw organisatie." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback")
    .insert({
      ...parsed.data,
      company_id: user.companyId,
      submitted_by: user.id,
      status: "new",
    })
    .select("id")
    .single();

  if (error) return { error: "Uw feedback kon niet worden verstuurd. Probeer het opnieuw." };

  revalidatePath("/portaal/feedback");
  revalidatePath("/portaal");
  return { success: "Bedankt, uw feedback is ontvangen.", id: data.id };
}

/**
 * Eigen feedback bijwerken (§26).
 *
 * Alleen zolang wij er nog niet mee bezig zijn: daarna hoort het punt bij de
 * werkvoorraad en zou een wijziging het gesprek eronder onnavolgbaar maken. De
 * policies `feedback_update_client` en `feedback_delete_client` bewaken dezelfde
 * grens in de database.
 */
export async function updateOwnFeedbackAction(
  _prev: PortalState,
  formData: FormData,
): Promise<PortalState> {
  const user = await requireClient();

  const id = text(formData.get("id"));
  if (!id) return { error: "Onbekend feedbackpunt." };

  const parsed = feedbackSchema.safeParse({
    project_id: text(formData.get("project_id")),
    title: text(formData.get("title")),
    description: text(formData.get("description")),
    type: text(formData.get("type")) || "general",
    priority: text(formData.get("priority")) || "normal",
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  if (!(await assertOwnProject(parsed.data.project_id, user.companyId))) {
    return { error: "Dit project hoort niet bij uw organisatie." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback")
    .update(parsed.data)
    .eq("id", id)
    .eq("submitted_by", user.id)
    .eq("status", "new")
    .select("id")
    .maybeSingle();

  if (error) return { error: "De wijziging kon niet worden opgeslagen." };
  if (!data) {
    return {
      error: "Dit punt is al in behandeling genomen en kan niet meer worden aangepast.",
    };
  }

  revalidatePath("/portaal/feedback");
  revalidatePath(`/portaal/feedback/${id}`);
  revalidatePath("/feedback");
  revalidatePath(`/feedback/${id}`);
  return { success: "Uw feedback is bijgewerkt.", id };
}

/** Eigen feedback intrekken zolang die nog niet is opgepakt (§26). */
export async function withdrawFeedbackAction(formData: FormData) {
  const user = await requireClient();

  const id = text(formData.get("id"));
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("feedback")
    .delete()
    .eq("id", id)
    .eq("submitted_by", user.id)
    .eq("status", "new");

  revalidatePath("/portaal/feedback");
  revalidatePath("/portaal");
  revalidatePath("/feedback");
  redirect("/portaal/feedback");
}

// -----------------------------------------------------------------------------
// Vraag stellen (§27)
// -----------------------------------------------------------------------------
// Het project is bewust optioneel: een klant die nog geen project heeft — of
// een algemene vraag stelt — moet ons ook kunnen bereiken.
const questionSchema = z.object({
  project_id: optionalUuid,
  subject: z.string().trim().min(2, "Vul een onderwerp in."),
  body: z.string().trim().min(1, "Stel uw vraag."),
});

export async function askQuestionAction(
  _prev: PortalState,
  formData: FormData,
): Promise<PortalState> {
  const user = await requireClient();

  const parsed = questionSchema.safeParse({
    project_id: text(formData.get("project_id")),
    subject: text(formData.get("subject")),
    body: text(formData.get("body")),
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  if (
    parsed.data.project_id &&
    !(await assertOwnProject(parsed.data.project_id, user.companyId))
  ) {
    return { error: "Dit project hoort niet bij uw organisatie." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_questions")
    .insert({
      ...parsed.data,
      company_id: user.companyId,
      asked_by: user.id,
      status: "new",
    })
    .select("id")
    .single();

  if (error) return { error: "Uw vraag kon niet worden verstuurd. Probeer het opnieuw." };

  revalidatePath("/portaal/vragen");
  revalidatePath("/portaal");
  return { success: "Bedankt, uw vraag is verstuurd.", id: data.id };
}

// -----------------------------------------------------------------------------
// Project aanvragen (§24)
// -----------------------------------------------------------------------------
const projectRequestSchema = z.object({
  name: z.string().trim().min(2, "Geef het project een werktitel."),
  description: z.string().trim().min(1, "Beschrijf kort wat u wilt laten maken."),
  desired_date: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Vul een geldige datum in."),
});

/**
 * Een klant vraagt een nieuw project aan.
 *
 * Bewust géén echt project: dat krijgt een projectmanager, planning, fases en
 * een offerte, en dat blijft bij het team. De aanvraag komt binnen als algemene
 * vraag. Zo landt hij in hetzelfde overzicht, met dezelfde notificatie, en kan
 * de klant er in de reacties direct over doorpraten.
 */
export async function requestProjectAction(
  _prev: PortalState,
  formData: FormData,
): Promise<PortalState> {
  const user = await requireClient();

  const parsed = projectRequestSchema.safeParse({
    name: text(formData.get("name")),
    description: text(formData.get("description")),
    desired_date: text(formData.get("desired_date")),
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const body = [parsed.data.description];
  if (parsed.data.desired_date) {
    body.push("", `Gewenste opleverdatum: ${formatDate(parsed.data.desired_date)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_questions")
    .insert({
      company_id: user.companyId,
      project_id: null,
      subject: `Projectaanvraag: ${parsed.data.name}`,
      body: body.join("\n"),
      asked_by: user.id,
      status: "new",
    })
    .select("id")
    .single();

  if (error) return { error: "Uw aanvraag kon niet worden verstuurd. Probeer het opnieuw." };

  revalidatePath("/portaal/vragen");
  revalidatePath("/portaal/projecten");
  revalidatePath("/portaal");
  revalidatePath("/vragen");
  return { success: "Bedankt, uw aanvraag is verstuurd.", id: data.id };
}

// -----------------------------------------------------------------------------
// Actie afronden (§28)
// -----------------------------------------------------------------------------
export async function setActionStatusAction(actionId: string, status: string) {
  await requireClient();

  if (!["open", "in_progress", "done"].includes(status)) {
    return { error: "Onbekende status." };
  }

  const supabase = await createClient();

  // De trigger `guard_customer_action_client_update` zorgt ervoor dat een klant
  // uitsluitend de status kan wijzigen; alle andere kolommen zijn geblokkeerd.
  const { data, error } = await supabase
    .from("customer_actions")
    .update({ status })
    .eq("id", actionId)
    .select("id")
    .maybeSingle();

  if (error || !data) return { error: "Deze actie kon niet worden bijgewerkt." };

  revalidatePath("/portaal/acties");
  revalidatePath("/portaal");
  return { success: "Bijgewerkt." };
}
