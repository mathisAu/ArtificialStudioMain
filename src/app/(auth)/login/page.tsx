import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Inloggen" };

const ERRORS: Record<string, string> = {
  "geen-organisatie":
    "Je account is nog niet aan een organisatie gekoppeld. Neem contact op met je projectmanager.",
  "geen-toegang": "Je hebt geen toegang tot deze pagina.",
  verlopen: "Je sessie is verlopen. Log opnieuw in.",
  "link-verlopen":
    "Deze link is verlopen of al gebruikt. Vraag een nieuwe aan via 'Wachtwoord vergeten', of vraag je projectmanager om een nieuwe uitnodiging.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verder?: string; fout?: string }>;
}) {
  const { verder, fout } = await searchParams;

  return (
    <LoginForm
      verder={verder?.startsWith("/") ? verder : undefined}
      initialError={fout ? ERRORS[fout] : undefined}
    />
  );
}
