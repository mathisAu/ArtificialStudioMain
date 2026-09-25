"use server";

import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidateShared } from "@/lib/revalidate";
import { checkbox, firstIssue, text } from "@/lib/validation";
import type { EntityType } from "@/lib/types";

export interface CommentState {
  error?: string;
  success?: string;
}

const ENTITY_TYPES = [
  "project",
  "task",
  "feedback",
  "question",
  "customer_action",
  "project_update",
  "note",
  "invoice",
  "company",
] as const;

const commentSchema = z.object({
  entity_type: z.enum(ENTITY_TYPES),
  entity_id: z.uuid("Onbekend onderwerp."),
  project_id: z.uuid().nullable(),
  company_id: z.uuid().nullable(),
  body: z.string().trim().min(1, "Schrijf eerst een reactie."),
  is_internal: z.boolean(),
});

/**
 * Reactie plaatsen op een taak, feedbackitem, vraag of klantactie.
 *
 * De zichtbaarheid ligt bij `is_internal`: een interne reactie is nooit
 * zichtbaar voor de klant. De RLS-policy `comments_insert` weigert bovendien
 * elke poging van een klantaccount om een interne reactie te plaatsen.
 */
export async function addCommentAction(
  _prev: CommentState,
  formData: FormData,
): Promise<CommentState> {
  const user = await requireUser();

  const parsed = commentSchema.safeParse({
    entity_type: text(formData.get("entity_type")),
    entity_id: text(formData.get("entity_id")),
    project_id: text(formData.get("project_id")) || null,
    company_id: text(formData.get("company_id")) || null,
    body: text(formData.get("body")),
    // Klanten kunnen dit veld niet meesturen; voor de zekerheid dwingen we het
    // hier ook af, zodat een aangepast formulier niets oplevert.
    is_internal: user.role === "client" ? false : checkbox(formData.get("is_internal")),
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const mentions = formData
    .getAll("mentions")
    .map((value) => String(value))
    .filter(Boolean);

  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({
    ...parsed.data,
    author_id: user.id,
    mentions,
  });

  if (error) {
    return { error: "De reactie kon niet worden geplaatst. Probeer het opnieuw." };
  }

  revalidateFor(parsed.data.entity_type, parsed.data.entity_id, parsed.data.project_id);
  return { success: "Reactie geplaatst." };
}

export async function deleteCommentAction(formData: FormData) {
  await requireUser();

  const id = text(formData.get("id"));
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("comments").delete().eq("id", id);

  revalidateFor(
    text(formData.get("entity_type")) as EntityType,
    text(formData.get("entity_id")),
    text(formData.get("project_id")) || null,
  );
}

/** Ververs alle plekken waar deze reactie zichtbaar kan zijn. */
function revalidateFor(
  entityType: EntityType,
  entityId: string,
  projectId: string | null,
) {
  const paths: Record<string, string> = {
    feedback: `/feedback/${entityId}`,
    question: `/vragen/${entityId}`,
    customer_action: `/acties/${entityId}`,
  };

  revalidateShared(
    paths[entityType],
    projectId ? `/projecten/${projectId}` : null,
    "/notificaties",
  );
}
