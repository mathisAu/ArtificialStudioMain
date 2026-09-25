"use client";

import { Link2, Paperclip, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { registerFileAction } from "@/lib/actions/files";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Modal, SubmitButton } from "@/components/ui/modal";
import { DOCUMENT_CATEGORY, options } from "@/lib/labels";
import {
  DOCUMENTS_BUCKET,
  MAX_FILE_BYTES,
  buildStoragePath,
  formatBytes,
} from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { useActionForm } from "@/lib/use-action-form";
import type { CompanySummary, EntityType } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Document toevoegen (§17): een upload of een externe link.
 *
 * De upload gaat rechtstreeks van de browser naar Supabase Storage. Pas als dat
 * gelukt is, wordt het formulier verstuurd met het opgeslagen pad erin.
 */
export function DocumentUploadModal({
  companies,
  defaultCompanyId,
  projectId,
  projects = [],
  label = "Document toevoegen",
  allowClientVisibility = true,
  entityType,
  entityId,
}: {
  companies: CompanySummary[];
  defaultCompanyId?: string;
  /** Vast project; laat leeg om de gebruiker te laten kiezen. */
  projectId?: string;
  projects?: { id: string; name: string; company_id: string }[];
  label?: string;
  allowClientVisibility?: boolean;
  /** Koppelt de upload aan één item, bijvoorbeeld een feedbackpunt. */
  entityType?: EntityType;
  entityId?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const formRef = useRef<HTMLFormElement>(null);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"upload" | "link">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? "");
  const [uploading, setUploading] = useState(false);
  const [storagePath, setStoragePath] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { submit, pending, error } = useActionForm(registerFileAction, (result) => {
    toast.success(result.success ?? "Document toegevoegd.");
    reset();
    setOpen(false);
    router.refresh();
  });

  function reset() {
    formRef.current?.reset();
    setFile(null);
    setStoragePath("");
    setUploadError(null);
    setMode("upload");
  }

  async function onFileChosen(chosen: File | null) {
    setUploadError(null);
    setStoragePath("");
    setFile(chosen);

    if (!chosen) return;

    if (chosen.size > MAX_FILE_BYTES) {
      setUploadError(
        `Dit bestand is ${formatBytes(chosen.size)}. Het maximum is ${formatBytes(MAX_FILE_BYTES)}.`,
      );
      setFile(null);
      return;
    }

    if (!companyId) {
      setUploadError("Kies eerst een klant; die bepaalt waar het bestand wordt opgeslagen.");
      setFile(null);
      return;
    }

    setUploading(true);
    const path = buildStoragePath(companyId, projectId ?? null, chosen.name);
    const { error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, chosen, { contentType: chosen.type || undefined });
    setUploading(false);

    if (error) {
      setUploadError(`Uploaden mislukt: ${error.message}`);
      setFile(null);
      return;
    }

    setStoragePath(path);
  }

  const relevantProjects = projects.filter((p) => !companyId || p.company_id === companyId);
  const canSubmit = mode === "link" ? true : Boolean(storagePath);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-3.5 w-3.5" />
        {label}
      </Button>

      <Modal
        open={open}
        onClose={() => {
          reset();
          setOpen(false);
        }}
        title="Document toevoegen"
        description="Upload een bestand of leg een externe link vast."
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Annuleren
            </Button>
            <SubmitButton
              form="document-form"
              pending={pending || uploading}
              pendingLabel={uploading ? "Uploaden…" : "Opslaan…"}
              className={cn(!canSubmit && "pointer-events-none opacity-50")}
            >
              Opslaan
            </SubmitButton>
          </>
        }
      >
        <form id="document-form" ref={formRef} action={submit} className="space-y-4">
          <input type="hidden" name="storage_path" value={mode === "upload" ? storagePath : ""} />
          <input type="hidden" name="mime_type" value={file?.type ?? ""} />
          <input type="hidden" name="size_bytes" value={file ? String(file.size) : ""} />
          {projectId ? <input type="hidden" name="project_id" value={projectId} /> : null}
          {entityType && entityId ? (
            <>
              <input type="hidden" name="entity_type" value={entityType} />
              <input type="hidden" name="entity_id" value={entityId} />
            </>
          ) : null}

          <FormError>{error ?? uploadError}</FormError>

          <div className="inline-flex rounded-[var(--radius)] border border-border-strong p-0.5">
            {(
              [
                { value: "upload", label: "Bestand", icon: Paperclip },
                { value: "link", label: "Externe link", icon: Link2 },
              ] as const
            ).map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-[calc(var(--radius)-2px)] px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                    mode === option.value
                      ? "bg-surface-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {option.label}
                </button>
              );
            })}
          </div>

          <Field label="Klant" htmlFor="doc_company" required>
            <Select
              id="doc_company"
              name="company_id"
              required
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
              disabled={Boolean(defaultCompanyId)}
            >
              <option value="">Kies een klant…</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </Select>
            {defaultCompanyId ? (
              <input type="hidden" name="company_id" value={defaultCompanyId} />
            ) : null}
          </Field>

          {!projectId && relevantProjects.length > 0 ? (
            <Field
              label="Project"
              htmlFor="doc_project"
              hint="Laat leeg voor een document op klantniveau."
            >
              <Select id="doc_project" name="project_id" defaultValue="">
                <option value="">Geen project</option>
                {relevantProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {mode === "upload" ? (
            <Field
              label="Bestand"
              htmlFor="doc_file"
              required
              hint={`PDF, Word, Excel, afbeeldingen en overige bestanden tot ${formatBytes(MAX_FILE_BYTES)}.`}
            >
              <input
                id="doc_file"
                type="file"
                onChange={(event) => onFileChosen(event.target.files?.[0] ?? null)}
                className="block w-full text-[13px] text-muted-foreground file:mr-3 file:rounded-[var(--radius)] file:border file:border-border-strong file:bg-surface file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-foreground hover:file:bg-surface-muted"
              />
              {uploading ? (
                <p className="text-xs text-muted-foreground">Bezig met uploaden…</p>
              ) : null}
              {storagePath && file ? (
                <p className="text-xs text-success">
                  {file.name} ({formatBytes(file.size)}) is geüpload.
                </p>
              ) : null}
            </Field>
          ) : (
            <Field label="Externe link" htmlFor="doc_url" required>
              <Input
                id="doc_url"
                name="external_url"
                type="url"
                placeholder="https://"
                required={mode === "link"}
              />
            </Field>
          )}

          <Field label="Naam" htmlFor="doc_name" required>
            <Input
              id="doc_name"
              name="name"
              required
              key={file?.name ?? "leeg"}
              defaultValue={file?.name ?? ""}
              placeholder="Offerte klantportaal"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categorie" htmlFor="doc_category">
              <Select id="doc_category" name="category" defaultValue="project_documentation">
                {options(DOCUMENT_CATEGORY).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Omschrijving" htmlFor="doc_description">
            <Textarea id="doc_description" name="description" rows={2} />
          </Field>

          {allowClientVisibility ? (
            <Checkbox
              name="visible_to_client"
              label="Zichtbaar voor de klant"
              description="Alleen vrijgegeven documenten verschijnen in het klantportaal."
            />
          ) : null}
        </form>
      </Modal>
    </>
  );
}
