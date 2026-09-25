import { Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { InvoiceFormModal } from "./invoice-form-modal";
import { ListToolbar } from "@/components/domain/list-toolbar";
import { StatusBadge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/card";
import { CardsSkeleton, EmptyState, PageHeader, TableSkeleton } from "@/components/ui/misc";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { requireManager } from "@/lib/auth";
import { INVOICE_STATUS, options } from "@/lib/labels";
import { getCompanyOptions, getProjectOptions } from "@/lib/queries/lookups";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceStatus } from "@/lib/types";
import { cn, formatCurrency, formatDate, isOverdue } from "@/lib/utils";

export const metadata: Metadata = { title: "Facturen" };

interface Filters {
  q?: string;
  status?: string;
  klant?: string;
  project?: string;
}

/** Centraal factuuroverzicht (§20). Alleen voor admin en projectmanager. */
export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  await requireManager();
  const params = await searchParams;

  const [companies, projects] = await Promise.all([
    getCompanyOptions(),
    getProjectOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Facturen"
        description="Alle facturen, per klant en project."
        action={
          <InvoiceFormModal
            companies={companies}
            projects={projects.map((p) => ({
              id: p.id,
              name: p.name,
              company_id: p.company_id,
            }))}
          />
        }
      />

      <Suspense fallback={<CardsSkeleton />}>
        <InvoiceKpis />
      </Suspense>

      <ListToolbar
        searchPlaceholder="Zoek op factuurnummer…"
        filters={[
          { name: "status", label: "Status", options: options(INVOICE_STATUS) },
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
        ]}
      />

      <Suspense key={JSON.stringify(params)} fallback={<TableSkeleton cols={7} />}>
        <InvoiceTable params={params} />
      </Suspense>
    </>
  );
}

/** KPI's bovenaan het overzicht (§20). */
async function InvoiceKpis() {
  const supabase = await createClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const monthStart = startOfMonth.toISOString().slice(0, 10);

  const [{ data: openRows }, { data: monthRows }] = await Promise.all([
    supabase.from("invoices").select("total_amount, status").in("status", ["open", "overdue"]),
    supabase
      .from("invoices")
      .select("total_amount, status, invoice_date, paid_at")
      .gte("invoice_date", monthStart),
  ]);

  const sum = (rows: { total_amount: number }[]) =>
    rows.reduce((total, row) => total + Number(row.total_amount ?? 0), 0);

  const open = (openRows ?? []).filter((r) => r.status === "open");
  const overdue = (openRows ?? []).filter((r) => r.status === "overdue");
  const invoicedThisMonth = (monthRows ?? []).filter((r) => r.status !== "draft");
  const paidThisMonth = (monthRows ?? []).filter((r) => r.status === "paid");

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Totaal openstaand"
        value={formatCurrency(sum(open))}
        hint={`${open.length} ${open.length === 1 ? "factuur" : "facturen"}`}
        tone={open.length ? "warning" : "neutral"}
        href="/facturen?status=open"
      />
      <StatCard
        label="Totaal verlopen"
        value={formatCurrency(sum(overdue))}
        hint={`${overdue.length} ${overdue.length === 1 ? "factuur" : "facturen"}`}
        tone={overdue.length ? "danger" : "neutral"}
        href="/facturen?status=overdue"
      />
      <StatCard
        label="Deze maand gefactureerd"
        value={formatCurrency(sum(invoicedThisMonth))}
      />
      <StatCard
        label="Deze maand betaald"
        value={formatCurrency(sum(paidThisMonth))}
        tone="success"
      />
    </section>
  );
}

async function InvoiceTable({ params }: { params: Filters }) {
  const supabase = await createClient();

  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, invoice_date, due_date, total_amount, status, company:companies(id, name), project:projects(id, name)",
    )
    .order("invoice_date", { ascending: false });

  if (params.q) query = query.ilike("invoice_number", `%${params.q}%`);
  if (params.status) query = query.eq("status", params.status);
  if (params.klant) query = query.eq("company_id", params.klant);
  if (params.project) query = query.eq("project_id", params.project);

  const { data, error } = await query;

  if (error) {
    return <EmptyState title="Facturen konden niet worden geladen" description={error.message} />;
  }

  const rows = data ?? [];

  if (rows.length === 0) {
    return (
      <TableWrap>
        <EmptyState
          title="Geen facturen gevonden"
          description="Pas je filters aan, of maak een nieuwe factuur aan."
          icon={<Receipt className="h-5 w-5" />}
        />
      </TableWrap>
    );
  }

  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Factuurnummer</Th>
            <Th>Klant</Th>
            <Th>Project</Th>
            <Th>Factuurdatum</Th>
            <Th>Vervaldatum</Th>
            <Th className="text-right">Bedrag</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((invoice) => {
            const company = Array.isArray(invoice.company)
              ? invoice.company[0]
              : invoice.company;
            const project = Array.isArray(invoice.project)
              ? invoice.project[0]
              : invoice.project;
            const late = invoice.status === "overdue" || (
              invoice.status === "open" && isOverdue(invoice.due_date)
            );

            return (
              <Tr key={invoice.id}>
                <Td>
                  <Link
                    href={`/facturen/${invoice.id}`}
                    className="font-medium tabular-nums text-foreground hover:text-accent"
                  >
                    {invoice.invoice_number}
                  </Link>
                </Td>
                <Td className="text-muted-foreground">
                  {(company as { name?: string } | null)?.name ?? "—"}
                </Td>
                <Td className="text-muted-foreground">
                  {(project as { name?: string } | null)?.name ?? "—"}
                </Td>
                <Td className="tabular-nums text-muted-foreground">
                  {formatDate(invoice.invoice_date)}
                </Td>
                <Td className={cn("tabular-nums", late && "font-medium text-danger")}>
                  {formatDate(invoice.due_date)}
                </Td>
                <Td className="text-right font-medium tabular-nums">
                  {formatCurrency(Number(invoice.total_amount))}
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
  );
}
