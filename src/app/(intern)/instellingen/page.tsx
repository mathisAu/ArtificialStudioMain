import { redirect } from "next/navigation";

/** Instellingen opent op de pagina die iedereen mag zien. */
export default function SettingsIndexPage() {
  redirect("/instellingen/notificaties");
}
