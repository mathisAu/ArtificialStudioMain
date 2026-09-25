"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireInternal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidateShared } from "@/lib/revalidate";
import { firstIssue, optionalText, optionalUuid, text } from "@/lib/validation";

export interface FeedbackState {
  error?: string;
  success?: string;
  id?: string;
}

const FEEDBACK_TYPES = ["change", "bug", "feature_request", "general", "other"] as const;
const FEEDBACK_STATUSES = [
  "new",
  "in_progress",
  "need_info",
  "planned",
  "resolved",
  "rejected",
] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const feedbackSchema = z.object({
  project_id: z.uuid("Kies een project."),
  title: z.string().trim().min(2, "Vul een onderwerp in."),
  description: z.string().trim().default(""),
  type: z.enum(FEEDBACK_TYPES),
  priority: z.enum(PRIORITIES),
  status: z.enum(FEEDBACK_STATUSES),
});

export async function createFeedbackAction(
  _prev: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  const user = await requireInternal();

  const parsed = feedbackSchema.safeParse({
    project_id: text(formData.get("project_id")),
    title: text(formData.get("title")),
    description: text(formData.get("description")),
    type: text(formData.get("type")) || "general",
    priority: text(formData.get("priority")) || "normal",
    status: text(formData.get("status")) || "new",
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();

  // company_id volgt altijd uit het project; nooit uit het formulier, anders
  // zou feedback aan de verkeerde organisatie gekoppeld kunnen worden.
  const { data: project } = await supabase
    .from("projects")
    .select("company_id")
    .eq("id", parsed.data.project_id)
    .maybeSingle();

  if (!project) return { error: "Project niet gevonden." };

  const { data, error } = await supabase
    .from("feedback")
    .insert({
      ...parsed.data,
      company_id: project.company_id,
      submitted_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: "De feedback kon niet worden opgeslagen." };

  revalidateShared("/feedback");
  revalidateShared(`/projecten/${parsed.data.project_id}`);
  revalidateShared("/dashboard");
  return { success: "Feedback toegevoegd.", id: data.id };
}

export async function updateFeedbackAction(
  _prev: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  await requireInternal();

  const id = text(formData.get("id"));
  if (!id) return { error: "Onbekend feedbackitem." };

  const parsed = feedbackSchema.safeParse({
    project_id: text(formData.get("project_id")),
    title: text(formData.get("title")),
    description: text(formData.get("description")),
    type: text(formData.get("type")) || "general",
    priority: text(formData.get("priority")) || "normal",
    status: text(formData.get("status")) || "new",
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("feedback")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      type: parsed.data.type,
      priority: parsed.data.priority,
      status: parsed.data.status,
    })
    .eq("id", id);

  if (error) return { error: "De wijzigingen konden niet worden opgeslagen." };

  revalidateShared("/feedback");
  revalidateShared(`/feedback/${id}`);
  revalidateShared(`/projecten/${parsed.data.project_id}`);
  return { success: "Feedback bijgewerkt.", id };
}

/** Statuswissel vanaf de lijst of de detailpagina. */
export async function setFeedbackStatusAction(feedbackId: string, status: string) {
  await requireInternal();

  if (!(FEEDBACK_STATUSES as readonly string[]).includes(status)) {
    return { error: "Onbekende status." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback")
    .update({ status })
    .eq("id", feedbackId)
    .select("project_id")
    .maybeSingle();

  if (error || !data) {
    return { error: "Je hebt geen rechten om deze feedback te wijzigen." };
  }

  revalidateShared("/feedback");
  revalidateShared(`/feedback/${feedbackId}`);
  revalidateShared(`/projecten/${data.project_id}`);
  revalidateShared("/dashboard");
  return { success: "Status bijgewerkt." };
}

/**
 * Feedback omzetten naar een taak (§14).
 *
 * De databasefunctie `convert_feedback_to_task` doet het werk in één keer en
 * bewaart de relatie tussen de oorspronkelijke feedback en de nieuwe taak.
 */
export async function convertFeedbackToTaskAction(
  _prev: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  await requireInternal();

  const feedbackId = text(formData.get("feedback_id"));
  if (!feedbackId) return { error: "Onbekend feedbackitem." };

  const assignee = optionalUuid.safeParse(text(formData.get("assignee_id")));
  const dueDate = optionalText.safeParse(text(formData.get("due_date")));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_feedback_to_task", {
    p_feedback_id: feedbackId,
    p_assignee_id: assignee.success ? assignee.data : null,
    p_due_date: dueDate.success ? dueDate.data : null,
  });

  if (error) {
    return { error: "De taak kon niet worden aangemaakt. Controleer je rechten." };
  }

  revalidateShared("/feedback");
  revalidateShared(`/feedback/${feedbackId}`);
  return { success: "Feedback omgezet naar een taak.", id: data as string };
}

export async function deleteFeedbackAction(formData: FormData) {
  await requireInternal();

  const id = text(formData.get("id"));
  const projectId = text(formData.get("project_id"));
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("feedback").delete().eq("id", id);

  revalidateShared("/feedback");
  if (projectId) revalidateShared(`/projecten/${projectId}`);
  // De detailpagina bestaat nu niet meer; terug naar het overzicht.
  redirect("/feedback");
}
