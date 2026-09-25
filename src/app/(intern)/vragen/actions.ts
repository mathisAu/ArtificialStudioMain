"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireInternal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidateShared } from "@/lib/revalidate";
import { firstIssue, text } from "@/lib/validation";

export interface QuestionState {
  error?: string;
  success?: string;
  id?: string;
}

const QUESTION_STATUSES = [
  "new",
  "in_progress",
  "answered",
  "waiting_client",
  "closed",
] as const;

const questionSchema = z.object({
  project_id: z.uuid("Kies een project."),
  subject: z.string().trim().min(2, "Vul een onderwerp in."),
  body: z.string().trim().default(""),
  status: z.enum(QUESTION_STATUSES),
});

export async function createQuestionAction(
  _prev: QuestionState,
  formData: FormData,
): Promise<QuestionState> {
  const user = await requireInternal();

  const parsed = questionSchema.safeParse({
    project_id: text(formData.get("project_id")),
    subject: text(formData.get("subject")),
    body: text(formData.get("body")),
    status: text(formData.get("status")) || "new",
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("company_id")
    .eq("id", parsed.data.project_id)
    .maybeSingle();

  if (!project) return { error: "Project niet gevonden." };

  const { data, error } = await supabase
    .from("customer_questions")
    .insert({
      ...parsed.data,
      company_id: project.company_id,
      asked_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: "De vraag kon niet worden opgeslagen." };

  revalidateShared("/vragen");
  revalidateShared(`/projecten/${parsed.data.project_id}`);
  return { success: "Vraag vastgelegd.", id: data.id };
}

export async function updateQuestionAction(
  _prev: QuestionState,
  formData: FormData,
): Promise<QuestionState> {
  await requireInternal();

  const id = text(formData.get("id"));
  if (!id) return { error: "Onbekende vraag." };

  const parsed = questionSchema.safeParse({
    project_id: text(formData.get("project_id")),
    subject: text(formData.get("subject")),
    body: text(formData.get("body")),
    status: text(formData.get("status")) || "new",
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_questions")
    .update({
      subject: parsed.data.subject,
      body: parsed.data.body,
      status: parsed.data.status,
    })
    .eq("id", id);

  if (error) return { error: "De wijzigingen konden niet worden opgeslagen." };

  revalidateShared("/vragen");
  revalidateShared(`/vragen/${id}`);
  return { success: "Vraag bijgewerkt.", id };
}

export async function setQuestionStatusAction(questionId: string, status: string) {
  await requireInternal();

  if (!(QUESTION_STATUSES as readonly string[]).includes(status)) {
    return { error: "Onbekende status." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_questions")
    .update({
      status,
      // Zet het antwoordmoment vast; de trigger stuurt de klant een notificatie.
      ...(status === "answered" ? { answered_at: new Date().toISOString() } : {}),
    })
    .eq("id", questionId)
    .select("project_id")
    .maybeSingle();

  if (error || !data) {
    return { error: "Je hebt geen rechten om deze vraag te wijzigen." };
  }

  revalidateShared("/vragen");
  revalidateShared(`/vragen/${questionId}`);
  if (data.project_id) revalidateShared(`/projecten/${data.project_id}`);
  revalidateShared("/dashboard");
  return { success: "Status bijgewerkt." };
}

export async function deleteQuestionAction(formData: FormData) {
  await requireInternal();

  const id = text(formData.get("id"));
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("customer_questions").delete().eq("id", id);

  revalidateShared("/vragen");
  redirect("/vragen");
}
