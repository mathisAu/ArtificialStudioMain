"use server";

import { z } from "zod";

import { requireInternal, requireManager } from "@/lib/auth";
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

export interface ActionState {
  error?: string;
  success?: string;
  id?: string;
}

const PROJECT_STATUSES = [
  "intake",
  "planning",
  "in_development",
  "internal_test",
  "client_test",
  "waiting_client",
  "revisions",
  "ready_for_delivery",
  "completed",
  "on_hold",
] as const;

const PROJECT_TYPES = [
  "website",
  "webshop",
  "automation",
  "integration",
  "app",
  "maintenance",
  "consultancy",
  "other",
] as const;

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const projectSchema = z.object({
  name: z.string().trim().min(2, "Vul een projectnaam in."),
  company_id: z.uuid("Kies een klant."),
  description: optionalText,
  goal: optionalText,
  scope: optionalText,
  next_step: optionalText,
  project_type: z.enum(PROJECT_TYPES),
  project_manager_id: optionalUuid,
  start_date: optionalDate,
  deadline: optionalDate,
  priority: z.enum(PRIORITIES),
  status: z.enum(PROJECT_STATUSES),
});

function readProject(formData: FormData) {
  return projectSchema.safeParse({
    name: text(formData.get("name")),
    company_id: text(formData.get("company_id")),
    description: text(formData.get("description")),
    goal: text(formData.get("goal")),
    scope: text(formData.get("scope")),
    next_step: text(formData.get("next_step")),
    project_type: text(formData.get("project_type")) || "other",
    project_manager_id: text(formData.get("project_manager_id")),
    start_date: text(formData.get("start_date")),
    deadline: text(formData.get("deadline")),
    priority: text(formData.get("priority")) || "normal",
    status: text(formData.get("status")) || "intake",
  });
}

export async function createProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireManager();
  const parsed = readProject(formData);

  if (!parsed.success) return { error: firstIssue(parsed.error) };
  if (
    parsed.data.start_date &&
    parsed.data.deadline &&
    parsed.data.deadline < parsed.data.start_date
  ) {
    return { error: "De deadline kan niet vóór de startdatum liggen." };
  }

  const supabase = await createClient();

  const templateId = text(formData.get("template_id"));
  const memberIds = formData
    .getAll("member_ids")
    .map((value) => String(value))
    .filter(Boolean);

  const { data: project, error } = await supabase
    .from("projects")
    .insert({ ...parsed.data, template_id: templateId || null, created_by: user.id })
    .select("id")
    .single();

  if (error) {
    return { error: "Het project kon niet worden aangemaakt. Probeer het opnieuw." };
  }

  if (memberIds.length) {
    await supabase.from("project_members").upsert(
      memberIds.map((id) => ({
        project_id: project.id,
        user_id: id,
        created_by: user.id,
      })),
      { onConflict: "project_id,user_id", ignoreDuplicates: true },
    );
  }

  // Fases en starttaken uit het gekozen template aanmaken (§34).
  if (templateId) {
    const { error: templateError } = await supabase.rpc("apply_project_template", {
      p_project_id: project.id,
      p_template_id: templateId,
    });
    if (templateError) {
      // Het project bestaat al; het template is een extra. Niet fataal.
      console.error("apply_project_template mislukt:", templateError.message);
    }
  }

  revalidateShared("/projecten");
  revalidateShared("/dashboard");
  return { success: "Project aangemaakt.", id: project.id };
}

export async function updateProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireInternal();

  const id = text(formData.get("id"));
  if (!id) return { error: "Onbekend project." };

  const parsed = readProject(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();

  const progressRaw = text(formData.get("progress"));
  const manualProgress = checkbox(formData.get("progress_is_manual"));

  const { error } = await supabase
    .from("projects")
    .update({
      ...parsed.data,
      progress_is_manual: manualProgress,
      ...(manualProgress && progressRaw
        ? { progress: Math.max(0, Math.min(100, Number(progressRaw))) }
        : {}),
    })
    .eq("id", id);

  if (error) {
    return { error: "De wijzigingen konden niet worden opgeslagen." };
  }

  revalidateShared("/projecten");
  revalidateShared(`/projecten/${id}`);
  return { success: "Project bijgewerkt.", id };
}

/**
 * Verplaats een project naar een andere fase. Wordt aangeroepen door het
 * kanban-bord (drag & drop, §7) en door het statusmenu op de detailpagina.
 */
export async function moveProjectAction(projectId: string, status: string) {
  await requireInternal();

  if (!(PROJECT_STATUSES as readonly string[]).includes(status)) {
    return { error: "Onbekende projectfase." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      status,
      ...(status === "completed" ? { delivered_at: new Date().toISOString() } : {}),
    })
    .eq("id", projectId);

  if (error) {
    return { error: "Je hebt geen rechten om dit project te verplaatsen." };
  }

  revalidateShared("/projecten");
  revalidateShared(`/projecten/${projectId}`);
  revalidateShared("/dashboard");
  return { success: "Projectfase bijgewerkt." };
}

export async function updateProjectMembersAction(formData: FormData) {
  await requireInternal();

  const projectId = text(formData.get("project_id"));
  if (!projectId) return;

  const memberIds = formData
    .getAll("member_ids")
    .map((value) => String(value))
    .filter(Boolean);

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);

  const current = new Set((existing ?? []).map((row) => row.user_id));
  const wanted = new Set(memberIds);

  const toAdd = memberIds.filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !wanted.has(id));

  if (toAdd.length) {
    await supabase.from("project_members").upsert(
      toAdd.map((id) => ({ project_id: projectId, user_id: id })),
      { onConflict: "project_id,user_id", ignoreDuplicates: true },
    );
  }
  if (toRemove.length) {
    await supabase
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .in("user_id", toRemove);
  }

  revalidateShared(`/projecten/${projectId}`);
}
