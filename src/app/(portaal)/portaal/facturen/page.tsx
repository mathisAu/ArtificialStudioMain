import { Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { requireClient } from "@/lib/auth";
import { INVOICE_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceStatus } from "@/lib/types";
import { cn, formatCurrency, formatDate, isOverdue } from "@/lib/utils";

export const metadata: Metadata = { title: "Facturen" };

/**
 * Facturen in het klantportaal (§29).
 *
 * Concepten blijven intern: de RLS-policy `invoices_select` filtert die er voor
 * klanten al uit.
 */
export default async function PortalInvoicesPage() {
  const user = await requireClient();
  const supabase = await createClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, invoice_date, due_date, total_amount, status, project:projects(name)",
    )
    .eq("company_id", user.companyId)
    // Concepten zijn intern; ze horen nooit in het portaal te verschijnen.
    .neq("status", "draft")
    .order("invoice_date", { ascending: false });

  const rows = invoices ?? [];
  const outstanding = rows.filter((i) => i.status === "open" || i.status === "overdue");
  const outstandingTotal = outstanding.reduce(
    (total, row) => total + Number(row.total_amount ?? 0),
    0,
  );

  return (
    <>
      <PageHeader title="Facturen" description="Al uw facturen op één plek." />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Openstaand bedrag"
          value={formatCurrency(outstandingTotal)}
          hint={`${outstanding.length} ${outstanding.length === 1 ? "factuur" : "facturen"}`}
          tone={outstanding.length ? "warning" : "neutral"}
        />
        <StatCard
          label="Verlopen"
          value={rows.filter((i) => i.status === "overdue").length}
          tone={rows.some((i) => i.status === "overdue") ? "danger" : "neutral"}
        />
        <StatCard label="Totaal aantal facturen" value={rows.length} />
      </section>

      <Card>
        <CardHeader title="Overzicht" />
        {rows.length === 0 ? (
          <EmptyState
            title="Nog geen facturen"
            description="Zodra wij factureren, vindt u de factuur hier terug."
            icon={<Receipt className="h-5 w-5" />}
          />
        ) : (
          <TableWrap className="border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Factuurnummer</Th>
                  <Th>Datum</Th>
                  <Th>Project</Th>
                  <Th className="text-right">Bedrag</Th>
                  <Th>Vervaldatum</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((invoice) => {
                  const project = Array.isArray(invoice.project)
                    ? invoice.project[0]
                    : invoice.project;
                  const late =
                    invoice.status === "overdue" ||
                    (invoice.status === "open" && isOverdue(invoice.due_date));

                  return (
                    <Tr key={invoice.id}>
                      <Td>
                        <Link
                          href={`/portaal/facturen/${invoice.id}`}
                          className="font-medium tabular-nums text-foreground hover:text-accent"
                        >
                          {invoice.invoice_number}
                        </Link>
                      </Td>
                      <Td className="tabular-nums text-muted-foreground">
                        {formatDate(invoice.invoice_date)}
                      </Td>
                      <Td className="text-muted-foreground">
                        {(project as { name?: string } | null)?.name ?? "—"}
                      </Td>
                      <Td className="text-right font-medium tabular-nums">
                        {formatCurrency(Number(invoice.total_amount))}
                      </Td>
                      <Td className={cn("tabular-nums", late && "font-medium text-danger")}>
                        {formatDate(invoice.due_date)}
                      </Td>
                      <Td>
                        <StatusBadge
                          map={INVOICE_STATUS}
                          value={invoice.status as InvoiceStatus}
                        />
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
