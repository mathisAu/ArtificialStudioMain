"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signInAction, type AuthFormState } from "../actions";
import { Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/modal";

const INITIAL: AuthFormState = {};

export function LoginForm({ verder, initialError }: { verder?: string; initialError?: string }) {
  const [state, formAction] = useActionState(signInAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Inloggen</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Log in met het account dat je van ons hebt ontvangen.
        </p>
      </div>

      <FormError>{state.error ?? initialError}</FormError>

      <input type="hidden" name="verder" value={verder ?? ""} />

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

      <Field label="Wachtwoord" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <SubmitButton className="w-full justify-center" pendingLabel="Inloggen…">
        Inloggen
      </SubmitButton>

      <p className="text-center text-[13px]">
        <Link
          href="/wachtwoord-vergeten"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Wachtwoord vergeten?
        </Link>
      </p>
    </form>
  );
}
