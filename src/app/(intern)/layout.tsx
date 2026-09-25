import type { ReactNode } from "react";

import { signOutAction } from "../(auth)/actions";
import { AppShell } from "@/components/layout/app-shell";
import { INTERNAL_NAV, visibleNav } from "@/components/layout/nav-config";
import { getAuthUserId, requireInternal } from "@/lib/auth";
import { countUnreadNotifications } from "@/lib/queries/notifications";
import { readTheme } from "@/lib/theme-server";

export default async function InternalLayout({ children }: { children: ReactNode }) {
  // Het id komt uit het JWT, dus de teller hoeft niet te wachten op het profiel.
  // Is er geen sessie, dan stuurt requireInternal() je alsnog naar /login.
  const userId = await getAuthUserId();
  const [user, theme, unread] = await Promise.all([
    requireInternal(),
    readTheme(),
    userId ? countUnreadNotifications(userId) : 0,
  ]);

  return (
    <AppShell
      nav={visibleNav(INTERNAL_NAV, user.role)}
      user={{
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      }}
      accountHref="/account"
      unreadNotifications={unread}
      theme={theme}
      signOut={signOutAction}
    >
      {children}
    </AppShell>
  );
}
