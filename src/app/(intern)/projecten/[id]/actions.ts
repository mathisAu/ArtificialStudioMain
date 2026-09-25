"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireInternal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  checkbox,
  firstIssue,
  optionalDate,
  optionalText,
  optionalUuid,
  text,
} from "@/lib/validation";

export interface TaskActionState {
  error?: string;
  success?: string;
  id?: string;
}

const TASK_STATUSES = ["todo", "in_progress", "review", "blocked", "done"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const taskSchema = z.object({
  project_id: z.uuid("Onbekend project."),
  title: z.string().trim().min(2, "Vul een taaknaam in."),
  description: optionalText,
  status: z.enum(TASK_STATUSES),
  priority: z.enum(PRIORITIES),
  assignee_id: optionalUuid,
  start_date: optionalDate,
  due_date: optionalDate,
  visible_to_client: z.boolean(),
});

function readTask(formData: FormData) {
  return taskSchema.safeParse({
    project_id: text(formData.get("project_id")),
    title: text(formData.get("title")),
    description: text(formData.get("description")),
    status: text(formData.get("status")) || "todo",
    priority: text(formData.get("priority")) || "normal",
    assignee_id: text(formData.get("assignee_id")),
    start_date: text(formData.get("start_date")),
    due_date: text(formData.get("due_date")),
    visible_to_client: checkbox(formData.get("visible_to_client")),
  });
}

export async function createTaskAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const user = await requireInternal();
  const parsed = readTask(formData);

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();

  // Nieuwe taken komen onderaan hun kolom.
  const { data: last } = await supabase
    .from("tasks")
    .select("position")
    .eq("project_id", parsed.data.project_id)
    .eq("status", parsed.data.status)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...parsed.data,
      position: (last?.position ?? 0) + 1000,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return {
      error:
        "De taak kon niet worden opgeslagen. Mogelijk ben je geen lid van dit project.",
    };
  }

  revalidatePath(`/projecten/${parsed.data.project_id}`);
  revalidatePath("/mijn-taken");
  revalidatePath("/dashboard");
  return { success: "Taak aangemaakt.", id: data.id };
}

export async function updateTaskAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  await requireInternal();

  const id = text(formData.get("id"));
  if (!id) return { error: "Onbekende taak." };

  const parsed = readTask(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update(parsed.data).eq("id", id);

  if (error) return { error: "De wijzigingen konden niet worden opgeslagen." };

  revalidatePath(`/projecten/${parsed.data.project_id}`);
  revalidatePath("/mijn-taken");
  return { success: "Taak bijgewerkt.", id };
}

/** Verplaats een taak naar een andere kolom van het bord (§11). */
export async function moveTaskAction(
  taskId: string,
  status: string,
  position: number,
) {
  await requireInternal();

  if (!(TASK_STATUSES as readonly string[]).includes(status)) {
    return { error: "Onbekende taakstatus." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ status, position })
    .eq("id", taskId)
    .select("project_id")
    .maybeSingle();

  if (error || !data) {
    return { error: "Je hebt geen rechten om deze taak te verplaatsen." };
  }

  revalidatePath(`/projecten/${data.project_id}`);
  revalidatePath("/mijn-taken");
  revalidatePath("/dashboard");
  return { success: "Taak verplaatst." };
}

export async function deleteTaskAction(formData: FormData) {
  await requireInternal();

  const id = text(formData.get("id"));
  const projectId = text(formData.get("project_id"));
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("tasks").delete().eq("id", id);

  revalidatePath(`/projecten/${projectId}`);
  revalidatePath("/mijn-taken");
}

// -----------------------------------------------------------------------------
// Subtaken
// -----------------------------------------------------------------------------
export async function addSubtaskAction(formData: FormData) {
  await requireInternal();

  const taskId = text(formData.get("task_id"));
  const projectId = text(formData.get("project_id"));
  const title = text(formData.get("title")).trim();
  if (!taskId || !title) return;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("subtasks")
    .select("position")
    .eq("task_id", taskId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("subtasks").insert({
    task_id: taskId,
    title,
    position: (last?.position ?? 0) + 1,
  });

  revalidatePath(`/projecten/${projectId}`);
}

export async function toggleSubtaskAction(subtaskId: string, isDone: boolean) {
  await requireInternal();

  const supabase = await createClient();
  const { error } = await supabase
    .from("subtasks")
    .update({ is_done: isDone })
    .eq("id", subtaskId);

  return error ? { error: "Kon de subtaak niet bijwerken." } : { success: true };
}
