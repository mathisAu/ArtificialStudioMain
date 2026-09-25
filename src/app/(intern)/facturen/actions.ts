"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireManager } from "@/lib/auth";
import { DOCUMENTS_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { revalidateShared } from "@/lib/revalidate";
import {
  firstIssue,
  optionalText,
  optionalUuid,
  parseAmount,
  text,
} from "@/lib/validation";

export interface InvoiceState {
  error?: string;
  success?: string;
  id?: string;
}

const INVOICE_STATUSES = ["draft", "open", "paid", "overdue", "credited"] as const;

const amount = z
  .string()
  .trim()
  .transform(parseAmount)
  .refine((value) => Number.isFinite(value) && value >= 0, {
    message: "Vul een geldig bedrag in.",
  });

const invoiceSchema = z
  .object({
    company_id: z.uuid("Kies een klant."),
    project_id: optionalUuid,
    description: optionalText,
    invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Vul een factuurdatum in."),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Vul een vervaldatum in."),
    amount_excl_vat: amount,
    vat_amount: amount,
    status: z.enum(INVOICE_STATUSES),
    external_invoice_id: optionalText,
    external_payment_url: optionalText,
  })
  .refine((data) => data.due_date >= data.invoice_date, {
    message: "De vervaldatum kan niet vóór de factuurdatum liggen.",
    path: ["due_date"],
  });

function readInvoice(formData: FormData) {
  return invoiceSchema.safeParse({
    company_id: text(formData.get("company_id")),
    project_id: text(formData.get("project_id")),
    description: text(formData.get("description")),
    invoice_date: text(formData.get("invoice_date")),
    due_date: text(formData.get("due_date")),
    amount_excl_vat: text(formData.get("amount_excl_vat")),
    vat_amount: text(formData.get("vat_amount")),
    status: text(formData.get("status")) || "draft",
    external_invoice_id: text(formData.get("external_invoice_id")),
    external_payment_url: text(formData.get("external_payment_url")),
  });
}

export async function createInvoiceAction(
  _prev: InvoiceState,
  formData: FormData,
): Promise<InvoiceState> {
  const user = await requireManager();
  const parsed = readInvoice(formData);

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    // invoice_number wordt door de database toegekend (F-JJJJ-NNNN).
    .insert({ ...parsed.data, created_by: user.id })
    .select("id")
    .single();

  if (error) return { error: "De factuur kon niet worden opgeslagen." };

  revalidateShared("/facturen");
  revalidateShared(`/klanten/${parsed.data.company_id}`);
  return { success: "Factuur aangemaakt.", id: data.id };
}

export async function updateInvoiceAction(
  _prev: InvoiceState,
  formData: FormData,
): Promise<InvoiceState> {
  await requireManager();

  const id = text(formData.get("id"));
  if (!id) return { error: "Onbekende factuur." };

  const parsed = readInvoice(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("invoices").update(parsed.data).eq("id", id);

  if (error) return { error: "De wijzigingen konden niet worden opgeslagen." };

  revalidateShared("/facturen");
  revalidateShared(`/facturen/${id}`);
  revalidateShared(`/klanten/${parsed.data.company_id}`);
  return { success: "Factuur bijgewerkt.", id };
}

export async function setInvoiceStatusAction(invoiceId: string, status: string) {
  await requireManager();

  if (!(INVOICE_STATUSES as readonly string[]).includes(status)) {
    return { error: "Onbekende status." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .update({ status })
    .eq("id", invoiceId)
    .select("company_id")
    .maybeSingle();

  if (error || !data) return { error: "De factuur kon niet worden gewijzigd." };

  revalidateShared("/facturen");
  revalidateShared(`/facturen/${invoiceId}`);
  revalidateShared(`/klanten/${data.company_id}`);
  return { success: "Status bijgewerkt." };
}

export async function deleteInvoiceAction(formData: FormData) {
  await requireManager();

  const id = text(formData.get("id"));
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("invoices").delete().eq("id", id);

  revalidateShared("/facturen");
  redirect("/facturen");
}

/**
 * Factuur-PDF vastleggen (§21).
 *
 * Het bestand staat al in Storage; deze actie legt de metadata vast. Er wordt
 * bewust ook een rij in `files` aangemaakt: de storage-policy geeft alleen
 * toegang tot objecten waarvoor zo'n rij bestaat, en zo verschijnt de factuur
 * meteen in het documentenoverzicht van de klant.
 */
export async function attachInvoicePdfAction(
  _prev: InvoiceState,
  formData: FormData,
): Promise<InvoiceState> {
  const user = await requireManager();

  const invoiceId = text(formData.get("invoice_id"));
  const storagePath = text(formData.get("storage_path"));
  const fileName = text(formData.get("name")) || "Factuur.pdf";
  const sizeRaw = text(formData.get("size_bytes"));

  if (!invoiceId || !storagePath) return { error: "Kies eerst een bestand." };

  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, company_id, project_id, invoice_number, status")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) return { error: "Factuur niet gevonden." };

  const { error: fileError } = await supabase.from("files").insert({
    company_id: invoice.company_id,
    project_id: invoice.project_id,
    entity_type: "invoice",
    entity_id: invoice.id,
    name: fileName,
    category: "invoice",
    storage_path: storagePath,
    mime_type: text(formData.get("mime_type")) || "application/pdf",
    size_bytes: sizeRaw ? Number(sizeRaw) : null,
    // Een concept blijft intern; zodra de factuur verstuurd is mag de klant erbij.
    visible_to_client: invoice.status !== "draft",
    uploaded_by: user.id,
  });

  if (fileError) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
    return { error: "De PDF kon niet worden vastgelegd." };
  }

  await supabase.from("invoices").update({ pdf_path: storagePath }).eq("id", invoiceId);

  revalidateShared(`/facturen/${invoiceId}`);
  revalidateShared("/documenten");
  return { success: "PDF toegevoegd." };
}
