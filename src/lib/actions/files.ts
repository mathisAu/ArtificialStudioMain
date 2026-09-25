"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { DOCUMENTS_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { checkbox, firstIssue, optionalText, optionalUuid, text } from "@/lib/validation";

export interface FileState {
  error?: string;
  success?: string;
}

const CATEGORIES = [
  "quote",
  "invoice",
  "project_documentation",
  "manual",
  "design",
  "technical",
  "other",
] as const;

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

const fileSchema = z.object({
  company_id: z.uuid("Kies een klant."),
  project_id: optionalUuid,
  // Optionele koppeling aan een specifiek item, bijvoorbeeld een screenshot bij
  // een feedbackpunt (§14) of een bestand bij een klantactie (§16).
  entity_type: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .refine((value) => value === null || (ENTITY_TYPES as readonly string[]).includes(value), {
      message: "Onbekend onderwerp.",
    }),
  entity_id: optionalUuid,
  name: z.string().trim().min(1, "Vul een naam in."),
  description: optionalText,
  category: z.enum(CATEGORIES),
  storage_path: optionalText,
  external_url: optionalText,
  mime_type: optionalText,
  size_bytes: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .nullable(),
  visible_to_client: z.boolean(),
});

/**
 * Legt een geüpload bestand of een externe link vast (§17).
 *
 * De bytes gaan niet door de Next-server: de browser uploadt rechtstreeks naar
 * Supabase Storage, waar dezelfde toegangsregels gelden. Deze actie schrijft
 * alleen de metadata weg.
 */
export async function registerFileAction(
  _prev: FileState,
  formData: FormData,
): Promise<FileState> {
  const user = await requireUser();

  const parsed = fileSchema.safeParse({
    company_id: text(formData.get("company_id")),
    project_id: text(formData.get("project_id")),
    entity_type: text(formData.get("entity_type")),
    entity_id: text(formData.get("entity_id")),
    name: text(formData.get("name")),
    description: text(formData.get("description")),
    category: text(formData.get("category")) || "other",
    storage_path: text(formData.get("storage_path")),
    external_url: text(formData.get("external_url")),
    mime_type: text(formData.get("mime_type")),
    size_bytes: text(formData.get("size_bytes")),
    visible_to_client:
      user.role === "client" ? true : checkbox(formData.get("visible_to_client")),
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  if (!parsed.data.storage_path && !parsed.data.external_url) {
    return { error: "Kies een bestand of vul een externe link in." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("files")
    .insert({ ...parsed.data, uploaded_by: user.id });

  if (error) {
    // De upload staat al in Storage; zonder metadata is die onbereikbaar.
    // Opruimen, anders blijft er een weesbestand achter.
    if (parsed.data.storage_path) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([parsed.data.storage_path]);
    }
    return { error: "Het document kon niet worden opgeslagen." };
  }

  revalidateDocumentPaths(parsed.data);
  return { success: "Document toegevoegd." };
}

export async function deleteFileAction(formData: FormData) {
  await requireUser();

  const id = text(formData.get("id"));
  if (!id) return;

  const supabase = await createClient();

  const { data: file } = await supabase
    .from("files")
    .select("storage_path, project_id, company_id, entity_type, entity_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("files").delete().eq("id", id);
  if (error) return;

  // Pas het object weggooien als de rij daadwerkelijk verwijderd is; anders
  // wijst de metadata naar een bestand dat niet meer bestaat.
  if (file?.storage_path) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([file.storage_path]);
  }

  revalidateDocumentPaths(file ?? {});
}

/**
 * Routes per onderwerp waaraan een bestand kan hangen. Zonder deze koppeling
 * blijft de bijlage na verwijderen gewoon staan op bijvoorbeeld de
 * feedbackpagina: de actie slaagt, maar de pagina komt uit de cache.
 */
const ENTITY_ROUTES: Record<string, [string] | [string, string]> = {
  feedback: ["/feedback", "/portaal/feedback"],
  question: ["/vragen", "/portaal/vragen"],
  customer_action: ["/acties", "/portaal/acties"],
  invoice: ["/facturen", "/portaal/facturen"],
  project: ["/projecten", "/portaal/projecten"],
  project_update: ["/projecten"],
  task: ["/projecten"],
  company: ["/klanten"],
};

/**
 * Dezelfde handeling raakt twee omgevingen: een klant die een bestand aanlevert
 * of verwijdert moet dat meteen terugzien in het portaal, en het team in het
 * interne overzicht. Beide kanten worden daarom altijd ververst.
 */
function revalidateDocumentPaths(file: {
  project_id?: string | null;
  company_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
}) {
  revalidatePath("/documenten");
  revalidatePath("/portaal/documenten");
  revalidatePath("/portaal");

  if (file.project_id) {
    revalidatePath(`/projecten/${file.project_id}`);
    revalidatePath(`/portaal/projecten/${file.project_id}`);
  }
  if (file.company_id) revalidatePath(`/klanten/${file.company_id}`);

  const routes = file.entity_type ? ENTITY_ROUTES[file.entity_type] : undefined;
  if (routes && file.entity_id) {
    for (const base of routes) revalidatePath(`${base}/${file.entity_id}`);
  }
}

/**
 * Tijdelijke downloadlink. De bucket is privé, dus een direct pad werkt niet.
 * Supabase controleert bij het aanmaken van de link opnieuw de storage-policy,
 * dus een klant kan hiermee geen bestand van een andere klant opvragen.
 */
export async function getDownloadUrlAction(
  fileId: string,
): Promise<{ url?: string; error?: string }> {
  await requireUser();

  const supabase = await createClient();

  const { data: file } = await supabase
    .from("files")
    .select("storage_path, external_url, name")
    .eq("id", fileId)
    .maybeSingle();

  if (!file) return { error: "Document niet gevonden." };
  if (file.external_url) return { url: file.external_url };
  if (!file.storage_path) return { error: "Dit document heeft geen bestand." };

  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(file.storage_path, 60, { download: file.name });

  if (error || !data) return { error: "De downloadlink kon niet worden gemaakt." };
  return { url: data.signedUrl };
}
