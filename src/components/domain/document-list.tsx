"use client";

import {
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Link2,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteFileAction, getDownloadUrlAction } from "@/lib/actions/files";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { DOCUMENT_CATEGORY } from "@/lib/labels";
import { formatBytes } from "@/lib/storage";
import type { DocumentCategory } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export interface DocumentRow {
  id: string;
  name: string;
  description: string | null;
  category: DocumentCategory;
  mime_type: string | null;
  size_bytes: number | null;
  external_url: string | null;
  visible_to_client: boolean;
  created_at: string;
  uploaded_by: string | null;
  uploaderName: string | null;
  projectName?: string | null;
  companyName?: string | null;
}

function iconFor(row: DocumentRow): LucideIcon {
  if (row.external_url) return Link2;
  const type = row.mime_type ?? "";
  if (type.startsWith("image/")) return FileImage;
  if (type.includes("pdf")) return FileText;
  if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) {
    return FileSpreadsheet;
  }
  if (type.includes("word") || type.includes("document")) return FileText;
  return File;
}

/** Documentenlijst met downloadknop (§17, §30). */
export function DocumentList({
  documents,
  canDelete = false,
  currentUserId,
  newSince,
  showProject = false,
  showVisibility = true,
  emptyTitle = "Nog geen documenten",
  emptyDescription = "Voeg offertes, ontwerpen of technische documentatie toe.",
}: {
  documents: DocumentRow[];
  canDelete?: boolean;
  /**
   * Wie zelf een bestand heeft aangeleverd, mag het ook weer weghalen — dat is
   * precies wat de databasepolicy toestaat, dus de knop hoort er te staan.
   */
  currentUserId?: string;
  /** Alles wat na dit tijdstip is toegevoegd krijgt het label "Nieuw". */
  newSince?: string;
  showProject?: boolean;
  showVisibility?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function download(id: string) {
    setBusyId(id);
    const result = await getDownloadUrlAction(id);
    setBusyId(null);

    if (result.error || !result.url) {
      toast.error(result.error ?? "De download kon niet worden gestart.");
      return;
    }
    // De link komt pas na een server-actie binnen, dus lang na de klik. Veel
    // browsers zien `window.open` dan als een ongevraagde pop-up en blokkeren
    // hem zonder melding — het document leek daardoor niet te openen. Lukt het
    // niet, dan navigeert hetzelfde tabblad ernaartoe.
    const opened = window.open(result.url, "_blank", "noopener,noreferrer");
    if (!opened || opened.closed) window.location.assign(result.url);
  }

  if (documents.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={<FileText className="h-5 w-5" />}
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {documents.map((doc) => {
        const Icon = iconFor(doc);
        const mayDelete =
          canDelete || (currentUserId != null && doc.uploaded_by === currentUserId);
        const isNew = newSince != null && doc.created_at > newSince;
        const meta = [
          DOCUMENT_CATEGORY[doc.category].label,
          showProject ? (doc.projectName ?? doc.companyName ?? null) : null,
          doc.external_url ? "Externe link" : formatBytes(doc.size_bytes),
          `${formatDate(doc.created_at)}${doc.uploaderName ? ` · ${doc.uploaderName}` : ""}`,
        ].filter(Boolean);

        return (
          <li key={doc.id} className="flex items-center gap-3 px-5 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-surface-muted text-muted-foreground">
              <Icon className="h-4 w-4" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                <span className="truncate">{doc.name}</span>
                {isNew ? <Badge tone="accent">Nieuw</Badge> : null}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {meta.join(" · ")}
              </p>
              {doc.description ? (
                <p className="mt-0.5 truncate text-xs text-subtle-foreground">
                  {doc.description}
                </p>
              ) : null}
            </div>

            {showVisibility ? (
              doc.visible_to_client ? (
                <Badge tone="success">
                  <Eye className="h-3 w-3" />
                  Klant
                </Badge>
              ) : (
                <Badge tone="neutral">
                  <EyeOff className="h-3 w-3" />
                  Intern
                </Badge>
              )
            ) : null}

            <Button
              variant="ghost"
              size="icon"
              aria-label={doc.external_url ? `${doc.name} openen` : `${doc.name} downloaden`}
              disabled={busyId === doc.id}
              onClick={() => download(doc.id)}
            >
              {doc.external_url ? (
                <ExternalLink className="h-4 w-4" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>

            {mayDelete ? (
              <form
                action={(formData) => {
                  if (!window.confirm(`"${doc.name}" definitief verwijderen?`)) return;
                  startTransition(() => {
                    void deleteFileAction(formData);
                  });
                }}
              >
                <input type="hidden" name="id" value={doc.id} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  aria-label={`${doc.name} verwijderen`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </form>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
