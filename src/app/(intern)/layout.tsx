import type { ReactNode } from "react";

import { signOutAction } from "../(auth)/actions";
import { AppShell } from "@/components/layout/app-shell";
import { INTERNAL_NAV, visibleNav } from "@/components/layout/nav-config";
import { requireInternal } from "@/lib/auth";
import { readTheme } from "@/lib/theme-server";

export default async function InternalLayout({ children }: { children: ReactNode }) {
  const [user, theme] = await Promise.all([requireInternal(), readTheme()]);

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
      theme={theme}
      signOut={signOutAction}
    >
      {children}
    </AppShell>
  );
}
