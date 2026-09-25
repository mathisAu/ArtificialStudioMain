"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { createInvoiceAction, updateInvoiceAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Modal, SubmitButton } from "@/components/ui/modal";
import { INVOICE_STATUS, options } from "@/lib/labels";
import type { CompanySummary, Invoice } from "@/lib/types";
import { useActionForm } from "@/lib/use-action-form";
import { parseAmount } from "@/lib/validation";
import { formatCurrency, inDaysIso, toDateInput, todayIso } from "@/lib/utils";

/** Standaard btw-tarief; het bedrag blijft handmatig aanpasbaar. */
const VAT_RATE = 0.21;

export function InvoiceFormModal({
  companies,
  projects,
  invoice,
  defaultCompanyId,
  defaultProjectId,
}: {
  companies: CompanySummary[];
  projects: { id: string; name: string; company_id: string }[];
  invoice?: Invoice;
  defaultCompanyId?: string;
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(invoice);

  const [companyId, setCompanyId] = useState(
    invoice?.company_id ?? defaultCompanyId ?? "",
  );
  const [excl, setExcl] = useState(String(invoice?.amount_excl_vat ?? ""));
  const [vat, setVat] = useState(String(invoice?.vat_amount ?? ""));
  // Eén keer berekend bij het monteren, zodat de standaard vervaldatum niet
  // verschuift wanneer het formulier opnieuw rendert.
  const [defaultDueDate] = useState(() => inDaysIso(30));

  const { submit, pending, error } = useActionForm(
    isEdit ? updateInvoiceAction : createInvoiceAction,
    (result) => {
      toast.success(result.success ?? "Opgeslagen.");
      setOpen(false);
      if (!isEdit && result.id) router.push(`/facturen/${result.id}`);
      else router.refresh();
    },
  );

  // Dezelfde interpretatie als de server, zodat het getoonde totaal klopt bij
  // "1.500,00" én bij "1500.00".
  const exclNumber = parseAmount(excl) || 0;
  const vatNumber = parseAmount(vat) || 0;

  const relevantProjects = projects.filter((p) => !companyId || p.company_id === companyId);

  return (
    <>
      <Button
        size={isEdit ? "sm" : "md"}
        variant={isEdit ? "secondary" : "primary"}
        onClick={() => setOpen(true)}
      >
        {isEdit ? "Bewerken" : <><Plus className="h-4 w-4" />Nieuwe factuur</>}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? "Factuur bewerken" : "Nieuwe factuur"}
        description={
          isEdit
            ? undefined
            : "Het factuurnummer wordt automatisch toegekend. Na het aanmaken open je meteen de factuur om de PDF toe te voegen."
        }
        size="lg"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <SubmitButton form="invoice-form" pending={pending} pendingLabel="Opslaan…">
              {isEdit ? "Wijzigingen opslaan" : "Factuur aanmaken"}
            </SubmitButton>
          </>
        }
      >
        <form id="invoice-form" action={submit} className="space-y-4">
          {invoice ? <input type="hidden" name="id" value={invoice.id} /> : null}

          <FormError>{error}</FormError>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Klant" htmlFor="inv_company" required>
              <Select
                id="inv_company"
                name="company_id"
                required
                value={companyId}
                onChange={(event) => setCompanyId(event.target.value)}
              >
                <option value="">Kies een klant…</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Project" htmlFor="inv_project" hint="Optioneel.">
              <Select
                id="inv_project"
                name="project_id"
                defaultValue={invoice?.project_id ?? defaultProjectId ?? ""}
              >
                <option value="">Geen project</option>
                {relevantProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Omschrijving" htmlFor="inv_description">
            <Textarea
              id="inv_description"
              name="description"
              rows={2}
              defaultValue={invoice?.description ?? ""}
              placeholder="Ontwikkeling klantportaal, sprint 3"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Factuurdatum" htmlFor="inv_date" required>
              <Input
                id="inv_date"
                name="invoice_date"
                type="date"
                required
                defaultValue={toDateInput(invoice?.invoice_date) || todayIso()}
              />
            </Field>
            <Field label="Vervaldatum" htmlFor="inv_due" required>
              <Input
                id="inv_due"
                name="due_date"
                type="date"
                required
                defaultValue={toDateInput(invoice?.due_date) || defaultDueDate}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Bedrag excl. btw" htmlFor="inv_excl" required>
              <Input
                id="inv_excl"
                name="amount_excl_vat"
                inputMode="decimal"
                required
                value={excl}
                onChange={(event) => {
                  setExcl(event.target.value);
                  // Btw automatisch meerekenen. Met een komma als decimaalteken,
                  // zoals de rest van het formulier: "315.00" las eerder als
                  // een duizendtal en werd zo € 31.500.
                  const parsed = parseAmount(event.target.value);
                  if (Number.isFinite(parsed)) {
                    setVat((parsed * VAT_RATE).toFixed(2).replace(".", ","));
                  }
                }}
                placeholder="1500,00"
              />
            </Field>

            <Field label="Btw" htmlFor="inv_vat">
              <Input
                id="inv_vat"
                name="vat_amount"
                inputMode="decimal"
                value={vat}
                onChange={(event) => setVat(event.target.value)}
                placeholder="315,00"
              />
            </Field>

            <Field label="Totaal">
              <div className="flex h-9 items-center rounded-[var(--radius)] border border-border bg-surface-muted px-3 text-sm font-medium tabular-nums">
                {formatCurrency(exclNumber + vatNumber)}
              </div>
            </Field>
          </div>

          <Field label="Status" htmlFor="inv_status">
            <Select id="inv_status" name="status" defaultValue={invoice?.status ?? "draft"}>
              {options(INVOICE_STATUS).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <details className="rounded-[var(--radius)] border border-border bg-surface-muted/40 px-3.5 py-2.5">
            <summary className="cursor-pointer text-[13px] font-medium text-foreground">
              Koppelingen
            </summary>
            <div className="mt-3 space-y-4">
              <Field
                label="Externe factuur-ID"
                htmlFor="inv_external_id"
                hint="Het nummer in je boekhoudpakket."
              >
                <Input
                  id="inv_external_id"
                  name="external_invoice_id"
                  defaultValue={invoice?.external_invoice_id ?? ""}
                />
              </Field>
              <Field
                label="Betaallink"
                htmlFor="inv_payment_url"
                hint="Vul je hier een link in, dan verschijnt 'Nu betalen' in het klantportaal."
              >
                <Input
                  id="inv_payment_url"
                  name="external_payment_url"
                  type="url"
                  placeholder="https://"
                  defaultValue={invoice?.external_payment_url ?? ""}
                />
              </Field>
            </div>
          </details>
        </form>
      </Modal>
    </>
  );
}
