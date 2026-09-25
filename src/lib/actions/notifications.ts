"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { text } from "@/lib/validation";

/**
 * Notificaties (§32). Dezelfde acties bedienen de interne omgeving en het
 * klantportaal; welke meldingen iemand ziet bepaalt RLS.
 *
 * De policy beperkt alles al tot `user_id = auth.uid()`, maar we filteren hier
 * ook expliciet op de eigen gebruiker: twee sloten op dezelfde deur.
 */

function revalidateBoth() {
  revalidatePath("/notificaties");
  revalidatePath("/portaal/notificaties");
  // De teller in de zijbalk hangt aan de layout van beide omgevingen.
  revalidatePath("/dashboard");
  revalidatePath("/portaal");
}

/**
 * Markeert één melding als gelezen. Wordt aangeroepen zodra iemand de melding
 * aanklikt; zonder dit bleef de teller op hetzelfde getal staan.
 */
export async function markNotificationReadById(id: string) {
  const user = await requireUser();
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidateBoth();
}

export async function markNotificationReadAction(formData: FormData) {
  const user = await requireUser();

  const id = text(formData.get("id"));
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidateBoth();
}

export async function markAllNotificationsReadAction() {
  const user = await requireUser();

  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("is_read", false);

  revalidateBoth();
}

export async function deleteNotificationAction(formData: FormData) {
  const user = await requireUser();

  const id = text(formData.get("id"));
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("notifications").delete().eq("id", id).eq("user_id", user.id);

  revalidateBoth();
}
