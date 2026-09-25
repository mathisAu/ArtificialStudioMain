import type { Metadata } from "next";

import { DocumentList, type DocumentRow } from "@/components/domain/document-list";
import { DocumentUploadModal } from "@/components/domain/document-upload-modal";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireClient } from "@/lib/auth";
import { DOCUMENT_CATEGORY } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { DocumentCategory } from "@/lib/types";
import { daysAgoIso } from "@/lib/utils";

export const metadata: Metadata = { title: "Documenten" };

/**
 * Documenten in het klantportaal (§30).
 *
 * RLS zorgt ervoor dat hier uitsluitend documenten van de eigen organisatie
 * verschijnen die als zichtbaar voor de klant zijn gemarkeerd.
 */
export default async function PortalDocumentsPage() {
  const user = await requireClient();
  const supabase = await createClient();

  const [{ data: fileRows }, { data: projects }] = await Promise.all([
    supabase
      .from("files")
      .select("*, project:projects(name)")
      // Naast RLS ook hier expliciet: alleen de eigen organisatie, en alleen
      // wat bewust met de klant gedeeld is.
      .eq("company_id", user.companyId)
      .eq("visible_to_client", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, name, company_id")
      .eq("company_id", user.companyId)
      .order("name"),
  ]);

  // Alles van de afgelopen week krijgt een "Nieuw"-label en staat bovendien
  // bovenaan in een aparte kaart, zodat een net aangeleverd bestand meteen
  // zichtbaar is en niet ergens tussen de categorieën verdwijnt.
  const newSince = daysAgoIso(7);

  const documents: DocumentRow[] = (fileRows ?? []).map((row) => {
    const project = Array.isArray(row.project) ? row.project[0] : row.project;
    return {
      ...(row as unknown as DocumentRow),
      uploaderName: null,
      projectName: (project as { name?: string } | null)?.name ?? null,
    };
  });

  // Groeperen per categorie, in de volgorde uit lib/labels.ts.
  const categories = (Object.values(DOCUMENT_CATEGORY) as {
    value: DocumentCategory;
    label: string;
    order: number;
  }[])
    .sort((a, b) => a.order - b.order)
    .map((category) => ({
      ...category,
      items: documents.filter((doc) => doc.category === category.value),
    }))
    .filter((category) => category.items.length > 0);

  const recent = documents.filter((doc) => doc.created_at > newSince).slice(0, 8);

  return (
    <>
      <PageHeader
        title="Documenten"
        description="Offertes, handleidingen, ontwerpen en projectdocumentatie."
        action={
          <DocumentUploadModal
            companies={[
              {
                id: user.companyId,
                name: user.companyName ?? "Mijn organisatie",
                status: "active",
              },
            ]}
            defaultCompanyId={user.companyId}
            projects={(projects ?? []).map((p) => ({
              id: p.id,
              name: p.name,
              company_id: p.company_id,
            }))}
            allowClientVisibility={false}
            label="Bestand aanleveren"
          />
        }
      />

      {recent.length > 0 ? (
        <Card>
          <CardHeader
            title="Onlangs toegevoegd"
            description="De nieuwste bestanden van de afgelopen week."
          />
          <DocumentList
            documents={recent}
            currentUserId={user.id}
            newSince={newSince}
            showProject
            showVisibility={false}
          />
        </Card>
      ) : null}

      {categories.length === 0 ? (
        <Card>
          <DocumentList
            documents={[]}
            showVisibility={false}
            currentUserId={user.id}
            emptyTitle="Nog geen documenten"
            emptyDescription="Zodra wij documenten met u delen, verschijnen ze hier."
          />
        </Card>
      ) : (
        categories.map((category) => (
          <Card key={category.value}>
            <CardHeader
              title={category.label}
              action={
                <span className="text-[13px] tabular-nums text-muted-foreground">
                  {category.items.length}
                </span>
              }
            />
            <DocumentList
              documents={category.items}
              currentUserId={user.id}
              newSince={newSince}
              showProject
              showVisibility={false}
            />
          </Card>
        ))
      )}
    </>
  );
}
