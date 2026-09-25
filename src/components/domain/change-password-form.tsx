"use client";

import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/modal";
import { changePasswordAction } from "@/lib/actions/account";
import { useActionForm } from "@/lib/use-action-form";

/**
 * Nieuw wachtwoord kiezen vanaf de accountpagina, zonder resetmail.
 *
 * React zet een formulier na een geslaagde action vanzelf terug, dus de velden
 * zijn na het opslaan weer leeg.
 */
export function ChangePasswordForm() {
  const { submit, pending, error } = useActionForm(changePasswordAction, (result) => {
    toast.success(result.success ?? "Wachtwoord gewijzigd.");
  });

  return (
    <form action={submit} className="space-y-4">
      <FormError>{error}</FormError>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nieuw wachtwoord" htmlFor="account_password" required>
          <Input
            id="account_password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
          />
        </Field>

        <Field label="Herhaal wachtwoord" htmlFor="account_password_confirm" required>
          <Input
            id="account_password_confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
          />
        </Field>
      </div>

      <p className="text-xs text-muted-foreground">Minimaal 10 tekens.</p>

      <SubmitButton variant="secondary" pending={pending} pendingLabel="Opslaan…">
        <KeyRound className="h-3.5 w-3.5" />
        Wachtwoord wijzigen
      </SubmitButton>
    </form>
  );
}
