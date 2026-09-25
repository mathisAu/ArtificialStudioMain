"use client";

import { Plus, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { createCompanyAction, updateCompanyAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Modal, SubmitButton } from "@/components/ui/modal";
import { COMPANY_STATUS, options } from "@/lib/labels";
import { useActionForm } from "@/lib/use-action-form";
import type { Company, UserSummary } from "@/lib/types";

export function CompanyFormModal({
  company,
  managers,
  variant = "create",
}: {
  company?: Company;
  managers: UserSummary[];
  variant?: "create" | "edit";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEdit = variant === "edit";

  const { submit, pending, error } = useActionForm(
    isEdit ? updateCompanyAction : createCompanyAction,
    (result) => {
      toast.success(result.success ?? "Opgeslagen.");
      setOpen(false);
      if (!isEdit && result.id) router.push(`/klanten/${result.id}`);
      else router.refresh();
    },
  );

  return (
    <>
      {isEdit ? (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Bewerken
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Nieuwe klant
        </Button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? "Klant bewerken" : "Nieuwe klant"}
        description={
          isEdit
            ? "Pas de gegevens van deze organisatie aan."
            : "Leg een nieuwe klantorganisatie vast. Contactpersonen voeg je daarna toe."
        }
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} type="button">
              Annuleren
            </Button>
            <SubmitButton form="company-form" pending={pending} pendingLabel="Opslaan…">
              {isEdit ? "Wijzigingen opslaan" : "Klant aanmaken"}
            </SubmitButton>
          </>
        }
      >
        <form id="company-form" action={submit} className="space-y-4">
          {company ? <input type="hidden" name="id" value={company.id} /> : null}

          <FormError>{error}</FormError>

          <Field label="Bedrijfsnaam" htmlFor="name" required>
            <Input
              id="name"
              name="name"
              defaultValue={company?.name ?? ""}
              required
              minLength={2}
              placeholder="BVS Projecten"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="E-mailadres" htmlFor="email">
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={company?.email ?? ""}
                placeholder="info@bedrijf.nl"
              />
            </Field>
            <Field label="Telefoonnummer" htmlFor="phone">
              <Input id="phone" name="phone" defaultValue={company?.phone ?? ""} />
            </Field>
          </div>

          <Field label="Website" htmlFor="website">
            <Input
              id="website"
              name="website"
              defaultValue={company?.website ?? ""}
              placeholder="https://"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status" htmlFor="status">
              <Select
                id="status"
                name="status"
                defaultValue={company?.status ?? "active"}
              >
                {options(COMPANY_STATUS).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Interne verantwoordelijke"
              htmlFor="account_manager_id"
              hint="De projectmanager die deze klant beheert."
            >
              <Select
                id="account_manager_id"
                name="account_manager_id"
                defaultValue={company?.account_manager_id ?? ""}
              >
                <option value="">Niet toegewezen</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.full_name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <details className="rounded-[var(--radius)] border border-border bg-surface-muted/40 px-3.5 py-2.5">
            <summary className="cursor-pointer text-[13px] font-medium text-foreground">
              Adres en administratie
            </summary>
            <div className="mt-3 space-y-4">
              <Field label="Adres" htmlFor="address_line">
                <Input
                  id="address_line"
                  name="address_line"
                  defaultValue={company?.address_line ?? ""}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Postcode" htmlFor="postal_code">
                  <Input
                    id="postal_code"
                    name="postal_code"
                    defaultValue={company?.postal_code ?? ""}
                  />
                </Field>
                <Field label="Plaats" htmlFor="city">
                  <Input id="city" name="city" defaultValue={company?.city ?? ""} />
                </Field>
              </div>
              <Field label="Btw-nummer" htmlFor="vat_number">
                <Input
                  id="vat_number"
                  name="vat_number"
                  defaultValue={company?.vat_number ?? ""}
                />
              </Field>
            </div>
          </details>

          <Field
            label="Interne notitie"
            htmlFor="notes"
            hint="Niet zichtbaar voor de klant."
          >
            <Textarea id="notes" name="notes" defaultValue={company?.notes ?? ""} rows={3} />
          </Field>
        </form>
      </Modal>
    </>
  );
}
