"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PORTAL_PREVIEW_COOKIE, requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Opent het klantportaal van één klant als voorbeeld (alleen admin en projectmanager). */
export async function startPortalPreviewAction(formData: FormData) {
  await requireManager();

  const companyId = String(formData.get("company_id") ?? "");
  if (!companyId) return;

  // Alleen een klant die deze gebruiker echt kan zien (RLS), nooit een verzonnen id.
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .maybeSingle();
  if (!data) return;

  (await cookies()).set(PORTAL_PREVIEW_COOKIE, data.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4,
  });

  redirect("/portaal");
}

/** Sluit het voorbeeld en gaat terug naar de klantenlijst. */
export async function stopPortalPreviewAction() {
  (await cookies()).delete(PORTAL_PREVIEW_COOKIE);
  redirect("/klantportaal");
}
