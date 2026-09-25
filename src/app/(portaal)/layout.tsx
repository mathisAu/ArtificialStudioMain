import type { ReactNode } from "react";

import { signOutAction } from "../(auth)/actions";
import { AppShell } from "@/components/layout/app-shell";
import { CLIENT_NAV } from "@/components/layout/nav-config";
import { getAuthUserId, requireClient } from "@/lib/auth";
import { countUnreadNotifications } from "@/lib/queries/notifications";
import { readTheme } from "@/lib/theme-server";

/**
 * Het klantportaal heeft bewust een eenvoudigere schil dan de interne
 * omgeving (§22, §31).
 */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  // Het id komt uit het JWT, dus de teller hoeft niet te wachten op het profiel.
  // Is er geen sessie, dan stuurt requireClient() je alsnog naar /login.
  const userId = await getAuthUserId();
  const [user, theme, unread] = await Promise.all([
    requireClient(),
    readTheme(),
    userId ? countUnreadNotifications(userId) : 0,
  ]);

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
      unreadNotifications={unread}
      theme={theme}
      signOut={signOutAction}
    >
      {children}
    </AppShell>
  );
}
