"use client";

import { useActionState } from "react";

import { updatePasswordAction, type AuthFormState } from "../actions";
import { Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/modal";

const INITIAL: AuthFormState = {};

/**
 * Wordt gebruikt voor zowel 'wachtwoord resetten' als 'account activeren':
 * beide mails leiden via /auth/callback naar deze pagina, waar de gebruiker
 * een eigen wachtwoord kiest (§3).
 */
export default function ResetPasswordPage() {
  const [state, formAction] = useActionState(updatePasswordAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Nieuw wachtwoord instellen</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Kies een wachtwoord van minimaal 10 tekens.
        </p>
      </div>

      <FormError>{state.error}</FormError>

      <Field label="Nieuw wachtwoord" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </Field>

      <Field label="Herhaal wachtwoord" htmlFor="confirm" required>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </Field>

      <SubmitButton className="w-full justify-center" pendingLabel="Opslaan…">
        Wachtwoord opslaan
      </SubmitButton>
    </form>
  );
}
