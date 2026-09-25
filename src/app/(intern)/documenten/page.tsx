import type { Metadata } from "next";
import { Suspense } from "react";

import { DocumentList, type DocumentRow } from "@/components/domain/document-list";
import { DocumentUploadModal } from "@/components/domain/document-upload-modal";
import { ListToolbar } from "@/components/domain/list-toolbar";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, TableSkeleton } from "@/components/ui/misc";
import { requireInternal } from "@/lib/auth";
import { DOCUMENT_CATEGORY, options } from "@/lib/labels";
import { getCompanyOptions, getProjectOptions } from "@/lib/queries/lookups";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Documenten" };

interface Filters {
  q?: string;
  categorie?: string;
  klant?: string;
  project?: string;
  zichtbaar?: string;
}

/** Centraal documentbeheer (§17). */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  await requireInternal();
  const params = await searchParams;

  const [companies, projects] = await Promise.all([
    getCompanyOptions(),
    getProjectOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Documenten"
        description="Offertes, ontwerpen, handleidingen en technische documentatie."
        action={
          <DocumentUploadModal
            companies={companies}
            projects={projects.map((p) => ({
              id: p.id,
              name: p.name,
              company_id: p.company_id,
            }))}
          />
        }
      />

      <ListToolbar
        searchPlaceholder="Zoek op documentnaam…"
        filters={[
          { name: "categorie", label: "Categorie", options: options(DOCUMENT_CATEGORY) },
          {
            name: "klant",
            label: "Klant",
            options: companies.map((c) => ({ value: c.id, label: c.name })),
          },
          {
            name: "project",
            label: "Project",
            options: projects.map((p) => ({ value: p.id, label: p.name })),
          },
          {
            name: "zichtbaar",
            label: "Zichtbaarheid",
            options: [
              { value: "klant", label: "Zichtbaar voor klant" },
              { value: "intern", label: "Alleen intern" },
            ],
          },
        ]}
      />

      <Suspense key={JSON.stringify(params)} fallback={<TableSkeleton cols={4} />}>
        <DocumentsTable params={params} />
      </Suspense>
    </>
  );
}

async function DocumentsTable({ params }: { params: Filters }) {
  const supabase = await createClient();

  let query = supabase
    .from("files")
    .select(
      `*, uploader:users!files_uploaded_by_fkey(full_name),
       project:projects(name), company:companies(name)`,
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.q) query = query.ilike("name", `%${params.q}%`);
  if (params.categorie) query = query.eq("category", params.categorie);
  if (params.klant) query = query.eq("company_id", params.klant);
  if (params.project) query = query.eq("project_id", params.project);
  if (params.zichtbaar === "klant") query = query.eq("visible_to_client", true);
  if (params.zichtbaar === "intern") query = query.eq("visible_to_client", false);

  const { data, error } = await query;

  if (error) {
    return (
      <EmptyState title="Documenten konden niet worden geladen" description={error.message} />
    );
  }

  function one<T>(value: T | T[] | null | undefined): T | null {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
  }

  const documents: DocumentRow[] = (data ?? []).map((row) => ({
    ...(row as unknown as DocumentRow),
    uploaderName: one(row.uploader as { full_name?: string } | null)?.full_name ?? null,
    projectName: one(row.project as { name?: string } | null)?.name ?? null,
    companyName: one(row.company as { name?: string } | null)?.name ?? null,
  }));

  return (
    <Card>
      <DocumentList
        documents={documents}
        canDelete
        showProject
        emptyTitle="Geen documenten gevonden"
        emptyDescription="Pas je filters aan, of voeg een document toe."
      />
    </Card>
  );
}
