"use client";

import { FileText, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { attachInvoicePdfAction } from "../actions";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { DOCUMENTS_BUCKET, MAX_FILE_BYTES, buildStoragePath, formatBytes } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { useActionForm } from "@/lib/use-action-form";

/**
 * Factuur-PDF toevoegen (§21).
 *
 * Het bestand gaat rechtstreeks naar Storage; daarna legt de server action de
 * metadata vast en zet die het pad op de factuur.
 */
export function InvoicePdfUpload({
  invoiceId,
  companyId,
  projectId,
  invoiceNumber,
}: {
  invoiceId: string;
  companyId: string;
  projectId: string | null;
  invoiceNumber: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [storagePath, setStoragePath] = useState("");

  const { submit, pending, error } = useActionForm(attachInvoicePdfAction, (result) => {
    toast.success(result.success ?? "PDF toegevoegd.");
    setFile(null);
    setStoragePath("");
    formRef.current?.reset();
    router.refresh();
  });

  async function onFileChosen(chosen: File | null) {
    setUploadError(null);
    setStoragePath("");
    setFile(chosen);
    if (!chosen) return;

    if (chosen.size > MAX_FILE_BYTES) {
      setUploadError(`Maximaal ${formatBytes(MAX_FILE_BYTES)} per bestand.`);
      setFile(null);
      return;
    }

    setUploading(true);
    const path = buildStoragePath(companyId, projectId, chosen.name);
    const { error: storageError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, chosen, { contentType: chosen.type || "application/pdf" });
    setUploading(false);

    if (storageError) {
      setUploadError(`Uploaden mislukt: ${storageError.message}`);
      setFile(null);
      return;
    }

    setStoragePath(path);
  }

  return (
    <form ref={formRef} action={submit} className="space-y-3">
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <input type="hidden" name="storage_path" value={storagePath} />
      <input type="hidden" name="name" value={file?.name ?? `${invoiceNumber}.pdf`} />
      <input type="hidden" name="mime_type" value={file?.type ?? ""} />
      <input type="hidden" name="size_bytes" value={file ? String(file.size) : ""} />

      <FormError>{error ?? uploadError}</FormError>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={(event) => onFileChosen(event.target.files?.[0] ?? null)}
        className="block w-full text-[13px] text-muted-foreground file:mr-3 file:rounded-[var(--radius)] file:border file:border-border-strong file:bg-surface file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-foreground hover:file:bg-surface-muted"
      />

      {uploading ? (
        <p className="text-xs text-muted-foreground">Bezig met uploaden…</p>
      ) : null}

      {storagePath && file ? (
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-success">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {file.name} ({formatBytes(file.size)})
            </span>
          </p>
          <Button type="submit" size="sm" disabled={pending}>
            <Upload className="h-3.5 w-3.5" />
            {pending ? "Opslaan…" : "Vastleggen"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
