"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstIssue, optionalText, text } from "@/lib/validation";

export interface AccountState {
  error?: string;
  success?: string;
}

/**
 * Eigen profiel bijwerken (§3). Dezelfde actie voor het team en voor klanten.
 *
 * Rol, e-mailadres en actief-status staan hier bewust niet bij. De trigger
 * `guard_user_self_update` blokkeert ze ook in de database, mocht er ooit langs
 * een andere weg een poging worden gedaan.
 */
const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Vul een naam in."),
  job_title: optionalText,
  phone: optionalText,
});

export async function updateOwnProfileAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    full_name: text(formData.get("full_name")),
    job_title: text(formData.get("job_title")),
    phone: text(formData.get("phone")),
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("users").update(parsed.data).eq("id", user.id);

  if (error) return { error: "De gegevens konden niet worden opgeslagen." };

  // De naam staat ook in de zijbalk, die in de layout van beide omgevingen zit.
  for (const path of ["/account", "/portaal/account", "/dashboard", "/portaal", "/team"]) {
    revalidatePath(path);
  }
  return { success: "Gegevens opgeslagen." };
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

/**
 * Wachtwoord wijzigen terwijl je ingelogd bent.
 *
 * Tot nu toe kon dat alleen via een resetmail. Dat werkt pas als de
 * mailinstellingen en redirect-URL's van het Supabase-project kloppen; wie al
 * ingelogd is, heeft die omweg niet nodig.
 */
export async function changePasswordAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  await requireUser();

  const parsed = passwordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    switch (error.code) {
      case "same_password":
        return { error: "Kies een ander wachtwoord dan het huidige." };
      case "weak_password":
        return { error: "Dit wachtwoord is te zwak. Kies een langer of minder voorspelbaar wachtwoord." };
      case "reauthentication_needed":
        return {
          error: "Om veiligheidsredenen moet dit via 'Wachtwoord vergeten' op de inlogpagina.",
        };
      default:
        return { error: "Het wachtwoord kon niet worden gewijzigd. Probeer het opnieuw." };
    }
  }

  return { success: "Wachtwoord gewijzigd." };
}
