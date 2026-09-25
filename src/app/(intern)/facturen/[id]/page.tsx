import { ExternalLink, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteInvoiceAction, setInvoiceStatusAction } from "../actions";
import { InvoiceFormModal } from "../invoice-form-modal";
import { InvoicePdfUpload } from "./invoice-pdf-upload";
import { DocumentList, type DocumentRow } from "@/components/domain/document-list";
import { InlineStatusSelect } from "@/components/domain/inline-status-select";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList, PageHeader } from "@/components/ui/misc";
import { requireManager } from "@/lib/auth";
import { INVOICE_STATUS } from "@/lib/labels";
import { getCompanyOptions, getProjectOptions } from "@/lib/queries/lookups";
import { createClient } from "@/lib/supabase/server";
import type { Invoice, InvoiceStatus } from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime, isOverdue } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("id", id)
    .maybeSingle();
  return { title: data?.invoice_number ?? "Factuur" };
}

/** Factuurdetails (§21). */
export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireManager();
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, company:companies(id, name), project:projects(id, name)")
    .eq("id", id)
    .maybeSingle();

  if (!invoice) notFound();

  const [{ data: fileRows }, companies, projects] = await Promise.all([
    supabase
      .from("files")
      .select("*, uploader:users!files_uploaded_by_fkey(full_name)")
      .eq("entity_type", "invoice")
      .eq("entity_id", id)
      .order("created_at", { ascending: false }),
    getCompanyOptions(),
    getProjectOptions(),
  ]);

  const company = Array.isArray(invoice.company) ? invoice.company[0] : invoice.company;
  const project = Array.isArray(invoice.project) ? invoice.project[0] : invoice.project;

  const documents: DocumentRow[] = (fileRows ?? []).map((row) => {
    const uploader = Array.isArray(row.uploader) ? row.uploader[0] : row.uploader;
    return {
      ...(row as unknown as DocumentRow),
      uploaderName: (uploader as { full_name?: string } | null)?.full_name ?? null,
    };
  });

  const late =
    invoice.status === "overdue" ||
    (invoice.status === "open" && isOverdue(invoice.due_date));

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Facturen", href: "/facturen" },
          { label: invoice.invoice_number },
        ]}
        title={invoice.invoice_number}
        description={invoice.description ?? "Geen omschrijving"}
        action={
          <>
            <InlineStatusSelect
              id={invoice.id}
              value={invoice.status as InvoiceStatus}
              map={INVOICE_STATUS}
              action={setInvoiceStatusAction}
            />
            <InvoiceFormModal
              companies={companies}
              projects={projects.map((p) => ({
                id: p.id,
                name: p.name,
                company_id: p.company_id,
              }))}
              invoice={invoice as Invoice}
            />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Bedragen" />
            <CardBody>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Bedrag exclusief btw</dt>
                  <dd className="tabular-nums">
                    {formatCurrency(Number(invoice.amount_excl_vat))}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Btw</dt>
                  <dd className="tabular-nums">
                    {formatCurrency(Number(invoice.vat_amount))}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2.5 text-base font-semibold">
                  <dt>Totaal</dt>
                  <dd className="tabular-nums">
                    {formatCurrency(Number(invoice.total_amount))}
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="PDF en bijlagen"
              description="De PDF verschijnt in het klantportaal zodra de factuur geen concept meer is."
            />
            <DocumentList
              documents={documents}
              canDelete
              emptyTitle="Nog geen PDF"
              emptyDescription="Voeg de factuur-PDF toe zodat de klant hem kan downloaden."
            />
            <CardBody className="border-t border-border">
              <InvoicePdfUpload
                invoiceId={invoice.id}
                companyId={invoice.company_id}
                projectId={invoice.project_id}
                invoiceNumber={invoice.invoice_number}
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Gegevens" />
            <CardBody>
              <DefinitionList
                className="sm:grid-cols-1"
                items={[
                  {
                    label: "Klant",
                    value: company ? (
                      <Link
                        href={`/klanten/${(company as { id: string }).id}`}
                        className="text-accent hover:underline"
                      >
                        {(company as { name: string }).name}
                      </Link>
                    ) : (
                      "—"
                    ),
                  },
                  {
                    label: "Project",
                    value: project ? (
                      <Link
                        href={`/projecten/${(project as { id: string }).id}`}
                        className="text-accent hover:underline"
                      >
                        {(project as { name: string }).name}
                      </Link>
                    ) : (
                      "—"
                    ),
                  },
                  { label: "Factuurdatum", value: formatDate(invoice.invoice_date) },
                  {
                    label: "Vervaldatum",
                    value: (
                      <span className={late ? "font-medium text-danger" : undefined}>
                        {formatDate(invoice.due_date)}
                      </span>
                    ),
                  },
                  {
                    label: "Status",
                    value: (
                      <StatusBadge
                        map={INVOICE_STATUS}
                        value={invoice.status as InvoiceStatus}
                      />
                    ),
                  },
                  {
                    label: "Betaald op",
                    value: invoice.paid_at ? formatDateTime(invoice.paid_at) : "—",
                  },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Koppelingen"
              description="Voorbereid op boekhoudsoftware en een payment provider."
            />
            <CardBody>
              <DefinitionList
                className="sm:grid-cols-1"
                items={[
                  {
                    label: "Externe factuur-ID",
                    value: invoice.external_invoice_id ?? "—",
                  },
                  {
                    label: "Betaallink",
                    value: invoice.external_payment_url ? (
                      <a
                        href={invoice.external_payment_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 text-accent hover:underline"
                      >
                        Openen
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      "Niet ingesteld"
                    ),
                  },
                ]}
              />
            </CardBody>
          </Card>

          <form action={deleteInvoiceAction}>
            <input type="hidden" name="id" value={invoice.id} />
            <Button type="submit" variant="ghost" size="sm" className="text-danger">
              <Trash2 className="h-3.5 w-3.5" />
              Factuur verwijderen
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
