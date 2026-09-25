import type { ReactNode } from "react";

import { signOutAction } from "../(auth)/actions";
import { stopPortalPreviewAction } from "./preview-actions";
import { AppShell } from "@/components/layout/app-shell";
import { CLIENT_NAV } from "@/components/layout/nav-config";
import { Button } from "@/components/ui/button";
import { requireClient } from "@/lib/auth";
import { readTheme } from "@/lib/theme-server";

/**
 * Het klantportaal heeft bewust een eenvoudigere schil dan de interne
 * omgeving (§22, §31).
 */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const [user, theme] = await Promise.all([requireClient(), readTheme()]);

  return (
    <AppShell
      nav={CLIENT_NAV}
      user={{
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        subtitle: user.companyName ?? undefined,
      }}
      accountHref="/portaal/account"
      theme={theme}
      signOut={signOutAction}
    >
      {user.preview ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-warning/40 bg-warning-soft px-4 py-2.5 text-[13px]">
          <span>
            <strong className="font-semibold">Voorbeeldweergave</strong> — je ziet het portaal
            zoals {user.companyName} het ziet. Wat je hier aanklikt of wijzigt, is echt.
          </span>
          <form action={stopPortalPreviewAction}>
            <Button type="submit" size="sm" variant="secondary">
              Voorbeeld sluiten
            </Button>
          </form>
        </div>
      ) : null}
      {children}
    </AppShell>
  );
}
