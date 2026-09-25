"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getSiteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export interface AuthFormState {
  error?: string;
  success?: string;
}

const loginSchema = z.object({
  email: z.string().email("Vul een geldig e-mailadres in."),
  password: z.string().min(1, "Vul je wachtwoord in."),
});

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Controleer je gegevens." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Bewust één generieke melding: geen informatie prijsgeven over de vraag
    // of een e-mailadres wel of niet bestaat.
    return { error: "E-mailadres of wachtwoord is onjuist." };
  }

  const verder = String(formData.get("verder") ?? "");
  redirect(verder.startsWith("/") ? verder : "/");
}

export async function requestPasswordResetAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!z.string().email().safeParse(email).success) {
    return { error: "Vul een geldig e-mailadres in." };
  }

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/wachtwoord-resetten`,
  });

  // Altijd dezelfde bevestiging, ongeacht of het account bestaat.
  return {
    success:
      "Als dit e-mailadres bij ons bekend is, ontvang je binnen enkele minuten een link om je wachtwoord opnieuw in te stellen.",
  };
}

const passwordSchema = z
  .object({
    password: z.string().min(10, "Gebruik minimaal 10 tekens."),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "De twee wachtwoorden komen niet overeen.",
    path: ["confirm"],
  });

export async function updatePasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = passwordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Controleer je invoer." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "De link is verlopen of al gebruikt. Vraag een nieuwe link aan via 'Wachtwoord vergeten'.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: "Het wachtwoord kon niet worden opgeslagen. Probeer het opnieuw." };
  }

  redirect("/");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
