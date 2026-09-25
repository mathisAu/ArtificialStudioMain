"use client";

import { toast } from "sonner";

import { Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/modal";
import { updateOwnProfileAction } from "@/lib/actions/account";
import { useActionForm } from "@/lib/use-action-form";

/** Eigen naam, functie en telefoonnummer aanpassen (§3, §31). */
export function ProfileForm({
  fullName,
  jobTitle,
  phone,
}: {
  fullName: string;
  jobTitle: string | null;
  phone: string | null;
}) {
  const { submit, pending, error } = useActionForm(updateOwnProfileAction, (result) => {
    toast.success(result.success ?? "Gegevens opgeslagen.");
  });

  return (
    <form action={submit} className="space-y-4">
      <FormError>{error}</FormError>

      <Field label="Naam" htmlFor="account_name" required>
        <Input
          id="account_name"
          name="full_name"
          required
          minLength={2}
          autoComplete="name"
          defaultValue={fullName}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Functie" htmlFor="account_job">
          <Input
            id="account_job"
            name="job_title"
            autoComplete="organization-title"
            defaultValue={jobTitle ?? ""}
          />
        </Field>

        <Field label="Telefoonnummer" htmlFor="account_phone">
          <Input
            id="account_phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={phone ?? ""}
            placeholder="06 12 34 56 78"
          />
        </Field>
      </div>

      <SubmitButton pending={pending} pendingLabel="Opslaan…">
        Gegevens opslaan
      </SubmitButton>
    </form>
  );
}
