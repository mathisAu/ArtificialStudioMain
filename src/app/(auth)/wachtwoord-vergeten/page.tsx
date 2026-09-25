"use client";

import Link from "next/link";
import { useActionState } from "react";

import { requestPasswordResetAction, type AuthFormState } from "../actions";
import { Field, FormError, FormSuccess, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/modal";

const INITIAL: AuthFormState = {};

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState(requestPasswordResetAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Wachtwoord vergeten</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Vul je e-mailadres in. Je ontvangt een link om een nieuw wachtwoord in te stellen.
        </p>
      </div>

      <FormError>{state.error}</FormError>
      <FormSuccess>{state.success}</FormSuccess>

      {!state.success ? (
        <>
          <Field label="E-mailadres" htmlFor="email" required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="naam@bedrijf.nl"
            />
          </Field>

          <SubmitButton className="w-full justify-center" pendingLabel="Versturen…">
            Link versturen
          </SubmitButton>
        </>
      ) : null}

      <p className="text-center text-[13px]">
        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Terug naar inloggen
        </Link>
      </p>
    </form>
  );
}
