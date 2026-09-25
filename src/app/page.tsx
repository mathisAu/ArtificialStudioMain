import { redirect } from "next/navigation";

import { getSessionUser, homePathForRole } from "@/lib/auth";

/**
 * Na het inloggen bepaalt de rol automatisch naar welke omgeving de gebruiker
 * gaat: interne gebruikers naar het dashboard, klanten naar hun eigen
 * klantportaal (§3).
 */
export default async function RootPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(homePathForRole(user.role));
}
