import { CreditCard, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocumentList, type DocumentRow } from "@/components/domain/document-list";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList, PageHeader } from "@/components/ui/misc";
import { requireClient } from "@/lib/auth";
import { INVOICE_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceStatus } from "@/lib/types";
import { buttonClass } from "@/components/ui/button";
import { formatCurrency, formatDate, isOverdue } from "@/lib/utils";

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

/** Factuurdetail in het klantportaal (§29). */
export default async function PortalInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireClient();
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, project:projects(id, name)")
    .eq("id", id)
    .eq("company_id", user.companyId)
    .neq("status", "draft")
    .maybeSingle();

  if (!invoice) notFound();

  const { data: fileRows } = await supabase
    .from("files")
    .select("*")
    .eq("entity_type", "invoice")
    .eq("entity_id", id)
    .eq("company_id", user.companyId)
    .order("created_at", { ascending: false });

  const project = Array.isArray(invoice.project) ? invoice.project[0] : invoice.project;
  const late =
    invoice.status === "overdue" ||
    (invoice.status === "open" && isOverdue(invoice.due_date));
  const outstanding = invoice.status === "open" || invoice.status === "overdue";

  const documents: DocumentRow[] = (fileRows ?? []).map((row) => ({
    ...(row as unknown as DocumentRow),
    uploaderName: null,
  }));

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Facturen", href: "/portaal/facturen" },
          { label: invoice.invoice_number },
        ]}
        title={invoice.invoice_number}
        description={invoice.description ?? undefined}
        action={
          <StatusBadge map={INVOICE_STATUS} value={invoice.status as InvoiceStatus} />
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

            {outstanding ? (
              <CardBody className="border-t border-border">
                {invoice.external_payment_url ? (
                  <a
                    href={invoice.external_payment_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={buttonClass("primary", "md")}
                  >
                    <CreditCard className="h-4 w-4" />
                    Nu betalen
                    <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                  </a>
                ) : (
                  <div className="rounded-[var(--radius)] border border-dashed border-border bg-surface-muted/40 px-4 py-3">
                    <p className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      Online betalen
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Online betalen is voor deze factuur nog niet beschikbaar. U kunt het
                      bedrag overmaken op de rekening die op de factuur staat.
                    </p>
                  </div>
                )}
              </CardBody>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Factuur downloaden" />
            <DocumentList
              documents={documents}
              showVisibility={false}
              emptyTitle="Nog geen PDF beschikbaar"
              emptyDescription="Zodra wij de PDF toevoegen, kunt u die hier downloaden."
            />
          </Card>
        </div>

        <Card>
          <CardHeader title="Gegevens" />
          <CardBody>
            <DefinitionList
              className="sm:grid-cols-1"
              items={[
                { label: "Factuurnummer", value: invoice.invoice_number },
                { label: "Factuurdatum", value: formatDate(invoice.invoice_date) },
                {
                  label: "Vervaldatum",
                  value: (
                    <span className={late ? "font-medium text-danger" : undefined}>
                      {formatDate(invoice.due_date)}
                    </span>
                  ),
                },
                { label: "Project", value: project?.name ?? "—" },
                {
                  label: "Betaalstatus",
                  value: (
                    <StatusBadge
                      map={INVOICE_STATUS}
                      value={invoice.status as InvoiceStatus}
                    />
                  ),
                },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
