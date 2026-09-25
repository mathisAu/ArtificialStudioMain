import type { ReactNode } from "react";

import { SettingsNav } from "./settings-nav";
import { PageHeader } from "@/components/ui/misc";
import { requireInternal } from "@/lib/auth";

/**
 * Instellingen. De tabs met geheimen zijn alleen zichtbaar voor admins; de
 * pagina's daarachter controleren dat nog eens apart met `requireAdmin`.
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const user = await requireInternal();
  const isAdmin = user.role === "admin";

  return (
    <>
      <PageHeader
        title="Instellingen"
        description="Templates, integraties en je persoonlijke voorkeuren."
      />

      <SettingsNav
        items={[
          { href: "/instellingen/notificaties", label: "Mijn notificaties" },
          ...(isAdmin
            ? [
                { href: "/instellingen/templates", label: "Projecttemplates" },
                { href: "/instellingen/integraties", label: "Integraties" },
              ]
            : []),
        ]}
      />

      {children}
    </>
  );
}
