"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { createContactAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input } from "@/components/ui/field";
import { Modal, SubmitButton } from "@/components/ui/modal";
import { useActionForm } from "@/lib/use-action-form";

export function ContactFormModal({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { submit, pending, error } = useActionForm(createContactAction, (result) => {
    toast.success(result.success ?? "Opgeslagen.");
    setOpen(false);
    router.refresh();
  });

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Contactpersoon
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Contactpersoon toevoegen"
        description="Een organisatie kan meerdere contactpersonen hebben."
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <SubmitButton form="contact-form" pending={pending} pendingLabel="Opslaan…">
              Toevoegen
            </SubmitButton>
          </>
        }
      >
        <form id="contact-form" action={submit} className="space-y-4">
          <input type="hidden" name="company_id" value={companyId} />
          <FormError>{error}</FormError>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Voornaam" htmlFor="first_name" required>
              <Input id="first_name" name="first_name" required />
            </Field>
            <Field label="Achternaam" htmlFor="last_name" required>
              <Input id="last_name" name="last_name" required />
            </Field>
          </div>

          <Field label="E-mailadres" htmlFor="contact_email">
            <Input id="contact_email" name="email" type="email" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telefoonnummer" htmlFor="contact_phone">
              <Input id="contact_phone" name="phone" />
            </Field>
            <Field label="Functie" htmlFor="job_title">
              <Input id="job_title" name="job_title" placeholder="Directeur" />
            </Field>
          </div>

          <Checkbox
            name="is_primary"
            label="Hoofdcontactpersoon"
            description="Deze persoon wordt standaard getoond in overzichten."
          />
        </form>
      </Modal>
    </>
  );
}
