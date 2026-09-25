"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin, requireInternal, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { checkbox, firstIssue, optionalText, text } from "@/lib/validation";

export interface SettingsState {
  error?: string;
  success?: string;
  id?: string;
}

// -----------------------------------------------------------------------------
// Projecttemplates (§34)
// -----------------------------------------------------------------------------
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

const templateSchema = z.object({
  name: z.string().trim().min(2, "Vul een naam in."),
  description: optionalText,
  project_type: z.enum(PROJECT_TYPES),
  is_active: z.boolean(),
});

export async function saveTemplateAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireAdmin();

  const parsed = templateSchema.safeParse({
    name: text(formData.get("name")),
    description: text(formData.get("description")),
    project_type: text(formData.get("project_type")) || "other",
    is_active: checkbox(formData.get("is_active")),
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const id = text(formData.get("id"));

  if (id) {
    const { error } = await supabase.from("project_templates").update(parsed.data).eq("id", id);
    if (error) return { error: "Het template kon niet worden opgeslagen." };
    revalidatePath("/instellingen/templates");
    return { success: "Template bijgewerkt.", id };
  }

  const { data, error } = await supabase
    .from("project_templates")
    .insert({ ...parsed.data, created_by: user.id })
    .select("id")
    .single();

  if (error) return { error: "Het template kon niet worden aangemaakt." };

  revalidatePath("/instellingen/templates");
  return { success: "Template aangemaakt.", id: data.id };
}

export async function deleteTemplateAction(formData: FormData) {
  await requireAdmin();

  const id = text(formData.get("id"));
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("project_templates").delete().eq("id", id);

  revalidatePath("/instellingen/templates");
  // De detailpagina bestaat nu niet meer.
  redirect("/instellingen/templates");
}

const templateItemSchema = z.object({
  template_id: z.uuid("Onbekend template."),
  kind: z.enum(["phase", "task"]),
  title: z.string().trim().min(2, "Vul een titel in."),
  description: optionalText,
  priority: z.enum(["low", "normal", "high", "urgent"]),
  offset_days: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .nullable()
    .refine((value) => value === null || (Number.isInteger(value) && value >= 0), {
      message: "Vul een geheel aantal dagen in.",
    }),
});

export async function addTemplateItemAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireAdmin();

  const parsed = templateItemSchema.safeParse({
    template_id: text(formData.get("template_id")),
    kind: text(formData.get("kind")) || "task",
    title: text(formData.get("title")),
    description: text(formData.get("description")),
    priority: text(formData.get("priority")) || "normal",
    offset_days: text(formData.get("offset_days")),
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();

  // Nieuwe regels komen onderaan hun soort.
  const { data: last } = await supabase
    .from("project_template_items")
    .select("position")
    .eq("template_id", parsed.data.template_id)
    .eq("kind", parsed.data.kind)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from("project_template_items")
    .insert({ ...parsed.data, position: (last?.position ?? 0) + 1 });

  if (error) return { error: "De regel kon niet worden toegevoegd." };

  revalidatePath(`/instellingen/templates/${parsed.data.template_id}`);
  return { success: "Toegevoegd." };
}

export async function deleteTemplateItemAction(formData: FormData) {
  await requireAdmin();

  const id = text(formData.get("id"));
  const templateId = text(formData.get("template_id"));
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("project_template_items").delete().eq("id", id);

  revalidatePath(`/instellingen/templates/${templateId}`);
}

// -----------------------------------------------------------------------------
// Integraties (§33, §26)
// -----------------------------------------------------------------------------
export async function saveIntegrationAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireAdmin();

  const key = text(formData.get("key"));
  if (key !== "slack" && key !== "email") return { error: "Onbekende integratie." };

  const supabase = await createClient();

  let value: Record<string, unknown>;

  if (key === "slack") {
    const webhook = text(formData.get("webhook_url")).trim();
    if (webhook && !webhook.startsWith("https://hooks.slack.com/")) {
      return {
        error: "Een Slack-webhook begint met https://hooks.slack.com/. Controleer de URL.",
      };
    }
    value = {
      enabled: checkbox(formData.get("enabled")),
      webhook_url: webhook || null,
    };
  } else {
    const from = text(formData.get("from_address")).trim();
    if (from && !z.email().safeParse(from).success) {
      return { error: "Vul een geldig afzenderadres in." };
    }
    value = {
      enabled: checkbox(formData.get("enabled")),
      from_address: from || null,
      from_name: text(formData.get("from_name")).trim() || "Artificial Studio",
    };
  }

  const { error } = await supabase
    .from("app_settings")
    .update({ value, updated_by: user.id })
    .eq("key", key);

  if (error) return { error: "De instellingen konden niet worden opgeslagen." };

  revalidatePath("/instellingen/integraties");
  return { success: "Instellingen opgeslagen." };
}

/** Slack-instellingen per project (§33). */
export async function saveProjectSlackAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireInternal();

  const projectId = text(formData.get("project_id"));
  if (!projectId) return { error: "Onbekend project." };

  const channel = text(formData.get("slack_channel_id")).trim();
  const events = formData.getAll("events").map((value) => String(value));

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      slack_channel_id: channel || null,
      slack_config: { events },
    })
    .eq("id", projectId);

  if (error) {
    return { error: "De Slack-instellingen konden niet worden opgeslagen." };
  }

  revalidatePath(`/projecten/${projectId}`);
  return { success: "Slack-instellingen opgeslagen." };
}

// -----------------------------------------------------------------------------
// Persoonlijke e-mailvoorkeuren (§32)
// -----------------------------------------------------------------------------
export async function saveEmailPreferencesAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();

  const enabled = checkbox(formData.get("enabled"));
  const muted = formData.getAll("muted_types").map((value) => String(value));

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ email_notifications: { enabled, muted_types: muted } })
    .eq("id", user.id);

  if (error) return { error: "Je voorkeuren konden niet worden opgeslagen." };

  revalidatePath("/instellingen/notificaties");
  revalidatePath("/portaal/account");
  return { success: "Voorkeuren opgeslagen." };
}
