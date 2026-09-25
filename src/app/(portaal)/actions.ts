"use server";

import { revalidatePath } from "next/cache";

import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// -----------------------------------------------------------------------------
// Actie afronden (§28)
// -----------------------------------------------------------------------------
export async function setActionStatusAction(actionId: string, status: string) {
  await requireClient();

  if (!["open", "in_progress", "done"].includes(status)) {
    return { error: "Onbekende status." };
  }

  const supabase = await createClient();

  // De trigger `guard_customer_action_client_update` zorgt ervoor dat een klant
  // uitsluitend de status kan wijzigen; alle andere kolommen zijn geblokkeerd.
  const { data, error } = await supabase
    .from("customer_actions")
    .update({ status })
    .eq("id", actionId)
    .select("id")
    .maybeSingle();

  if (error || !data) return { error: "Deze actie kon niet worden bijgewerkt." };

  revalidatePath("/portaal/acties");
  revalidatePath("/portaal");
  return { success: "Bijgewerkt." };
}
