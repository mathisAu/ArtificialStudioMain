import { NextResponse } from "next/server";

import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIso } from "@/lib/utils";

/**
 * Facturen exporteren als CSV voor de boekhouding (§27).
 *
 * Provider-neutraal: semicolon als scheidingsteken en een komma als decimaal,
 * zodat het bestand in een Nederlandse Excel en in de meeste boekhoudpakketten
 * meteen goed wordt ingelezen.
 */

const HEADERS = [
  "factuurnummer",
  "factuurdatum",
  "vervaldatum",
  "klant",
  "project",
  "omschrijving",
  "bedrag_excl_btw",
  "btw",
  "totaal",
  "status",
  "betaald_op",
  "externe_factuur_id",
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // Velden met een scheidingsteken, aanhalingsteken of regeleinde moeten
  // tussen dubbele aanhalingstekens, waarbij die zelf verdubbeld worden.
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvAmount(value: number | string | null): string {
  if (value === null) return "";
  return Number(value).toFixed(2).replace(".", ",");
}

export async function GET() {
  // Alleen admin en projectmanager mogen financiële gegevens zien (§2).
  await requireManager();

  const supabase = await createClient();
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(
      `invoice_number, invoice_date, due_date, description, amount_excl_vat,
       vat_amount, total_amount, status, paid_at, external_invoice_id,
       company:companies(name), project:projects(name)`,
    )
    .order("invoice_date", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "De export kon niet worden gemaakt." },
      { status: 500 },
    );
  }

  /** PostgREST levert een embedded relatie soms als object, soms als array. */
  const naam = (value: unknown): string => {
    const row = Array.isArray(value) ? value[0] : value;
    return (row as { name?: string } | null)?.name ?? "";
  };

  const rows = (invoices ?? []).map((invoice) =>
    [
      invoice.invoice_number,
      invoice.invoice_date,
      invoice.due_date,
      naam(invoice.company),
      naam(invoice.project),
      invoice.description ?? "",
      csvAmount(invoice.amount_excl_vat),
      csvAmount(invoice.vat_amount),
      csvAmount(invoice.total_amount),
      invoice.status,
      invoice.paid_at ? String(invoice.paid_at).slice(0, 10) : "",
      invoice.external_invoice_id ?? "",
    ]
      .map(csvCell)
      .join(";"),
  );

  // BOM zodat Excel het bestand als UTF-8 opent en accenten goed toont.
  const csv = "﻿" + [HEADERS.join(";"), ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="facturen-${todayIso()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
