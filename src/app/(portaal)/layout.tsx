import type { ReactNode } from "react";

import { signOutAction } from "../(auth)/actions";
import { AppShell } from "@/components/layout/app-shell";
import { CLIENT_NAV } from "@/components/layout/nav-config";
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
      {children}
    </AppShell>
  );
}
